import { integer, jsonb, pgTable, timestamp } from "drizzle-orm/pg-core";
import type { FormDefinition } from "../forms/types";

export const formsTable = pgTable("forms", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  schema: jsonb().$type<FormDefinition>().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
});

export const submissionsTable = pgTable("submissions", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  formId: integer()
    .references(() => formsTable.id, { onDelete: "cascade" })
    .notNull(),
  values: jsonb().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});