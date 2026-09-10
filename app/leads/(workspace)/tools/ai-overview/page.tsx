import Tool from "@/components/leads/tools/ai-overview";
import { requireOwnerTool } from "@/lib/leads/owner-tool-auth";

export const metadata = { title: "AI search visibility | T-Agent" };

export default async function Page() {
  await requireOwnerTool("/leads/tools/ai-overview");
  return <Tool />;
}
