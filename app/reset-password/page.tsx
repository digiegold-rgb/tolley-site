import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Reset password",
  // A reset link in an inbox must never be crawled or indexed.
  robots: { index: false, follow: false },
};

type ResetPasswordPageProps = {
  searchParams?: Promise<{
    /** Present when arriving from the emailed link. */
    token?: string;
    callbackUrl?: string;
  }>;
};

function resolveCallbackUrl(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/animate";
  }
  return value;
}

/**
 * /reset-password — one page, two states.
 *
 *   /reset-password              → "email me a link"
 *   /reset-password?token=…      → "choose a new password"
 *
 * Branded as Jelly Studio: password reset shipped for the invite-only beta,
 * and studio accounts are who will use it. The token is read on the SERVER and
 * handed to the client component as a prop rather than being pulled out of
 * `window.location` — it never becomes part of a client-side router state that
 * could survive in history beyond this render.
 */
export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const params = (await searchParams) || {};
  const token =
    typeof params.token === "string" && params.token.trim()
      ? params.token.trim()
      : undefined;
  const callbackUrl = resolveCallbackUrl(params.callbackUrl);

  return (
    <AuthShell
      brand="jelly studio"
      title={token ? "Choose a new password" : "Reset your password"}
      subtitle={
        token
          ? "Pick something you haven't used elsewhere. This signs you out on every other device."
          : "Enter your email and we'll send you a link. It works once and expires in an hour."
      }
      alternatePrompt="Don't need this?"
      alternateLabel="Back to sign in"
      alternateHref={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
    >
      <ResetPasswordForm token={token} callbackUrl={callbackUrl} />
    </AuthShell>
  );
}
