import { redirect } from "next/navigation";

/**
 * /leads/clients → People workspace (Phase 5). The client DB is now a smart
 * list inside /leads/people.
 */
export default function ClientsRedirect() {
  redirect("/leads/people?list=clients");
}
