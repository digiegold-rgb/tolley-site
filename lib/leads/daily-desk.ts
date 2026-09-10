import { prisma } from "@/lib/prisma";
import { customerLeads } from "@/lib/customer-leads";
import { dailyBounds, orderDailyTasks, type DailyDeskData, type DailyTask } from "./daily-plan";

export async function loadDailyDesk(subscriberId: string, owner: boolean, now = new Date()): Promise<DailyDeskData> {
  const { start, end, weekStart } = dailyBounds(now);
  const adopted = owner ? await prisma.crmTask.findMany({ where: { subscriberId, id: { startsWith: `inquiry:${subscriberId}:` } }, select: { id: true } }) : [];
  const adoptedIds = adopted.map(t => t.id.slice(`inquiry:${subscriberId}:`.length));
  const [pending, upcoming, pendingCount, clients, activities, inquiries] = await Promise.all([
    prisma.crmTask.findMany({ where: { subscriberId, status: "pending", OR: [{ dueDate: null }, { dueDate: { lt: end } }] }, orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }], take: 50 }),
    prisma.crmTask.findMany({ where: { subscriberId, status: "pending", dueDate: { gte: end } }, orderBy: { dueDate: "asc" }, take: 3 }),
    prisma.crmTask.count({ where: { subscriberId, status: "pending", OR: [{ dueDate: null }, { dueDate: { lt: end } }] } }),
    prisma.client.findMany({ where: { subscriberId, status: "active", CrmTask: { none: { subscriberId, status: "pending" } }, CrmActivity: { none: { subscriberId, createdAt: { gte: weekStart } } } }, select: { id: true, firstName: true, lastName: true, phone: true, email: true }, orderBy: { updatedAt: "desc" }, take: 3 }),
    prisma.crmActivity.findMany({ where: { subscriberId, createdAt: { gte: weekStart, lt: end }, type: { startsWith: "daily_" } }, select: { type: true, createdAt: true } }),
    owner ? prisma.leadAction.findMany({ where: { status: "new", id: { notIn: adoptedIds }, createdAt: { gte: new Date(now.getTime() - 30 * 86400000) } }, orderBy: { createdAt: "desc" }, take: 3, select: { id: true, name: true, subsite: true, action: true, createdAt: true } }) : [],
  ]);
  const all = [...pending, ...upcoming];
  // Resolve linked records through ownership checks instead of raw global relations.
  const [linkedClients, leads, deals] = await Promise.all([
    prisma.client.findMany({ where: { subscriberId, id: { in: all.flatMap(t => t.clientId ? [t.clientId] : []) } }, select: { id: true, firstName: true, lastName: true, phone: true, email: true } }),
    customerLeads(subscriberId).findMany({ where: { id: { in: all.flatMap(t => t.leadId ? [t.leadId] : []) } }, select: { id: true, ownerName: true, ownerPhone: true, ownerEmail: true } }),
    prisma.deal.findMany({ where: { subscriberId, id: { in: all.flatMap(t => t.dealId ? [t.dealId] : []) } }, select: { id: true } }),
  ]);
  const toTask = (t: typeof pending[number]): DailyTask => {
    const client = linkedClients.find(c => c.id === t.clientId);
    const lead = leads.find(l => l.id === t.leadId);
    return { id: t.id, title: t.title, description: t.description, dueDate: t.dueDate?.toISOString() ?? null, priority: t.priority,
      person: client ? `${client.firstName} ${client.lastName}`.trim() : lead?.ownerName ?? null,
      phone: client?.phone ?? lead?.ownerPhone ?? null, email: client?.email ?? lead?.ownerEmail ?? null,
      href: client ? "/leads/clients" : lead ? `/leads/${encodeURIComponent(lead.id)}` : deals.some(d => d.id === t.dealId) ? "/leads/deals" : null };
  };
  const count = (type: string, since: Date) => activities.filter(a => a.type === type && a.createdAt >= since).length;
  return {
    tasks: orderDailyTasks(pending.map(toTask), now), upcoming: upcoming.map(toTask), pendingCount,
    suggestions: clients.map(c => ({ id: c.id, name: `${c.firstName} ${c.lastName}`.trim(), phone: c.phone, email: c.email })),
    inquiries: inquiries.map(i => ({ ...i, name: i.name || "New inquiry", createdAt: i.createdAt.toISOString() })),
    progress: { attempts: count("daily_attempted", start), conversations: count("daily_conversation", start), appointments: count("daily_appointment", start), completed: count("daily_completed", start) },
    week: { conversations: count("daily_conversation", weekStart), appointments: count("daily_appointment", weekStart) }, asOf: now.toISOString(),
  };
}
