import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("the render delivery CLI starts and validates arguments without uploading", () => {
  const result = spawnSync(process.execPath, [...process.execArgv, "scripts/vater-blob-upload.ts"], {
    encoding: "utf8", timeout: 30_000,
  });
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /usage: --file/);
});

test("the release check rejects the missing-brace upload regression", async () => {
  const { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join, resolve } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "listing-upload-syntax-"));
  try {
    mkdirSync(join(dir, "scripts/lib"), { recursive: true });
    const original = readFileSync("scripts/vater-blob-upload.ts", "utf8");
    const broken = original.replace("return uploadFileToBlob(filePath, key, contentType);\n}", "return uploadFileToBlob(filePath, key, contentType);");
    assert.notEqual(broken, original);
    writeFileSync(join(dir, "scripts/vater-blob-upload.ts"), broken);
    writeFileSync(join(dir, "scripts/lib/blob-put.ts"), readFileSync("scripts/lib/blob-put.ts"));
    const result = spawnSync(process.execPath, [resolve("scripts/check-render-upload.mjs")], {
      cwd: dir, encoding: "utf8", timeout: 30_000,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /expected/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
