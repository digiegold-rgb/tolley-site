import { auth } from "@/auth";
import { redirect } from "next/navigation";
import OpenHouseManager from "@/components/leads/OpenHouseManager";

export const revalidate = 0;

export default async function OpenHousePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/leads/open-house");
  return (
    <>
      <h1 className="text-2xl font-bold text-white mb-6">Open House Manager</h1>
      <OpenHouseManager />
    </>
  );
}
