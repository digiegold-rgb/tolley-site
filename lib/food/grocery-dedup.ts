import { normalizeIngredient } from "./ingredient-taxonomy";

// ── Unit conversion tables ─────────────────────────────────────

const VOLUME_TO_TSP: Record<string, number> = {
  tsp: 1,
  teaspoon: 1,
  teaspoons: 1,
  tbsp: 3,
  tablespoon: 3,
  tablespoons: 3,
  "fl oz": 6,
  "fluid ounce": 6,
  "fluid ounces": 6,
  cup: 48,
  cups: 48,
  pint: 96,
  pints: 96,
  pt: 96,
  quart: 192,
  quarts: 192,
  qt: 192,
  gallon: 768,
  gallons: 768,
  gal: 768,
  ml: 0.202884,
  milliliter: 0.202884,
  milliliters: 0.202884,
  liter: 202.884,
  liters: 202.884,
  l: 202.884,
};

const WEIGHT_TO_OZ: Record<string, number> = {
  oz: 1,
  ounce: 1,
  ounces: 1,
  lb: 16,
  lbs: 16,
  pound: 16,
  pounds: 16,
  g: 0.035274,
  gram: 0.035274,
  grams: 0.035274,
  kg: 35.274,
  kilogram: 35.274,
  kilograms: 35.274,
};

/**
 * Normalize a quantity+unit into the smallest practical standard unit.
 * Volume → cup (if >= 48 tsp) or tbsp (if >= 3 tsp) or tsp.
 * Weight → lb (if >= 16 oz) or oz.
 */
export function normalizeUnit(
  quantity: number,
  unit: string
): { quantity: number; unit: string } {
  const lower = unit.toLowerCase().trim();

  // ── Volume path ──────────────────────────────────────────────
  if (lower in VOLUME_TO_TSP) {
    const totalTsp = quantity * VOLUME_TO_TSP[lower];
    if (totalTsp >= 48) {
      return { quantity: round(totalTsp / 48), unit: "cup" };
    }
    if (totalTsp >= 3) {
      return { quantity: round(totalTsp / 3), unit: "tbsp" };
    }
    return { quantity: round(totalTsp), unit: "tsp" };
  }

  // ── Weight path ──────────────────────────────────────────────
  if (lower in WEIGHT_TO_OZ) {
    const totalOz = quantity * WEIGHT_TO_OZ[lower];
    if (totalOz >= 16) {
      return { quantity: round(totalOz / 16), unit: "lb" };
    }
    return { quantity: round(totalOz), unit: "oz" };
  }

  // ── Pass-through for count-based units ───────────────────────
  return { quantity, unit: lower };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Merge & Dedup ──────────────────────────────────────────────

export interface GroceryItem {
  name: string;
  quantity: number;
  unit: string;
}

export interface MergedGroceryItem {
  name: string;
  quantity: number;
  unit: string;
  normalizedName: string;
  category: string;
  aisle: string;
}

/**
 * Merge duplicate ingredients by normalized name and compatible unit.
 * Quantities for the same item in the same unit family are summed.
 */
export function mergeIngredients(items: GroceryItem[]): MergedGroceryItem[] {
  const grouped = new Map<string, MergedGroceryItem>();

  for (const item of items) {
    const { canonical, category, aisle } = normalizeIngredient(item.name);
    const normalized = normalizeUnit(item.quantity, item.unit);
    const key = `${canonical}::${normalized.unit}`;

    const existing = grouped.get(key);
    if (existing) {
      existing.quantity = round(existing.quantity + normalized.quantity);
    } else {
      grouped.set(key, {
        name: item.name,
        quantity: normalized.quantity,
        unit: normalized.unit,
        normalizedName: canonical,
        category,
        aisle,
      });
    }
  }

  return Array.from(grouped.values()).sort((a, b) =>
    a.aisle.localeCompare(b.aisle) || a.normalizedName.localeCompare(b.normalizedName)
  );
}

// ── Pantry subtraction ─────────────────────────────────────────

export interface PantryEntry {
  name: string;
  quantity: number;
  unit: string;
}

/**
 * Remove items from the grocery list that are already in stock.
 * If the pantry has partial stock, the grocery quantity is reduced.
 * Items fully covered by the pantry are removed entirely.
 */
export function subtractPantry(
  groceryItems: MergedGroceryItem[],
  pantryItems: PantryEntry[]
): MergedGroceryItem[] {
  // Build a map of pantry stock by normalized name + unit
  const pantryMap = new Map<string, number>();
  for (const p of pantryItems) {
    const { canonical } = normalizeIngredient(p.name);
    const normalized = normalizeUnit(p.quantity, p.unit);
    const key = `${canonical}::${normalized.unit}`;
    pantryMap.set(key, (pantryMap.get(key) || 0) + normalized.quantity);
  }

  const result: MergedGroceryItem[] = [];

  for (const item of groceryItems) {
    const key = `${item.normalizedName}::${item.unit}`;
    const stock = pantryMap.get(key) || 0;

    if (stock <= 0) {
      result.push(item);
    } else if (stock < item.quantity) {
      result.push({
        ...item,
        quantity: round(item.quantity - stock),
      });
      pantryMap.set(key, 0);
    } else {
      // Fully in stock — skip
      pantryMap.set(key, round(stock - item.quantity));
    }
  }

  return result;
}
