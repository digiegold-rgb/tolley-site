import { readFile } from "node:fs/promises";
import { put } from "@vercel/blob";
import { prisma } from "../../lib/prisma";
import { drainClips, registerClip } from "../../lib/live/publish";
import { canAutoPublish } from "../../lib/live/core";
const [command, path] = process.argv.slice(2);
async function main() {
  if (command === "drain") return drainClips();
  if (command === "ingest") {
    const manifest = JSON.parse(await readFile(path, "utf8"));
    const { file, ...data } = manifest;
    if (await prisma.liveClip.findUnique({ where: { id: data.id } })) return;
    if (!canAutoPublish(data.review)) {
      // Held media stays on the DGX, never uploaded to a public bucket.
      await prisma.liveClip.create({ data: { ...data, mediaUrl: "", status: "held" } }); return;
    }
    const blob = await put(`stream-clips/${data.id}.mp4`, await readFile(file), { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "video/mp4" });
    await registerClip({ ...data, mediaUrl: blob.url });return;
  }
  throw new Error("Use ingest <manifest.json> or drain");
}
main().catch(e => { console.error(e instanceof Error ? e.message : "Clip worker failed");process.exitCode=1; }).finally(()=>prisma.$disconnect());
