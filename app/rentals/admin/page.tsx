import { requireAdminPageSession } from "@/lib/admin-auth";
import { RentalsAdminClient } from "./rentals-admin-client";

export const dynamic = "force-dynamic";

export default async function RentalsAdminPage() {
  const session = await requireAdminPageSession("/rentals/admin");

  return (
    <main className="min-h-screen bg-[#0a0a0f] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 backdrop-blur">
          <p className="text-xs font-semibold tracking-widest text-white/50 uppercase">Rentals Admin</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Booking Management</h1>
          <p className="mt-1 text-sm text-white/50">Logged in as {session.email}</p>
        </header>
        <RentalsAdminClient />
      </div>
    </main>
  );
}
