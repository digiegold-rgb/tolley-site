import "server-only";
import { prisma } from "@/lib/prisma";
import { COMPANY_POLICY, CompanyError, monthKey } from "./policy";
import { controls } from "./store";
import { rollbackCapability } from "./growth";
export async function overview() {
  const control = await controls();
  const [tasks, experiments, budget, capabilities, decisions, events] = await Promise.all([
    prisma.companyTask.findMany({ orderBy: { createdAt: "desc" }, take: 40, select: { id: true, capabilityId: true, state: true, maxCents: true, chargedCents: true, createdAt: true, error: true } }),
    prisma.companyExperiment.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.companyExperiment.aggregate({ where: { month: monthKey() }, _sum: { reservedCents: true, spentCents: true } }),
    prisma.companyCapability.findMany({ orderBy: { id: "asc" }, select: { id: true, version: true, status: true, evidence: true } }),
    prisma.companyDecision.findMany({ where: { state: "pending" }, take: 20, orderBy: { createdAt: "asc" } }),
    prisma.companyEvent.findMany({ where: { kind: { in: ["health", "capability.published", "control", "worker.error"] } }, take: 20, orderBy: { createdAt: "desc" } }),
  ]);
  return { control, policy: COMPANY_POLICY, month: monthKey(), budget: { limitCents: COMPANY_POLICY.monthlyResearchCents, reservedCents: budget._sum.reservedCents || 0, spentCents: budget._sum.spentCents || 0 }, tasks, experiments, capabilities, decisions, events };
}
export async function controlCommand(command: string, argument: string, sourceKey: string) {
  const prior = await prisma.companyEvent.findUnique({ where: { key: sourceKey } }); if (prior) return prior.data;
  await controls();
  if (command === "STATUS") { const s = await overview(); return { message: `Tolley: admission ${s.control.admission ? "on" : "off"}; learning ${s.control.learning ? "on" : "off"}; development ${s.control.development ? "on" : "off"}; deployment ${s.control.deployment ? "on" : "off"}. Research $${(s.budget.spentCents/100).toFixed(2)} spent + $${(s.budget.reservedCents/100).toFixed(2)} reserved / $500. ${s.decisions.length} pending decisions.` }; }
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('company-controls',0))`;
    if (await tx.companyEvent.findUnique({ where: { key: sourceKey } })) return;
    if (command === "ROLLBACK") await rollbackCapability(argument, tx);
    else if (command === "PAUSE") await tx.companyControl.update({ where: { id: "company" }, data: { learning: false, development: false, deployment: false } });
    else if (command === "RESUME") await tx.companyControl.update({ where: { id: "company" }, data: { learning: true, development: true, deployment: true } });
    else if (command === "ADMISSION") { if (!["on", "off"].includes(argument)) throw new CompanyError("admission_on_or_off_required"); await tx.companyControl.update({ where: { id: "company" }, data: { admission: argument === "on" } }); }
    else if (command === "STOP") { if (!argument) throw new CompanyError("task_id_required"); await tx.companyTask.updateMany({ where: { id: argument, state: { notIn: ["completed", "failed", "cancelled"] } }, data: { cancelRequested: true } }); }
    else if (["APPROVE", "REJECT"].includes(command)) {
      const d = await tx.companyDecision.findUnique({ where: { id: argument } });
      if (!d || d.state !== "pending" || d.expiresAt < new Date()) throw new CompanyError("decision_expired_or_missing", 409);
      // Approval records intent; protected-policy/credential changes are carried out by the owner workflow, not an LLM.
      await tx.companyDecision.update({ where: { id: argument }, data: { state: command === "APPROVE" ? "approved" : "rejected", resolvedAt: new Date() } });
    } else throw new CompanyError("unknown_command");
    await tx.companyEvent.create({ data: { key: sourceKey, kind: "control", data: { command, argument } } });
  });
  const result = { message: `${command} ${argument}`.trim() + " recorded." };
  return result;
}
