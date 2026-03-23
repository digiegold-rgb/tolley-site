/**
 * Pool water management constants, types, and utilities.
 * 48,000-gallon saltwater pool — Independence, MO
 */

// ─── Chemistry Ranges (saltwater pool) ───────────────────────

export const WATER_RANGES = {
  ph:              { min: 7.2, ideal: 7.4, max: 7.6, unit: "",    label: "pH" },
  freeChlorine:    { min: 2,   ideal: 3,   max: 5,   unit: "ppm", label: "Free Chlorine" },
  totalChlorine:   { min: 2,   ideal: 3,   max: 5,   unit: "ppm", label: "Total Chlorine" },
  alkalinity:      { min: 80,  ideal: 100, max: 120, unit: "ppm", label: "Alkalinity" },
  cya:             { min: 30,  ideal: 50,  max: 80,  unit: "ppm", label: "CYA (Stabilizer)" },
  calciumHardness: { min: 200, ideal: 300, max: 400, unit: "ppm", label: "Calcium Hardness" },
  salt:            { min: 2700,ideal: 3200,max: 3400,unit: "ppm", label: "Salt" },
  temperature:     { min: 65,  ideal: 82,  max: 90,  unit: "°F",  label: "Temperature" },
  tds:             { min: 0,   ideal: 1500,max: 3000,unit: "ppm", label: "TDS" },
  phosphates:      { min: 0,   ideal: 0,   max: 300, unit: "ppb", label: "Phosphates" },
} as const;

export type WaterParam = keyof typeof WATER_RANGES;
export type WaterStatus = "good" | "warning" | "critical";

export function getStatus(param: WaterParam, value: number | null | undefined): WaterStatus {
  if (value == null) return "warning";
  const r = WATER_RANGES[param];
  if (value < r.min * 0.85 || value > r.max * 1.15) return "critical";
  if (value < r.min || value > r.max) return "warning";
  return "good";
}

export function getStatusColor(status: WaterStatus): string {
  return status === "good" ? "#10b981" : status === "warning" ? "#f59e0b" : "#ef4444";
}

// ─── Types ───────────────────────────────────────────────────

export interface WaterReading {
  id: string;
  ph: number | null;
  freeChlorine: number | null;
  totalChlorine: number | null;
  alkalinity: number | null;
  cya: number | null;
  calciumHardness: number | null;
  salt: number | null;
  temperature: number | null;
  tds: number | null;
  lsi: number | null;
  phosphates: number | null;
  notes: string | null;
  source: string;
  readingAt: string;
  createdAt: string;
}

export interface PoolCostEntry {
  id: string;
  season: number;
  category: string;
  item: string;
  amount: number;
  quantity: number | null;
  unit: string | null;
  vendor: string | null;
  notes: string | null;
  purchaseDate: string;
}

export interface PoolInventoryItem {
  id: string;
  item: string;
  category: string;
  quantity: number;
  unit: string;
  lowStockThreshold: number;
  lastRestocked: string | null;
  notes: string | null;
  isLowStock?: boolean;
}

// ─── Constants ───────────────────────────────────────────────

export const COST_CATEGORIES = ["chemical", "equipment", "repair", "startup", "utility"] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number];

export const INVENTORY_CATEGORIES = [
  "salt", "acid", "stabilizer", "shock", "soda", "borax", "equipment", "other",
] as const;

export const POOL_VOLUME_GAL = 48_000;
export const POOL_TYPE = "saltwater";
export const POOL_LOCATION = { lat: 39.0911, lng: -94.4155, city: "Independence, MO" };

export const PARAM_ICONS: Record<string, string> = {
  ph: "🧪",
  freeChlorine: "🟢",
  totalChlorine: "🔵",
  alkalinity: "⚖️",
  cya: "🛡️",
  calciumHardness: "🪨",
  salt: "🧂",
  temperature: "🌡️",
  tds: "💧",
  phosphates: "🌿",
};

// ─── Tab config ──────────────────────────────────────────────

export const WATER_TABS = [
  { label: "Dashboard",  href: "/water" },
  { label: "Readings",   href: "/water/readings" },
  { label: "Calculator",  href: "/water/calculator" },
  { label: "Costs",      href: "/water/costs" },
  { label: "Inventory",  href: "/water/inventory" },
] as const;
