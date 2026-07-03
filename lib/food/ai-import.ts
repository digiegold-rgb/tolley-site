import { chatJSON } from "./ai-client";

export interface ImportedOrder {
  store: string;
  date: string;
  orderNumber?: string;
  items: {
    name: string;
    qty: number;
    unitPrice: number;
    totalPrice: number;
  }[];
  subtotal?: number;
  tax?: number;
  total: number;
}

/**
 * Parse pasted Walmart (or any store) purchase history text into structured orders.
 * Handles raw copy-paste from Walmart.com purchase history pages, email receipts,
 * or any freeform text containing purchase information.
 */
export async function parseImportText(text: string): Promise<ImportedOrder[]> {
  const today = new Date().toISOString().split("T")[0];
  const systemPrompt = `You are a purchase history parser. Extract ALL orders and their line items from the provided text. The text may be copy-pasted from Walmart.com, Sam's Club (samsclub.com), Aldi, Amazon, Instacart, or any store's order history page.

Rules:
- Extract every distinct order/receipt you can find
- For each order, extract: store name, date (YYYY-MM-DD), order number if visible, all items with quantities and prices, and the total
- If unit price isn't shown, divide total price by quantity
- If dates are relative ("3 days ago", "Mar 15"), convert to absolute YYYY-MM-DD dates. Today is ${today}.
- Normalize item names: remove SKU numbers, clean up abbreviated names (e.g., "GV 2% MLK GL" → "Great Value 2% Milk Gallon", "MM ORG WHL MLK" → "Member's Mark Organic Whole Milk")
- Infer the store from context. Known store signatures:
  - "Walmart" / "Walmart.com" / "Great Value" / "Marketside" → "Walmart"
  - "Sam's Club" / "samsclub.com" / "Member's Mark" / "Daily Chef" → "Sam's Club"
  - "Aldi" → "Aldi", "Costco" / "Kirkland" → "Costco", "Amazon" → "Amazon"
- For Sam's Club bulk packs (e.g., "24 ct", "5 lb"), keep the size in the item name
- Return an empty array if no purchase data can be found

Return ONLY valid JSON array:
[{
  "store": "Walmart",
  "date": "2025-03-15",
  "orderNumber": "200-1234567-8901234",
  "items": [{"name": "Item Name", "qty": 1, "unitPrice": 2.99, "totalPrice": 2.99}],
  "subtotal": 10.00,
  "tax": 0.80,
  "total": 10.80
}]`;

  const parsed = await chatJSON<ImportedOrder[] | ImportedOrder>({
    task: "parse-import-text",
    system: systemPrompt,
    user: text,
    temperature: 0.2,
    maxTokens: 8000,
    timeoutMs: 120000,
  });

  return Array.isArray(parsed) ? parsed : [parsed];
}
