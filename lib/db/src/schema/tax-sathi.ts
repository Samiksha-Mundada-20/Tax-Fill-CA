import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const documentsTable = pgTable("tax_sathi_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileName: text("file_name").notNull(),
  documentType: text("document_type").notNull(),
  status: text("status").notNull().default("review"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  confidence: real("confidence").notNull().default(0.94),
  extracted: jsonb("extracted").$type<{
    employer: string;
    grossSalary: number;
    tdsDeducted: number;
    pan: string;
    assessmentYear: string;
    confidenceNote: string;
  }>().notNull(),
});

export const itrFilingsTable = pgTable("tax_sathi_itr_filings", {
  id: uuid("id").primaryKey().defaultRandom(),
  form: text("form").notNull().default("ITR-1"),
  assessmentYear: text("assessment_year").notNull(),
  status: text("status").notNull().default("draft"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  warnings: jsonb("warnings").$type<string[]>().notNull().default([]),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
});

export const consentTable = pgTable("tax_sathi_consent", {
  id: integer("id").primaryKey().default(1),
  ocrProcessing: boolean("ocr_processing").notNull().default(false),
  dataStorage: boolean("data_storage").notNull().default(false),
  taxCalculation: boolean("tax_calculation").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDocumentSchema = createInsertSchema(documentsTable).omit({
  id: true,
  uploadedAt: true,
});
export const insertItrFilingSchema = createInsertSchema(itrFilingsTable).omit({
  id: true,
  generatedAt: true,
});

export type Document = typeof documentsTable.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type ItrFiling = typeof itrFilingsTable.$inferSelect;
export type InsertItrFiling = z.infer<typeof insertItrFilingSchema>;
export type Consent = typeof consentTable.$inferSelect;