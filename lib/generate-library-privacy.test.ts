import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GENERATE_LIBRARY_VISIBLE_KEY,
  readGenerateLibraryVisible,
  writeGenerateLibraryVisible,
} from "./generate-library-privacy.ts";

describe("generate library privacy", () => {
  it("defaults hidden when storage is empty, missing, or unavailable", () => {
    assert.equal(readGenerateLibraryVisible(null), false);
    assert.equal(readGenerateLibraryVisible(undefined), false);
    const mem = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
      removeItem: (k: string) => {
        mem.delete(k);
      },
    };
    assert.equal(readGenerateLibraryVisible(storage), false);
    storage.setItem(GENERATE_LIBRARY_VISIBLE_KEY, "0");
    assert.equal(readGenerateLibraryVisible(storage), false);
    storage.setItem(GENERATE_LIBRARY_VISIBLE_KEY, "yes");
    assert.equal(readGenerateLibraryVisible(storage), false);
  });

  it("persists opt-in as 1 and clears on hide", () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
      removeItem: (k: string) => {
        mem.delete(k);
      },
    };
    writeGenerateLibraryVisible(storage, true);
    assert.equal(storage.getItem(GENERATE_LIBRARY_VISIBLE_KEY), "1");
    assert.equal(readGenerateLibraryVisible(storage), true);
    writeGenerateLibraryVisible(storage, false);
    assert.equal(storage.getItem(GENERATE_LIBRARY_VISIBLE_KEY), null);
    assert.equal(readGenerateLibraryVisible(storage), false);
  });

  it("gates /generate galleries behind the privacy control (no thumbs until show)", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..");
    const studio = readFileSync(join(root, "app/generate/generate-studio.tsx"), "utf8");
    const gate = readFileSync(join(root, "app/generate/library-gate.tsx"), "utf8");
    assert.match(studio, /<GenerateLibraryGate/);
    assert.match(gate, /data-testid="generate-library-gate"/);
    assert.match(gate, /Library hidden/);
    assert.match(gate, /Show library/);
    assert.match(gate, /GENERATE_LIBRARY_VISIBLE_KEY/);
    assert.doesNotMatch(gate, /defaultChecked=\{true\}/);
  });
});
