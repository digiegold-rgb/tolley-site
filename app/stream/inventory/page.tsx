import { redirect } from "next/navigation";
import { validateWdAdmin } from "@/lib/wd-auth";
import InventoryDesk from "./ui";
export const metadata = { title: "Inventory | Tolley", robots: { index: false, follow: false } };
export default async function Page() {
  if (!(await validateWdAdmin()).authed) redirect("/login?callbackUrl=/stream/inventory");
  return <InventoryDesk />;
}
