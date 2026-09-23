import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { InventoryError, inventoryIssue, inventoryTransaction, stockForUpdate } from "./inventory";

export function shopifyConfigured() { return !!(process.env.SHOPIFY_SHOP_DOMAIN && process.env.SHOPIFY_ADMIN_ACCESS_TOKEN); }
export function verifyShopifyWebhook(raw: string, signature: string | null, domain: string | null) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret || !signature || domain !== process.env.SHOPIFY_SHOP_DOMAIN) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  const supplied = Buffer.from(signature, "base64");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
export async function shopifyGraphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const domain = process.env.SHOPIFY_SHOP_DOMAIN;
  if (!shopifyConfigured() || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain!)) throw new InventoryError("Shopify is not configured", 503);
  const r = await fetch(`https://${domain}/admin/api/2026-07/graphql.json`, { method: "POST", headers: { "content-type": "application/json", "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_ACCESS_TOKEN! }, body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!r.ok) throw new Error(`Shopify HTTP ${r.status}`);
  const result = await r.json();
  if (result.errors?.length || !result.data) throw new Error("Shopify rejected the API request. Verify access scopes and the API version.");
  return result.data as T;
}
export async function readShopifyLevel(externalId: string, locationId: string) {
  const result = await shopifyGraphql<{ inventoryItem: { sku: string | null; tracked: boolean; inventoryLevel: { quantities: { name: string; quantity: number }[] } | null } | null }>(`query Level($id: ID!, $location: ID!) { inventoryItem(id: $id) { sku tracked inventoryLevel(locationId: $location) { quantities(names: ["available"]) { name quantity } } } }`, { id: externalId, location: locationId });
  const item = result.inventoryItem;
  const quantity = item?.inventoryLevel?.quantities.find(q => q.name === "available")?.quantity;
  if (!item?.tracked || !Number.isSafeInteger(quantity)) throw new InventoryError("Shopify stock tracking is missing at this location.");
  return { quantity: quantity!, sku: item.sku };
}

// Call with the product locked. Read live quantities rather than trusting out-of-order webhook bodies.
async function acceptRemoteDelta(tx: Prisma.TransactionClient, productId: string, delta: number, reference: string) {
  if (!delta) return;
  const { stock, product } = await stockForUpdate(tx, productId);
  let onHand = stock.onHand + delta, reserved = stock.reserved;
  // A remote decrease consumes units assigned to Whatnot first. It never silently consumes a paid checkout hold.
  if (delta < 0) {
    let consumed = -delta;
    const holds = await tx.inventoryReservation.findMany({ where: { productId, channel: "whatnot", status: "active" }, orderBy: { createdAt: "asc" } });
    for (const hold of holds) {
      const take = Math.min(consumed, hold.quantity); if (!take) break;
      reserved -= take; consumed -= take;
      await tx.inventoryReservation.update({ where: { id: hold.id }, data: { quantity: hold.quantity - take, status: take === hold.quantity ? "consumed" : "active" } });
      if (hold.reference?.startsWith("show:")) {
        const item = await tx.streamLineupItem.findFirst({ where: { productId, lineupId: hold.reference.slice(5) } });
        if (item) {
          const soldQuantity = Math.min(item.quantity, item.soldQuantity + take);
          await tx.streamLineupItem.update({ where: { id: item.id }, data: { soldQuantity, soldAt: soldQuantity >= item.quantity ? new Date() : null } });
        }
      }
    }
  }
  const conflict = onHand < reserved || onHand < 0;
  if (conflict) {
    await inventoryIssue(tx, `shopify-shortfall:${productId}`, productId, "shopify", "Remote stock fell below other buyer reservations. Check pending checkouts and count the physical stock before selling more.");
    // Retain existing buyer holds for investigation; block checkout until a physical count resolves the discrepancy.
    onHand = Math.max(0, onHand, reserved);
  }
  await tx.inventoryStock.update({ where: { productId }, data: { onHand, reserved, available: onHand - reserved, blocked: conflict || stock.blocked, revision: { increment: 1 } } });
  await tx.inventoryMovement.create({ data: { key: `remote:${reference}`, fingerprint: reference, productId, action: "sync", channel: "shopify", quantity: Math.abs(delta), delta, onHandAfter: onHand, reservedAfter: reserved, note: "Shopify inventory change; check platform orders for sale details" } });
  if (onHand === 0) await tx.product.update({ where: { id: productId }, data: { status: "sold", soldAt: new Date(), soldPlatform: "shopify" } });
  else if (product.status === "sold") await tx.product.update({ where: { id: productId }, data: { status: "listed", soldAt: null, soldPlatform: null } });
  await tx.platformListing.updateMany({ where: { productId, platform: "shop", status: { in: ["active", "sold", "reserved"] } }, data: { status: onHand === 0 ? "sold" : conflict || onHand === reserved ? "reserved" : "active", soldAt: onHand === 0 ? new Date() : null } });
  if (product.shopItemId) await tx.shopItem.updateMany({ where: { id: product.shopItemId }, data: { status: onHand === 0 ? "sold" : conflict || onHand === reserved ? "reserved" : "active", soldAt: onHand === 0 ? new Date() : null } });
  if (product.fbListingId) await inventoryIssue(tx, `facebook:${productId}`, productId, "facebook", `Shopify stock changed. Update Marketplace: ${Math.max(0, onHand - reserved)} units available.`);
}

export async function linkShopifyProduct(productId: string, externalId: string, locationId: string) {
  if (!/^gid:\/\/shopify\/InventoryItem\/\d+$/.test(externalId) || !/^gid:\/\/shopify\/Location\/\d+$/.test(locationId)) throw new InventoryError("Enter valid Shopify inventory-item and location IDs.", 400);
  return inventoryTransaction(async tx => {
    const { stock, product } = await stockForUpdate(tx, productId);
    if (stock.reserved || !stock.countedAt) throw new InventoryError("Verify the physical count and release reservations before linking Shopify.");
    if (await tx.inventoryChannel.findUnique({ where: { productId_channel: { productId, channel: "shopify" } } })) throw new InventoryError("This product is already linked.");
    const level = await readShopifyLevel(externalId, locationId);
    if (level.sku !== `tolley-${product.id}`) throw new InventoryError(`Set the Shopify variant SKU to tolley-${product.id} to verify this exact product.`);
    if (level.quantity !== stock.onHand) throw new InventoryError(`Shopify has ${level.quantity}; Tolley has ${stock.onHand}. Reconcile physical stock before linking.`);
    return tx.inventoryChannel.create({ data: { productId, channel: "shopify", externalId, locationId, lastQuantity: level.quantity, checkedAt: new Date() } });
  });
}

export async function syncShopifyProduct(productId: string) {
  // Stage a durable request before the network mutation, so a lost response can be replayed with identical parameters.
  const job = await inventoryTransaction(async tx => {
    await stockForUpdate(tx, productId);
    const mapping = await tx.inventoryChannel.findUnique({ where: { productId_channel: { productId, channel: "shopify" } } });
    if (!mapping?.locationId || mapping.lastQuantity == null) return null;
    const next = await tx.inventorySync.findFirst({ where: { productId, status: { not: "done" } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    if (next?.status === "blocked") {
      await tx.inventoryChannel.update({ where: { id: mapping.id }, data: { checkedAt: new Date() } });
      return null;
    }
    if (next?.status === "sending") return { ...next, mapping };
    const level = await readShopifyLevel(mapping.externalId, mapping.locationId);
    const stamp = `${mapping.id}:${randomUUID()}`;
    await acceptRemoteDelta(tx, productId, level.quantity - mapping.lastQuantity, stamp);
    await tx.inventoryChannel.update({ where: { id: mapping.id }, data: { lastQuantity: level.quantity, checkedAt: new Date() } });
    if (!next) return null;
    if (level.quantity + next.delta < 0) {
      await tx.inventorySync.update({ where: { id: next.id }, data: { status: "blocked", lastError: "Remote stock insufficient" } });
      await tx.inventoryStock.update({ where: { productId }, data: { blocked: true } });
      await inventoryIssue(tx, `shopify-sync:${productId}`, productId, "shopify", "Pending stock update exceeds Shopify availability. Reconcile this product before resuming synchronization.");
      return null;
    }
    const staged = await tx.inventorySync.update({ where: { id: next.id }, data: { status: "sending", expectedQuantity: level.quantity, targetQuantity: level.quantity + next.delta, startedAt: new Date() } });
    return { ...staged, mapping };
  });
  if (!job) return;
  if (job.startedAt && Date.now() - job.startedAt.getTime() > 23 * 3600000) {
    await prisma.inventorySync.update({ where: { id: job.id }, data: { status: "blocked", lastError: "Uncertain request older than retry window; inspect Shopify before retrying." } });
    await prisma.inventoryStock.update({ where: { productId }, data: { blocked: true } });
    await inventoryTransaction(tx => inventoryIssue(tx, `shopify-sync:${productId}`, productId, "shopify", "An uncertain Shopify request is older than the retry window. Check Shopify inventory before resuming."));
    return;
  }
  try {
    const result = await shopifyGraphql<{ inventorySetQuantities: { userErrors: { message: string; code: string }[] } }>(`mutation Stock($input: InventorySetQuantitiesInput!, $key: String!) { inventorySetQuantities(input: $input) @idempotent(key: $key) { userErrors { code message } } }`, { key: job.id, input: { name: "available", reason: "correction", referenceDocumentUri: `https://www.tolley.io/stream/inventory?event=${job.id}`, quantities: [{ inventoryItemId: job.mapping.externalId, locationId: job.mapping.locationId, quantity: job.targetQuantity, changeFromQuantity: job.expectedQuantity }] } });
    if (result.inventorySetQuantities.userErrors.length) {
      await prisma.inventorySync.update({ where: { id: job.id }, data: { status: "blocked", lastError: result.inventorySetQuantities.userErrors.map(e => e.message).join("; ").slice(0, 500) } });
      await prisma.inventoryStock.update({ where: { productId }, data: { blocked: true } });
      throw new Error("Shopify rejected a stock update. Check the inventory discrepancy before resuming.");
    }
    await inventoryTransaction(async tx => {
      await stockForUpdate(tx, productId);
      const latest = await tx.inventorySync.findUniqueOrThrow({ where: { id: job.id } });
      if (latest.status === "done") return;
      await tx.inventorySync.update({ where: { id: job.id }, data: { status: "done", lastError: null, attempts: { increment: 1 } } });
      await tx.inventoryChannel.update({ where: { id: job.mapping.id }, data: { lastQuantity: job.targetQuantity, checkedAt: new Date() } });
      await tx.inventoryIssue.updateMany({ where: { key: `shopify-sync:${productId}` }, data: { resolvedAt: new Date() } });
    });
  } catch (e) {
    await prisma.inventorySync.update({ where: { id: job.id }, data: { attempts: { increment: 1 }, lastError: e instanceof Error ? e.message.slice(0, 500) : "Shopify sync failed" } });
    await inventoryTransaction(tx => inventoryIssue(tx, `shopify-sync:${productId}`, productId, "shopify", "Shopify stock update is pending or failed. Check availability on both platforms before selling the final unit."));
    throw e;
  }
}

// An explicit physical reconciliation establishes a new baseline; it never overwrites Shopify.
export async function reconcileShopifyProduct(productId: string) {
  return inventoryTransaction(async tx => {
    const { stock } = await stockForUpdate(tx, productId);
    const mapping = await tx.inventoryChannel.findUnique({ where: { productId_channel: { productId, channel: "shopify" } } });
    if (!mapping?.locationId || !stock.blocked) throw new InventoryError("Choose a linked product with a paused inventory discrepancy.");
    if (stock.reserved) throw new InventoryError("Resolve buyer and show reservations before reconciling stock.");
    const outstanding = await tx.inventorySync.findMany({ where: { productId, status: { not: "done" } } });
    if (outstanding.some(j => j.status === "sending")) throw new InventoryError("A Shopify request is still uncertain. Retry Sync now before reconciling.");
    const latestCount = await tx.inventoryMovement.findFirst({ where: { productId, action: "count" }, orderBy: { createdAt: "desc" } });
    const latestBlock = outstanding.filter(j => j.status === "blocked").reduce((time, j) => Math.max(time, j.updatedAt.getTime()), 0);
    if (!latestCount || latestCount.createdAt.getTime() < latestBlock || latestCount.onHandAfter !== stock.onHand) throw new InventoryError("Save a fresh physical count after reviewing the discrepancy.");
    const level = await readShopifyLevel(mapping.externalId, mapping.locationId);
    if (level.sku !== `tolley-${productId}` || level.quantity !== stock.onHand) throw new InventoryError(`Shopify has ${level.quantity}; Tolley has ${stock.onHand}. Check physical stock and correct both counts before resuming.`);
    await tx.inventorySync.updateMany({ where: { productId, status: { not: "done" } }, data: { status: "done", lastError: "Superseded by seller-confirmed physical reconciliation" } });
    await tx.inventoryChannel.update({ where: { id: mapping.id }, data: { lastQuantity: level.quantity, checkedAt: new Date() } });
    await tx.inventoryStock.update({ where: { productId }, data: { blocked: false, revision: { increment: 1 } } });
    await tx.inventoryMovement.create({ data: { key: `reconcile:${randomUUID()}`, fingerprint: latestCount.key, productId, action: "reconcile", channel: "shopify", quantity: stock.onHand, delta: 0, onHandAfter: stock.onHand, reservedAfter: 0, note: "Seller verified physical and Shopify counts; pending changes superseded" } });
    await tx.inventoryIssue.updateMany({ where: { key: { in: [`shopify-sync:${productId}`, `shopify-shortfall:${productId}`] } }, data: { resolvedAt: new Date() } });
  });
}
