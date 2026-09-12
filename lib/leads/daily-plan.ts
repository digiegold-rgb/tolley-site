export const DAILY_TIME_ZONE = "America/Chicago";
export const DAILY_OUTCOMES = ["attempted", "conversation", "appointment", "completed", "snooze"] as const;
export type DailyOutcome = typeof DAILY_OUTCOMES[number];
export interface DailyTask {
  draft?: import("./weekday-plan").SellerDraft | null;
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: string;
  person: string | null;
  phone: string | null;
  email: string | null;
  href: string | null;
}
export interface DailyDeskData {
  sellerDrafts?: DailyTask[];
  weekdayDrop?: { day: string; count: number; shortfall: number } | null;
  tasks: DailyTask[];
  pendingCount: number;
  upcoming: DailyTask[];
  suggestions: { id: string; name: string; phone: string | null; email: string | null }[];
  inquiries: { id: string; name: string; subsite: string; action: string; createdAt: string }[];
  progress: { attempts: number; conversations: number; appointments: number; completed: number };
  week: { conversations: number; appointments: number };
  asOf: string;
}

/** Chicago calendar boundaries, including 23/25-hour DST days. */
export function dailyBounds(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: DAILY_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: string) => Number(parts.find(p => p.type === type)!.value);
  function midnight(dayOffset: number) {
    const wall = Date.UTC(get("year"), get("month") - 1, get("day") + dayOffset);
    let utc = wall;
    for (let n = 0; n < 3; n++) {
      const local = new Intl.DateTimeFormat("en-US", { timeZone: DAILY_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(utc));
      const p = (type: string) => Number(local.find(x => x.type === type)!.value);
      utc += wall - Date.UTC(p("year"), p("month") - 1, p("day"), p("hour"), p("minute"), p("second"));
    }
    return new Date(utc);
  }
  return { start: midnight(0), end: midnight(1), weekStart: midnight(-6) };
}

export function orderDailyTasks(tasks: DailyTask[], now: Date): DailyTask[] {
  const { start, end } = dailyBounds(now);
  const rank = (task: DailyTask) => !task.dueDate ? 2 : new Date(task.dueDate) < start ? 0 : 1;
  return tasks.filter(t => !t.dueDate || new Date(t.dueDate) < end).sort((a,b) =>
    rank(a) - rank(b) || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
    (({ high: 0, medium: 1, low: 2 } as Record<string, number>)[a.priority] ?? 1) - (({ high: 0, medium: 1, low: 2 } as Record<string, number>)[b.priority] ?? 1) || a.id.localeCompare(b.id));
}

export function taskReason(task: DailyTask, now: Date): string {
  if (!task.dueDate) return "You saved this follow-up without a date.";
  const due = new Date(task.dueDate);
  const { start } = dailyBounds(now);
  const label = new Intl.DateTimeFormat("en-US", { timeZone: DAILY_TIME_ZONE, month: "short", day: "numeric" }).format(due);
  return due < start ? `Your follow-up was due ${label}.` : "You scheduled this for today.";
}

export function phoneHref(phone: string | null): string | null {
  const normalized = phone?.replace(/[^\d+]/g, "") ?? "";
  return /^\+?\d{7,15}$/.test(normalized) ? `tel:${normalized}` : null;
}
