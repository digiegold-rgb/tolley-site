import { redirect } from "next/navigation";
import { validateWdAdmin } from "@/lib/wd-auth";
import Growth from "./ui";
export default async function GrowthPage() {
  if (!(await validateWdAdmin()).authed) redirect("/login?callbackUrl=/stream/growth");
  return <Growth/>;
}
