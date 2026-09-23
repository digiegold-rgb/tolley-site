import { prisma } from "@/lib/prisma";
import { InventoryError, inventoryTransaction, stockForUpdate } from "./inventory";
import { linkShopifyProduct, shopifyGraphql } from "./shopify-inventory";

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
type RemoteProduct = { id: string; handle: string; variants: { nodes: { id: string; sku: string | null; inventoryItem: { id: string } }[] } };
const selection = "id handle variants(first: 2) { nodes { id sku inventoryItem { id } } }";

// Dedicated one-variant products only. A stable handle makes retries find the same draft.
export async function syncShopifyCatalog(productId: string, locationId?: string) {
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
  const inventoryLink = await prisma.inventoryChannel.findUnique({ where: { productId_channel: { productId, channel: "shopify" } } });
  locationId ||= inventoryLink?.locationId ?? process.env.SHOPIFY_LOCATION_ID;
  if (!locationId || !/^gid:\/\/shopify\/Location\/\d+$/.test(locationId)) throw new InventoryError("Configure the Shopify inventory location before sending products.");
  if (!product.title.trim() || !product.targetPrice || !product.weightOz || !product.imageUrls.some(u => u.startsWith("https://"))) throw new InventoryError("Add a title, selling price, package weight, and public HTTPS photo before sending this product.");
  const handle = `tolley-${product.id}`;
  const found = await shopifyGraphql<{ products: { nodes: RemoteProduct[] } }>(`query Product($query: String!) { products(first: 2, query: $query) { nodes { ${selection} } } }`, { query: `handle:${handle}` });
  const existing = found.products.nodes.find(p => p.handle === handle);
  if (inventoryLink && !existing) throw new InventoryError("The linked Shopify product does not use this Tolley handle. Inventory remains linked; update its details in Shopify or set the matching handle before catalog updates.");
  if (existing && (existing.variants.nodes.length !== 1 || existing.variants.nodes[0].sku !== handle)) throw new InventoryError("This Shopify product has different variants or a different SKU. Review its mapping before updating.");
  const result = await inventoryTransaction(async tx => {
    const { stock, product: fresh } = await stockForUpdate(tx, productId);
    if (!existing && (!stock.countedAt || stock.reserved || stock.blocked)) throw new InventoryError("Verify the stock count and release reservations before creating the Shopify draft.");
    const input = {
      handle, title: fresh.title, descriptionHtml: escapeHtml(fresh.description ?? fresh.title), vendor: fresh.brand ?? "Tolley",
      productOptions: [{ name: "Title", position: 1, values: [{ name: "Default Title" }] }],
      variants: [{ ...(existing ? { id: existing.variants.nodes[0].id } : {}), optionValues: [{ optionName: "Title", name: "Default Title" }], sku: handle, price: fresh.targetPrice!.toFixed(2), inventoryPolicy: "DENY", inventoryItem: { tracked: true, measurement: { weight: { value: fresh.weightOz!, unit: "OUNCES" } } },
        ...(!existing ? { inventoryQuantities: [{ locationId, name: "available", quantity: stock.onHand }] } : {}) }],
      ...(!existing ? { status: "DRAFT", files: product.imageUrls.filter(u => u.startsWith("https://")).slice(0, 8).map(originalSource => ({ originalSource, contentType: "IMAGE" })) } : {}),
    };
    const response = await shopifyGraphql<{ productSet: { product: RemoteProduct | null; userErrors: { message: string }[] } }>(`mutation Product($input: ProductSetInput!, $identifier: ProductSetIdentifiers!) { productSet(input: $input, identifier: $identifier, synchronous: true) { product { ${selection} } userErrors { message } } }`, { input, identifier: { handle } });
    if (response.productSet.userErrors.length || !response.productSet.product) throw new InventoryError(response.productSet.userErrors.map(e => e.message).join("; ") || "Shopify did not create the product");
    return response.productSet.product;
  });
  if (!inventoryLink) await linkShopifyProduct(productId, result.variants.nodes[0].inventoryItem.id, locationId);
  await prisma.inventoryIssue.updateMany({ where: { key: `shopify-catalog:${productId}` }, data: { resolvedAt: new Date() } });
  return { id: result.id, created: !existing, message: existing ? "Product details updated. Existing stock was preserved." : "Draft created and stock linked. Review the draft and publish it to the Whatnot sales channel in Shopify." };
}
