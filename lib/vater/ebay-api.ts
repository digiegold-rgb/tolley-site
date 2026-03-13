/**
 * eBay Browse API — placeholder with mock data
 *
 * Real implementation: eBay Browse API v1
 * https://developer.ebay.com/api-docs/buy/browse/overview.html
 */

export interface EbayProduct {
  itemId: string;
  title: string;
  price: number;
  imageUrl: string;
  url: string;
  category: string;
}

// async function searchEbayReal(query: string): Promise<EbayProduct[]> {
//   const res = await fetch(
//     `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&limit=10`,
//     { headers: { Authorization: `Bearer ${process.env.EBAY_ACCESS_TOKEN}` } }
//   );
//   const data = await res.json();
//   return data.itemSummaries.map((item: any) => ({
//     itemId: item.itemId,
//     title: item.title,
//     price: parseFloat(item.price.value),
//     imageUrl: item.thumbnailImages?.[0]?.imageUrl ?? "",
//     url: item.itemWebUrl,
//     category: item.categories?.[0]?.categoryName ?? "",
//   }));
// }

const MOCK_EBAY_PRODUCTS: EbayProduct[] = [
  {
    itemId: "EB001",
    title: "Wireless Earbuds Pro — Noise Cancelling BT 5.3",
    price: 49.99,
    imageUrl: "https://placehold.co/300x300/0f172a/38bdf8?text=Earbuds+Pro",
    url: "https://ebay.com/itm/EB001",
    category: "Electronics",
  },
  {
    itemId: "EB002",
    title: "LED Desk Lamp USB — Touch Dimmer 3 Color Temps",
    price: 39.99,
    imageUrl: "https://placehold.co/300x300/0f172a/38bdf8?text=LED+Lamp",
    url: "https://ebay.com/itm/EB002",
    category: "Home",
  },
  {
    itemId: "EB003",
    title: "BT Speaker Waterproof — 20W Portable Bass Boost",
    price: 44.99,
    imageUrl: "https://placehold.co/300x300/0f172a/38bdf8?text=BT+Speaker",
    url: "https://ebay.com/itm/EB003",
    category: "Electronics",
  },
  {
    itemId: "EB004",
    title: "Digital Kitchen Scale — 0.1g Precision USB-C",
    price: 29.99,
    imageUrl: "https://placehold.co/300x300/0f172a/38bdf8?text=Kitchen+Scale",
    url: "https://ebay.com/itm/EB004",
    category: "Kitchen",
  },
  {
    itemId: "EB005",
    title: "Magnetic Car Mount — MagSafe Dashboard Holder",
    price: 24.99,
    imageUrl: "https://placehold.co/300x300/0f172a/38bdf8?text=Car+Mount",
    url: "https://ebay.com/itm/EB005",
    category: "Automotive",
  },
];

export async function searchEbay(_query: string): Promise<EbayProduct[]> {
  return MOCK_EBAY_PRODUCTS;
}

export async function getEbayItem(itemId: string): Promise<EbayProduct | null> {
  return MOCK_EBAY_PRODUCTS.find((p) => p.itemId === itemId) ?? null;
}
