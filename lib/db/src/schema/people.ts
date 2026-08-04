import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { housesTable } from "./houses";

export const peopleTable = pgTable("people", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  houseId: integer("house_id").notNull().references(() => housesTable.id, { onDelete: "restrict" }),
  avatar: text("avatar"),         // optional emoji or initials override
  personalColor: text("personal_color"), // optional curated accent hex colour
  active: boolean("active").notNull().default(true),
  // Activation — true once the member has verified their email and chosen their own PIN
  activated: boolean("activated").notNull().default(false),
  // Email — set during the activation flow
  email: text("email"),
  // Personal 4-digit PIN for directory-based identity verification.
  // Hash format: "scrypt:salt_hex:hash_hex" — plaintext never stored after hashing.
  personalPinHash: text("personal_pin_hash"),
  // Email OTP for activation flow
  emailOtpHash: text("email_otp_hash"),
  emailOtpExpiresAt: timestamp("email_otp_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPersonSchema = createInsertSchema(peopleTable).omit({ id: true, createdAt: true });
export type InsertPerson = z.infer<typeof insertPersonSchema>;
export type Person = typeof peopleTable.$inferSelect;
