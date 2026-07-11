import { redirect } from "next/navigation";

// /rentals is the registered subsite name, but the consumer landing lives at
// /rental. Before this redirect existed the registered URL 404'd (CTO audit
// 2026-07-06, Tier 2 #9).
export default function RentalsPage() {
  redirect("/rental");
}
