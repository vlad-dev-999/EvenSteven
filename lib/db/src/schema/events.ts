import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  token: text("token").notNull().unique(),
  pin: text("pin").notNull(),
  frozen: boolean("frozen").notNull().default(false),
  archived: boolean("archived").notNull().default(false),
  // Event details
  coverImage: text("cover_image"),
  description: text("description"),
  venue: text("venue"),
  address: text("address"),
  mapsLink: text("maps_link"),
  startDate: timestamp("start_date", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
  itinerary: text("itinerary"),
  // Banner and tonight's note
  bannerImage: text("banner_image"),
  tonightNoteTitle: text("tonight_note_title"),
  tonightNoteBody: text("tonight_note_body"),
  // Settlement configuration
  settlementMode: text("settlement_mode").notNull().default("individual"), // "individual" | "house"
  // Creator — person_id from the permanent directory (null for admin-created)
  createdByPersonId: integer("created_by_person_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventSchema = createInsertSchema(eventsTable).omit({ id: true, createdAt: true });
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
