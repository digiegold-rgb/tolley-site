import { redirect } from "next/navigation";
import { requireOwnerTool } from "@/lib/leads/owner-tool-auth";
import { fixesPrivateUrl } from "@/lib/fixes-private-url";

export const dynamic = "force-dynamic";
export const metadata = { title: "Private Fixes | Tolley", robots: { index: false, follow: false } };

export default async function Page() {
  await requireOwnerTool("/fixes");
  const destination = fixesPrivateUrl(process.env.FIXES_PRIVATE_URL);
  if (destination) redirect(destination);
  return <main style={{ maxWidth: 640, margin: "12vh auto", padding: "32px 24px" }}>
    <p style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>Tolley · Private workspace</p>
    <h1>Fixes is waiting for its private connection.</h1>
    <p>The repair queue runs on your Spark. Once the private connection is ready, this page will open it from your approved Tailscale devices.</p>
  </main>;
}
