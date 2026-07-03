export const DEFAULT_BUDGET_CATEGORIES: Array<{
  name: string;
  slug: string;
  monthlyLimitCents: number;
  color: string;
  icon: string;
  sortOrder: number;
}> = [
  { name: "Groceries",     slug: "groceries",     monthlyLimitCents: 80000,  color: "#10b981", icon: "🛒", sortOrder: 0 },
  { name: "Gas",           slug: "gas",           monthlyLimitCents: 30000,  color: "#f59e0b", icon: "⛽", sortOrder: 1 },
  { name: "Dining",        slug: "dining",        monthlyLimitCents: 25000,  color: "#ef4444", icon: "🍔", sortOrder: 2 },
  { name: "Utilities",     slug: "utilities",     monthlyLimitCents: 35000,  color: "#3b82f6", icon: "💡", sortOrder: 3 },
  { name: "Subscriptions", slug: "subscriptions", monthlyLimitCents: 15000,  color: "#8b5cf6", icon: "📺", sortOrder: 4 },
  { name: "Auto",          slug: "auto",          monthlyLimitCents: 20000,  color: "#06b6d4", icon: "🚗", sortOrder: 5 },
  { name: "Home",          slug: "home",          monthlyLimitCents: 30000,  color: "#84cc16", icon: "🏠", sortOrder: 6 },
  { name: "Health",        slug: "health",        monthlyLimitCents: 20000,  color: "#ec4899", icon: "💊", sortOrder: 7 },
  { name: "Entertainment", slug: "entertainment", monthlyLimitCents: 15000,  color: "#a855f7", icon: "🎮", sortOrder: 8 },
  { name: "Shopping",      slug: "shopping",      monthlyLimitCents: 20000,  color: "#eab308", icon: "🛍️", sortOrder: 9 },
  { name: "Misc",          slug: "misc",          monthlyLimitCents: 10000,  color: "#94a3b8", icon: "📦", sortOrder: 10 },
];
