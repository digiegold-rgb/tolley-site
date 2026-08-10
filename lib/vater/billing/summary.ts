/**
 * getVaterBillingSummary — the ONE place Trey's render bill is computed.
 *
 * Consumed by /api/vater/latest (the /animate header pill) and
 * /api/hq/vater-payment (the /hq "Zelle received" reset button). All-time
 * total = compute at cost + render-operations fee; it NEVER resets.
 * Payments received (Zelle) accumulate in VaterPayment; current due is the
 * gap. Keep both surfaces on this helper — a fork here means the pill and
 * /hq disagree about what Trey owes.
 */

import { prisma } from "@/lib/prisma";

import { getOpsRate } from "./ops-fee";

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface VaterBillingSummary {
  opsRatePerMinute: number;
  minutes: number;
  videos: number;
  computeUsd: number;
  opsUsd: number;
  totalUsd: number;
  paidUsd: number;
  dueUsd: number;
}

export async function getVaterBillingSummary(): Promise<{
  summary: VaterBillingSummary;
  costs: Awaited<ReturnType<typeof prisma.vaterCostSnapshot.findUnique>>;
}> {
  const [costs, finished, paidAgg] = await Promise.all([
    prisma.vaterCostSnapshot.findUnique({ where: { id: "vater-costs" } }),
    prisma.youTubeProject.findMany({
      where: { status: "ready", finalVideoUrl: { not: null } },
      select: { audioDuration: true },
    }),
    prisma.vaterPayment.aggregate({ _sum: { amountUsd: true } }),
  ]);

  const opsRatePerMinute = getOpsRate();
  let minutes = 0;
  for (const p of finished) {
    minutes += Math.max(0, Number(p.audioDuration ?? 0)) / 60;
  }
  const computeUsd = r2(
    (costs?.claudeUsd ?? 0) + (costs?.modalUsd ?? 0) + (costs?.geminiUsd ?? 0) +
    (costs?.falUsd ?? 0) + (costs?.otherUsd ?? 0),
  );
  const opsUsd = r2(minutes * opsRatePerMinute);
  const totalUsd = r2(computeUsd + opsUsd);
  const paidUsd = r2(paidAgg._sum.amountUsd ?? 0);

  return {
    summary: {
      opsRatePerMinute,
      minutes: r2(minutes),
      videos: finished.length,
      computeUsd,
      opsUsd,
      totalUsd,
      paidUsd,
      dueUsd: r2(Math.max(0, totalUsd - paidUsd)),
    },
    costs,
  };
}
