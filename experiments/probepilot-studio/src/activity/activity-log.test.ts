import { describe, expect, it } from "vitest";
import type { ActivityEvent } from "@/domain/types";
import { ActivityLog } from "@/activity/activity-log";

function event(index: number): ActivityEvent {
  return {
    id: `activity-${index}`,
    actor: "system",
    action: "project_reset",
    summary: `Event ${index}`,
    affectedIds: [],
    createdAt: new Date(2026, 7, 31, 0, 0, index).toISOString()
  };
}

describe("ActivityLog", () => {
  it("retains the newest 100 activity entries in newest-first order", () => {
    let entries: ActivityEvent[] = [];
    for (let index = 0; index < 101; index += 1) {
      entries = ActivityLog.prepend(entries, event(index));
    }

    expect(entries).toHaveLength(100);
    expect(entries[0]?.id).toBe("activity-100");
    expect(entries.at(-1)?.id).toBe("activity-1");
  });
});
