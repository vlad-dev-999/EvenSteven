import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { eventsTable } from "./events";
import { familiesTable } from "./families";
import { peopleTable } from "./people";
import { housesTable } from "./houses";

export const membersTable = pgTable("members", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  familyId: integer("family_id").references(() => familiesTable.id, { onDelete: "set null" }),
  isHost: boolean("is_host").notNull().default(false),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  // permanent directory references
  personId: integer("person_id").references(() => peopleTable.id, { onDelete: "set null" }),
  houseId: integer("house_id").references(() => housesTable.id, { onDelete: "set null" }),
  // personal PIN for cross-device identity restoration
  // personalPin: legacy plaintext (kept for migration, will be null for new members)
  personalPin: text("personal_pin"),
  // personalPinHash: scrypt hash format "scrypt:salt_hex:hash_hex"
  personalPinHash: text("personal_pin_hash"),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMemberSchema = createInsertSchema(membersTable).omit({ id: true, createdAt: true });
export type InsertMember = z.infer<typeof insertMemberSchema>;
export type Member = typeof membersTable.$inferSelect;
