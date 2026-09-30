import { redirect } from "next/navigation";
import { validateWdAdmin } from "@/lib/wd-auth";

export default async function ShowAssistant() {
  if (!(await validateWdAdmin()).authed) redirect("/login?callbackUrl=/stream/assistant");
  redirect("/api/stream/whatnot-bot/admin");
}
