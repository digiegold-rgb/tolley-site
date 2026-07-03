import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ScriptsLibrary from "@/components/leads/ScriptsLibrary";

export default async function ScriptsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/leads/scripts");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Scripts Library</h1>
      <ScriptsLibrary />
    </div>
  );
}
