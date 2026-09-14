type OcrInput = {
  dataUrl: string;
  documentType: string;
};

type OcrPage = {
  markdown?: string;
};

type MistralOcrResponse = {
  pages?: OcrPage[];
};

export type OcrExtraction = {
  employer: string;
  grossSalary: number;
  tdsDeducted: number;
  pan: string;
  assessmentYear: string;
  confidenceNote: string;
  rawText: string;
};

function numberFromText(value: string | undefined) {
  if (!value) return 0;
  const normalized = value.replace(/[₹,\s]/g, "").replace(/[^\d.]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function extractFields(text: string, documentType: string): OcrExtraction {
  const compactText = text.replace(/\r/g, "");
  const pan = firstMatch(compactText, [
    /(?:PAN|Permanent Account Number)\s*(?:No\.?|Number|:)?\s*([A-Z]{5}[0-9]{4}[A-Z])/i,
  ]).toUpperCase();
  const assessmentYear =
    firstMatch(compactText, [
      /Assessment Year\s*[:\-]?\s*(20\d{2}[-–]20\d{2})/i,
      /A\.?Y\.?\s*[:\-]?\s*(20\d{2}[-–]20\d{2})/i,
    ]).replace("–", "-") || "2026-27";
  const employer = firstMatch(compactText, [
    /Name and address of the Employer\s*[:\-]?\s*(.+)/i,
    /Employer(?: Name)?\s*[:\-]?\s*(.+)/i,
  ]).split("\n")[0].trim();
  const grossSalary = numberFromText(
    firstMatch(compactText, [
      /Gross Salary\s*[:\-]?\s*₹?\s*([\d,]+(?:\.\d+)?)/i,
      /Gross total income\s*[:\-]?\s*₹?\s*([\d,]+(?:\.\d+)?)/i,
      /Total amount of salary\s*[:\-]?\s*₹?\s*([\d,]+(?:\.\d+)?)/i,
    ]),
  );
  const tdsDeducted = numberFromText(
    firstMatch(compactText, [
      /Tax deducted and deposited\s*[:\-]?\s*₹?\s*([\d,]+(?:\.\d+)?)/i,
      /Total TDS\s*[:\-]?\s*₹?\s*([\d,]+(?:\.\d+)?)/i,
      /Tax deducted\s*[:\-]?\s*₹?\s*([\d,]+(?:\.\d+)?)/i,
    ]),
  );
  const foundFields = [pan, employer, grossSalary, tdsDeducted].filter(Boolean).length;
  return {
    employer,
    grossSalary,
    tdsDeducted,
    pan,
    assessmentYear,
    confidenceNote:
      foundFields >= 3
        ? `Mistral OCR read this ${documentType.replaceAll("_", " ")}. Review the highlighted values before using them.`
        : "Mistral OCR returned text, but several tax fields were not confidently identified. Review and enter them manually.",
    rawText: compactText,
  };
}

export async function extractWithMistral({ dataUrl, documentType }: OcrInput): Promise<OcrExtraction> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error("MISTRAL_API_KEY is not configured.");
  }
  if (!dataUrl.startsWith("data:")) {
    throw new Error("OCR input must be a data URL.");
  }

  const mimeType = dataUrl.slice(5, dataUrl.indexOf(";")) || "application/pdf";
  const document =
    mimeType === "application/pdf"
      ? { type: "document_url", document_url: dataUrl }
      : { type: "image_url", image_url: dataUrl };

  const response = await fetch("https://api.mistral.ai/v1/ocr", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mistral-ocr-latest",
      document,
      include_image_base64: false,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Mistral OCR failed (${response.status}): ${details.slice(0, 500)}`);
  }

  const result = (await response.json()) as MistralOcrResponse;
  const rawText = (result.pages ?? [])
    .map((page) => page.markdown ?? "")
    .filter(Boolean)
    .join("\n\n");
  if (!rawText) {
    throw new Error("Mistral OCR returned no readable text.");
  }

  return extractFields(rawText, documentType);
}