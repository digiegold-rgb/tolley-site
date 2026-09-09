import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { readMfaIdentity, mfaRequirement, safeMfaDestination } from "@/lib/auth/mfa-session";
import { MfaChallengeForm } from "@/components/auth/mfa-challenge-form";
import { MfaEnrollment } from "@/components/auth/mfa-enrollment";

export const metadata: Metadata = { title: "Two-Factor Authentication | Tolley", robots: { index: false } };
export default async function MfaChallengePage({ searchParams }: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const callbackUrl = safeMfaDestination((await searchParams).callbackUrl);
  const identity = await readMfaIdentity();
  if (!identity) redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  const required = await mfaRequirement(identity.userId, identity.email, identity.sessionId);
  if (!required) redirect(callbackUrl);
  return <main className="flex min-h-screen items-center justify-center px-4">
    <div className="w-full max-w-sm space-y-6">
      <h1 className="text-xl font-semibold text-white">Two-factor authentication</h1>
      {!identity.fresh ? <p>Your sign-in challenge expired. Sign out and sign in again to continue.</p>
        : required === "setup" ? <><p>Protect your owner account with an authenticator app. Save the recovery codes before continuing.</p>
          <MfaEnrollment callbackUrl={callbackUrl} /></>
        : <><p>Enter your authenticator code or one of your recovery codes.</p><MfaChallengeForm callbackUrl={callbackUrl} /></>}
      <Link href="/logout" className="text-sm underline">Sign out</Link>
    </div>
  </main>;
}
