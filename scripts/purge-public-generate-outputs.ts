/**
 * Delete public Vercel Blob *job outputs* under generate/** (not identity refs).
 *
 * Run this against the **public** store token (the one that created
 * *.public.blob.vercel-storage.com/generate/…/0-….png).
 *
 *   BLOB_READ_WRITE_TOKEN_PUBLIC=vercel_blob_rw_… \
 *     npx tsx scripts/purge-public-generate-outputs.ts
 *
 * Add --apply to actually delete. Default is dry-run.
 *
 * Identity refs under generate/identity/ are left in place (residual risk —
 * Modal still fetches those over HTTPS). Re-upload privately later if needed.
 */

import { del, list } from "@vercel/blob";

const APPLY = process.argv.includes("--apply");

function publicToken(): string {
  const token = (
    process.env.BLOB_READ_WRITE_TOKEN_PUBLIC ||
    process.env.BLOB_READ_WRITE_TOKEN ||
    ""
  ).trim();
  if (!token) {
    throw new Error("Set BLOB_READ_WRITE_TOKEN_PUBLIC (or BLOB_READ_WRITE_TOKEN) for the public store.");
  }
  return token;
}

function isIdentityRef(pathname: string): boolean {
  return pathname.startsWith("generate/identity/") || pathname.includes("/generate/identity/");
}

function isGenerateOutput(pathname: string): boolean {
  if (!pathname.startsWith("generate/")) return false;
  if (isIdentityRef(pathname)) return false;
  return /\.(png|jpe?g|webp)$/i.test(pathname);
}

async function main() {
  const token = publicToken();
  const doomed: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({
      prefix: "generate/",
      token,
      cursor,
      limit: 200,
    });
    for (const blob of page.blobs) {
      if (isGenerateOutput(blob.pathname)) doomed.push(blob.url);
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  console.log(`${APPLY ? "Deleting" : "Dry-run"} ${doomed.length} public generate output(s).`);
  for (const url of doomed) console.log(`  ${url}`);
  if (!doomed.length) return;
  if (!APPLY) {
    console.log("Re-run with --apply to delete.");
    return;
  }
  await del(doomed, { token });
  console.log(`Deleted ${doomed.length} object(s). Identity refs under generate/identity/ were skipped.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
