import Tool from "@/components/leads/tools/probate";
import { requireOwnerTool } from "@/lib/leads/owner-tool-auth";

export const metadata = { title: "Probate | T-Agent" };

export default async function Page() {
  await requireOwnerTool("/leads/tools/probate");
  return <Tool />;
}
