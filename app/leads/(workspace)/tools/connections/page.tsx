import Tool from "@/components/leads/tools/connections";
import { requireOwnerTool } from "@/lib/leads/owner-tool-auth";

export const metadata = { title: "Connections and bulk tools | T-Agent" };

export default async function Page() {
  await requireOwnerTool("/leads/tools/connections");
  return <Tool />;
}
