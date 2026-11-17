import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Dashboard } from "@/components/laundry/dashboard";
export const metadata = {
  title: "Operator workspace",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const s = await auth();
  if (!s?.user?.id || s.mfaRequired || s.impersonatedBy)
    redirect("/login?callbackUrl=%2Flaundry%2Fdashboard");
  return (
    <div className="wrap page">
      <p className="eyebrow">Laundry Rental Network</p>
      <h1>Your operator workspace.</h1>
      <p>Manage requests, confirm deliveries and keep your listing current.</p>
      <Dashboard />
    </div>
  );
}
