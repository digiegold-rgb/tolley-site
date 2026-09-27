// Treasure Hauls Whatnot slideshow. Each night, replace
// public/stream/shows/tonight.json (and optionally public/stream/shows/YYYY-MM-DD.json).
// The page at /stream/slideshow reads that file. It has no stream controls.

export type ProductType = "auction" | "bin" | "giveaway";

export type ShowProduct = {
  id: string;
  title: string;
  type: ProductType;
  price: number;
  quantity: number;
  condition: string;
  size: string;
  description: string;
  images: string[];
};

export type ShowData = {
  show: {
    title: string;
    start_ct: string;
    whatnot_url: string;
    category: string;
  };
  products: ShowProduct[];
};

export type ParseResult = { ok: true; show: ShowData } | { ok: false; error: string };

const DATE_PARAM = /^\d{4}-\d{2}-\d{2}$/;

/** `?date=YYYY-MM-DD` selects a dated file. Anything else is tonight.json. */
export function showFileName(date: string | null | undefined): string {
  if (typeof date === "string" && DATE_PARAM.test(date)) return `${date}.json`;
  return "tonight.json";
}

export function intervalMs(raw: string | null | undefined, fallback = 6000): number {
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  // 6 or 8.5 means seconds. 6000 means milliseconds.
  const ms = n >= 500 ? n : n * 1000;
  return Math.min(120_000, Math.max(2_000, Math.round(ms)));
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function money(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value === "string") {
    const n = Number(value.replace(/[$,\s]/g, ""));
    if (Number.isFinite(n)) return Math.max(0, n);
  }
  return 0;
}

export function productType(value: unknown): ProductType {
  const t = text(value, 40).toLowerCase().replace(/[_-]+/g, " ");
  if (t === "giveaway" || t === "give away") return "giveaway";
  if (t === "bin" || t === "buy it now" || t === "buy now") return "bin";
  return "auction";
}

export function priceLabel(type: ProductType, price: number): string {
  if (type === "giveaway") return "GIVEAWAY";
  const rounded = Math.round(price * 100) / 100;
  const amount = Number.isInteger(rounded) ? `$${rounded}` : `$${rounded.toFixed(2)}`;
  return type === "bin" ? `Buy Now ${amount}` : `Starts at ${amount}`;
}

export function detailLine(product: Pick<ShowProduct, "condition" | "size" | "quantity">): string {
  const bits = [product.condition, product.size].map((s) => s.trim()).filter(Boolean);
  // 50+ is an open lot ("various"), not a count to put on the slide.
  if (product.quantity > 1 && product.quantity < 50) bits.push(`x${product.quantity}`);
  return bits.join(" · ");
}

export function formatShowStart(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(d);
}

export function isPlaceholderShow(show: ShowData): boolean {
  return /EXAMPLE/i.test([show.show.title, show.show.category, ...show.products.map((p) => p.title)].join("\n"));
}

export function parseShowFile(raw: unknown): ParseResult {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Show file must be a JSON object." };
  const root = raw as Record<string, unknown>;
  if (!root.show || typeof root.show !== "object") return { ok: false, error: "Show file is missing a show object." };
  if (!Array.isArray(root.products)) return { ok: false, error: "Show file is missing a products array." };
  const show = root.show as Record<string, unknown>;
  const products: ShowProduct[] = [];
  for (const item of root.products) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    const images = Array.isArray(p.images)
      ? p.images.filter((u): u is string => typeof u === "string" && u.trim().length > 0).map((u) => u.trim()).slice(0, 12)
      : [];
    const title = text(p.title, 240);
    if (!title && images.length === 0) continue;
    const quantityRaw = p.quantity;
    const quantity = quantityRaw == null || quantityRaw === ""
      ? 1
      : Math.max(0, Math.round(money(quantityRaw)));
    products.push({
      id: text(p.id, 80) || `item-${products.length + 1}`,
      title: title || "Untitled item",
      type: productType(p.type),
      price: money(p.price),
      quantity,
      condition: text(p.condition, 80),
      size: text(p.size, 80),
      description: text(p.description, 2000),
      images,
    });
  }
  return {
    ok: true,
    show: {
      show: {
        title: text(show.title, 200) || "Treasure Hauls",
        start_ct: text(show.start_ct, 40),
        whatnot_url: text(show.whatnot_url, 300),
        category: text(show.category, 120),
      },
      products,
    },
  };
}
