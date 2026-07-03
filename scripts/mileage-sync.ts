/**
 * Sync delivery mileage (Buckeye weekly deliveries) into the MileageTrip log.
 * Gap-fills by day so it never double-counts days MileIQ already tracked.
 *
 * Usage:
 *   npx tsx scripts/mileage-sync.ts --year 2026
 *   npx tsx scripts/mileage-sync.ts --from 2026-06-25 --to 2026-12-31
 *   npx tsx scripts/mileage-sync.ts --year 2026 --dry-run
 *
 * Runs weekly via systemd (mileage-sync.timer) and after each Buckeye invoice build.
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
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
loadEnvFile(join(process.cwd(), ".env.production.local"));
loadEnvFile(join(process.cwd(), ".env"));

import { syncBuckeyeMileage, syncWayneMileage } from "../lib/account/invoice-mileage";
import { prisma } from "../lib/prisma";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const year = arg("year");
  let from = arg("from");
  let to = arg("to");
  if (year) {
    from = from || `${year}-01-01`;
    to = to || `${year}-12-31`;
  }

  const source = arg("source") || "all"; // all | buckeye | wayne
  const out: Record<string, unknown> = { from, to, dryRun };
  if (source === "all" || source === "buckeye") {
    out.buckeye = await syncBuckeyeMileage({ from, to, dryRun });
  }
  if (source === "all" || source === "wayne") {
    out.wayne = await syncWayneMileage({ from, to, dryRun });
  }
  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
