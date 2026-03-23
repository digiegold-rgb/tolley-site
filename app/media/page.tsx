import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/admin-auth";
import { MediaDashboard } from "@/components/media/media-dashboard";

export default async function MediaPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/media");
  }
  if (!isAdminEmail(session.user.email)) {
    redirect("/");
  }

  return (
    <main className="relative z-10 min-h-screen">
      <section className="mx-auto max-w-4xl px-5 pt-20 pb-8 sm:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Media Hub
        </h1>
        <p className="mt-2 text-white/50">
          Download music, music videos, and media to your Plex server.
        </p>
      </section>

      <div className="mx-auto max-w-4xl px-5 pb-20 sm:px-8">
        <MediaDashboard />
      </div>
    </main>
  );
}
