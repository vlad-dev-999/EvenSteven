import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { housesTable } from "./houses";

export const peopleTable = pgTable("people", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  houseId: integer("house_id").notNull().references(() => housesTable.id, { onDelete: "restrict" }),
  avatar: text("avatar"), // optional emoji or initials override
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPersonSchema = createInsertSchema(peopleTable).omit({ id: true, createdAt: true });
export type InsertPerson = z.infer<typeof insertPersonSchema>;
export type Person = typeof peopleTable.$inferSelect;
