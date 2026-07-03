import { auth } from "@/auth";
import { redirect } from "next/navigation";
import FarmMailCampaigns from "@/components/leads/FarmMailCampaigns";

export default async function FarmMailPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/leads/farm-mail");

  return <FarmMailCampaigns />;
}
