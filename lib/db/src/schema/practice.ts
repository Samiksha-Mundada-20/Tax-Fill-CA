import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const clientsTable = pgTable("tax_sathi_clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  panMasked: text("pan_masked").notNull().default("Not added"),
  email: text("email").notNull().default(""),
  service: text("service").notNull().default("ITR filing"),
  status: text("status").notNull().default("active"),
  nextDeadline: text("next_deadline").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tasksTable = pgTable("tax_sathi_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id"),
  title: text("title").notNull(),
  category: text("category").notNull().default("document_collection"),
  dueDate: text("due_date").notNull(),
  priority: text("priority").notNull().default("normal"),
  assignee: text("assignee").notNull().default("Unassigned"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Client = typeof clientsTable.$inferSelect;
export type Task = typeof tasksTable.$inferSelect;