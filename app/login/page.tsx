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
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) {
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

  if (session?.mfaRequired) {
    redirect(`/login/mfa-challenge?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  if (session?.user?.id) {
    redirect(callbackUrl);
  }

  // Brand the auth screen off the destination: /animate signups are Jelly
  // Studio customers, not T-Agent search users (audit AN-03, 2026-08-15).
  const product = productForPath(callbackUrl);
  const isGen2 = callbackUrl === "/gen2" || callbackUrl.startsWith("/gen2?");
  const isGenerate = callbackUrl === "/generate" || callbackUrl.startsWith("/generate?");
  const isStudio = product !== null || isGenerate || isGen2;
  const isListing = product === "realestate";

  return (
    <AuthShell
      brand={isListing ? "listing studio" : isStudio ? "jelly studio" : "t-agent"}
      title={isGen2 ? "Sign in to Gen2" : isGenerate ? "Sign in to Generate" : isListing ? "Sign in to Listing Studio" : isStudio ? "Sign in to Jelly Studio" : "Sign In"}
      subtitle={
        (isGenerate || isGen2) ? "Use your owner account and complete two-factor authentication to return to your generation workspace." : isListing
          ? "Pick up where you left off — your listings, videos and billing are waiting."
          : isStudio
            ? "Pick up where you left off — your projects, library and billing are waiting."
            : "Use your account credentials to continue in T-Agent."
      }
      alternatePrompt={(isGenerate || isGen2) ? "Owner access is required." : "Need access?"}
      alternateLabel={isGen2 ? "Back to Gen2" : isGenerate ? "Back to Generate" : "Create account"}
      alternateHref={isGen2 ? "/gen2" : isGenerate ? "/generate" : `/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`}
    >
      <LoginForm />
    </AuthShell>
  );
}
