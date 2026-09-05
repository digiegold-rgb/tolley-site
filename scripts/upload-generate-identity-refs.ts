/**
 * Upload the three grey-shirt identity refs to Vercel Blob and print env URLs.
 *
 * Usage:
 *   npx tsx scripts/upload-generate-identity-refs.ts \
 *     --front ./front.jpg --left ./profile-left.jpg --right ./profile-right.jpg
 *
 * Do not pass Spark paths into Modal workers. This script is the durable-asset step.
 *
 * Identity refs may stay on the public store for now (Modal fetches HTTPS).
 * Job *outputs* must not use this public put — see spark/generate-store.
 */
import { readFileSync } from "node:fs";
import { put } from "@vercel/blob";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

async function upload(kind: string, filePath: string): Promise<string> {
  const buf = readFileSync(filePath);
  const ext = (filePath.split(".").pop() || "jpg").toLowerCase();
  const ct = ext === "png" ? "image/png" : "image/jpeg";
  const blob = await put(`generate/identity/${kind}.${ext}`, buf, {
    access: "public",
    contentType: ct,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return blob.url;
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required");
  }
  const front = arg("front");
  const left = arg("left");
  const right = arg("right");
  if (!front || !left || !right) {
    throw new Error("Need --front --left --right file paths");
  }
  const frontUrl = await upload("front", front);
  const leftUrl = await upload("profile-left", left);
  const rightUrl = await upload("profile-right", right);
  console.log("Set these on Vercel:");
  console.log(`GENERATE_IDENTITY_REF_FRONT_URL=${frontUrl}`);
  console.log(`GENERATE_IDENTITY_REF_LEFT_URL=${leftUrl}`);
  console.log(`GENERATE_IDENTITY_REF_RIGHT_URL=${rightUrl}`);
  console.log(`GENERATE_IDENTITY_REF_URLS=${frontUrl},${leftUrl},${rightUrl}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
