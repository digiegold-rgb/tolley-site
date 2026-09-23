import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { prisma } from "../lib/prisma";
import { runInventory, observeFacebookSale } from "../lib/shop/inventory";
import { syncShopifyCatalog } from "../lib/shop/shopify-catalog";
import { reserveShow, sellLineupUnit } from "../lib/shop/show-inventory";
import { reconcileShopifyProduct, linkShopifyProduct, syncShopifyProduct, verifyShopifyWebhook } from "../lib/shop/shopify-inventory";

if (!process.env.DATABASE_URL?.includes("127.0.0.1:55449/tolley_inventory_test")) throw new Error("Use only the isolated inventory test database");
const ids: string[] = [];
async function product(quantity = 1) {
  const p = await prisma.product.create({ data: { title: `Inventory test ${randomUUID()}`, imageUrls: [], status: "listed", targetPrice: 10, listings: { create: { platform: "shop", status: "active", price: 10 } } } });
  ids.push(p.id);
  await runInventory({ productId: p.id, key: randomUUID(), action: "count", channel: "other", quantity, expectedRevision: 0, note: "Test count" });
  return p;
}
let checks = 0;
async function check(name: string, fn: () => Promise<void>) { await fn(); checks++; console.log(`PASS ${name}`); }

async function main() {
  await check("concurrent sales cannot sell the final unit twice", async () => {
    const p = await product();
    const result = await Promise.allSettled(["shop", "facebook"].map(channel => runInventory({ productId: p.id, key: randomUUID(), action: "sale", channel, quantity: 1 })));
    assert.equal(result.filter(r => r.status === "fulfilled").length, 1);
    assert.equal((await prisma.inventoryStock.findUniqueOrThrow({ where: { productId: p.id } })).available, 0);
    assert.equal((await prisma.platformListing.findFirstOrThrow({ where: { productId: p.id, platform: "shop" } })).status, "sold");
  });
  await check("duplicate notifications count once and altered replays are rejected", async () => {
    const p = await product(4), c = { productId: p.id, key: randomUUID(), action: "sale" as const, channel: "facebook", quantity: 1 };
    await Promise.all([runInventory(c), runInventory(c)]);
    assert.equal((await prisma.inventoryStock.findUniqueOrThrow({ where: { productId: p.id } })).onHand, 3);
    await assert.rejects(runInventory({ ...c, quantity: 2 }), /different action/);
  });
  await check("reservations protect other buyers and are consumed without subtracting twice", async () => {
    const p = await product(2);
    const hold = await runInventory({ productId: p.id, key: randomUUID(), action: "reserve", channel: "shop", quantity: 2 });
    await assert.rejects(runInventory({ productId: p.id, key: randomUUID(), action: "sale", channel: "facebook", quantity: 1 }), /Only 0/);
    await runInventory({ productId: p.id, key: randomUUID(), action: "sale", channel: "shop", reservationId: hold.movement.reservationId!, quantity: 1 });
    const s = await prisma.inventoryStock.findUniqueOrThrow({ where: { productId: p.id } });
    assert.deepEqual([s.onHand, s.reserved, s.available], [1, 1, 0]);
  });
  await check("a release is idempotent and returns only its held units", async () => {
    const p = await product(3);
    const h = await runInventory({ productId: p.id, key: randomUUID(), action: "reserve", channel: "facebook", quantity: 2 });
    const command = { productId: p.id, key: randomUUID(), action: "release" as const, channel: "facebook", reservationId: h.movement.reservationId! };
    await runInventory(command); await runInventory(command);
    const s = await prisma.inventoryStock.findUniqueOrThrow({ where: { productId: p.id } });
    assert.deepEqual([s.onHand,s.reserved,s.available], [3,0,3]);
  });
  await check("stale counts and counts below reservations cannot overwrite sales", async () => {
    const p = await product(3);
    await runInventory({ productId: p.id, key: randomUUID(), action: "reserve", channel: "facebook", quantity: 2 });
    await assert.rejects(runInventory({ productId: p.id, key: randomUUID(), action: "count", channel: "other", quantity: 10, expectedRevision: 1, note: "stale" }), /Stock changed/);
    await assert.rejects(runInventory({ productId: p.id, key: randomUUID(), action: "count", channel: "other", quantity: 1, expectedRevision: 2, note: "bad count" }), /reserved/);
  });
  await check("a reversed sale restores stock once", async () => {
    const p = await product();
    const sale = await runInventory({ productId: p.id, key: randomUUID(), action: "sale", channel: "facebook", quantity: 1 });
    await runInventory({ productId: p.id, key: randomUUID(), action: "restore", channel: "facebook", reference: sale.movement.key });
    await assert.rejects(runInventory({ productId: p.id, key: randomUUID(), action: "restore", channel: "facebook", reference: sale.movement.key }), /already reversed/);
    assert.equal((await prisma.inventoryStock.findUniqueOrThrow({ where: { productId: p.id } })).available, 1);
  });
  await check("show reservations, partial sales and unsold release share the same balance", async () => {
    const p = await product(3);
    const lineup = await prisma.streamLineup.create({ data: { slug: `test-${randomUUID()}`, name: "8:30 show", items: { create: { productId: p.id, quantity: 3, sortOrder: 0 } } }, include: { items: true } });
    await reserveShow(lineup.slug); await reserveShow(lineup.slug);
    const key = randomUUID();
    const sold = await sellLineupUnit(lineup.slug, lineup.items[0].id, key, false);
    await sellLineupUnit(lineup.slug, lineup.items[0].id, key, false);
    assert.equal(sold.soldQuantity, 1); assert.equal(sold.soldAt, null);
    await reserveShow(lineup.slug, true);
    const s = await prisma.inventoryStock.findUniqueOrThrow({ where: { productId: p.id } });
    assert.deepEqual([s.onHand,s.reserved,s.available], [2,0,2]);
  });
  await check("a show reservation is all-or-nothing when one item has insufficient stock", async () => {
    const p = await product(1), p2 = await product(1);
    const l = await prisma.streamLineup.create({ data: { slug: `test-${randomUUID()}`, name: "Invalid show", items: { create: [{ productId: p.id, quantity: 1, sortOrder: 0 }, { productId: p2.id, quantity: 2, sortOrder: 1 }] } } });
    await assert.rejects(reserveShow(l.slug), /Only 1/);
    assert.equal(await prisma.inventoryReservation.count({ where: { productId: { in: [p.id, p2.id] }, status: "active" } }), 0);
  });
  await check("Facebook observations hold stock for review without inventing sales", async () => {
    const p = await product(2);
    await observeFacebookSale(p.id, "fb-test"); await observeFacebookSale(p.id, "fb-test");
    const s = await prisma.inventoryStock.findUniqueOrThrow({ where: { productId: p.id } });
    assert.deepEqual([s.onHand,s.reserved,s.available], [2,2,0]);
    assert.equal(await prisma.inventoryMovement.count({ where: { productId: p.id, action: "sale" } }), 0);
  });

  process.env.SHOPIFY_SHOP_DOMAIN = "inventory-test.myshopify.com";
  process.env.SHOPIFY_ADMIN_ACCESS_TOKEN = "test-token";
  process.env.SHOPIFY_WEBHOOK_SECRET = "test-webhook-secret";
  const raw = '{"available":2}', signature = createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET).update(raw).digest("base64");
  assert(verifyShopifyWebhook(raw, signature, "inventory-test.myshopify.com"));
  assert(!verifyShopifyWebhook(raw + "x", signature, "inventory-test.myshopify.com"));
  assert(!verifyShopifyWebhook(raw, signature, "attacker.myshopify.com"));
  console.log("PASS signed webhook rejects tampering and other stores"); checks++;
  const originalFetch = globalThis.fetch;
  try {
    await check("catalog creates one linked draft and preserves stock on later detail updates", async () => {
      const p = await product(2);
      await prisma.product.update({where:{id:p.id},data:{weightOz:16,imageUrls:["https://example.com/product.jpg"],description:"Box <sealed>"}});
      const handle = `tolley-${p.id}`;
      const variant = {id:"gid://shopify/ProductVariant/1",sku:handle,inventoryItem:{id:`gid://shopify/InventoryItem/${Date.now()}4`}};
      const remote = {id:"gid://shopify/Product/1",handle,variants:{nodes:[variant]}};
      let exists = false, creates = 0, writes = 0;
      globalThis.fetch = async (_url, init) => {
        const {query,variables} = JSON.parse(String(init?.body));
        if (query.startsWith("query Product")) return Response.json({data:{products:{nodes:exists ? [remote] : []}}});
        if (query.startsWith("query Level")) return Response.json({data:{inventoryItem:{tracked:true,sku:handle,inventoryLevel:{quantities:[{name:"available",quantity:2}]}}}});
        assert(query.startsWith("mutation Product"));
        assert.equal(variables.input.descriptionHtml,"Box &lt;sealed&gt;");
        if (!exists) {
          assert.equal(variables.input.status,"DRAFT");
          assert.equal(variables.input.variants[0].inventoryQuantities[0].quantity,2);
          creates++;
        } else {
          assert.equal(variables.input.status,undefined);
          assert.equal(variables.input.variants[0].inventoryQuantities,undefined);
          assert.equal(variables.input.files,undefined);
        }
        exists = true; writes++;
        return Response.json({data:{productSet:{product:remote,userErrors:[]}}});
      };
      assert.equal((await syncShopifyCatalog(p.id,"gid://shopify/Location/1")).created,true);
      assert.equal((await syncShopifyCatalog(p.id)).created,false);
      assert.equal(creates,1); assert.equal(writes,2);
      assert.equal(await prisma.inventoryChannel.count({where:{productId:p.id,channel:"shopify"}}),1);
    });
    await check("Shopify combines a remote sale with a queued local sale without losing either", async () => {
      const p = await product(5); let remote = 5;
      const applied = new Map<string, number>();
      globalThis.fetch = async (_url, init) => {
        const { query, variables } = JSON.parse(String(init?.body));
        if (query.startsWith("query Level")) return Response.json({ data: { inventoryItem: { tracked: true, sku: `tolley-${p.id}`, inventoryLevel: { quantities: [{ name: "available", quantity: remote }] } } } });
        if (applied.has(variables.key)) return Response.json({ data: { inventorySetQuantities: { userErrors: [] } } });
        const q = variables.input.quantities[0]; assert.equal(q.changeFromQuantity, remote);
        remote = q.quantity; applied.set(variables.key, remote);
        return Response.json({ data: { inventorySetQuantities: { userErrors: [] } } });
      };
      await linkShopifyProduct(p.id, `gid://shopify/InventoryItem/${Date.now()}1`, "gid://shopify/Location/1");
      await runInventory({ productId: p.id, key: randomUUID(), action: "sale", channel: "facebook", quantity: 1 });
      remote -= 1; // Whatnot sells before the queued local sale reaches Shopify.
      await syncShopifyProduct(p.id); await syncShopifyProduct(p.id);
      assert.equal(remote, 3); assert.equal((await prisma.inventoryStock.findUniqueOrThrow({ where: { productId: p.id } })).onHand, 3);
      assert.equal(applied.size, 1);
    });
    await check("a lost Shopify response retries the same mutation without selling twice", async () => {
      const p = await product(3); let remote = 3, lost = false;
      const keys = new Set<string>();
      globalThis.fetch = async (_url, init) => {
        const { query, variables } = JSON.parse(String(init?.body));
        if (query.startsWith("query Level")) return Response.json({ data: { inventoryItem: { tracked: true, sku: `tolley-${p.id}`, inventoryLevel: { quantities: [{ name: "available", quantity: remote }] } } } });
        if (!keys.has(variables.key)) { remote = variables.input.quantities[0].quantity; keys.add(variables.key); }
        if (!lost) { lost = true; throw new Error("Simulated lost response after remote commit"); }
        return Response.json({ data: { inventorySetQuantities: { userErrors: [] } } });
      };
      await linkShopifyProduct(p.id, `gid://shopify/InventoryItem/${Date.now()}2`, "gid://shopify/Location/1");
      await runInventory({ productId: p.id, key: randomUUID(), action: "sale", channel: "facebook", quantity: 1 });
      await assert.rejects(syncShopifyProduct(p.id), /lost response/);
      await syncShopifyProduct(p.id); await syncShopifyProduct(p.id);
      assert.equal(remote, 2); assert.equal(keys.size, 1);
      assert.equal((await prisma.inventoryStock.findUniqueOrThrow({ where: { productId: p.id } })).onHand, 2);
    });
    await check("a Shopify compare failure blocks further sales instead of overwriting remote stock", async () => {
      const p = await product(3); let remote = 3;
      globalThis.fetch = async (_url, init) => {
        const {query} = JSON.parse(String(init?.body));
        if (query.startsWith("query Level")) return Response.json({data:{inventoryItem:{tracked:true,sku:`tolley-${p.id}`,inventoryLevel:{quantities:[{name:"available",quantity:remote}]}}}});
        remote -= 1;
        return Response.json({data:{inventorySetQuantities:{userErrors:[{code:"COMPARE_QUANTITY_STALE",message:"Stock changed"}]}}});
      };
      await linkShopifyProduct(p.id,`gid://shopify/InventoryItem/${Date.now()}3`,"gid://shopify/Location/1");
      await runInventory({productId:p.id,key:randomUUID(),action:"sale",channel:"facebook",quantity:1});
      await assert.rejects(syncShopifyProduct(p.id),/rejected/);
      assert.equal(remote,2);
      await assert.rejects(runInventory({productId:p.id,key:randomUUID(),action:"sale",channel:"facebook",quantity:1}),/review/);
      assert.equal((await prisma.inventorySync.findFirstOrThrow({where:{productId:p.id}})).status,"blocked");
      await assert.rejects(reconcileShopifyProduct(p.id), /fresh physical count/);
      const before = await prisma.inventoryStock.findUniqueOrThrow({where:{productId:p.id}});
      await runInventory({productId:p.id,key:randomUUID(),action:"count",channel:"other",quantity:1,expectedRevision:before.revision,note:"Physical count after disputed update"});
      await assert.rejects(runInventory({productId:p.id,key:randomUUID(),action:"sale",channel:"facebook",quantity:1}),/review/);
      await assert.rejects(reconcileShopifyProduct(p.id), /correct both counts/);
      remote = 1; // Seller checks orders and corrects Shopify to match the physical count.
      await reconcileShopifyProduct(p.id);
      assert.equal((await prisma.inventoryStock.findUniqueOrThrow({where:{productId:p.id}})).blocked,false);
      assert.equal(await prisma.inventorySync.count({where:{productId:p.id,status:{not:"done"}}}),0);
      await syncShopifyProduct(p.id);
      assert.equal((await prisma.inventoryStock.findUniqueOrThrow({where:{productId:p.id}})).onHand,1);
    });
  } finally { globalThis.fetch = originalFetch; }
  console.log(`${checks} shared inventory checks passed`);
}
main().finally(() => prisma.$disconnect()).catch(e => { console.error(e); process.exitCode = 1; });
