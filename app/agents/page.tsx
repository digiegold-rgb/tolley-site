import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AgentSetupDashboard } from "@/components/agents/agent-setup-dashboard";
import { getUserBillingState, isSubscribed } from "@/lib/billing-state";

export default async function AgentsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/agents");
  }

  const billingState = await getUserBillingState(session.user.id);
  if (!isSubscribed(billingState)) {
    redirect("/pricing");
  }

  return (
    <AgentSetupDashboard
      initialPlan={billingState.subscriptionTier}
      initialStatus={billingState.subscriptionStatus}
    />
  );
}
