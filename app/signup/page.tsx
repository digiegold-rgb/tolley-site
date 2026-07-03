import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

type SignupPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string;
    plan?: string;
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
  const callbackUrl = resolveCallbackUrl(params.callbackUrl);
  const isFoodPlan =
    params.plan === "food" || callbackUrl.startsWith("/food");

  const session = await auth();
  if (session?.user?.id) {
    redirect(callbackUrl);
  }

  const title = isFoodPlan
    ? "Create your Ruthann's Kitchen account"
    : "Create Account";
  const subtitle = isFoodPlan
    ? "30-day free trial, then $39/year. Cancel anytime."
    : "Set up your credentials to unlock paid T-Agent search.";

  return (
    <AuthShell
      title={title}
      subtitle={subtitle}
      alternatePrompt="Already have access?"
      alternateLabel="Sign in"
      alternateHref={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
    >
      <SignupForm />
    </AuthShell>
  );
}
