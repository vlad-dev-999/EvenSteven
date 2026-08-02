import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Global application settings stored as key/value rows.
 * Current keys:
 *   skipper_note — shown on the login page (editable by Steward only)
 */
export const appSettingsTable = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AppSetting = typeof appSettingsTable.$inferSelect;
