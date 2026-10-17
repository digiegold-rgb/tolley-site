import { z } from "zod";

// Private records are loaded through the authenticated HQ endpoint, never bundled.
export const aiIncomeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  source: z.string().min(1),
  status: z.enum(["collected", "booked"]),
  reportedAt: z.string(),
  collectedAt: z.string().nullable(),
  bookingWindow: z.string().nullable(),
  grossCents: z.number().int().nonnegative().nullable(),
  costs: z.array(z.object({ label: z.string(), amountCents: z.number().int().nonnegative(), estimated: z.boolean() })),
  minutes: z.number().positive().nullable(),
  note: z.string(),
}).refine(r => r.status !== "collected" || r.grossCents !== null, "Collected income requires a receipt amount");
export type AiIncome = z.infer<typeof aiIncomeSchema>;

export function summarizeAiIncome(records: AiIncome[]) {
  const unique = [...new Map(records.map(r => [r.id, r])).values()];
  const collected = unique.filter(r => r.status === "collected");
  const grossCents = collected.reduce((n, r) => n + r.grossCents!, 0);
  const costCents = collected.reduce((n, r) => n + r.costs.reduce((s, c) => s + c.amountCents, 0), 0);
  return { grossCents, costCents, profitCents: grossCents - costCents, completed: collected.length, booked: unique.filter(r => r.status === "booked").length };
}
