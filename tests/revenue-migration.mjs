// Applies the additive migration to the exact release schema inside a rolled-back
// transaction in the disposable test database. No production URL is accepted.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const database = process.env.DATABASE_URL;
if (database !== 'postgresql://postgres@127.0.0.1:55438/tolley_revenue_test') throw new Error('Exact isolated test database required');
const baseline = process.argv[2];
if (!baseline || !/^[a-f0-9]{7,40}$/.test(baseline)) throw new Error('Pass the baseline release commit');
const temp = mkdtempSync(join(tmpdir(), 'tolley-migration-'));
try {
  const schemaPath = join(temp, 'schema.prisma');
  writeFileSync(schemaPath, execFileSync('git', ['show', `${baseline}:prisma/schema.prisma`]));
  const ddl = execFileSync('node', ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', schemaPath, '--script'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const migration = readFileSync('prisma/migrations/20260908020000_revenue_repair/migration.sql', 'utf8');
  const sql = `BEGIN;
CREATE SCHEMA revenue_migration_validation;
SET LOCAL search_path TO revenue_migration_validation;
${ddl.replaceAll('"public"', '"revenue_migration_validation"')}
INSERT INTO "WdClient" ("id", "name", "unitDescription", "updatedAt") VALUES ('migration-client', 'Test', 'Test', NOW());
INSERT INTO "WdPayment" ("id", "clientId", "amount", "month", "paidAt") VALUES ('migration-payment', 'migration-client', 58, '2025-08', '2025-08-01');
${migration}
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM "WdPayment" WHERE id = 'migration-payment' AND amount = 58 AND "paidAt" = '2025-08-01' AND "paidAtSource" IS NULL AND "failureAttempts" = 0) THEN
    RAISE EXCEPTION 'Historical payment changed';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'revenue_migration_validation' AND table_name = 'LeadNotification') <> 12 THEN
    RAISE EXCEPTION 'Notification table schema mismatch';
  END IF;
END $$;
ROLLBACK;`;
  const run = spawnSync('node', ['node_modules/prisma/build/index.js', 'db', 'execute', '--url', database, '--stdin'], { input: sql, encoding: 'utf8' });
  if (run.status !== 0) throw new Error(run.stderr || run.stdout || 'Migration test failed');
  console.log('PASS: full release schema + additive migration; historical payment preserved; transaction rolled back.');
  const execute = sql => {
    const result = spawnSync('node', ['node_modules/prisma/build/index.js', 'db', 'execute', '--url', database, '--stdin'], { input: sql, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr || 'Isolated SQL failed');
  };
  execute(`CREATE SCHEMA revenue_migration_release;\n${ddl.replaceAll('"public"', '"revenue_migration_release"')}`);
  try {
    const runRelease = args => execFileSync('node', ['--import', '/home/jelly/.npm-global/lib/node_modules/tsx/dist/loader.mjs', 'scripts/apply-revenue-migration.ts', ...args], {
      encoding: 'utf8', env: { ...process.env, DATABASE_URL: `${database}?schema=revenue_migration_release` },
    });
    assert.equal(JSON.parse(runRelease([])).schema, 'ready_for_additive_migration');
    assert.equal(JSON.parse(runRelease(['--apply', '--snapshot', join(temp, 'schema-before.json')])).schema, 'applied');
    assert.equal(JSON.parse(runRelease([])).schema, 'present');
    console.log('PASS: release script review, transactional apply, private schema snapshot, and repeat-run detection.');
  } finally { execute('DROP SCHEMA revenue_migration_release CASCADE'); }
} finally { rmSync(temp, { recursive: true, force: true }); }
