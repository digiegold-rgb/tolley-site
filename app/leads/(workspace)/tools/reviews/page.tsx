import Tool from "@/components/leads/tools/reviews";
import { requireOwnerTool } from "@/lib/leads/owner-tool-auth";

export const metadata = { title: "Review requests | T-Agent" };

export default async function Page() {
  await requireOwnerTool("/leads/tools/reviews");
  return <Tool />;
}
