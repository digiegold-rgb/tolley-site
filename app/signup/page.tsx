import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { productForPath } from "@/lib/vater/product";

import { auth } from "@/auth";
import { authPageMetadata } from "@/lib/auth-page-metadata";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

type SignupPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string;
    plan?: string;
    claim?: string;
    /** Optional leftover / team invite code — read client-side by SignupForm.
     *  Jelly public beta does not require it. */
    invite?: string;
  }>;
};

function resolveCallbackUrl(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/leads/dashboard";
  }
  return value;
}

export async function generateMetadata({ searchParams }: SignupPageProps): Promise<Metadata> {
  const params = (await searchParams) || {};
  return authPageMetadata(resolveCallbackUrl(params.callbackUrl), "signup");
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = (await searchParams) || {};
  const claimSlug =
    typeof params.claim === "string" && /^[a-z0-9-]{1,80}$/.test(params.claim)
      ? params.claim
      : undefined;
  const callbackUrl = resolveCallbackUrl(params.callbackUrl);
  const isFoodPlan =
    params.plan === "food" || callbackUrl.startsWith("/food");
  // /animate signups are Jelly Studio customers (audit AN-03, 2026-08-15);
  // /realestateanimated signups are Listing Studio agents (2026-08-26).
  const product = productForPath(callbackUrl);
  const isStudio = product !== null;
  const isListing = product === "realestate";

  const session = await auth();
  if (session?.user?.id) {
    // Already signed in — send a claimer straight to the portal to link up.
    redirect(claimSlug ? `/sales/portal?claim=${encodeURIComponent(claimSlug)}` : callbackUrl);
  }

  const title = claimSlug
    ? "Claim your storefront"
    : isFoodPlan
      ? "Create your Ruthann's Kitchen account"
      : isListing
        ? "Create your Listing Studio account"
        : isStudio
          ? "Create your Jelly Studio account"
          : "Create Account";
  const subtitle = claimSlug
    ? "Set up your login to take ownership of your Launchpad site and track your sales."
    : isFoodPlan
      ? "30-day free trial, then $39/year. Cancel anytime."
      : isListing
        ? "Invite-only beta for licensed agents. No subscription — your first staging is covered by a starter credit. You pay per listing."
        : isStudio
          ? "Public beta. No subscription — a $10 starter credit lands when you put a card on file. Nothing is charged until you spend it. You pay per video."
          : "Set up your credentials to unlock paid T-Agent search.";

  const loginHref = claimSlug
    ? `/login?callbackUrl=${encodeURIComponent(`/sales/portal?claim=${claimSlug}`)}`
    : `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return (
    <AuthShell
      brand={isListing ? "listing studio" : isStudio ? "jelly studio" : "t-agent"}
      title={title}
      subtitle={subtitle}
      alternatePrompt="Already have an account?"
      alternateLabel="Sign in"
      alternateHref={loginHref}
    >
      <SignupForm claimSlug={claimSlug} />
    </AuthShell>
  );
}
