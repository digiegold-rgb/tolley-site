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

  return (
    <AuthShell
      title="Sign In"
      subtitle="Use your account credentials to continue in T-Agent."
      alternatePrompt="Need access?"
      alternateLabel="Create account"
      alternateHref={`/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`}
    >
      <LoginForm />
    </AuthShell>
  );
}
