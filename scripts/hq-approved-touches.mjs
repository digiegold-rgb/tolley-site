#!/usr/bin/env node
/**
 * Growth outbound DB bridge (Engine 1 sender + reply poller).
 * Runs from inside tolley-site so @prisma/client resolves:
 *   node --env-file=.env.local scripts/hq-approved-touches.mjs <mode> [json-arg]
 *
 * READ-ONLY by default. The only writes are the explicit "mark-*" / "record-*"
 * mutations the growth-engine sender/poller asks for — it never touches /wd, /hq,
 * app code, or schema. All business logic (throttle, sequencing gates, Instantly
 * calls) lives in ~/growth-engine/outbound/*.mjs; this file is just the data plane.
 *
 * Modes:
 *   list-approved              -> JSON {touches:[{id, leadId, channel, direction,
 *                                  status, subject, body, meta, lead:{id,name,
 *                                  ownerName,email,stage,offer,city,category,
 *                                  rating,reviews,demoUrl}}]}  (approved, out, email;
 *                                  offer="listing" rows EXCLUDED — those go through
 *                                  the direct sender, never Instantly)
 *   list-approved-direct       -> same shape, but ONLY lead.offer="listing", any
 *                                  channel (sms+email), lead includes phone/address.
 *   sent-steps  <json>         -> {sentByLead:{<leadId>:[{seq,step,sentAt,
 *                                  sendOffsetDays}]}} for the given leadIds — lets the
 *                                  sender enforce drip gating. Optional "channel" in
 *                                  the JSON arg ("email" default, "any" = no filter).
 *   mark-sent   <json:[ids]>   -> sets status="sent", sentAt=now for those touch ids.
 *   mark-contacted <json:[leadIds]> -> sets stage="contacted" (only if not already
 *                                  past contacted) for step-1 sends.
 *   lead-by-email <json:{emails:[...]}> -> {leads:[{id,name,ownerName,email,stage,offer}]}
 *   record-reply <json:{leadId,body,classification,subject}> -> creates GrowthTouch
 *                                  (channel=email, direction=in, status=received).
 *   draft-reply  <json:{leadId,subject,body}> -> creates GrowthTouch
 *                                  (channel=email, direction=out, status=draft).
 *   set-stage    <json:{leadId,stage}> -> sets GrowthLead.stage.
 *
 * Prints exactly one JSON object to stdout (last line). Errors -> stderr + exit 1.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const mode = process.argv[2];
const rawArg = process.argv[3];
const arg = rawArg ? JSON.parse(rawArg) : null;

const LEAD_SELECT = {
  id: true, name: true, ownerName: true, email: true, stage: true,
  offer: true, city: true, category: true, rating: true, reviews: true, demoUrl: true,
};

// stage ordering so we never regress a lead that's already further along
const STAGE_ORDER = ['scraped', 'enriched', 'demo_built', 'contacted', 'replied', 'booked', 'client', 'dead'];
const rank = (s) => { const i = STAGE_ORDER.indexOf(s); return i === -1 ? 0 : i; };

async function main() {
  switch (mode) {
    case 'list-approved': {
      const touches = await prisma.growthTouch.findMany({
        // offer="listing" must NEVER flow to Instantly — the direct sender
        // (send-approved-direct.mjs) owns those via list-approved-direct.
        where: {
          status: 'approved', channel: 'email', direction: 'out',
          lead: { offer: { not: 'listing' } },
        },
        include: { lead: { select: LEAD_SELECT } },
        orderBy: { createdAt: 'asc' },
      });
      return { touches };
    }

    case 'list-approved-direct': {
      const touches = await prisma.growthTouch.findMany({
        where: { status: 'approved', direction: 'out', lead: { offer: 'listing' } },
        include: { lead: { select: { ...LEAD_SELECT, phone: true, address: true } } },
        orderBy: { createdAt: 'asc' },
      });
      return { touches };
    }

    case 'sent-steps': {
      const leadIds = arg?.leadIds ?? [];
      // Channel-aware (default "email" keeps the Instantly sender unchanged);
      // pass channel:"any" to gate across mixed sms+email sequences.
      const channel = arg?.channel ?? 'email';
      const sent = await prisma.growthTouch.findMany({
        where: {
          leadId: { in: leadIds }, status: 'sent', direction: 'out',
          ...(channel === 'any' ? {} : { channel }),
        },
        select: { leadId: true, meta: true, sentAt: true },
      });
      const sentByLead = {};
      for (const t of sent) {
        (sentByLead[t.leadId] ??= []).push({
          seq: t.meta?.seq ?? null,
          step: t.meta?.step ?? null,
          sendOffsetDays: t.meta?.sendOffsetDays ?? null,
          sentAt: t.sentAt ? t.sentAt.toISOString() : null,
        });
      }
      return { sentByLead };
    }

    case 'mark-sent': {
      const ids = arg ?? [];
      const r = await prisma.growthTouch.updateMany({
        where: { id: { in: ids }, status: 'approved' },
        data: { status: 'sent', sentAt: new Date() },
      });
      return { updated: r.count };
    }

    case 'mark-contacted': {
      const leadIds = arg ?? [];
      const leads = await prisma.growthLead.findMany({
        where: { id: { in: leadIds } }, select: { id: true, stage: true },
      });
      let updated = 0;
      for (const l of leads) {
        if (rank(l.stage) < rank('contacted')) {
          await prisma.growthLead.update({ where: { id: l.id }, data: { stage: 'contacted' } });
          updated++;
        }
      }
      return { updated };
    }

    case 'lead-by-email': {
      const emails = (arg?.emails ?? []).filter(Boolean).map((e) => e.toLowerCase());
      // Prisma is case-sensitive on Postgres by default; pull a superset and match in JS.
      const leads = await prisma.growthLead.findMany({
        where: { email: { not: null } }, select: LEAD_SELECT,
      });
      const set = new Set(emails);
      return { leads: leads.filter((l) => l.email && set.has(l.email.toLowerCase())) };
    }

    case 'record-reply': {
      const t = await prisma.growthTouch.create({
        data: {
          leadId: arg.leadId, channel: 'email', direction: 'in', status: 'received',
          subject: arg.subject ?? null, body: arg.body ?? '',
          meta: { classification: arg.classification ?? 'unknown' },
        },
        select: { id: true },
      });
      return { id: t.id };
    }

    case 'draft-reply': {
      const t = await prisma.growthTouch.create({
        data: {
          leadId: arg.leadId, channel: 'email', direction: 'out', status: 'draft',
          subject: arg.subject ?? null, body: arg.body ?? '',
          meta: { kind: 'reply-suggestion', auto: true },
        },
        select: { id: true },
      });
      return { id: t.id };
    }

    case 'set-stage': {
      // never regress past current stage unless going to a terminal "dead"
      const lead = await prisma.growthLead.findUnique({ where: { id: arg.leadId }, select: { stage: true } });
      if (!lead) return { updated: 0, note: 'lead not found' };
      const target = arg.stage;
      if (target === 'dead' || rank(target) > rank(lead.stage)) {
        await prisma.growthLead.update({ where: { id: arg.leadId }, data: { stage: target } });
        return { updated: 1 };
      }
      return { updated: 0, note: `kept ${lead.stage} (>= ${target})` };
    }

    default:
      throw new Error(`unknown mode: ${mode}`);
  }
}

main()
  .then((out) => { process.stdout.write(JSON.stringify(out) + '\n'); })
  .catch((e) => { console.error('[hq-bridge]', e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
