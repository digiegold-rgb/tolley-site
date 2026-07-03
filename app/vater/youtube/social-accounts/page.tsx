/**
 * /vater/youtube/social-accounts — per-user social credential manager.
 *
 * Each user connects their OWN YouTube / TikTok / IG / FB / Pinterest / X /
 * LinkedIn credentials here. These are NOT the platform-owner's (Jared's)
 * creds — every tolley-site user sees only their own connected accounts.
 *
 * Storage is the SocialAccount Prisma model, keyed by (userId, platform).
 *
 * OAuth flows per platform are a TODO (each is ~half a day). For the
 * MVP we let users paste API tokens / refresh tokens manually into a form.
 * Posting from the Library queues the upload but actual platform API calls
 * come in a follow-up ticket.
 */
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SocialAccountsManager } from "./manager-client";

export const dynamic = "force-dynamic";

export default async function SocialAccountsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/vater/youtube");
  }

  return (
    <main className="vater-page mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6">
        <h1 className="vater-neon mb-2 text-2xl font-bold tracking-wide">
          Social Accounts
        </h1>
        <p className="text-sm text-zinc-300">
          Connect YouTube, TikTok, Instagram, Facebook, Pinterest, X/Twitter,
          and LinkedIn so you can one-click share videos from your Library.
          These credentials belong to you — they&rsquo;re stored per-user and
          not shared with anyone else.
        </p>
      </div>

      <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
        <strong>OAuth one-click flows are coming soon.</strong> For now, paste
        the API token / refresh token for each platform you&rsquo;ve already
        set up. Your Library share button will prompt you here whenever a
        platform&rsquo;s credentials are missing.
      </div>

      <SocialAccountsManager />
    </main>
  );
}
