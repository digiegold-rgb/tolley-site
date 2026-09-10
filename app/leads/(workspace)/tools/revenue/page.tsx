import Tool from "@/components/leads/tools/revenue";
import { requireOwnerTool } from "@/lib/leads/owner-tool-auth";

export const metadata = { title: "Revenue imports | T-Agent" };

export default async function Page() {
  await requireOwnerTool("/leads/tools/revenue");
  return <Tool />;
}
