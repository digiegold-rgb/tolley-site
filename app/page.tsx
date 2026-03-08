import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export default async function Home() {
  const session = await auth();

  if (session?.user?.id) {
    redirect("/agents");
  }

  return (
    <AuthShell
      title="Sign In"
      subtitle="Login to access Agent Setup."
      alternatePrompt="Need access?"
      alternateLabel="Create account"
      alternateHref="/signup?callbackUrl=%2Fagents"
    >
      <LoginForm />
    </AuthShell>
  );
}
