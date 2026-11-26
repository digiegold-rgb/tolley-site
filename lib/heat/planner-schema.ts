import { z } from "zod";

const jsonObject = z.record(z.string().max(100), z.unknown());
export const plannerEventSchema = z.object({
  id: z.string().uuid(), ts: z.string().datetime({ offset: true }),
  kind: z.enum(["decision", "learned", "write_attempt", "watchdog", "daily_model", "command_ack", "review_model", "blower_sample"]),
  season: z.enum(["heat", "cool"]), mode: z.enum(["shadow", "live"]),
  period: z.string().max(30).optional(), reason_code: z.string().max(100).optional(),
  why: z.string().max(4000).optional(), inputs: jsonObject.optional(), plan: jsonObject.optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), text: z.string().max(20_000).optional(),
  devices: jsonObject.optional(), counters_today: jsonObject.optional(), daily: jsonObject.optional(),
  override: jsonObject.optional(), alerts: z.array(z.string().max(100)).max(30).optional(),
  housemode: z.enum(["home", "away"]).optional(), occupancy: z.null().optional(),
  manual_changes: z.array(jsonObject).max(20).optional(), safety: z.boolean().optional(), stage: z.string().max(40).optional(),
  param: z.string().max(100).optional(), key: z.string().max(150).optional(),
  value: z.number().finite().optional(), n: z.number().int().min(0).optional(),
  prev_value: z.number().finite().nullable().optional(), model_version: z.number().int().optional(),
  device: z.enum(["honeywell", "nest", "humidifier", "loft_fan"]).optional(),
  desired: jsonObject.optional(), attempt: z.number().int().min(1).max(10).optional(),
  decision_id: z.string().uuid().optional(), readback_ok: z.boolean().optional(),
  result: z.enum(["ok", "failed", "rejected", "accepted_shadow", "accepted_live"]).optional(),
  error: z.string().max(200).optional(), command_id: z.string().uuid().optional(), safe_request: jsonObject.nullable().optional(),
}).strict().superRefine((e, ctx) => {
  if (e.kind === "learned" && (e.param == null || e.key == null || e.value == null || e.n == null)) {
    ctx.addIssue({ code: "custom", message: "Learned event is incomplete" });
  }
  if (e.kind === "decision" && (!e.inputs || !e.plan || !e.devices || !e.why)) {
    ctx.addIssue({ code: "custom", message: "Decision is incomplete" });
  }
  if (e.kind === "blower_sample") {
    const reading = z.object({
      source: z.literal("furnace_power"), read_only: z.literal(true),
      watts: z.number().finite().min(0).max(4000).nullable(),
      valid: z.boolean(), running: z.boolean(), observed_at: z.number().finite(),
      thresholds_provisional: z.boolean(), on_w: z.number().positive(), off_w: z.number().nonnegative(),
    }).passthrough().safeParse(e.inputs?.blower);
    if (!reading.success || (reading.success && (reading.data.off_w >= reading.data.on_w ||
      (reading.data.valid && reading.data.watts === null) || (!reading.data.valid && reading.data.running)))) {
      ctx.addIssue({ code: "custom", message: "Blower reading is incomplete or inconsistent" });
    }
  }
  if (e.kind === "command_ack" && (!e.command_id || !["accepted_shadow", "accepted_live", "rejected"].includes(e.result || ""))) {
    ctx.addIssue({ code: "custom", message: "Command acknowledgment is incomplete" });
  }
  const serialized = JSON.stringify(e);
  if (serialized.length > 40_000 || /"[^"\\]*(?:password|secret|token|authorization|cookie|email)[^"\\]*"\s*:/i.test(serialized)) {
    ctx.addIssue({ code: "custom", message: "Event exceeds limits or contains a credential field" });
  }
});

export type PlannerEvent = z.infer<typeof plannerEventSchema>;

export function parsePlannerEvents(value: unknown, now = Date.now()): PlannerEvent[] {
  const rows = z.array(plannerEventSchema).min(1).max(100).parse(value);
  for (const row of rows) {
    const t = Date.parse(row.ts);
    if (t > now + 900_000 || t < now - 2 * 366 * 86400_000) throw new Error("Event date out of retention window");
  }
  return [...new Map(rows.map(row => [row.id, row])).values()];
}

export const heatCommandSchema = z.object({
  action: z.enum(["warm", "hold", "auto", "away", "home", "stove"]),
  target_f: z.number().finite().min(60).max(73).optional(),
  hours: z.number().finite().min(0.1).max(24).optional(),
}).strict().refine(c => c.action !== "stove" || (c.hours ?? 2) <= 8, "Stove mode is limited to eight hours");
