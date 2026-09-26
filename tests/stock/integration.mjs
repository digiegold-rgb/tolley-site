import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright";
import {
  createOwnerSession,
  requireIsolatedServer,
} from "../helpers/owner-session.mjs";
const base = "http://localhost:3059";
requireIsolatedServer(base);
const p = new PrismaClient();
const key = randomUUID();
let owner, browser;
async function req(path, body, jar = owner?.cookie || "", extra = {}) {
  const r = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    redirect: "manual",
    headers: {
      cookie: jar,
      origin: base,
      "content-type": "application/json",
      ...extra,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { r, status: r.status, data: await r.json().catch(() => null) };
}
try {
  assert.equal((await req("/api/stock/dashboard")).status, 401);
  assert.equal(
    (await req("/api/shop/sales")).status,
    401,
    "shared sales never expose private costs publicly",
  );
  assert.equal(
    (
      await req("/api/stock/worker/process", {}, "", {
        authorization: "Bearer wrong",
      })
    ).status,
    401,
  );
  owner = await createOwnerSession(p, base);
  assert.equal((await req("/api/stock/dashboard")).status, 200);
  assert.equal(
    (
      await req("/api/stock/deals", {}, owner.cookie, {
        origin: "https://wrong.example",
      })
    ).status,
    401,
  );
  const url =
    "https://bstock.com/buy/listings/details/" + key.replaceAll("-", "");
  const input = {
    sourceUrl: url,
    title: "Test tools and toys " + key,
    supplier: "B-Stock",
    category: "Tools",
    location: "Kansas City",
    distanceMiles: 12,
    pickup: true,
    quantity: 5,
    bidCents: 10000,
    feesCents: 500,
    freightCents: null,
  };
  let r = await req("/api/stock/deals", input);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const deal = r.data;
  const worker = { authorization: "Bearer stock-test-worker" };
  const email = {
    key: "fixture:" + key,
    subject: "New tool lot",
    text: `Supplier listing: ${url}`,
    observedAt: new Date().toISOString(),
  };
  const imports = await Promise.all([
    req("/api/stock/worker/email", email, "", worker),
    req("/api/stock/worker/email", email, "", worker),
  ]);
  assert.equal(
    imports[0].data.id,
    imports[1].data.id,
    "duplicate delivery deduped",
  );
  assert.equal(
    (await req("/api/stock/worker/process", {}, "", worker)).status,
    200,
  );
  assert.equal(
    await p.stockOpportunity.count({ where: { sourceUrl: url } }),
    1,
  );
  const form = new FormData();
  form.set("sourceUrl", url);
  form.set(
    "file",
    new Blob([
      "ITEM DESCRIPTION,QTY,UNIT RETAIL\nTool set,3,25\nSealed toy,2,10\n",
    ]),
    "manifest.csv",
  );
  const fileResult = await fetch(base + "/api/stock/imports", {
    method: "POST",
    headers: { cookie: owner.cookie, origin: base },
    body: form,
  });
  assert.equal(fileResult.status, 200, await fileResult.text());
  assert.equal(
    (await p.stockOpportunity.findUnique({ where: { id: deal.id } })).manifest
      .length,
    2,
  );
  const purchases = await Promise.all([
    req(`/api/stock/deals/${deal.id}/purchase`, { totalCents: 10001 }),
    req(`/api/stock/deals/${deal.id}/purchase`, { totalCents: 10001 }),
  ]);
  assert.equal(purchases[0].status, 200, JSON.stringify(purchases[0].data));
  assert.equal(purchases[0].data.id, purchases[1].data.id);
  const purchase = purchases[0].data;
  const rows = [
    {
      title: "Test tool",
      expected: 3,
      good: 2,
      damaged: 1,
      category: "Tools",
      condition: "Inspected",
    },
    {
      title: "Test toy",
      expected: 2,
      good: 1,
      damaged: 0,
      category: "Toys",
      condition: "New",
    },
  ];
  assert.equal(
    (await req(`/api/stock/purchases/${purchase.id}/receive`, { rows })).status,
    200,
  );
  assert.equal(
    await p.product.count({ where: { lotId: purchase.lotId } }),
    0,
    "partial receipt creates no products",
  );
  const wrong = await req(`/api/stock/purchases/${purchase.id}/receive`, {
    rows: rows.map((r) => ({ ...r, allocationCents: 5 })),
    finalize: true,
  });
  assert.equal(wrong.status, 400);
  await Promise.all(
    [1, 2].map(() =>
      req(`/api/stock/purchases/${purchase.id}/receive`, {
        rows,
        finalize: true,
      }),
    ),
  );
  const products = await p.product.findMany({
    where: { lotId: purchase.lotId },
  });
  assert.equal(
    products.length,
    3,
    "repeat finalization creates products only once",
  );
  const final = await p.stockPurchase.findUnique({
    where: { id: purchase.id },
  });
  assert.equal(
    products.reduce((n, v) => n + Math.round(v.totalCogs * 100), 0) +
      final.writeoffCents,
    10001,
  );
  const lineup = await req("/api/stream-lineup", {
    name: "Stock test " + key,
    slug: "stock-" + key,
  });
  assert.equal(lineup.status, 200, JSON.stringify(lineup.data));
  const slug = "stock-" + key;
  const add = await req(`/api/stream-lineup/${slug}/items`, {
    productId: products[0].id,
  });
  assert.equal(add.status, 200, JSON.stringify(add.data));
  const sale = {
    saleCents: 6000,
    feesCents: 600,
    shippingCents: 500,
    shippingPaidCents: 500,
    platform: "whatnot",
    externalId: key,
  };
  const sales = await Promise.all(
    [1, 2].map(() => req(`/api/stock/products/${products[0].id}/sale`, sale)),
  );
  assert.equal(sales[0].status, 200, JSON.stringify(sales[0].data));
  assert.equal(sales[0].data.id, sales[1].data.id);
  assert.equal(
    (await req(`/api/stock/products/${products[1].id}/sale`, sale)).status,
    400,
    "external sale cannot be assigned twice",
  );
  const dashboard = (await req("/api/stock/dashboard")).data;
  const summary = dashboard.purchases.find((v) => v.id === purchase.id).results;
  assert.equal(summary.sold, 1);
  assert.equal(summary.cashRecoveryCents, 5400 - 10001);
  assert.equal(summary.remaining, 2);
  // Exercise the actual owner UI on desktop and mobile; capture artifacts outside the repo.
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addCookies(
    owner.cookie.split("; ").map((s) => {
      const i = s.indexOf("=");
      return { name: s.slice(0, i), value: s.slice(i + 1), url: base };
    }),
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/stream/stock", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page
    .getByRole("heading", { name: "Stock for the next show." })
    .waitFor();
  await page.getByText(input.title, { exact: true }).waitFor();
  await page.screenshot({
    path: "/tmp/tolley-stock-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Purchased lots", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Show inventory", exact: true })
    .click();
  await page.getByRole("button", { name: "Results", exact: true }).click();
  await page
    .getByRole("button", { name: "Imports & sources", exact: true })
    .click();
  await page.getByRole("heading", { name: "Collection health" }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Deals", exact: true }).click();
  await page.screenshot({
    path: "/tmp/tolley-stock-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
    "mobile has no page overflow",
  );
  assert.deepEqual(errors, []);
  writeFileSync(
    "/tmp/tolley-stock-test-result.json",
    JSON.stringify({
      passed: true,
      deal: deal.id,
      purchase: purchase.id,
      tests:
        "auth, MFA, origin, dedupe, manifest, receiving, costs, show lineup, sales, desktop/mobile",
    }),
  );
  console.log(
    "PASS: owner/MFA, origin rejection, worker auth, duplicate email/purchase/finalization/sale, manifest, partial receipt, damaged stock, cost reconciliation, show lineup, shared sales, desktop/mobile UI.",
  );
} finally {
  if (browser) await browser.close();
  if (owner) await owner.cleanup();
  await p.$disconnect();
}
