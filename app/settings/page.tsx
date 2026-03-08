import { redirect } from "next/navigation";

import { auth } from "@/auth";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/?callbackUrl=/settings");
  }

  return (
    <main className="portal-shell ambient-noise relative flex min-h-screen items-center justify-center px-6">
      <div className="rounded-3xl border border-white/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.16),rgba(129,75,229,0.1)),rgba(8,7,15,0.58)] p-6 text-center shadow-[0_20px_48px_rgba(3,2,10,0.62)] backdrop-blur-2xl">
        <p className="text-sm tracking-[0.15em] text-white/65 uppercase">Settings</p>
        <h1 className="mt-2 text-xl font-semibold text-white/94">Account Settings</h1>
        <p className="mt-2 text-sm text-white/70">
          Settings UI can be expanded here. Route is protected.
        </p>
      </div>
    </main>
  );
}
