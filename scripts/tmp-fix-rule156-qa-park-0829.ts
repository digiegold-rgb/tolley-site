// One-off (2026-08-29): rule 156's last sentence still ordered an unconditional
// `qa` park for studio/Vater tickets on a PASSING audit. That outlived the
// 2026-08-28 autonomy change in fable5-runner.mjs (lane.gate is now off unless
// FABLE5_HUMAN_GATE=1) and hung F5-728HCZ at "audit passed — delivering" with a
// green PASS and nothing moving. The runner injects THIS rulebook into every
// session and is told to cite it, so a stale sentence here beats the code.
// The PUT route needs a browser session, hence a script.
import { prisma } from "../lib/prisma";

const OLD =
  ' Studio/Vater-lane tickets ALWAYS park at `qa` after a passing audit ("READY FOR REVIEW" Telegram with the audit link); Jared eyeballs and delivers.';
const NEW =
  ' On a PASSING audit the runner DELIVERS on every lane, studio/Vater included (Jared 2026-08-28, "complete autonomous operations"). The old READY-FOR-REVIEW park is opt-in only: set `FABLE5_HUMAN_GATE=1` on the fable5-runner unit. ⛔ Do not re-add an unconditional qa park here — this sentence used to read "Studio/Vater-lane tickets ALWAYS park at `qa` after a passing audit", which outlived the code change and left F5-728HCZ sitting at `rendered · audit passed — delivering` with a green PASS and nothing moving (Jared 2026-08-29). The runner reads THIS rulebook, so a stale sentence here beats the code every time.';

async function main() {
  const r = await prisma.vaterRule.findUnique({ where: { code: "156" } });
  if (!r) throw new Error("rule 156 not found");
  if (!r.body.includes(OLD)) {
    console.log(r.body.includes("complete autonomous operations") ? "already fixed — no change" : "ANCHOR MISSING — no change made");
    return;
  }
  const body = r.body.replace(OLD, NEW);
  await prisma.$transaction([
    prisma.vaterRuleRevision.create({
      data: {
        code: "156",
        before: { title: r.title, body: r.body, source: r.source },
        after: { title: r.title, body, source: r.source },
        by: "dgx:fix-qa-park-0829",
        note: "drop the unconditional studio/Vater qa park — superseded by the 2026-08-28 autonomy change; it hung F5-728HCZ",
      },
    }),
    prisma.vaterRule.update({ where: { code: "156" }, data: { body, updatedBy: "dgx:fix-qa-park-0829" } }),
  ]);
  console.log("rule 156 updated; revision recorded");
  console.log(body.slice(-360));
}
main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
