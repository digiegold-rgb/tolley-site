import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

type LoginPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string;
  }>;
};

function resolveCallbackUrl(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/leads/dashboard";
  }
  return value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) || {};
  const callbackUrl = resolveCallbackUrl(params.callbackUrl);
  const session = await auth();

  if (session?.user?.id) {
    redirect(callbackUrl);
  }

  // Brand the auth screen off the destination: /animate signups are Jelly
  // Studio customers, not T-Agent search users (audit AN-03, 2026-08-15).
  const isStudio = callbackUrl.startsWith("/animate");

  return (
    <AuthShell
      brand={isStudio ? "jelly studio" : "t-agent"}
      title={isStudio ? "Sign in to Jelly Studio" : "Sign In"}
      subtitle={
        isStudio
          ? "Pick up where you left off — your projects, library and billing are waiting."
          : "Use your account credentials to continue in T-Agent."
      }
      alternatePrompt="Need access?"
      alternateLabel="Create account"
      alternateHref={`/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`}
    >
      <LoginForm />
    </AuthShell>
  );
}
