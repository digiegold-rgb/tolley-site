import Tool from "@/components/leads/tools/analytics";
import { requireOwnerTool } from "@/lib/leads/owner-tool-auth";

export const metadata = { title: "Business analytics | T-Agent" };

export default async function Page() {
  await requireOwnerTool("/leads/tools/analytics");
  return <Tool />;
}
