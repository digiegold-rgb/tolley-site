import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MfaChallengeForm } from "@/components/auth/mfa-challenge-form";

export const metadata: Metadata = {
  title: "Two-Factor Authentication | T-Agent",
};

export default async function MfaChallengePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <p className="text-[0.7rem] tracking-[0.38em] text-white/50 uppercase">
            t-agent
          </p>
          <h1 className="mt-2 text-xl font-semibold text-white/95">
            Two-Factor Authentication
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Enter the code from your authenticator app
          </p>
        </div>

        <div className="rounded-2xl border border-white/14 bg-white/[0.03] p-6 backdrop-blur-sm">
          <MfaChallengeForm />
        </div>
      </div>
    </main>
  );
}
