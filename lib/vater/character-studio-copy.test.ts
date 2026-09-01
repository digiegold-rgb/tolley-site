import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  CHARACTER_STUDIO_COPY_DEFAULT,
  canCopyOntoStyle,
  characterNamesMatch,
  findSameNameCharacter,
  readCharacterStudioCopyFlag,
  resolveAdoptImageUrl,
} from "./character-studio-copy.ts";

describe("readCharacterStudioCopyFlag", () => {
  it("defaults ON so the product ships with copy available", () => {
    assert.equal(CHARACTER_STUDIO_COPY_DEFAULT, true);
    assert.equal(readCharacterStudioCopyFlag(undefined), true);
    assert.equal(readCharacterStudioCopyFlag(null), true);
    assert.equal(readCharacterStudioCopyFlag("false"), true);
  });

  it("honours an explicit boolean", () => {
    assert.equal(readCharacterStudioCopyFlag(true), true);
    assert.equal(readCharacterStudioCopyFlag(false), false);
  });
});

describe("characterNamesMatch / findSameNameCharacter", () => {
  it("matches trimmed case-insensitive names so Lady 2 is not duplicated", () => {
    assert.equal(characterNamesMatch("Lady 2", "lady 2"), true);
    assert.equal(characterNamesMatch(" Lady 2 ", "LADY 2"), true);
    assert.equal(characterNamesMatch("Lady 2", "Lady 3"), false);
    const hit = findSameNameCharacter(
      [
        { id: "a", name: "Host" },
        { id: "b", name: "Lady 2" },
      ],
      "lady 2",
    );
    assert.equal(hit?.id, "b");
  });
});

describe("resolveAdoptImageUrl", () => {
  it("keeps the site proxy path as-is (no re-upload)", () => {
    const url = "/api/vater/file/style/styleAbc/lady2.png";
    assert.equal(resolveAdoptImageUrl(url), url);
  });

  it("rewrites a DGX-relative path to the site proxy", () => {
    assert.equal(
      resolveAdoptImageUrl("/vater/file/style/styleAbc/lady2.png"),
      "/api/vater/file/style/styleAbc/lady2.png",
    );
    assert.equal(
      resolveAdoptImageUrl(
        "https://autopilot.example/vater/file/style/styleAbc/lady2.png",
      ),
      "/api/vater/file/style/styleAbc/lady2.png",
    );
  });

  it("keeps other absolute URLs and drops junk relative paths", () => {
    assert.equal(
      resolveAdoptImageUrl("https://cdn.example/lady2.png"),
      "https://cdn.example/lady2.png",
    );
    assert.equal(resolveAdoptImageUrl("lady2.png"), null);
    assert.equal(resolveAdoptImageUrl(""), null);
    assert.equal(resolveAdoptImageUrl(null), null);
  });
});

describe("canCopyOntoStyle", () => {
  it("allows only same-owner non-system studios", () => {
    assert.equal(
      canCopyOntoStyle({
        isSystem: false,
        userId: "u1",
        ownerUserId: "u1",
      }),
      true,
    );
    assert.equal(
      canCopyOntoStyle({
        isSystem: true,
        userId: "u1",
        ownerUserId: "u1",
      }),
      false,
    );
    assert.equal(
      canCopyOntoStyle({
        isSystem: false,
        userId: "other",
        ownerUserId: "u1",
      }),
      false,
    );
    assert.equal(
      canCopyOntoStyle({
        isSystem: false,
        userId: null,
        ownerUserId: "u1",
      }),
      false,
    );
  });
});

describe("adopt route — upsert + free copy contract", () => {
  it("updates an existing same-name row instead of always creating", async () => {
    const src = await readFile(
      "app/api/vater/youtube/styles/[id]/characters/adopt/route.ts",
      "utf8",
    );
    assert.match(src, /findSameNameCharacter/);
    assert.match(src, /youTubeCharacter\.update/);
    assert.match(src, /youTubeCharacter\.create/);
    assert.match(src, /resolveAdoptImageUrl/);
    assert.match(src, /permanent:\s*true/);
    assert.match(src, /placeInEveryImage:\s*false/);
    assert.doesNotMatch(src, /checkBudget/);
    assert.doesNotMatch(src, /character_import/);
    assert.doesNotMatch(src, /dgxCall/);
  });
});

describe("GET/PATCH /api/vater/me — global characterStudioCopy flag", () => {
  it("reads and writes the root-login flag and defaults ON", async () => {
    const src = await readFile("app/api/vater/me/route.ts", "utf8");
    assert.match(src, /characterStudioCopy/);
    assert.match(src, /CHARACTER_STUDIO_COPY_DEFAULT/);
    assert.match(src, /settings:\s*\{/);
    assert.match(src, /body\.characterStudioCopy/);
  });
});
