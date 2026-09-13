import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { inMlsFarm, mlsSweepSchema, scoreMlsCapture } from "./mls-research";
import type { z } from "zod";

/** Authenticated MLS material stays in subscriber-owned CRM records, never shared listings/dossiers. */
export async function ingestMlsSweep(subscriberId: string, input: z.infer<typeof mlsSweepSchema>, now = new Date()) {
  const recent = (stamp: string) => Math.abs(now.getTime() - new Date(stamp).getTime()) <= 30 * 60000;
  if (!recent(input.observedAt) || input.captures.some(c => !recent(c.observedAt) || !inMlsFarm(c))) throw new Error("Sweep must contain fresh observations in the configured farm");
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${`mls-ingest:${subscriberId}`}))`;
    const receiptId = `mls-sweep:${subscriberId}`;
    const previous = await tx.crmActivity.findUnique({where:{id:receiptId}});
    const meta = previous?.metadata as {observedAt?:string;runId?:string} | null;
    if (meta?.runId === input.runId || (meta?.observedAt && meta.observedAt > input.observedAt)) return {alreadySaved:true};
    for (const capture of input.captures) {
      const key = createHash("sha256").update(`${subscriberId}:${capture.provider}:${capture.recordId}`).digest("hex").slice(0,32);
      const leadId = `mls-lead:${key}`, id = `mls-capture:${key}`;
      const {score,reasons} = scoreMlsCapture(capture);
      await tx.lead.upsert({where:{id:leadId},create:{id:leadId,ownerSubscriberId:subscriberId,source:"mls_browser",score,ownerName:capture.ownerName},update:{score}});
      const metadata = JSON.parse(JSON.stringify({version:1,runId:input.runId,capture,score,reasons}));
      await tx.crmActivity.upsert({where:{id},create:{id,subscriberId,leadId,type:"mls_capture",title:`MLS research: ${capture.address}`,metadata,createdAt:now},update:{metadata,createdAt:now}});
    }
    const metadata = {runId:input.runId,observedAt:input.observedAt,status:input.status,message:input.message,count:input.captures.length};
    await tx.crmActivity.upsert({where:{id:receiptId},create:{id:receiptId,subscriberId,type:"mls_sweep",title:"Live MLS research",metadata,createdAt:now},update:{metadata,createdAt:now}});
    return {saved:input.captures.length,status:input.status};
  },{timeout:30000});
}
