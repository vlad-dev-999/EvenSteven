import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  token: text("token").notNull().unique(),
  pin: text("pin").notNull(),
  frozen: boolean("frozen").notNull().default(false),
  // Event details
  coverImage: text("cover_image"),
  description: text("description"),
  venue: text("venue"),
  address: text("address"),
  mapsLink: text("maps_link"),
  startDate: timestamp("start_date", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
  itinerary: text("itinerary"),
  // Settlement configuration
  settlementMode: text("settlement_mode").notNull().default("individual"), // "individual" | "house"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventSchema = createInsertSchema(eventsTable).omit({ id: true, createdAt: true });
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
