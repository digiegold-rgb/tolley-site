import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class InventoryError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
export type InventoryCommand = {
  productId: string; key: string; action: "reserve" | "release" | "sale" | "restore" | "count";
  channel: string; quantity?: number; reservationId?: string; reference?: string;
  note?: string; expectedRevision?: number; salePrice?: number;
};
export const CHANNELS = ["shop", "facebook", "whatnot", "other", "ebay", "poshmark", "mercari", "depop", "tiktok"];
export function units(value: unknown, allowZero = false): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < (allowZero ? 0 : 1) || value > 100000) {
    throw new InventoryError("Enter a whole quantity between " + (allowZero ? "0" : "1") + " and 100000.", 400);
  }
  return value;
}
export function commandFingerprint(c: InventoryCommand) {
  return createHash("sha256").update(JSON.stringify([c.productId,c.action,c.channel,c.quantity,c.reservationId,c.reference,c.note,c.expectedRevision,c.salePrice])).digest("hex");
}
export async function inventoryTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(fn, { isolationLevel: "Serializable", timeout: 15000 }); }
    catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && (["P2034", "P2002"].includes(e.code) || (e.code === "P2010" && ["40001", "40P01"].includes(String(e.meta?.code)))) && attempt < 3) continue; throw e; }
  }
}
export async function stockForUpdate(tx: Prisma.TransactionClient, productId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Product" WHERE id = ${productId} FOR UPDATE`;
  if (!rows.length) throw new InventoryError("Product not found", 404);
  const product = await tx.product.findUniqueOrThrow({ where: { id: productId } });
  const initial = ["sold", "archived"].includes(product.status) ? 0 : 1;
  const stock = await tx.inventoryStock.upsert({ where: { productId }, create: { productId, onHand: initial, available: initial }, update: {} });
  return { product, stock };
}
export async function inventoryIssue(tx: Prisma.TransactionClient, key: string, productId: string | null, channel: string, message: string) {
  return tx.inventoryIssue.upsert({ where: { key }, create: { key, productId, channel, message }, update: { message, resolvedAt: null } });
}
export async function changeInventory(tx: Prisma.TransactionClient, c: InventoryCommand) {
  if (typeof c.key !== "string" || !c.key || c.key.length > 200 || !CHANNELS.includes(c.channel)) throw new InventoryError("Invalid sale channel or request identifier", 400);
  if (c.salePrice != null && (typeof c.salePrice !== "number" || !Number.isFinite(c.salePrice) || c.salePrice < 0)) throw new InventoryError("Enter a valid sale price", 400);
  const { product, stock } = await stockForUpdate(tx, c.productId);
  const fingerprint = commandFingerprint(c);
  const prior = await tx.inventoryMovement.findUnique({ where: { key: c.key } });
  if (prior) {
    if (prior.fingerprint !== fingerprint) throw new InventoryError("This request identifier was already used for a different action.");
    return { stock, movement: prior, replay: true };
  }
  if (stock.blocked && ["sale", "reserve"].includes(c.action)) throw new InventoryError("Inventory needs review before another sale or reservation. Check the Inventory desk.");
  const shopify = await tx.inventoryChannel.findUnique({ where: { productId_channel: { productId: product.id, channel: "shopify" } } });
  if (shopify && c.channel === "whatnot" && ["sale", "restore"].includes(c.action)) throw new InventoryError("This item is connected to Shopify. Whatnot inventory updates arrive automatically; use Sync now in the Inventory desk instead of recording the sale twice.");
  const nonShowBefore = await tx.inventoryReservation.aggregate({ where: { productId: product.id, status: "active", channel: { not: "whatnot" } }, _sum: { quantity: true } });
  let onHand = stock.onHand, reserved = stock.reserved;
  let quantity = c.quantity ?? 1, reservationId = c.reservationId ?? null;
  let delta = 0;
  if (c.action === "reserve") {
    units(quantity);
    if (quantity > stock.available || ["sold", "archived"].includes(product.status)) throw new InventoryError(`Only ${stock.available} available. Count or release stock before reserving.`);
    reservationId = randomUUID();
    await tx.inventoryReservation.create({ data: { id: reservationId, productId: product.id, channel: c.channel, quantity, reference: c.reference, note: c.note } });
    reserved += quantity;
  } else if (c.action === "release") {
    const hold = await tx.inventoryReservation.findFirst({ where: { id: reservationId ?? "", productId: product.id, status: "active" } });
    if (!hold) throw new InventoryError("This reservation is no longer active.");
    quantity = hold.quantity;
    reserved -= quantity;
    await tx.inventoryReservation.update({ where: { id: hold.id }, data: { status: "released", quantity: 0 } });
  } else if (c.action === "sale") {
    units(quantity);
    const hold = reservationId ? await tx.inventoryReservation.findFirst({ where: { id: reservationId, productId: product.id, channel: c.channel, status: "active" } }) : null;
    if (reservationId && (!hold || hold.quantity < quantity)) throw new InventoryError("The sale exceeds its reservation. Review the inventory before completing it.");
    if (!hold && stock.available < quantity) throw new InventoryError(`Only ${stock.available} available. Other units may be reserved for a show or buyer.`);
    if (hold) {
      reserved -= quantity;
      await tx.inventoryReservation.update({ where: { id: hold.id }, data: { quantity: hold.quantity - quantity, status: hold.quantity === quantity ? "consumed" : "active" } });
    }
    delta = -quantity;
    onHand -= quantity;
  } else if (c.action === "restore") {
    const sale = await tx.inventoryMovement.findUnique({ where: { key: c.reference ?? "" } });
    if (!sale || sale.productId !== product.id || sale.action !== "sale") throw new InventoryError("Select the recorded sale to reverse.");
    if (await tx.inventoryMovement.findFirst({ where: { productId: product.id, action: "restore", reference: sale.key } })) throw new InventoryError("This sale was already reversed.");
    quantity = sale.quantity; delta = quantity; onHand += quantity;
    if (sale.note?.startsWith("lineup:")) {
      const item = await tx.streamLineupItem.findUnique({ where: { id: sale.note.slice(7) } });
      if (item) await tx.streamLineupItem.update({ where: { id: item.id }, data: { soldQuantity: Math.max(0, item.soldQuantity - quantity), soldAt: null } });
    }
    await tx.shopSale.updateMany({ where: { productId: product.id, externalId: sale.key }, data: { fulfillment: "stock_returned" } });
  } else {
    units(quantity, true);
    if (c.expectedRevision !== stock.revision) throw new InventoryError("Stock changed while you were counting. Refresh and check the quantity again.");
    if (!c.note?.trim()) throw new InventoryError("Add a reason for the stock count.", 400);
    if (quantity < reserved) throw new InventoryError(`Release the ${reserved} reserved units before reducing the count below them.`);
    delta = quantity - onHand; onHand = quantity;
  }
  const updated = await tx.inventoryStock.update({ where: { productId: product.id }, data: {
    onHand, reserved, available: onHand - reserved, revision: { increment: 1 },
    ...(c.action === "count" ? { countedAt: new Date() } : {}),
    ...(c.action === "count" && !shopify ? { blocked: false } : {}),
  } });
  const movement = await tx.inventoryMovement.create({ data: {
    key: c.key, fingerprint, productId: product.id, action: c.action, channel: c.channel,
    quantity, delta, onHandAfter: onHand, reservedAfter: reserved, reservationId,
    reference: c.reference, note: c.note, salePrice: c.salePrice,
  } });
  if (shopify) {
    const nonShowAfter = await tx.inventoryReservation.aggregate({ where: { productId: product.id, status: "active", channel: { not: "whatnot" } }, _sum: { quantity: true } });
    const remoteDelta = delta - ((nonShowAfter._sum.quantity ?? 0) - (nonShowBefore._sum.quantity ?? 0));
    if (remoteDelta) await tx.inventorySync.create({ data: { key: movement.key, productId: product.id, delta: remoteDelta } });
  }
  const soldOut = onHand === 0;
  await tx.product.update({ where: { id: product.id }, data: {
    ...(soldOut ? { status: "sold", soldAt: product.soldAt ?? new Date(), soldPlatform: c.channel } : product.status === "sold" ? { status: "listed", soldAt: null, soldPlatform: null } : {}),
    ...(c.action === "sale" && c.salePrice != null ? { soldPrice: c.salePrice } : {}),
  } });
  // Only local listings can be confirmed here. External changes become explicit tasks.
  await tx.platformListing.updateMany({ where: { productId: product.id, platform: "shop", status: { in: ["active", "reserved", "sold"] } }, data: { status: soldOut ? "sold" : updated.available === 0 ? "reserved" : "active", soldAt: soldOut ? new Date() : null } });
  if (product.shopItemId) await tx.shopItem.updateMany({ where: { id: product.shopItemId }, data: { status: soldOut ? "sold" : updated.available === 0 ? "reserved" : "active", soldAt: soldOut ? new Date() : null } });
  if (product.fbListingId && c.channel !== "facebook") await inventoryIssue(tx, `facebook:${product.id}`, product.id, "facebook", `Update Marketplace availability: ${updated.available} available; ${reserved} reserved. Confirm the listing was updated.`);
  if (c.channel === "facebook" && c.action === "sale" && onHand === 0) await tx.inventoryIssue.updateMany({ where: { key: { in: [`facebook:${product.id}`, `facebook-observed:${product.id}`, `facebook-missing:${product.id}`] } }, data: { resolvedAt: new Date() } });
  const whatnotListing = await tx.inventoryChannel.findUnique({ where: { productId_channel: { productId: product.id, channel: "whatnot" } } });
  const inLineup = await tx.streamLineupItem.count({ where: { productId: product.id, soldAt: null } });
  if ((whatnotListing || inLineup > 0) && !shopify && c.channel !== "whatnot") await inventoryIssue(tx, `whatnot:${product.id}`, product.id, "whatnot", `Update Whatnot listing availability: ${onHand} unsold units, ${reserved} reserved. CSV uploads do not update existing listings.`);
  return { stock: updated, movement, replay: false };
}
export async function runInventory(c: InventoryCommand) { return inventoryTransaction(tx => changeInventory(tx, c)); }

// A missing Facebook listing is not proof of a sale. Queue a review instead of inventing a transaction.
export async function observeFacebookSale(productId: string, listingId: string | null, reason: "sold" | "missing" = "sold") {
  return inventoryTransaction(async tx => {
    const { stock } = await stockForUpdate(tx, productId);
    if (stock.onHand === 0) return;
    await inventoryIssue(tx, `facebook-observed:${productId}`, productId, "facebook", `${reason === "sold" ? "Facebook reports sold" : "Facebook listing is missing"}${listingId ? ` (${listingId})` : ""}. Confirm quantity and record the sale; a listing status does not identify which units were sold.`);
    // Block further local checkout until the observation has been reconciled.
    if (stock.available > 0) await changeInventory(tx, { productId, action: "reserve", channel: "facebook", quantity: stock.available, key: `fb-observed:${productId}:${stock.revision}`, reference: `facebook:${listingId ?? productId}`, note: reason === "sold" ? "Facebook sold status awaiting confirmation" : "Missing Facebook listing awaiting confirmation" });
  });
}
