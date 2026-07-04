import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

type SignupPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string;
    plan?: string;
    claim?: string;
  }>;
};

function resolveCallbackUrl(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/leads/dashboard";
  }
  return value;
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

  const session = await auth();
  if (session?.user?.id) {
    // Already signed in — send a claimer straight to the portal to link up.
    redirect(claimSlug ? `/sales/portal?claim=${encodeURIComponent(claimSlug)}` : callbackUrl);
  }

  const title = claimSlug
    ? "Claim your storefront"
    : isFoodPlan
      ? "Create your Ruthann's Kitchen account"
      : "Create Account";
  const subtitle = claimSlug
    ? "Set up your login to take ownership of your Launchpad site and track your sales."
    : isFoodPlan
      ? "30-day free trial, then $39/year. Cancel anytime."
      : "Set up your credentials to unlock paid T-Agent search.";

  const loginHref = claimSlug
    ? `/login?callbackUrl=${encodeURIComponent(`/sales/portal?claim=${claimSlug}`)}`
    : `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return (
    <AuthShell
      title={title}
      subtitle={subtitle}
      alternatePrompt="Already have access?"
      alternateLabel="Sign in"
      alternateHref={loginHref}
    >
      <SignupForm claimSlug={claimSlug} />
    </AuthShell>
  );
}
