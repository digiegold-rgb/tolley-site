import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminTabs from "@/components/leads/admin/AdminTabs";

export const revalidate = 0;

/**
 * /leads/admin — Admin workspace (Phase 7).
 *
 * Tabs for: Billing · Integrations · MLS Auth · Settings · Analytics ·
 * Workflow · Market Intel. Each tab is a launcher to the existing full-
 * featured route. Sidebar+topbar chrome is preserved on the deep-linked
 * pages.
 */
export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/leads/admin");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-white">Admin</h1>
        <p className="text-xs text-white/40">
          Billing, integrations, MLS auth, farm settings, analytics, workflow automation, and market intel.
        </p>
      </div>
      <AdminTabs />
    </div>
  );
}
