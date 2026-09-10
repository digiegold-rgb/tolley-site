import Tool from "@/components/leads/tools/inventory";
import { requireOwnerTool } from "@/lib/leads/owner-tool-auth";

export const metadata = { title: "Inventory and sales | T-Agent" };

export default async function Page() {
  await requireOwnerTool("/leads/tools/inventory");
  return <Tool />;
}
