import Tool from "@/components/leads/tools/maps";
import { requireOwnerTool } from "@/lib/leads/owner-tool-auth";

export const metadata = { title: "Maps rankings | T-Agent" };

export default async function Page() {
  await requireOwnerTool("/leads/tools/maps");
  return <Tool />;
}
