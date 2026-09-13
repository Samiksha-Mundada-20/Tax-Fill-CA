import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import {
  CalculateTaxBody,
  CalculateTaxResponse,
  CreateDocumentBody,
  CreateDocumentResponse,
  DeleteDocumentParams,
  GenerateItrDraftBody,
  GenerateItrDraftResponse,
  GetConsentResponse,
  GetDashboardResponse,
  ListDocumentsResponse,
  ListItrFilingsResponse,
  UpdateConsentBody,
  UpdateConsentResponse,
  UpdateDocumentBody,
  UpdateDocumentParams,
} from "@workspace/api-zod";
import {
  consentTable,
  db,
  documentsTable,
  itrFilingsTable,
} from "@workspace/db";
import { calculateTax } from "../lib/tax";

const router: IRouter = Router();

const emptyExtracted = {
  employer: "",
  grossSalary: 0,
  tdsDeducted: 0,
  pan: "",
  assessmentYear: "2026-27",
  confidenceNote: "Add extracted values after reviewing the uploaded document.",
};

function formatDocument(document: typeof documentsTable.$inferSelect) {
  return {
    ...document,
    uploadedAt: document.uploadedAt.toISOString(),
  };
}

async function getDocuments() {
  const documents = await db
    .select()
    .from(documentsTable)
    .orderBy(desc(documentsTable.uploadedAt));
  return documents.map(formatDocument);
}

function summaryFromDocuments(documents: Awaited<ReturnType<typeof getDocuments>>) {
  const form16 = documents.find((document) => document.documentType === "form16");
  return calculateTax({
    grossSalary: form16?.extracted.grossSalary ?? 0,
    otherIncome: 0,
    deductions80c: 0,
    deductions80d: 0,
    deductions80g: 0,
    homeLoanInterest: 0,
    hraReceived: 0,
    rentPaid: 0,
    basicSalary: 0,
    isMetro: false,
    age: 0,
  });
}

router.get("/dashboard", async (_req, res): Promise<void> => {
  const documents = await getDocuments();
  const form16 = documents.find((document) => document.documentType === "form16");
  const summary = summaryFromDocuments(documents);
  const data = {
    user: {
      name: "Your workspace",
      panMasked: "Not added",
      filingType: form16 ? "Review required · ITR-1" : "Not set",
    },
    assessmentYear: form16?.extracted.assessmentYear || "2026-27",
    documents,
    tax: summary,
    checklist: [
      { id: "documents", label: "Review your documents", state: documents.length ? "complete" : "current" },
      { id: "tax", label: "Compare your tax regimes", state: documents.length ? "current" : "upcoming" },
      { id: "itr", label: "Generate your ITR-1 draft", state: "upcoming" },
      { id: "file", label: "Upload and e-verify on the portal", state: "upcoming" },
    ],
  };
  res.json(GetDashboardResponse.parse(data));
});

router.get("/documents", async (_req, res): Promise<void> => {
  res.json(ListDocumentsResponse.parse(await getDocuments()));
});

router.post("/documents", async (req, res): Promise<void> => {
  const parsed = CreateDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [document] = await db
    .insert(documentsTable)
    .values({
      fileName: parsed.data.fileName,
      documentType: parsed.data.documentType,
      status: "review",
      confidence: parsed.data.extracted ? 0.94 : 0,
      extracted: {
        ...emptyExtracted,
        ...parsed.data.extracted,
        confidenceNote:
          parsed.data.extracted?.confidenceNote ??
          "Document added. Review and enter the extracted values before calculating tax.",
      },
    })
    .returning();
  res.status(201).json(CreateDocumentResponse.parse(formatDocument(document)));
});

router.patch("/documents/:documentId", async (req, res): Promise<void> => {
  const params = UpdateDocumentParams.safeParse(req.params);
  const parsed = UpdateDocumentBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: { status?: string; extracted?: typeof emptyExtracted } = {};
  if (parsed.data.status !== undefined) {
    updateData.status = parsed.data.status;
  }
  if (parsed.data.extracted) {
    updateData.extracted = {
      employer: parsed.data.extracted.employer,
      grossSalary: parsed.data.extracted.grossSalary,
      tdsDeducted: parsed.data.extracted.tdsDeducted,
      pan: parsed.data.extracted.pan,
      assessmentYear: parsed.data.extracted.assessmentYear,
      confidenceNote: parsed.data.extracted.confidenceNote ?? "",
    };
  }
  const [document] = await db
    .update(documentsTable)
    .set(updateData)
    .where(eq(documentsTable.id, params.data.documentId))
    .returning();
  if (!document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.json(formatDocument(document));
});

router.delete("/documents/:documentId", async (req, res): Promise<void> => {
  const parsed = DeleteDocumentParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [deleted] = await db
    .delete(documentsTable)
    .where(eq(documentsTable.id, parsed.data.documentId))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/tax/calculate", async (req, res): Promise<void> => {
  const parsed = CalculateTaxBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  res.json(CalculateTaxResponse.parse(calculateTax(parsed.data)));
});

router.post("/itr/generate", async (req, res): Promise<void> => {
  const parsed = GenerateItrDraftBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const warnings = [
    "Draft uses the Tax Sathi MVP mapping. Confirm fields against the latest CBDT offline utility before filing.",
    "Bank account and pre-filled AIS/26AS reconciliation are not included in this draft.",
  ];
  const payload = {
    ITR: {
      FormName: "ITR-1",
      AssessmentYear: "2026-27",
      PersonalInfo: { PAN: parsed.data.pan, AssesseeName: parsed.data.name },
      Income: { Salary: parsed.data.grossSalary },
      TaxPaid: { TDS: parsed.data.tdsDeducted },
      Regime: parsed.data.regime,
    },
  };
  const [filing] = await db
    .insert(itrFilingsTable)
    .values({
      form: "ITR-1",
      assessmentYear: "2026-27",
      status: "needs_review",
      warnings,
      payload,
    })
    .returning();
  res.status(201).json(
    GenerateItrDraftResponse.parse({
      ...filing,
      generatedAt: filing.generatedAt.toISOString(),
    }),
  );
});

router.get("/itr/filings", async (_req, res): Promise<void> => {
  const filings = await db
    .select()
    .from(itrFilingsTable)
    .orderBy(desc(itrFilingsTable.generatedAt));
  res.json(
    ListItrFilingsResponse.parse(
      filings.map((filing) => ({
        ...filing,
        generatedAt: filing.generatedAt.toISOString(),
      })),
    ),
  );
});

router.get("/compliance/consent", async (_req, res): Promise<void> => {
  let [consent] = await db.select().from(consentTable).where(eq(consentTable.id, 1));
  if (!consent) {
    [consent] = await db.insert(consentTable).values({ id: 1 }).returning();
  }
  res.json(GetConsentResponse.parse({ ...consent, updatedAt: consent.updatedAt.toISOString() }));
});

router.post("/compliance/consent", async (req, res): Promise<void> => {
  const parsed = UpdateConsentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [consent] = await db
    .insert(consentTable)
    .values({ id: 1, ...parsed.data, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: consentTable.id,
      set: { ...parsed.data, updatedAt: new Date() },
    })
    .returning();
  res.json(UpdateConsentResponse.parse({ ...consent, updatedAt: consent.updatedAt.toISOString() }));
});

export default router;