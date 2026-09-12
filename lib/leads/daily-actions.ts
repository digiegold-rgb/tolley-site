import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { customerCrmReferences } from "@/lib/customer-crm-references";
import { z } from "zod";
import { DAILY_OUTCOMES, dailyBounds } from "./daily-plan";
import { readSellerDraft } from "./weekday-plan";

const due = z.iso.datetime({ offset: true }).refine(v => new Date(v).getTime() > Date.now(), "Choose a future follow-up time");
export const dailyActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save-draft"), taskId: z.string().min(1).max(250), body: z.string().trim().min(1).max(4000), previousBody: z.string().max(4000) }),
  z.object({ action: z.literal("capture"), requestId: z.uuid(), name: z.string().trim().min(1).max(150), phone: z.string().trim().max(40).default(""), email: z.union([z.email(), z.literal("")]).default(""), title: z.string().trim().min(1).max(200), dueDate: due.optional() }),
  z.object({ action: z.literal("add-client"), clientId: z.string().min(1).max(200) }),
  z.object({ action: z.literal("adopt-inquiry"), inquiryId: z.string().min(1).max(200) }),
  z.object({ action: z.literal("outcome"), requestId: z.uuid(), taskId: z.string().min(1).max(250), outcome: z.enum(DAILY_OUTCOMES), note: z.string().trim().max(2000).default(""), nextTitle: z.string().trim().max(200).optional(), nextAt: due.optional() }).superRefine((v, ctx) => {
    if (["snooze", "attempted", "conversation", "appointment"].includes(v.outcome) && !v.nextAt) ctx.addIssue({ code: "custom", message: "Choose the next follow-up time, or mark this finished", path: ["nextAt"] });
  }),
]);
export class DailyActionError extends Error { constructor(message: string, readonly status: number) { super(message); } }

export async function applyDailyAction(subscriberId: string, owner: boolean, input: z.infer<typeof dailyActionSchema>, now = new Date()) {
  if (input.action === "save-draft") {
    if (!owner) throw new DailyActionError("Owner access required", 403);
    const task = await prisma.crmTask.findFirst({ where: { id: input.taskId, subscriberId, type: "seller_draft", status: "pending" } });
    const draft = readSellerDraft(task?.description ?? null);
    if (!task || !draft) throw new DailyActionError("Draft not found", 404);
    if (draft.body === input.body) return { saved: true };
    if (draft.body !== input.previousBody) throw new DailyActionError("This draft changed. Reload Today before saving again.", 409);
    const saved = await prisma.crmTask.updateMany({ where: { id: task.id, subscriberId, status: "pending", updatedAt: task.updatedAt }, data: { description: JSON.stringify({ ...draft, body: input.body }) } });
    if (!saved.count) throw new DailyActionError("This draft changed. Reload Today before saving again.", 409);
    return { saved: true };
  }
  if (input.action === "outcome") {
    const task = await prisma.crmTask.findFirst({ where: { id: input.taskId, subscriberId } });
    if (!task) throw new DailyActionError("Follow-up not found",404);
    if (!await customerCrmReferences(subscriberId, { leadId: task.leadId, clientId: task.clientId, dealId: task.dealId })) throw new DailyActionError("Linked contact is no longer available",404);
    const activityId = `daily-result:${subscriberId}:${input.requestId}`;
    if (await prisma.crmActivity.findFirst({ where: { id: activityId, subscriberId } })) return { alreadySaved: true };
    try {
    return await prisma.$transaction(async tx => {
      // Conditional claim makes completion retries safe and keeps all writes atomic.
      const claimed = await tx.crmTask.updateMany({ where: { id: task.id, subscriberId, status: "pending", updatedAt: task.updatedAt }, data: input.outcome === "snooze" ? { dueDate: new Date(input.nextAt!), title: input.nextTitle || task.title, description: task.type === "seller_draft" ? task.description : input.note || task.description, updatedAt: now } : { status: "completed", completedAt: now } });
      if (!claimed.count) {
        const current = await tx.crmTask.findFirst({ where: { id: task.id, subscriberId } });
        if (current?.status === "completed" || await tx.crmActivity.findFirst({ where: { id: activityId, subscriberId } })) return { alreadySaved: true };
        throw new DailyActionError("This follow-up changed. Reload Today before saving again.", 409);
      }
      const refs = { leadId: task.leadId, clientId: task.clientId, dealId: task.dealId };
      await tx.crmActivity.create({ data: { id: activityId, subscriberId, ...refs, type: `daily_${input.outcome}`, title: task.title, description: input.note || null, metadata: { taskId: task.id } } });
      if (input.outcome !== "snooze" && input.nextAt) await tx.crmTask.create({ data: { subscriberId, ...refs, title: input.nextTitle || `Follow up: ${task.title}`.slice(0,200), description: input.note || (task.type === "seller_draft" ? null : task.description), dueDate: new Date(input.nextAt), priority: task.priority } });
      return { saved: true };
    });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && await prisma.crmActivity.findFirst({ where: { id: activityId, subscriberId } })) return { alreadySaved: true };
      throw error;
    }
  }

  if (input.action === "adopt-inquiry" && !owner) throw new DailyActionError("Owner access required",403);
  const client = input.action === "add-client" ? await prisma.client.findFirst({ where: { id: input.clientId, subscriberId, status: "active" } }) : null;
  if (input.action === "add-client" && !client) throw new DailyActionError("Contact not found",404);
  const inquiry = input.action === "adopt-inquiry" ? await prisma.leadAction.findFirst({ where: { id: input.inquiryId, status: "new" } }) : null;
  if (input.action === "adopt-inquiry" && !inquiry) throw new DailyActionError("New inquiry not found",404);
  const id = input.action === "capture" ? `capture:${subscriberId}:${input.requestId}` : inquiry ? `inquiry:${subscriberId}:${inquiry.id}` : `client-followup:${subscriberId}:${client!.id}:${dailyBounds(now).start.toISOString().slice(0,10)}`;
  const existing = await prisma.crmTask.findFirst({ where: { id, subscriberId }, select: { id: true } });
  if (existing) return { taskId: existing.id, alreadySaved: true };
  try {
    return await prisma.$transaction(async tx => {
      let clientId = client?.id;
      if (!clientId) {
        const name = input.action === "capture" ? input.name : inquiry?.name || "Website inquiry";
        const [firstName,...last] = name.split(/\s+/);
        const person = await tx.client.create({ data: { subscriberId, firstName, lastName: last.join(" "), buyerSeller: "contact", phone: input.action === "capture" ? input.phone || null : inquiry?.phone, email: input.action === "capture" ? input.email || null : inquiry?.email, preferredCities: [], preferredZips: [], preferredPropertyTypes: [], interests: [], dealbreakers: [] } });
        clientId = person.id;
      }
      const task = await tx.crmTask.create({ data: { id, subscriberId, clientId, title: input.action === "capture" ? input.title : inquiry ? `Reply to ${inquiry.name || "inquiry"} about ${inquiry.subsite}` : `Check in with ${client!.firstName}`, description: inquiry ? `Requested ${inquiry.action} on /${inquiry.subsite}. Review the original request in HQ before replying.` : null, dueDate: input.action === "capture" && input.dueDate ? new Date(input.dueDate) : now, priority: inquiry ? "high" : "medium" } });
      await tx.crmActivity.create({ data: { subscriberId, clientId, type: "daily_added", title: task.title, metadata: { taskId: task.id, ...(inquiry ? { inquiryId: inquiry.id } : {}) } } });
      return { taskId: task.id };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const retry = await prisma.crmTask.findFirst({ where: { id, subscriberId }, select: { id: true } });
      if (retry) return { taskId: retry.id, alreadySaved: true };
    }
    throw error;
  }
}
