import Tool from "@/components/leads/tools/distress";
import { requireOwnerTool } from "@/lib/leads/owner-tool-auth";

export const metadata = { title: "Distress signals | T-Agent" };

export default async function Page() {
  await requireOwnerTool("/leads/tools/distress");
  return <Tool />;
}
