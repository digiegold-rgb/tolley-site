import { redirect } from "next/navigation";
import { validateWdAdmin } from "@/lib/wd-auth";
import { ContentIncome } from "@/components/hq/content-income";
import "./income.css";
export const dynamic = "force-dynamic";
export default async function ContentIncomePage() {
  if (!(await validateWdAdmin()).authed) redirect("/login?callbackUrl=%2Fhq%2Fcontent-income");
  return <ContentIncome />;
}
