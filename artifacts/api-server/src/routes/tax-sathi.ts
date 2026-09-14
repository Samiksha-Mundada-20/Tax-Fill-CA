import { Router, type IRouter } from "express";
import { asc, desc, eq } from "drizzle-orm";
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
  clientsTable,
  tasksTable,
} from "@workspace/db";
import { calculateTax } from "../lib/tax";
import { extractWithMistral } from "../lib/mistral-ocr";

const router: IRouter = Router();

type ParseResult<T> = { success: true; data: T } | { success: false; error: { message: string } };
type ClientInput = { name: string; panMasked?: string; email?: string; service: string; nextDeadline?: string };
type TaskInput = { clientId?: string; title: string; category: string; dueDate: string; priority: "normal" | "high" | "urgent"; assignee: string };

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseClientInput(body: unknown): ParseResult<ClientInput> {
  const input = body as Record<string, unknown> | null;
  const name = stringValue(input?.name);
  const service = stringValue(input?.service) || "ITR filing";
  if (!name || !service) return { success: false, error: { message: "Client name and service are required." } };
  return {
    success: true,
    data: {
      name,
      panMasked: stringValue(input?.panMasked) || undefined,
      email: stringValue(input?.email) || undefined,
      service,
      nextDeadline: stringValue(input?.nextDeadline) || undefined,
    },
  };
}

function parseTaskInput(body: unknown): ParseResult<TaskInput> {
  const input = body as Record<string, unknown> | null;
  const title = stringValue(input?.title);
  const dueDate = stringValue(input?.dueDate);
  const priority = stringValue(input?.priority) as TaskInput["priority"];
  if (!title || !dueDate) return { success: false, error: { message: "Task title and due date are required." } };
  if (priority && !["normal", "high", "urgent"].includes(priority)) return { success: false, error: { message: "Invalid task priority." } };
  const clientId = stringValue(input?.clientId);
  if (clientId && !/^[0-9a-f-]{36}$/i.test(clientId)) return { success: false, error: { message: "Invalid client." } };
  return {
    success: true,
    data: {
      clientId: clientId || undefined,
      title,
      category: stringValue(input?.category) || "document_collection",
      dueDate,
      priority: priority || "normal",
      assignee: stringValue(input?.assignee) || "Unassigned",
    },
  };
}

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

router.get("/practice/clients", async (_req, res): Promise<void> => {
  res.json(await db.select().from(clientsTable).orderBy(desc(clientsTable.createdAt)));
});

router.post("/practice/clients", async (req, res): Promise<void> => {
  const parsed = parseClientInput(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [client] = await db
    .insert(clientsTable)
    .values({
      ...parsed.data,
      panMasked: parsed.data.panMasked || "Not added",
      email: parsed.data.email || "",
      nextDeadline: parsed.data.nextDeadline || "",
    })
    .returning();
  res.status(201).json(client);
});

router.get("/practice/tasks", async (_req, res): Promise<void> => {
  const tasks = await db
    .select({
      id: tasksTable.id,
      clientId: tasksTable.clientId,
      clientName: clientsTable.name,
      title: tasksTable.title,
      category: tasksTable.category,
      dueDate: tasksTable.dueDate,
      priority: tasksTable.priority,
      assignee: tasksTable.assignee,
      status: tasksTable.status,
      createdAt: tasksTable.createdAt,
    })
    .from(tasksTable)
    .leftJoin(clientsTable, eq(tasksTable.clientId, clientsTable.id))
    .orderBy(asc(tasksTable.dueDate), desc(tasksTable.createdAt));
  res.json(tasks);
});

router.post("/practice/tasks", async (req, res): Promise<void> => {
  const parsed = parseTaskInput(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [task] = await db.insert(tasksTable).values(parsed.data).returning();
  res.status(201).json(task);
});

router.patch("/practice/tasks/:taskId", async (req, res): Promise<void> => {
  const taskId = stringValue(req.params.taskId);
  const status = stringValue((req.body as Record<string, unknown> | null)?.status);
  if (!/^[0-9a-f-]{36}$/i.test(taskId) || !["open", "in_progress", "done"].includes(status)) {
    res.status(400).json({ error: "Invalid task update." });
    return;
  }
  const [task] = await db
    .update(tasksTable)
    .set({ status })
    .where(eq(tasksTable.id, taskId))
    .returning();
  if (!task) {
    res.status(404).json({ error: "Task not found." });
    return;
  }
  res.json(task);
});

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
  let extracted = {
    ...emptyExtracted,
    ...parsed.data.extracted,
  };
  let confidence = parsed.data.extracted ? 0.94 : 0;
  if (parsed.data.fileData) {
    try {
      const ocr = await extractWithMistral({
        dataUrl: parsed.data.fileData,
        documentType: parsed.data.documentType,
      });
      extracted = {
        employer: ocr.employer,
        grossSalary: ocr.grossSalary,
        tdsDeducted: ocr.tdsDeducted,
        pan: ocr.pan,
        assessmentYear: ocr.assessmentYear,
        confidenceNote: ocr.confidenceNote,
      };
      if (parsed.data.extracted?.employer) extracted.employer = parsed.data.extracted.employer;
      if (parsed.data.extracted?.grossSalary) extracted.grossSalary = parsed.data.extracted.grossSalary;
      if (parsed.data.extracted?.tdsDeducted) extracted.tdsDeducted = parsed.data.extracted.tdsDeducted;
      if (parsed.data.extracted?.pan) extracted.pan = parsed.data.extracted.pan;
      confidence = [ocr.employer, ocr.grossSalary, ocr.tdsDeducted, ocr.pan].filter(Boolean).length / 4;
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : "OCR processing failed.",
      });
      return;
    }
  }
  const [document] = await db
    .insert(documentsTable)
    .values({
      fileName: parsed.data.fileName,
      documentType: parsed.data.documentType,
      status: "review",
      confidence,
      extracted: {
        ...extracted,
        confidenceNote:
          extracted.confidenceNote ||
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