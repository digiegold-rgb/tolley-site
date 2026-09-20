import { readFile } from "node:fs/promises";
import { prisma } from "../../lib/prisma";
async function main() {
  const sql = await readFile(new URL('../../prisma/migrations/20260920_live_growth/migration.sql',import.meta.url),'utf8');
  await prisma.$transaction(async tx=>{
    const existing=await tx.$queryRaw<{name:string|null}[]>`SELECT to_regclass('public."LiveSettings"')::text as name`;
    if(existing[0]?.name) throw new Error('Live tables already exist; verify schema before applying again');
    for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement);
  });
  console.log('Additive live-growth tables created');
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>prisma.$disconnect());
