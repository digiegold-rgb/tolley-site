import { readFile } from "node:fs/promises";
import { put } from "@vercel/blob";
import { prisma } from "../../lib/prisma";
import { drainClips, registerClip, matchShowForClip } from "../../lib/live/publish";
import { canAutoPublish } from "../../lib/live/core";
const [command, path] = process.argv.slice(2);
async function main() {
  if (command === "activity") {
    const data = JSON.parse(path);
    if (typeof data.id !== "string" || !data.id.startsWith("clip-") || typeof data.detail !== "string") throw new Error("Invalid activity");
    const value = { kind: "clips", status: String(data.status).slice(0,40), title: String(data.title).slice(0,200), detail: data.detail.slice(0,1000) };
    await prisma.growthActivity.upsert({ where: { id: data.id }, create: { id: data.id, ...value }, update: value }); return;
  }
  if (command === "drain") return drainClips();
  if (command === "ingest") {
    const manifest = JSON.parse(await readFile(path, "utf8"));
    const { file, recordedAt, ...data } = manifest;
    const showId = await matchShowForClip(recordedAt, data.startS, data.endS);
    data.showId = showId;
    if (!showId) data.review = { ...data.review, reason: "No confirmed public show covers this clip. Held locally." };
    if (await prisma.liveClip.findUnique({ where: { id: data.id } })) return;
    if (!showId || !canAutoPublish(data.review)) {
      // Held media stays on the DGX, never uploaded to a public bucket.
      await prisma.liveClip.create({ data: { ...data, mediaUrl: "", status: "held" } }); return;
    }
    const blob = await put(`stream-clips/${data.id}.mp4`, await readFile(file), { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "video/mp4" });
    await registerClip({ ...data, mediaUrl: blob.url });return;
  }
  throw new Error("Use ingest <manifest.json> or drain");
}
main().catch(e => { console.error(e instanceof Error ? e.message : "Clip worker failed");process.exitCode=1; }).finally(()=>prisma.$disconnect());
