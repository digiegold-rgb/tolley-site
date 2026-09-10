import Tool from "@/components/leads/tools/amazon-subtags";
import { requireOwnerTool } from "@/lib/leads/owner-tool-auth";

export const metadata = { title: "Amazon tracking | T-Agent" };

export default async function Page() {
  await requireOwnerTool("/leads/tools/amazon-subtags");
  return <Tool />;
}
