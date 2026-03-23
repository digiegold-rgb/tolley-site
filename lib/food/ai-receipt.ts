const VLLM_URL = process.env.VLLM_URL || "http://127.0.0.1:8355/v1";
const MODEL = "Qwen/Qwen3.5-35B-A3B-FP8";

export interface ReceiptItem {
  name: string;
  qty: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ScannedReceipt {
  store: string;
  date: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  total: number;
}

export async function scanReceipt(
  imageBase64: string,
  mimeType: string
): Promise<ScannedReceipt> {
  const res = await fetch(`${VLLM_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
              },
            },
            {
              type: "text",
              text: `Extract all line items from this store receipt. Identify the store name, date of purchase, each item with its quantity and price, plus subtotal, tax, and total.

Return ONLY valid JSON:
{
  "store": "Store Name",
  "date": "YYYY-MM-DD",
  "items": [{"name": "Item Name", "qty": 1, "unitPrice": 2.99, "totalPrice": 2.99}],
  "subtotal": 0.00,
  "tax": 0.00,
  "total": 0.00
}

If quantity is not listed for an item, assume 1. If unit price is not shown separately, set it equal to totalPrice divided by qty.`,
            },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 3000,
    }),
    signal: AbortSignal.timeout(60000),
  });

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error("Failed to parse receipt from AI response");
  }

  return JSON.parse(jsonMatch[0]) as ScannedReceipt;
}
