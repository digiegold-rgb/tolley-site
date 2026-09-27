import { redirect } from "next/navigation";
import { validateWdAdmin } from "@/lib/wd-auth";
import Stock from "./ui";
export const metadata = {
  title: "Stock · Tolley",
  robots: { index: false, follow: false },
};
export default async function StockPage() {
  if (!(await validateWdAdmin()).authed)
    redirect("/login?callbackUrl=/stream/stock");
  return <Stock />;
}
