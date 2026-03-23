const VLLM_URL = process.env.VLLM_URL || "http://127.0.0.1:8355/v1";
const MODEL = "Qwen/Qwen3.5-35B-A3B-FP8";

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
  const res = await fetch(`${VLLM_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are a purchase history parser. Extract ALL orders and their line items from the provided text. The text may be copy-pasted from Walmart.com purchase history, email receipts, or any store's order history page.

Rules:
- Extract every distinct order/receipt you can find
- For each order, extract: store name, date (YYYY-MM-DD), order number if visible, all items with quantities and prices, and the total
- If unit price isn't shown, divide total price by quantity
- If dates are relative ("3 days ago", "Mar 15"), convert to absolute YYYY-MM-DD dates. Today is ${new Date().toISOString().split("T")[0]}.
- Normalize item names: remove SKU numbers, clean up abbreviated names (e.g., "GV 2% MLK GL" → "Great Value 2% Milk Gallon")
- If store isn't explicitly mentioned, infer from context (Walmart.com URLs, Walmart branding, etc.)
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
}]`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      temperature: 0.2,
      max_tokens: 8000,
    }),
    signal: AbortSignal.timeout(120000),
  });

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";

  // Extract JSON array
  const arrayMatch = content.match(/\[[\s\S]*\]/);
  if (!arrayMatch) {
    // Try single object
    const objMatch = content.match(/\{[\s\S]*\}/);
    if (objMatch) {
      const parsed = JSON.parse(objMatch[0]);
      return Array.isArray(parsed) ? parsed : [parsed];
    }
    throw new Error("Could not parse any orders from the text");
  }

  return JSON.parse(arrayMatch[0]) as ImportedOrder[];
}
