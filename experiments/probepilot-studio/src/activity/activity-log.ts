import type { ActivityEvent } from "@/domain/types";

export class ActivityLog {
  static readonly MaxEntries = 100;

  static prepend(entries: readonly ActivityEvent[], entry: ActivityEvent): ActivityEvent[] {
    return [entry, ...entries].slice(0, ActivityLog.MaxEntries);
  }
}
