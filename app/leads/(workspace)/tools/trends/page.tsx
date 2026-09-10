import Tool from "@/components/leads/tools/trends";
import { requireOwnerTool } from "@/lib/leads/owner-tool-auth";

export const metadata = { title: "Trends and comparables | T-Agent" };

export default async function Page() {
  await requireOwnerTool("/leads/tools/trends");
  return <Tool />;
}
