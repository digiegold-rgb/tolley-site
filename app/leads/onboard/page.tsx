import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import OnboardForm from "@/components/leads/OnboardForm";

export default async function LeadsOnboardPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login?callbackUrl=/leads/onboard");
  }

  const sub = await prisma.leadSubscriber.findUnique({
    where: { userId },
  });

  if (!sub) {
    redirect("/leads/pricing");
  }

  const isEdit = sub.onboarded;

  return (
    <div className="min-h-screen bg-[#06050a]">
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="text-center mb-8">
          <p className="text-xs tracking-[0.2em] text-green-400/80 uppercase mb-3">
            {isEdit ? "T-Agent Leads" : "Welcome to T-Agent Leads"}
          </p>
          <h1 className="text-2xl font-bold text-white mb-2">
            {isEdit ? "Edit Your Farm Area" : "Set Up Your Farm Area"}
          </h1>
          <p className="text-white/50 text-sm">
            Choose where you want to receive leads. You can change this anytime.
          </p>
        </div>

        <OnboardForm
          tier={sub.tier}
          existingZips={sub.farmZips}
          existingSpecialties={sub.specialties}
        />
      </div>
    </div>
  );
}
