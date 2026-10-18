import inventory from "./route-inventory.json";
const pages = inventory.filter(r => /\/page\.tsx?$/.test(r.file));
export function routeClassification(path: string) {
  const clean = path.split("?")[0].replace(/\/+$/, "") || "/";
  const exact = pages.find(r => r.path === clean); if (exact) return exact;
  return pages.filter(r => r.path.includes("[")).sort((a,b) => b.path.length - a.path.length).find(r => {
    const regex = r.path.split("/").map(part => part.startsWith("[[...") ? ".*" : part.startsWith("[...") ? ".+" : part.startsWith("[") ? "[^/]+" : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("/");
    return new RegExp(`^${regex}$`).test(clean);
  }) || null;
}
export const publicRouteInventory = () => inventory.filter(r => ["public", "supporting", "machine"].includes(r.audience)).map(({ path, audience }) => ({ path, audience }));
