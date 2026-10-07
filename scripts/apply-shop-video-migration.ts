/** Review by default; apply only the five additive Shop Video tables. */
import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync } from "node:fs";
const prisma=new PrismaClient();
const tables=["ShopVideoProduct","ShopVideoAccount","ShopVideoBatch","ShopVideoJob","ShopVideoCommission"];
async function main(){
  const columns=await prisma.$queryRaw<{table_name:string;column_name:string;data_type:string}[]>`SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema=current_schema() AND table_name LIKE 'ShopVideo%' ORDER BY table_name,ordinal_position`;
  const found=new Set(columns.map(c=>c.table_name));
  if(tables.every(t=>found.has(t))){console.log(JSON.stringify({schema:"present",writes:0}));return;}
  if(found.size)throw new Error("Partial Shop Video schema detected; stop and reconcile");
  if(!process.argv.includes("--apply")){console.log(JSON.stringify({schema:"ready_for_additive_migration",addedTables:5,writes:0}));return;}
  const snapshot=process.argv[process.argv.indexOf("--snapshot")+1];
  if(!snapshot?.startsWith("/"))throw new Error("--apply requires an absolute --snapshot path");
  const sql=readFileSync("prisma/migrations/20261007000000_shop_video_batch/migration.sql","utf8");
  if(/^\s*(DROP|DELETE|TRUNCATE|UPDATE|INSERT)\b/im.test(sql))throw new Error("Migration must be additive only");
  writeFileSync(snapshot,JSON.stringify({capturedAt:new Date(),columns,migration:sql},null,2),{flag:"wx",mode:0o600});
  await prisma.$transaction(async tx=>{
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '30s'");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('tolley-shop-video-migration-20261007'))`;
    for(const statement of sql.split(";").map(s=>s.trim()).filter(Boolean))await tx.$executeRawUnsafe(statement);
  },{timeout:60000});
  console.log(JSON.stringify({schema:"applied",addedTables:5,existingRowsDeleted:0,next:"Record 20261007000000_shop_video_batch with Prisma migrate resolve before deploying"}));
}
main().catch(e=>{console.error(e instanceof Error && /^(Partial|--apply|Migration)/.test(e.message)?e.message:"Shop Video migration failed; check locks, connectivity and snapshot path");process.exitCode=1;}).finally(()=>prisma.$disconnect());
