import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("scopedProjectWhere — workspace tab isolation", () => {
  it("lists the current tenant even for the owner email (tabs stay separate)", async () => {
    const src = await readFile("lib/vater/project-access.ts", "utf8");
    const start = src.indexOf("export function scopedProjectWhere");
    const end = src.indexOf("export async function canAccessProjectAsync");
    const fn = src.slice(start, end);
    assert.match(fn, /return \{ userId: sessionUserId \}/);
    assert.equal(/isVaterAdminEmail\(sessionEmail\) return \{\}/.test(fn), false);
    assert.match(src, /canAccessProject/);
    assert.match(src, /isVaterAdminEmail\(sessionEmail\)/);
  });
});
