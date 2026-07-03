import { redirect } from "next/navigation";

/**
 * /leads/crm is consolidated into /leads/pipeline (Phase 4). The old kanban
 * board is now the full 8-stage pipeline under the new IA.
 */
export default function CrmRedirect() {
  redirect("/leads/pipeline");
}
