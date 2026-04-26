import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FoodHero } from "@/components/food/food-hero";
import { FoodRecipeCard } from "@/components/food/food-recipe-card";

export default async function FoodDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/food");

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
    include: { members: true },
  });

  if (!household) redirect("/food/settings");

  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const now2 = new Date();
  const dayOfWeek = now2.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now2);
  weekStart.setDate(now2.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const [mealPlan, expiringItems, groceryItems, recentRecipes] = await Promise.all([
    prisma.foodMealPlan.findFirst({
      where: { householdId: household.id, weekStart: { gte: weekStart, lt: weekEnd } },
      include: { slots: { include: { recipe: true } } },
    }),
    prisma.foodPantryItem.findMany({
      where: {
        householdId: household.id,
        expiresAt: { lte: threeDaysFromNow, gte: now },
        status: "in_stock",
      },
      orderBy: { expiresAt: "asc" },
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
      take: 4,
    }),
  ]);

  const expiringCount = expiringItems.length;
  const userName = session.user.name?.split(" ")[0] || "Chef";

  const quickActions = [
    { title: "Plan This Week's Meals", description: "Build your weekly menu and stay organized", href: "/food/plan", emoji: "📅", color: "var(--food-pink)" },
    { title: "Browse Recipes", description: "Find or generate your next family favorite", href: "/food/recipes", emoji: "📖", color: "var(--food-lavender)" },
    { title: "Scan Groceries", description: "Snap a photo to auto-track your haul", href: "/food/scan", emoji: "📷", color: "var(--food-mint)" },
    { title: "Check Pantry", description: "See what you have and what's running low", href: "/food/pantry", emoji: "🗄️", color: "var(--food-peach)" },
    { title: "View Spending", description: "Track your grocery budget and find deals", href: "/food/analytics", emoji: "📊", color: "var(--food-rose-gold)" },
  ];

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem 1.5rem" }}>
      <FoodHero
        userName={userName}
        weekSummary={{ planned: mealPlan?.slots.length ?? 0, cooked: mealPlan?.slots.filter((s) => s.recipe && s.recipe.timesCooked > 0).length ?? 0 }}
        expiringCount={expiringCount}
        groceryCount={groceryItems}
      />

      {expiringCount > 0 && (
        <section
          className="food-enter"
          style={{
            marginTop: "1.5rem",
            "--enter-delay": "0.08s",
          } as React.CSSProperties}
        >
          <div
            className="food-card"
            style={{
              padding: "1.25rem 1.5rem",
              background: "linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(253, 186, 116, 0.1))",
              border: "1.5px solid rgba(239, 68, 68, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1 }}>
              <span style={{ fontSize: "1.75rem" }}>⚠️</span>
              <div>
                <p className="food-expiry-urgent" style={{ margin: 0, fontSize: "1.0625rem", fontWeight: 600 }}>
                  {expiringCount} item{expiringCount !== 1 ? "s" : ""} expiring soon!
                </p>
                <p style={{ margin: "0.125rem 0 0", fontSize: "0.8125rem", color: "var(--food-text-secondary)" }}>
                  {expiringItems.slice(0, 3).map((item) => item.name).join(", ")}
                  {expiringCount > 3 ? ` and ${expiringCount - 3} more` : ""}
                </p>
              </div>
            </div>
            <Link
              href="/food/tonight"
              className="food-btn food-btn-primary"
              style={{ flexShrink: 0 }}
            >
              🍽️ Get recipe ideas →
            </Link>
          </div>
        </section>
      )}

      <section style={{ marginTop: "2rem" }}>
        <h2
          className="food-enter"
          style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem", "--enter-delay": "0.1s" } as React.CSSProperties}
        >
          Quick Actions
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
          {quickActions.map((action, i) => (
            <Link key={action.href} href={action.href} style={{ textDecoration: "none" }}>
              <div
                className="food-card food-enter"
                style={{
                  padding: "1.25rem",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "1rem",
                  cursor: "pointer",
                  "--enter-delay": `${0.15 + i * 0.08}s`,
                } as React.CSSProperties}
              >
                <div
                  style={{
                    fontSize: "2rem",
                    width: "3rem",
                    height: "3rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "0.75rem",
                    background: `${action.color}15`,
                    flexShrink: 0,
                  }}
                >
                  {action.emoji}
                </div>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "0.25rem" }}>
                    {action.title}
                  </h3>
                  <p style={{ fontSize: "0.8125rem", color: "var(--food-text-secondary)", margin: 0 }}>
                    {action.description}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {expiringCount > 0 && (
        <section
          className="food-enter"
          style={{ marginTop: "2rem", "--enter-delay": "0.5s" } as React.CSSProperties}
        >
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>
            Expiring Soon
          </h2>
          <div className="food-card" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {expiringItems.map((item) => {
                const daysLeft = item.expiresAt
                  ? Math.ceil((item.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                  : null;
                return (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.75rem",
                      borderRadius: "0.75rem",
                      background: "rgba(239, 68, 68, 0.05)",
                      border: "1px solid rgba(239, 68, 68, 0.15)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span style={{ fontSize: "1.25rem" }}>
                        {item.location === "fridge" ? "🧊" : item.location === "freezer" ? "❄️" : "🥫"}
                      </span>
                      <div>
                        <span style={{ fontWeight: 500, color: "var(--food-text)" }}>{item.name}</span>
                        <span style={{ fontSize: "0.8125rem", color: "var(--food-text-secondary)", marginLeft: "0.5rem" }}>
                          {item.quantity} {item.unit || ""}
                        </span>
                      </div>
                    </div>
                    <span className="food-expiry-urgent" style={{ fontSize: "0.8125rem" }}>
                      {daysLeft === 0 ? "Expires today!" : daysLeft === 1 ? "Expires tomorrow" : `${daysLeft} days left`}
                    </span>
                  </div>
                );
              })}
            </div>
            <Link
              href="/food/pantry"
              className="food-btn food-btn-secondary"
              style={{ marginTop: "1rem", display: "inline-flex" }}
            >
              View All Pantry Items
            </Link>
          </div>
        </section>
      )}

      {recentRecipes.length > 0 && (
        <section
          className="food-enter"
          style={{ marginTop: "2rem", "--enter-delay": "0.6s" } as React.CSSProperties}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)" }}>
              Recent Recipes
            </h2>
            <Link href="/food/recipes" className="food-btn food-btn-secondary" style={{ fontSize: "0.8125rem" }}>
              View All
            </Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "1rem" }}>
            {recentRecipes.map((recipe) => (
              <FoodRecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        </section>
      )}

      {recentRecipes.length === 0 && expiringCount === 0 && groceryItems === 0 && (
        <section
          className="food-card food-enter"
          style={{
            marginTop: "2rem",
            padding: "3rem 2rem",
            textAlign: "center",
            "--enter-delay": "0.5s",
          } as React.CSSProperties}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🍳</div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "0.5rem" }}>
            Your kitchen is all set up!
          </h3>
          <p style={{ color: "var(--food-text-secondary)", marginBottom: "1.5rem", maxWidth: "400px", margin: "0 auto 1.5rem" }}>
            Start by adding some recipes or planning your first week of meals.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/food/recipes/new" className="food-btn food-btn-primary food-glow">
              Add Your First Recipe
            </Link>
            <Link href="/food/plan" className="food-btn food-btn-secondary">
              Start Meal Planning
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
