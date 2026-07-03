import { validateShopAdmin } from "@/lib/shop-auth";
import { TvPinGate } from "./tv-pin-gate";
import { TvClient } from "./tv-client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Tolley TV — Request Movies & Shows",
  description:
    "Search any movie or TV show and request it. Auto-downloads behind VPN and lands in Plex, ready to watch.",
};

export default async function TvPage() {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) return <TvPinGate />;
  return <TvClient />;
}
