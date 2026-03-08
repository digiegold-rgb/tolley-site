import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

type SignupPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string;
  }>;
};

function resolveCallbackUrl(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/agents";
  }
  return value;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = (await searchParams) || {};
  const callbackUrl = resolveCallbackUrl(params.callbackUrl);
  const session = await auth();

  if (session?.user?.id) {
    redirect(callbackUrl);
  }

  return (
    <AuthShell
      title="Create Account"
      subtitle="Set up your credentials to unlock paid T-Agent search."
      alternatePrompt="Already have access?"
      alternateLabel="Sign in"
      alternateHref={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
    >
      <SignupForm />
    </AuthShell>
  );
}
