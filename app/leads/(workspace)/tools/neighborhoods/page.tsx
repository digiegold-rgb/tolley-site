import Tool from "@/components/leads/tools/neighborhoods";
import { requireOwnerTool } from "@/lib/leads/owner-tool-auth";

export const metadata = { title: "Neighborhood pages | T-Agent" };

export default async function Page() {
  await requireOwnerTool("/leads/tools/neighborhoods");
  return <Tool />;
}
