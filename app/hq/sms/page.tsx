import { redirect } from "next/navigation";

/** Memorable URL — the inbox lives as a /hq tab (same PIN, no second login). */
export default function HqSmsRedirectPage() {
  redirect("/hq?tab=sms");
}
