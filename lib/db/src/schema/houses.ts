import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const housesTable = pgTable("houses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // e.g. "House Vlad"
  crest: text("crest").notNull().default("home"), // lucide icon name
  accentColor: text("accent_color"), // optional hex colour
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHouseSchema = createInsertSchema(housesTable).omit({ id: true, createdAt: true });
export type InsertHouse = z.infer<typeof insertHouseSchema>;
export type House = typeof housesTable.$inferSelect;
