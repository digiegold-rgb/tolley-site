import { visionJSON } from "./ai-client";

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

const RECEIPT_PROMPT = `Extract all line items from this store receipt. Identify the store name, date of purchase, each item with its quantity and price, plus subtotal, tax, and total.

Return ONLY valid JSON:
{
  "store": "Store Name",
  "date": "YYYY-MM-DD",
  "items": [{"name": "Item Name", "qty": 1, "unitPrice": 2.99, "totalPrice": 2.99}],
  "subtotal": 0.00,
  "tax": 0.00,
  "total": 0.00
}

If quantity is not listed for an item, assume 1. If unit price is not shown separately, set it equal to totalPrice divided by qty.`;

/**
 * Scan a store receipt photo. Uses Gemini 2.5 Flash because Qwen3.5-35B-A3B-FP8
 * is text-only and hangs on image_url requests (per feedback_vllm_qwen_text_only).
 */
export async function scanReceipt(
  imageBase64: string,
  mimeType: string
): Promise<ScannedReceipt> {
  return visionJSON<ScannedReceipt>({
    task: "scan-receipt",
    prompt: RECEIPT_PROMPT,
    images: [{ base64: imageBase64, mimeType }],
    temperature: 0.2,
    maxTokens: 3000,
  });
}
