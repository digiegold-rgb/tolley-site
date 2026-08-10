/**
 * One-shot: publish the crossover re-animate takes (kling/wan hybrids +
 * alternates from DGX job a198beeb86ad4884) to Vercel Blob so the Course
 * Studio Clip Library can serve them to Trey. The 27 fal takes from the same
 * night were already cleaned off disk — only their ledger rows survive.
 *
 * Keys: vater-clips/<projectId>/scene-<NNN>[-vN].mp4
 * The bare scene-<NNN>.mp4 is the CURRENT take (what the final uses);
 * -vN are the alternates (superseded takes, still useful as course b-roll).
 *
 * Usage: npx tsx scripts/tmp-course-clips-upload.ts [--dry-run]
 */
import { put } from "@vercel/blob";
import { spawnSync } from "child_process";
import { existsSync, readFileSync, readdirSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join, basename } from "path";

function loadEnvFile(p: string) {
  if (!existsSync(p)) return;
  for (const raw of readFileSync(p, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvFile(join(process.cwd(), ".env.local"));

const PROJECT_ID = "cmsks8hae0001l4wcze2zf4ka"; // crossover — source of the takes
const SRC_DIR = "/home/jelly/content-autopilot/vater_work/a198beeb86ad4884/scenes";
const DRY = process.argv.includes("--dry-run");

async function main() {
  const files = readdirSync(SRC_DIR)
    .filter((f) => f.endsWith(".mp4"))
    .sort();
  console.log(`${files.length} clips in ${SRC_DIR}`);
  let uploaded = 0;
  for (const f of files) {
    const src = join(SRC_DIR, f);
    const key = `vater-clips/${PROJECT_ID}/scene-${basename(f)}`;
    if (DRY) {
      console.log(`would upload ${f} → ${key}`);
      continue;
    }
    // faststart remux (stream copy, idempotent) so browser playback starts
    // without downloading the whole file.
    const tmp = join(tmpdir(), `clip-faststart-${process.pid}-${f}`);
    const res = spawnSync("ffmpeg", [
      "-v", "error", "-y", "-i", src,
      "-c", "copy", "-movflags", "+faststart", tmp,
    ]);
    const body = readFileSync(res.status === 0 && existsSync(tmp) ? tmp : src);
    const blob = await put(key, body, {
      access: "public",
      contentType: "video/mp4",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    if (existsSync(tmp)) unlinkSync(tmp);
    uploaded++;
    console.log(`${uploaded}/${files.length} ${f} → ${blob.url}`);
  }
  console.log("DONE");
}

main().catch((e) => {
  console.error("UPLOAD FAILED:", e);
  process.exit(1);
});
