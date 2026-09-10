import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const privateDefaults = {
  status: "new", notes: null, referredTo: null, referralStatus: null, referralFee: null,
  contactedAt: null, closedAt: null, pipelineStage: "new_lead", pipelineOrder: 0,
};
const stateFields = [...Object.keys(privateDefaults), "ownerName", "ownerPhone", "ownerEmail"];

/** Each customer sees shared source facts plus their own private workflow data.
 * Legacy global notes/status remain operator-only; ownership cannot be inferred.
 * Keep this delegate scoped to one request/subscriber, never in a global singleton.
 */
// Prisma's generic select/include delegate signatures are retained at the boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export function customerLeads(subscriberId: string): typeof prisma.lead {
  const visibility = { OR: [{ ownerSubscriberId: subscriberId },
    { ownerSubscriberId: null, NOT: { source: "fsbo_manual" } },
    { ownerSubscriberId: null, source: null }] };
  function scoped(where: Row = {}): Row {
    const clauses: Row[] = [visibility];
    const source: Row = {};
    for (const [key, value] of Object.entries(where)) {
      if (["AND", "OR", "NOT"].includes(key)) {
        source[key] = Array.isArray(value) ? value.map(v => scoped(v)) : scoped(value);
      } else if (key in privateDefaults) {
        const fallback = privateDefaults[key as keyof typeof privateDefaults];
        const matchesDefault = typeof value === "object" && value !== null
          ? ("in" in value ? value.in.includes(fallback) : "equals" in value ? value.equals === fallback : false)
          : value === fallback;
        clauses.push({ OR: [
          { customerState: { some: { subscriberId, [key]: value } } },
          ...(matchesDefault ? [{ customerState: { none: { subscriberId } } }] : []),
        ] });
      } else source[key] = value;
    }
    return { AND: [...clauses, source] };
  }
  async function overlay(rows: Row[], select?: Row) {
    const states = await prisma.customerLeadState.findMany({ where: {
      subscriberId, leadId: { in: rows.map(r => r.id) },
    } });
    const byId = new Map(states.map(s => [s.leadId, s]));
    return rows.map(row => {
      const state = byId.get(row.id) as Row | undefined;
      const result = { ...row };
      for (const field of stateFields) {
        if (select && !select[field]) continue;
        if (field in privateDefaults) result[field] = state?.[field] ?? privateDefaults[field as keyof typeof privateDefaults];
        else if (state && state[field] !== null) result[field] = state[field];
      }
      if (state && (!select || select.updatedAt)) result.updatedAt = state.updatedAt;
      delete result.customerState;
      if (select && !select.id) delete result.id;
      return result;
    });
  }
  async function findMany(args: Row = {}) {
    const rows = await prisma.lead.findMany({ ...args, where: scoped(args.where),
      ...(args.select ? { select: { ...args.select, id: true } } : {}) });
    return overlay(rows, args.select);
  }
  const delegate = {
    findMany,
    async findUnique(args: Row) { return (await findMany({ ...args, take: 1 }))[0] ?? null; },
    async findFirst(args: Row = {}) { return (await findMany({ ...args, take: 1 }))[0] ?? null; },
    async count(args: Row = {}) { return prisma.lead.count({ ...args, where: scoped(args.where) }); },
    async groupBy(args: Row) {
      if (JSON.stringify(args.by) !== '["status"]') throw new Error("Unsupported customer lead grouping");
      const rows = await findMany({ where: args.where, select: { id: true, status: true } });
      const counts = new Map<string, number>();
      for (const row of rows) counts.set(row.status, (counts.get(row.status) || 0) + 1);
      return [...counts].map(([status, count]) => ({ status, _count: { id: count } }));
    },
    async update(args: Row) {
      const id = args.where?.id;
      if (typeof id !== "string") throw new Error("Lead ID required");
      const visible = await prisma.lead.findFirst({ where: scoped({ id }), select: { id: true } });
      if (!visible) throw new Prisma.PrismaClientKnownRequestError("Lead not found", { code: "P2025", clientVersion: Prisma.prismaVersion.client });
      const data: Row = {};
      for (const [key, value] of Object.entries(args.data)) {
        if (!stateFields.includes(key)) throw new Error("Cannot modify source lead fields");
        data[key] = value;
      }
      await prisma.customerLeadState.upsert({ where: { subscriberId_leadId: { subscriberId, leadId: id } },
        create: { subscriberId, leadId: id, ...data }, update: data });
      return (await findMany({ where: { id }, select: args.select, include: args.include, take: 1 }))[0];
    },
  };
  return new Proxy(delegate, {
    get(target, property) {
      if (property in target) return target[property as keyof typeof target];
      throw new Error(`Unsupported customer lead operation: ${String(property)}`);
    },
  }) as unknown as typeof prisma.lead;
}
