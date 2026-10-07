import { redirect } from "next/navigation";
import { validateWdAdmin } from "@/lib/wd-auth";
import { ShopVideoStudio } from "@/components/hq/shop-video-studio";
import "./shop-videos.css";

export const dynamic="force-dynamic";
export default async function ShopVideosPage() {
  if (!(await validateWdAdmin()).authed) redirect("/login?callbackUrl=%2Fhq%2Fshop-videos");
  return <ShopVideoStudio />;
}
