import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
const inventory = JSON.parse(readFileSync("lib/company/route-inventory.json", "utf8"));
function walk(path) { return readdirSync(path, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(path, e.name)) : /^(page|route)\.tsx?$/.test(e.name) ? [join(path, e.name)] : []); }
const actual = new Set(walk("app")); const expected = new Set(inventory.map(r => r.file));
const missing = [...actual].filter(f => !expected.has(f)); const stale = [...expected].filter(f => !actual.has(f));
if (missing.length || stale.length) { console.error(JSON.stringify({ error: "Classify every new route explicitly in lib/company/route-inventory.json", missing, stale }, null, 2)); process.exit(1); }
const allowed = new Set(["public", "supporting", "private", "redirect", "retired", "machine", "endpoint"]);
if (inventory.some(r => !allowed.has(r.audience))) throw new Error("Unknown route disposition");
console.log(`Company route coverage: ${actual.size}/${actual.size} route files classified; ${inventory.filter(r => r.audience === "public" || r.audience === "supporting").length} public page patterns.`);
