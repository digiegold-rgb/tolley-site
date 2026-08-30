import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { productForPath } from "@/lib/vater/product";

import { auth } from "@/auth";
import { authPageMetadata } from "@/lib/auth-page-metadata";
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

export async function generateMetadata({ searchParams }: LoginPageProps): Promise<Metadata> {
  const params = (await searchParams) || {};
  return authPageMetadata(resolveCallbackUrl(params.callbackUrl), "login");
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
  const product = productForPath(callbackUrl);
  const isStudio = product !== null;
  const isListing = product === "realestate";

  return (
    <AuthShell
      brand={isListing ? "listing studio" : isStudio ? "jelly studio" : "t-agent"}
      title={isListing ? "Sign in to Listing Studio" : isStudio ? "Sign in to Jelly Studio" : "Sign In"}
      subtitle={
        isListing
          ? "Pick up where you left off — your listings, videos and billing are waiting."
          : isStudio
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
