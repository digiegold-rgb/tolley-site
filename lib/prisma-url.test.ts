import test from "node:test";
import assert from "node:assert/strict";
import { databaseUrlWithTimeouts, withPrismaTimeout } from "./prisma-url";

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
