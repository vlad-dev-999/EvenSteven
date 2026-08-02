import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { eventsTable } from "./events";
import { membersTable } from "./members";

export const expenseCategoryEnum = ["tickets", "food", "drinks", "snacks", "fuel", "other"] as const;
export type ExpenseCategory = typeof expenseCategoryEnum[number];

export const splitTypeEnum = ["everyone", "families", "members"] as const;
export type SplitType = typeof splitTypeEnum[number];

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  paidByMemberId: integer("paid_by_member_id").notNull().references(() => membersTable.id),
  category: text("category").notNull().$type<ExpenseCategory>(),
  amount: integer("amount").notNull(), // in paise/cents
  description: text("description"),
  splitType: text("split_type").notNull().$type<SplitType>(),
  createdByMemberId: integer("created_by_member_id").notNull().references(() => membersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertExpenseSchema = createInsertSchema(expensesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expensesTable.$inferSelect;
