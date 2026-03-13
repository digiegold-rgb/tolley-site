/**
 * Amazon Product Advertising API — placeholder with mock data
 *
 * Real implementation: PA-API 5.0
 * https://webservices.amazon.com/paapi5/documentation/
 */

export interface AmazonProduct {
  asin: string;
  title: string;
  price: number;
  imageUrl: string;
  url: string;
  category: string;
}

// async function searchAmazonReal(query: string): Promise<AmazonProduct[]> {
//   const payload = {
//     Keywords: query,
//     SearchIndex: "All",
//     Resources: ["Images.Primary.Large", "ItemInfo.Title", "Offers.Listings.Price"],
//   };
//   const res = await fetch("https://webservices.amazon.com/paapi5/searchitems", {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//       Authorization: `AWS4-HMAC-SHA256 ...`,
//     },
//     body: JSON.stringify(payload),
//   });
//   const data = await res.json();
//   return data.SearchResult.Items.map((item: any) => ({
//     asin: item.ASIN,
//     title: item.ItemInfo.Title.DisplayValue,
//     price: item.Offers.Listings[0].Price.Amount,
//     imageUrl: item.Images.Primary.Large.URL,
//     url: item.DetailPageURL,
//     category: item.ItemInfo.Classifications?.ProductGroup?.DisplayValue ?? "",
//   }));
// }

const MOCK_AMAZON_PRODUCTS: AmazonProduct[] = [
  {
    asin: "B0AZ001",
    title: "Wireless Earbuds — BT 5.3 In-Ear Headphones",
    price: 29.99,
    imageUrl: "https://placehold.co/300x300/0f172a/ff9900?text=Earbuds",
    url: "https://amazon.com/dp/B0AZ001",
    category: "Electronics",
  },
  {
    asin: "B0AZ002",
    title: "Dimmable LED Lamp — USB Powered Touch Control",
    price: 22.99,
    imageUrl: "https://placehold.co/300x300/0f172a/ff9900?text=LED+Lamp",
    url: "https://amazon.com/dp/B0AZ002",
    category: "Home",
  },
  {
    asin: "B0AZ003",
    title: "Waterproof BT Speaker — Portable 20W Outdoor",
    price: 24.99,
    imageUrl: "https://placehold.co/300x300/0f172a/ff9900?text=BT+Speaker",
    url: "https://amazon.com/dp/B0AZ003",
    category: "Electronics",
  },
  {
    asin: "B0AZ004",
    title: "Kitchen Scale USB — Digital Food Scale 0.1g",
    price: 14.99,
    imageUrl: "https://placehold.co/300x300/0f172a/ff9900?text=Kitchen+Scale",
    url: "https://amazon.com/dp/B0AZ004",
    category: "Kitchen",
  },
  {
    asin: "B0AZ005",
    title: "Car Phone Holder — Magnetic Dashboard Mount",
    price: 11.99,
    imageUrl: "https://placehold.co/300x300/0f172a/ff9900?text=Car+Mount",
    url: "https://amazon.com/dp/B0AZ005",
    category: "Automotive",
  },
];

export async function searchAmazon(_query: string): Promise<AmazonProduct[]> {
  return MOCK_AMAZON_PRODUCTS;
}

export async function getAmazonProduct(asin: string): Promise<AmazonProduct | null> {
  return MOCK_AMAZON_PRODUCTS.find((p) => p.asin === asin) ?? null;
}
