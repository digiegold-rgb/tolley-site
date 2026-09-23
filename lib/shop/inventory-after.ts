import { after } from "next/server";
import { syncShopifyProduct, shopifyConfigured } from "./shopify-inventory";
import { inventoryTransaction, inventoryIssue } from "./inventory";

/** Call only inside a request. Durable jobs plus cron remain the retry mechanism. */
export function syncInventoryAfterResponse(productId: string) {
  if (!shopifyConfigured()) return;
  after(async () => {
    try { await syncShopifyProduct(productId); }
    catch {
      await inventoryTransaction(tx => inventoryIssue(tx, `shopify-sync:${productId}`, productId, "shopify", "Shopify synchronization could not finish. Check current stock on both platforms; the queued update is retained."));
    }
  });
}
