import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { prisma } from "../lib/prisma";
if(new URL(process.env.DATABASE_URL||"http://missing").port!=="55458")throw new Error("Requires isolated database");
async function main(){
  const sql=await readFile("prisma/migrations/20261008000000_content_income/migration.sql","utf8");
  assert.equal(/^\s*(DROP|DELETE|TRUNCATE|UPDATE|INSERT)\b/im.test(sql),false);
  const rollback=new Error("rollback fixture");
  try{await prisma.$transaction(async tx=>{
    await tx.$executeRawUnsafe("CREATE SCHEMA income_migration_fixture");
    await tx.$executeRawUnsafe("SET LOCAL search_path TO income_migration_fixture");
    await tx.$executeRawUnsafe('CREATE TABLE "ExistingData" (id integer, value text)');
    await tx.$executeRawUnsafe("INSERT INTO \"ExistingData\" VALUES (1,'keep this row')");
    for(const s of sql.split(";").map(s=>s.trim()).filter(Boolean))await tx.$executeRawUnsafe(s);
    const tables=await tx.$queryRaw<{table_name:string}[]>`SELECT table_name FROM information_schema.tables WHERE table_schema='income_migration_fixture'`;
    assert.equal(tables.length,5);
    const row=await tx.$queryRaw<{value:string}[]>`SELECT value FROM "ExistingData"`;
    assert.equal(row[0].value,"keep this row");
    const fks=await tx.$queryRaw<{update_rule:string}[]>`SELECT update_rule FROM information_schema.referential_constraints WHERE constraint_schema='income_migration_fixture'`;
    assert.equal(fks.length,3);assert.ok(fks.every(f=>f.update_rule==="CASCADE"));
    throw rollback;
  });}catch(e){if(e!==rollback)throw e;}
  console.log("Content Income migration: four additive tables, three foreign keys, existing row preserved");
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>prisma.$disconnect());
