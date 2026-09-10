import { requireOwnerTool } from "@/lib/leads/owner-tool-auth";
import ToolNavigation from "@/components/leads/tools/ToolNavigation";
import "@/app/shop/shop.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Owner tools | T-Agent", robots: { index: false, follow: false } };

export default async function OwnerToolsLayout({ children }: { children: React.ReactNode }) {
  await requireOwnerTool("/leads/tools");
  return <section className="min-w-0"><ToolNavigation />{children}</section>;
}
