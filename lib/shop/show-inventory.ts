import { randomUUID } from "node:crypto";
import { changeInventory, inventoryTransaction, InventoryError, stockForUpdate } from "./inventory";

export async function reserveShow(slug: string, release = false) {
  return inventoryTransaction(async tx => {
    const lineup = await tx.streamLineup.findUnique({ where: { slug }, include: { items: { orderBy: { productId: "asc" } } } });
    if (!lineup) throw new InventoryError("Show lineup not found", 404);
    const reference = `show:${lineup.id}`;
    for (const item of lineup.items) {
      await stockForUpdate(tx, item.productId);
      const holds = await tx.inventoryReservation.findMany({ where: { productId: item.productId, reference, status: "active" } });
      if (release) {
        for (const hold of holds) await changeInventory(tx, { productId: item.productId, key: `release:${hold.id}`, action: "release", channel: "whatnot", reservationId: hold.id });
      } else {
        const held = holds.reduce((sum, h) => sum + h.quantity, 0);
        const needed = Math.max(0, item.quantity - item.soldQuantity - held);
        if (needed) await changeInventory(tx, { productId: item.productId, key: `show:${item.id}:${randomUUID()}`, action: "reserve", channel: "whatnot", quantity: needed, reference, note: lineup.name });
      }
    }
    return { ok: true, reserved: !release };
  });
}

export async function sellLineupUnit(slug: string, itemId: string, key: string, undo: boolean) {
  return inventoryTransaction(async tx => {
    const initial = await tx.streamLineupItem.findFirst({ where: { id: itemId, lineup: { slug } } });
    if (!initial) throw new InventoryError("Item not found", 404);
    await stockForUpdate(tx, initial.productId);
    const item = await tx.streamLineupItem.findUniqueOrThrow({ where: { id: itemId } });
    const previous = await tx.inventoryMovement.findUnique({ where: { key } });
    if (previous) {
      if (previous.productId !== item.productId || previous.action !== (undo ? "restore" : "sale") || previous.note !== `lineup:${item.id}`) throw new InventoryError("Request already used for another action");
      return item;
    }
    let reference: string | undefined;
    if (undo) {
      const sales = await tx.inventoryMovement.findMany({ where: { productId: item.productId, action: "sale", note: `lineup:${item.id}` }, orderBy: { createdAt: "desc" } });
      for (const sale of sales) {
        if (!(await tx.inventoryMovement.findFirst({ where: { action: "restore", reference: sale.key } }))) { reference = sale.key; break; }
      }
      if (!reference) throw new InventoryError("No recorded sale to undo. Use a stock count for older sales.");
    } else if (item.soldQuantity >= item.quantity || item.soldAt) throw new InventoryError("All units in this lineup are sold.");
    const hold = await tx.inventoryReservation.findFirst({ where: { productId: item.productId, reference: `show:${item.lineupId}`, channel: "whatnot", status: "active" } });
    await changeInventory(tx, { productId: item.productId, key, action: undo ? "restore" : "sale", channel: "whatnot", quantity: 1, reservationId: undo ? undefined : hold?.id, reference, note: `lineup:${item.id}` });
    if (!undo) {
      const product = await tx.product.findUniqueOrThrow({ where: { id: item.productId } });
      await tx.shopSale.create({ data: { productId: item.productId, title: product.title, platform: "whatnot", externalId: key, salePrice: 0 } });
    }
    if (undo) return tx.streamLineupItem.findUniqueOrThrow({ where: { id: item.id } });
    const soldQuantity = item.soldQuantity + 1;
    return tx.streamLineupItem.update({ where: { id: item.id }, data: { soldQuantity, soldAt: soldQuantity >= item.quantity ? new Date() : null } });
  });
}
