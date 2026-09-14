import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";
import { RETIRED_SITE_PATHS, isRetiredSitePath } from "./retired-sites";

test("retired pages and nested routes return Gone before authentication or rendering", async () => {
  for (const path of RETIRED_SITE_PATHS) {
    for (const suffix of ["", "/", "/dashboard", "/track/example?ref=old-link", "/opengraph-image"]) {
      const response = await proxy(new NextRequest(`https://www.tolley.io${path}${suffix}`, {
        headers: { RSC: "1", cookie: "__Secure-authjs.session-token=invalid" },
      }));
      assert.equal(response.status, 410, `${path}${suffix}`);
      assert.equal(response.headers.get("X-Robots-Tag"), "noindex");
      assert.match(await response.text(), /This page has been removed/);
    }
  }
});

test("retirement matches complete path segments and leaves other apps available", async () => {
  for (const path of ["/", "/shop", "/wd", "/driver", "/cleanouts-other", "/api/vater/drive/status"]) {
    assert.equal(isRetiredSitePath(path), false, path);
    const response = await proxy(new NextRequest(`https://www.tolley.io${path}`));
    assert.equal(response.headers.get("x-middleware-next"), "1", path);
  }
});
