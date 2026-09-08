import { auth } from "@/auth";
import { redirect } from "next/navigation";
import EmailSequences from "@/components/leads/EmailSequences";

export const revalidate = 0;

export default async function EmailPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/leads/email");
  return (
    <>
      <h1 className="text-2xl font-bold text-white mb-6">Email Sequences</h1>
      <EmailSequences />
    </>
  );
}
