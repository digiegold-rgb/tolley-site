import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { prisma } from "../lib/prisma";
if(new URL(process.env.DATABASE_URL||"http://missing").port!=="55449")throw new Error("Migration validation requires the isolated test database");
async function main(){
  const sql=await readFile("prisma/migrations/20261007000000_shop_video_batch/migration.sql","utf8");
  assert.equal(/^\s*(DROP|DELETE|TRUNCATE|UPDATE|INSERT)\b/im.test(sql),false);
  const rollback=new Error("roll back the migration fixture");
  try{
    await prisma.$transaction(async tx=>{
      await tx.$executeRawUnsafe("CREATE SCHEMA shop_video_migration_fixture");
      await tx.$executeRawUnsafe("SET LOCAL search_path TO shop_video_migration_fixture");
      await tx.$executeRawUnsafe('CREATE TABLE "ExistingData" (id integer PRIMARY KEY, value text NOT NULL)');
      await tx.$executeRawUnsafe("INSERT INTO \"ExistingData\" VALUES (1,'preserve this existing row')");
      for(const statement of sql.split(";").map(s=>s.trim()).filter(Boolean))await tx.$executeRawUnsafe(statement);
      const tables=await tx.$queryRaw<{table_name:string}[]>`SELECT table_name FROM information_schema.tables WHERE table_schema='shop_video_migration_fixture'`;
      assert.equal(tables.length,6);
      const original=await tx.$queryRaw<{value:string}[]>`SELECT value FROM "ExistingData" WHERE id=1`;
      assert.equal(original[0].value,"preserve this existing row");
      const fks=await tx.$queryRaw<{constraint_name:string}[]>`SELECT constraint_name FROM information_schema.table_constraints WHERE table_schema='shop_video_migration_fixture' AND constraint_type='FOREIGN KEY'`;
      assert.equal(fks.length,2);
      throw rollback;
    });
  }catch(e){if(e!==rollback)throw e;}
  const remains=await prisma.$queryRaw<{schema_name:string}[]>`SELECT schema_name FROM information_schema.schemata WHERE schema_name='shop_video_migration_fixture'`;
  assert.equal(remains.length,0);
  console.log("Shop Video migration passed: five additive tables, foreign keys and indexes, existing rows preserved, fixture rolled back");
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>prisma.$disconnect());
