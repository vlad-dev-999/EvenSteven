import { pgTable, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { expensesTable } from "./expenses";
import { membersTable } from "./members";

export const expenseParticipantsTable = pgTable("expense_participants", {
  id: serial("id").primaryKey(),
  expenseId: integer("expense_id").notNull().references(() => expensesTable.id, { onDelete: "cascade" }),
  memberId: integer("member_id").notNull().references(() => membersTable.id, { onDelete: "cascade" }),
  shareAmount: integer("share_amount").notNull(), // in paise/cents
});

export const insertExpenseParticipantSchema = createInsertSchema(expenseParticipantsTable).omit({ id: true });
export type InsertExpenseParticipant = z.infer<typeof insertExpenseParticipantSchema>;
export type ExpenseParticipant = typeof expenseParticipantsTable.$inferSelect;
