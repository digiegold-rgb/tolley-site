import { redirect } from "next/navigation";

import { validateWdAdmin } from "@/lib/wd-auth";

import StockingClient from "./stocking-client";
import sheetData from "./sheet-data.json";

// Same cookie as /hq — log in there once and this page unlocks.
export default async function StorefrontStockingPage() {
  const { authed } = await validateWdAdmin();
  if (!authed) redirect("/hq");
  return <StockingClient data={sheetData} />;
}
