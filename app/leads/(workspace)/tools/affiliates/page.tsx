import Tool from "@/components/leads/tools/affiliates";
import { requireOwnerTool } from "@/lib/leads/owner-tool-auth";

export const metadata = { title: "Affiliate links | T-Agent" };

export default async function Page() {
  await requireOwnerTool("/leads/tools/affiliates");
  return <Tool />;
}
