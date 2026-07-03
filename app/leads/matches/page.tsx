import { redirect } from "next/navigation";

/**
 * /leads/matches → People workspace (Phase 5). Client matches are now a
 * smart list inside /leads/people.
 */
export default function MatchesRedirect() {
  redirect("/leads/people?list=matches");
}
