import test from "node:test";
import assert from "node:assert/strict";
import {
  databaseUrlWithTimeouts,
  isReadOnlyDatabaseUrl,
  NO_WRITE_URL_ERROR,
  resolveWritableDatabaseUrl,
  withPrismaTimeout,
} from "./prisma-url.ts";

test("databaseUrlWithTimeouts adds connect and pool timeouts", () => {
  const out = databaseUrlWithTimeouts(
    "postgresql://user:pass@ep-example.us-east-1.aws.neon.tech/neondb?sslmode=require",
  );
  assert.ok(out);
  const url = new URL(out);
  assert.equal(url.searchParams.get("connect_timeout"), "10");
  assert.equal(url.searchParams.get("pool_timeout"), "10");
  assert.equal(url.searchParams.get("sslmode"), "require");
});

test("databaseUrlWithTimeouts does not override an existing connect_timeout", () => {
  const out = databaseUrlWithTimeouts(
    "postgresql://user:pass@localhost/db?connect_timeout=3",
  );
  assert.ok(out);
  const url = new URL(out);
  assert.equal(url.searchParams.get("connect_timeout"), "3");
  assert.equal(url.searchParams.get("pool_timeout"), "10");
});

test("databaseUrlWithTimeouts leaves unparseable URLs alone", () => {
  assert.equal(databaseUrlWithTimeouts(undefined), undefined);
  assert.equal(databaseUrlWithTimeouts("not a url"), "not a url");
});

test("withPrismaTimeout returns the fallback when the query never settles", async () => {
  const hung = new Promise<string>(() => {});
  const started = Date.now();
  const result = await withPrismaTimeout(hung, "fallback", 25);
  assert.equal(result, "fallback");
  assert.ok(Date.now() - started < 500, "must not wait on a hung query");
});

test("withPrismaTimeout returns the value when the query finishes", async () => {
  const result = await withPrismaTimeout(Promise.resolve("ok"), "fallback", 200);
  assert.equal(result, "ok");
});

test("withPrismaTimeout uses the fallback when the query rejects", async () => {
  const result = await withPrismaTimeout(
    Promise.reject(new Error("neon down")),
    [],
    200,
  );
  assert.deepEqual(result, []);
});

const PRIMARY =
  "postgresql://app:secret@ep-example.us-east-2.aws.neon.tech/appdb?sslmode=require";

test("isReadOnlyDatabaseUrl is false for a primary Neon host", () => {
  assert.equal(isReadOnlyDatabaseUrl(PRIMARY), false);
  assert.equal(
    isReadOnlyDatabaseUrl(
      "postgresql://app:secret@ep-example-pooler.us-east-2.aws.neon.tech/appdb?sslmode=require",
    ),
    false,
  );
});

test("isReadOnlyDatabaseUrl detects replica hosts and read-only session attrs", () => {
  assert.equal(
    isReadOnlyDatabaseUrl(
      "postgresql://app:secret@ep-read-replica-12345.us-east-2.aws.neon.tech/appdb",
    ),
    true,
  );
  assert.equal(
    isReadOnlyDatabaseUrl(`${PRIMARY}&target_session_attrs=read-only`),
    true,
  );
  assert.equal(
    isReadOnlyDatabaseUrl(`${PRIMARY}&target_session_attrs=standby`),
    true,
  );
});

test("isReadOnlyDatabaseUrl detects session and Neon time-travel read-only options", () => {
  assert.equal(
    isReadOnlyDatabaseUrl(
      `${PRIMARY}&options=${encodeURIComponent("-c default_transaction_read_only=on")}`,
    ),
    true,
  );
  assert.equal(
    isReadOnlyDatabaseUrl(
      `${PRIMARY}&options=${encodeURIComponent("project=example&timestamp=2026-01-01T00:00:00Z")}`,
    ),
    true,
  );
  assert.equal(isReadOnlyDatabaseUrl(`${PRIMARY}&timestamp=2026-01-01T00:00:00Z`), true);
});

test("resolveWritableDatabaseUrl uses DATABASE_URL and ignores invented write secrets", () => {
  const env = {
    DATABASE_URL: PRIMARY,
    DIRECT_URL: "postgresql://app:secret@invented-direct.example/db",
    DATABASE_URL_UNPOOLED: "postgresql://app:secret@invented-unpooled.example/db",
  };
  assert.equal(resolveWritableDatabaseUrl(env), PRIMARY);
  assert.equal(resolveWritableDatabaseUrl({}), undefined);
});

test("resolveWritableDatabaseUrl fails closed on a read-only DATABASE_URL", () => {
  const env = {
    DATABASE_URL:
      "postgresql://app:secret@ep-read-replica-12345.us-east-2.aws.neon.tech/appdb",
    DIRECT_URL: "postgresql://app:secret@invented-direct.example/db",
  };
  assert.throws(() => resolveWritableDatabaseUrl(env), (err: unknown) => {
    assert.ok(err instanceof Error);
    assert.equal(err.message, NO_WRITE_URL_ERROR);
    return true;
  });
});
