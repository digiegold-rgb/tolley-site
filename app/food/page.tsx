import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FoodHero } from "@/components/food/food-hero";
import { FoodLanding } from "@/components/food/food-landing";
import { isFoodAccessGranted } from "@/lib/food-subscription";

const RECIPE_EMOJIS = ["🍝", "🌮", "🍲", "🥗", "🍕", "🍜", "🥘", "🍗", "🥧", "🍳"];
function recipeEmoji(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return RECIPE_EMOJIS[h % RECIPE_EMOJIS.length];
}

export default async function FoodDashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return <FoodLanding />;
  }

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
    include: { members: true },
  });

  if (!household) redirect("/food/onboarding");

  if (!isFoodAccessGranted(household.subscriptionStatus)) {
    redirect("/food/billing");
  }

  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const [mealPlan, groceryItems, recentRecipes, pantryStats] = await Promise.all([
    prisma.foodMealPlan.findFirst({
      where: { householdId: household.id, weekStart: { gte: weekStart, lt: weekEnd } },
      include: { slots: { include: { recipe: true } } },
    }),
    prisma.foodGroceryItem.count({
      where: {
        list: { householdId: household.id, status: "active" },
        isChecked: false,
      },
    }),
    prisma.foodRecipe.findMany({
      where: { householdId: household.id, timesCooked: { gt: 0 } },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    prisma.foodPantryItem.count({
      where: { householdId: household.id, status: "in_stock" },
    }),
  ]);

  const userName = session.user.name?.split(" ")[0] || "Chef";
  const plannedCount = mealPlan?.slots.length ?? 0;

  // Find tonight's planned dinner. day field: 0=Mon..6=Sun; getDay() returns 0=Sun..6=Sat.
  const todayDay = (now.getDay() + 6) % 7;
  const tonightSlot =
    mealPlan?.slots.find(
      (s) => s.day === todayDay && s.mealType === "dinner" && s.recipe,
    ) || null;

  const quickActions = [
    {
      href: "/food/plan",
      emoji: "📅",
      label: "Meal Plan",
      sub:
        plannedCount > 0 ? `${plannedCount} planned` : "Plan your week",
    },
    {
      href: "/food/groceries",
      emoji: "🛒",
      label: "Groceries",
      sub:
        groceryItems > 0
          ? `${groceryItems} item${groceryItems === 1 ? "" : "s"} left`
          : "All set ✨",
    },
    {
      href: "/food/recipes",
      emoji: "📖",
      label: "Recipes",
      sub: `${recentRecipes.length} saved`,
    },
    {
      href: "/food/pantry",
      emoji: "🥫",
      label: "Pantry",
      sub: `${pantryStats} in stock`,
    },
  ];

  return (
    <div style={{ background: "var(--food-bg-warm)", minHeight: "100vh" }}>
      <FoodHero userName={userName} />

      {tonightSlot && tonightSlot.recipe && (
        <section style={{ margin: "16px 16px 0" }}>
          <Link
            href={`/food/recipes/${tonightSlot.recipe.slug}`}
            className="food-card no-underline flex items-center"
            style={{
              background: "white",
              padding: 14,
              borderRadius: 18,
              border: "1px solid var(--food-border)",
              boxShadow: "0 4px 16px rgba(244,114,182,0.10)",
              gap: 14,
            }}
          >
            <div style={{ fontSize: 36, lineHeight: 1 }} aria-hidden="true">
              {recipeEmoji(tonightSlot.recipe.title)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "var(--font-sora), sans-serif",
                  fontSize: 11,
                  color: "var(--food-text-secondary)",
                  marginBottom: 3,
                }}
              >
                Tonight&rsquo;s plan
              </div>
              <div
                style={{
                  fontFamily: "var(--font-fredoka), system-ui, sans-serif",
                  fontWeight: 700,
                  fontSize: 16,
                  color: "var(--food-text)",
                }}
              >
                {tonightSlot.recipe.title}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-sora), sans-serif",
                  fontSize: 12,
                  color: "var(--food-text-secondary)",
                  marginTop: 2,
                }}
              >
                {(() => {
                  const total =
                    (tonightSlot.recipe.prepTime || 0) +
                    (tonightSlot.recipe.cookTime || 0);
                  return total > 0 ? `${total} min` : "—";
                })()}
                {tonightSlot.recipe.servings
                  ? ` · ${tonightSlot.recipe.servings} servings`
                  : ""}
              </div>
            </div>
            <span
              className="food-btn food-btn-primary"
              style={{ padding: "8px 16px", fontSize: 14, flexShrink: 0 }}
            >
              Cook 🍳
            </span>
          </Link>
        </section>
      )}

      <section
        className="grid grid-cols-2 gap-[10px]"
        style={{ margin: "16px 16px 0" }}
      >
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="food-card no-underline"
            style={{
              background: "white",
              border: "1px solid var(--food-border)",
              borderRadius: 16,
              padding: 14,
              textAlign: "left",
              display: "block",
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 6 }} aria-hidden="true">
              {action.emoji}
            </div>
            <div
              style={{
                fontFamily: "var(--font-fredoka), system-ui, sans-serif",
                fontWeight: 700,
                fontSize: 14,
                color: "var(--food-text)",
              }}
            >
              {action.label}
            </div>
            <div
              style={{
                fontFamily: "var(--font-sora), sans-serif",
                fontSize: 11,
                color: "var(--food-text-secondary)",
                marginTop: 2,
              }}
            >
              {action.sub}
            </div>
          </Link>
        ))}
      </section>

      {recentRecipes.length > 0 && (
        <section style={{ margin: "20px 16px 0" }}>
          <div
            className="flex items-center justify-between"
            style={{ marginBottom: 12 }}
          >
            <h2
              style={{
                fontFamily: "var(--font-fredoka), system-ui, sans-serif",
                fontWeight: 700,
                fontSize: 16,
                color: "var(--food-text)",
                margin: 0,
              }}
            >
              Recent Recipes
            </h2>
            <Link
              href="/food/recipes"
              className="no-underline"
              style={{
                fontSize: 13,
                color: "var(--food-pink)",
                fontFamily: "var(--font-sora), sans-serif",
              }}
            >
              See all →
            </Link>
          </div>
          <div
            className="flex"
            style={{
              gap: 10,
              overflowX: "auto",
              paddingBottom: 4,
              scrollbarWidth: "none",
            }}
          >
            {recentRecipes.map((recipe) => (
              <Link
                key={recipe.id}
                href={`/food/recipes/${recipe.slug}`}
                className="food-card no-underline"
                style={{
                  flexShrink: 0,
                  width: 110,
                  background: "white",
                  border: "1px solid var(--food-border)",
                  borderRadius: 14,
                  padding: "10px 10px 12px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{ fontSize: 28, marginBottom: 6 }}
                  aria-hidden="true"
                >
                  {recipeEmoji(recipe.title)}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-fredoka), system-ui, sans-serif",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--food-text)",
                    lineHeight: 1.2,
                  }}
                >
                  {recipe.title}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-sora), sans-serif",
                    fontSize: 10,
                    color: "var(--food-text-secondary)",
                    marginTop: 4,
                  }}
                >
                  {(() => {
                    const total = (recipe.prepTime || 0) + (recipe.cookTime || 0);
                    return total > 0 ? `${total} min` : "—";
                  })()}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {recentRecipes.length === 0 && plannedCount === 0 && groceryItems === 0 && (
        <section
          className="food-card"
          style={{
            margin: "20px 16px 0",
            padding: "32px 20px",
            textAlign: "center",
            background: "white",
            border: "1px solid var(--food-border)",
            borderRadius: 18,
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 12 }}>🍳</div>
          <h3
            style={{
              fontFamily: "var(--font-fredoka), system-ui, sans-serif",
              fontSize: 18,
              fontWeight: 700,
              color: "var(--food-text)",
              marginBottom: 6,
            }}
          >
            Your kitchen is all set up!
          </h3>
          <p
            style={{
              color: "var(--food-text-secondary)",
              fontSize: 13,
              marginBottom: 16,
              fontFamily: "var(--font-sora), sans-serif",
            }}
          >
            Start by adding recipes or planning your first week of meals.
          </p>
          <div className="flex flex-wrap justify-center" style={{ gap: 8 }}>
            <Link
              href="/food/recipes/new"
              className="food-btn food-btn-primary food-glow"
            >
              Add a Recipe
            </Link>
            <Link href="/food/plan" className="food-btn food-btn-secondary">
              Plan Meals
            </Link>
          </div>
        </section>
      )}

      <div style={{ height: 24 }} />
    </div>
  );
}
