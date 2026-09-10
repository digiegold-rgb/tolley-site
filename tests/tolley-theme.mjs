// Offline public-frame regression. Browser layout/contrast acceptance remains
// in tolley-front-doors.mjs; this test cannot certify rendered page appearance.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { transform } from "lightningcss";

const root = resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
let pathname = "/";
const cache = new Map();
function load(file) {
  file = resolve(root, file);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} };
  cache.set(file, mod);
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  new Function("require", "module", "exports", code)(name => {
    if (name === "next/navigation") return { usePathname: () => pathname };
    if (name.startsWith("@/") || name.startsWith(".")) {
      const base = name.startsWith("@/") ? resolve(root, name.slice(2)) : resolve(dirname(file), name);
      for (const ext of [".ts", ".tsx"]) if (existsSync(base + ext)) return load(base + ext);
    }
    return require(name);
  }, mod, mod.exports);
  return mod.exports;
}
const Frame = load("components/tolley/TolleyPublicFrame.tsx").default;
const child = createElement("main", { "data-fixture": "preserved" }, "Existing page");
const included = ["/", "/about", "/start", "/privacy", "/terms", "/security", "/data-retention", "/advertising", "/wd", "/wd/terms", "/pools", "/pools/example", "/homes", "/housing", "/trailer", "/generator", "/hvac", "/lastmile", "/moving", "/rental", "/tables", "/picnic-table", "/kerplunk", "/estate", "/estate/agreement", "/cleanouts", "/shop", "/shop/example", "/drive", "/drive/register", "/sales", "/real-estate-agent", "/real-estate-agent/example"];
const excluded = [null, "/animate", "/animate/privacy", "/agent", "/leads", "/leads/tools/probate", "/gpu", "/game", "/food", "/biz/example", "/junkinjays", "/crazybins", "/login", "/hq", "/start/analytics", "/shop/dashboard/serpapi/probate", "/shop/admin/bulk-add", "/shop/new", "/shop/whatsapp", "/wd/admin", "/pools/admin", "/drive/driver", "/drive/dashboard", "/sales/portal", "/sales/admin", "/shopper", "/about-us", "/unknown"];
for (const path of [...included, ...included.filter(p => p !== "/").map(p => p + "/"), ...excluded, "/about", "/animate", "/"]) {
  pathname = path;
  const html = renderToStaticMarkup(createElement(Frame, null, child));
  if (excluded.includes(path)) assert.equal(html, renderToStaticMarkup(child), `exception ${path}`);
  else {
    assert.equal((html.match(/class="tolley-header"/g) || []).length, 1, path);
    assert.equal((html.match(/class="tolley-footer"/g) || []).length, 1, path);
    assert.match(html, /href="#tolley-content"/);
    assert.match(html, /id="tolley-content" tabindex="-1"/);
    assert.match(html, /<main data-fixture="preserved">Existing page<\/main>/);
  }
}
for (const filename of ["app/tolley-theme.css", "app/tolley-service-theme.css", "app/tolley-home.module.css"]) {
  transform({ filename, code: readFileSync(resolve(root, filename)), errorRecovery: false });
}
console.log("Tolley theme passed: public/nested routes, trailing slashes, product/partner/operational exceptions, preserved page content, shared navigation, skip target, and CSS syntax. Browser acceptance is separate.");
