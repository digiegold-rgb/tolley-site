import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin-auth";
import { ManusConsole } from "@/components/manus/manus-console";

export default async function ManusPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/manus");
  }
  if (!isAdminEmail(session.user.email)) {
    redirect("/");
  }

  return (
    <main className="relative z-10 min-h-screen">
      <ManusConsole />
    </main>
  );
}
