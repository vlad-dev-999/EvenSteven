import { db } from "@workspace/db";
import { activityLogTable } from "@workspace/db";

/**
 * Records an activity log entry for an event.
 */
export async function logActivity(
  eventId: number,
  action: string,
  metadata: Record<string, unknown> = {},
  memberId?: number,
  memberName?: string,
): Promise<void> {
  await db.insert(activityLogTable).values({
    eventId,
    action,
    metadata,
    memberId: memberId ?? null,
    memberName: memberName ?? null,
  });
}
