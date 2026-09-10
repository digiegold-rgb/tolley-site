import Tool from "@/components/leads/tools/arbitrage";
import { requireOwnerTool } from "@/lib/leads/owner-tool-auth";

export const metadata = { title: "Arbitrage | T-Agent" };

export default async function Page() {
  await requireOwnerTool("/leads/tools/arbitrage");
  return <Tool />;
}
