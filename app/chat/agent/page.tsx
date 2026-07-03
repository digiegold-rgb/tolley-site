import { requireAdminPageSession } from "@/lib/admin-auth";

import AgentChat from "./agent-client";

export const dynamic = "force-dynamic";

export default async function AgentChatPage() {
  // Redirects to /login then home if not an allowlisted admin.
  await requireAdminPageSession("/chat/agent");
  return <AgentChat />;
}
