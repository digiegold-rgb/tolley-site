import { redirect } from "next/navigation";

// The results manifest advertises /results but only /results/[id] share pages
// exist — the registered URL 404'd (CTO audit 2026-07-06, Tier 2 #9). Until a
// real case-studies index ships, land visitors on the service directory.
export default function ResultsPage() {
  redirect("/start");
}
