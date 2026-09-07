import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  GENERATE_LIBRARY_MAX_AGE_SEC,
  GENERATE_LIBRARY_PIN_LOCAL_FALLBACK,
  buildGenerateLibraryToken,
  expectedGenerateLibraryPin,
  redactGenerateLibraryJobs,
  verifyGenerateLibraryCookie,
  verifyGenerateLibraryPin,
} from "./generate-library-auth-core.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readApp(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

const localEnv = {
  NODE_ENV: "test",
  AUTH_SECRET: "test-auth-secret-for-library-cookie",
  GENERATE_LIBRARY_PIN: "9999",
} as unknown as NodeJS.ProcessEnv;

describe("generate library PIN", () => {
  it("reads GENERATE_LIBRARY_PIN and timing-safe compares", () => {
    assert.equal(expectedGenerateLibraryPin(localEnv), "9999");
    assert.equal(verifyGenerateLibraryPin("9999", localEnv), true);
    assert.equal(verifyGenerateLibraryPin("9998", localEnv), false);
    assert.equal(verifyGenerateLibraryPin("4044", localEnv), false);
    assert.equal(verifyGenerateLibraryPin("", localEnv), false);
  });

  it("falls back to the local test PIN only when env is unset and not production", () => {
    const unset = { NODE_ENV: "test", AUTH_SECRET: "x" } as unknown as NodeJS.ProcessEnv;
    assert.equal(expectedGenerateLibraryPin(unset), GENERATE_LIBRARY_PIN_LOCAL_FALLBACK);
    assert.equal(verifyGenerateLibraryPin(GENERATE_LIBRARY_PIN_LOCAL_FALLBACK, unset), true);

    const prod = { NODE_ENV: "production" } as unknown as NodeJS.ProcessEnv;
    assert.equal(expectedGenerateLibraryPin(prod), "");
    assert.equal(verifyGenerateLibraryPin(GENERATE_LIBRARY_PIN_LOCAL_FALLBACK, prod), false);
  });
});

describe("generate library session cookie", () => {
  it("is bound to the admin actor and expires", () => {
    const now = 1_800_000_000;
    const token = buildGenerateLibraryToken("hq:tolley", localEnv, now);
    assert.ok(token);
    assert.equal(verifyGenerateLibraryCookie(token, "hq:tolley", localEnv, now), true);
    assert.equal(verifyGenerateLibraryCookie(token, "shop-admin", localEnv, now), false);
    assert.equal(verifyGenerateLibraryCookie(token, "hq:tolley", localEnv, now + GENERATE_LIBRARY_MAX_AGE_SEC + 1), false);
    assert.equal(verifyGenerateLibraryCookie("not-a-token", "hq:tolley", localEnv, now), false);
    assert.equal(verifyGenerateLibraryCookie(token, "hq:tolley", { ...localEnv, GENERATE_LIBRARY_PIN: "other" }, now), false);
  });

  it("refuses a cookie when AUTH_SECRET is missing", () => {
    const env = { NODE_ENV: "test", GENERATE_LIBRARY_PIN: "9999" } as unknown as NodeJS.ProcessEnv;
    assert.equal(buildGenerateLibraryToken("hq:tolley", env, 10), null);
    assert.equal(verifyGenerateLibraryCookie("10.deadbeef", "hq:tolley", env, 10), false);
  });
});

describe("library list redaction", () => {
  it("unauth / admin-without-pin see no jobs; unlocked admin sees them", () => {
    const jobs = [{ id: "job-nsfw" }, { id: "job-2" }];
    assert.deepEqual(redactGenerateLibraryJobs(jobs, false), []);
    assert.deepEqual(redactGenerateLibraryJobs(jobs, true), jobs);
  });
});

describe("library API + UI contracts", () => {
  it("unauth and admin-without-pin are denied library list/media; pin unlock is server-side", () => {
    const jobs = readApp("app/api/generate/jobs/route.ts");
    const image = readApp("app/api/generate/jobs/[id]/image/route.ts");
    const media = readApp("app/api/generate/jobs/[id]/media/route.ts");
    const library = readApp("app/api/generate/library/route.ts");
    const gate = readApp("app/generate/library-gate.tsx");
    const studio = readApp("app/generate/generate-studio.tsx");
    const logout = readApp("app/api/hq/logout/route.ts");

    assert.match(jobs, /requireGenerateAdmin/);
    assert.match(jobs, /isGenerateLibraryUnlocked/);
    assert.match(jobs, /redactGenerateLibraryJobs/);
    assert.match(jobs, /library:\s*\{\s*unlocked/);

    assert.match(image, /requireGenerateLibrary/);
    assert.match(image, /hide:\s*true/);
    assert.doesNotMatch(image, /requireGenerateAdmin\(\)/);

    assert.match(media, /from "\.\.\/image\/route"/);

    assert.match(library, /verifyGenerateLibraryPin/);
    assert.match(library, /buildGenerateLibraryCookie/);
    assert.match(library, /requireGenerateAdmin/);
    assert.doesNotMatch(library, /4044/);

    assert.match(gate, /data-testid="generate-library-gate"/);
    assert.match(gate, /Unlock library/);
    assert.match(gate, /\/api\/generate\/library/);
    assert.doesNotMatch(gate, /localStorage/);
    assert.doesNotMatch(gate, /4044/);
    assert.doesNotMatch(studio, /4044/);
    assert.doesNotMatch(studio, /GENERATE_LIBRARY_PIN/);

    assert.match(logout, /clearGenerateLibraryCookie/);
  });

  it("does not ship the library PIN as a client plaintext constant", () => {
    const gate = readApp("app/generate/library-gate.tsx");
    const studio = readApp("app/generate/generate-studio.tsx");
    assert.doesNotMatch(gate, /GENERATE_LIBRARY_PIN_LOCAL_FALLBACK/);
    assert.doesNotMatch(studio, /GENERATE_LIBRARY_PIN_LOCAL_FALLBACK/);
    assert.doesNotMatch(gate, /libraryVisible/);
    assert.doesNotMatch(studio, /libraryVisible/);
  });
});
