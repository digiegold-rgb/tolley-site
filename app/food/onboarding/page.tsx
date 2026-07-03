import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isFoodAccessGranted } from "@/lib/food-subscription";
import { FoodOnboardingWizard } from "@/components/food/food-onboarding-wizard";

export default async function FoodOnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/food/onboarding");
  }

  // Create the household shell if it doesn't exist — the wizard edits it in place.
  const household = await prisma.foodHousehold.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      name: session.user.name ? `${session.user.name}'s Kitchen` : "My Kitchen",
    },
    update: {},
    include: { members: true },
  });

  // If they already have access, bounce back to the main dashboard.
  if (isFoodAccessGranted(household.subscriptionStatus)) {
    redirect("/food");
  }

  const recipeCount = await prisma.foodRecipe.count({
    where: { householdId: household.id },
  });

  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "2.5rem 1.25rem 4rem",
      }}
    >
      <FoodOnboardingWizard
        initialHousehold={{
          id: household.id,
          name: household.name,
          timezone: household.timezone,
          weeklyBudget: household.weeklyBudget,
          defaultServings: household.defaultServings,
          cuisinePreferences: household.cuisinePreferences || [],
        }}
        initialMemberCount={household.members.length}
        initialRecipeCount={recipeCount}
      />
    </div>
  );
}
