import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * /food/admin — Ruthann's Kitchen funnel dashboard.
 *
 * Gated by matching session email against `FOOD_ADMIN_EMAILS` env var
 * (comma-separated list). Returns 404 for everyone else so the URL isn't
 * discoverable. Shows subscription-state counts, estimated annual revenue,
 * recent signups, and import activity.
 */

const ANNUAL_PRICE_USD = 39;

function getAdminEmails(): string[] {
  const raw = process.env.FOOD_ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export default async function FoodAdminPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/food/admin");
  }

  const adminEmails = getAdminEmails();
  const userEmail = session.user.email?.toLowerCase() || "";
  if (adminEmails.length === 0 || !adminEmails.includes(userEmail)) {
    // Pretend the page doesn't exist for non-admins.
    notFound();
  }

  const [
    total,
    none,
    trialing,
    active,
    pastDue,
    canceled,
    recipeTotal,
    recentHouseholds,
    recentCanceled,
    recentEvents,
  ] = await Promise.all([
    prisma.foodHousehold.count(),
    prisma.foodHousehold.count({ where: { subscriptionStatus: "none" } }),
    prisma.foodHousehold.count({ where: { subscriptionStatus: "trialing" } }),
    prisma.foodHousehold.count({ where: { subscriptionStatus: "active" } }),
    prisma.foodHousehold.count({ where: { subscriptionStatus: "past_due" } }),
    prisma.foodHousehold.count({ where: { subscriptionStatus: "canceled" } }),
    prisma.foodRecipe.count(),
    prisma.foodHousehold.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        user: { select: { email: true, name: true, createdAt: true } },
        _count: { select: { members: true, recipes: true } },
      },
    }),
    prisma.foodHousehold.findMany({
      where: { subscriptionStatus: "canceled" },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        updatedAt: true,
        currentPeriodEnd: true,
        user: { select: { email: true } },
      },
    }),
    prisma.foodActivityEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        household: {
          select: { name: true, user: { select: { email: true } } },
        },
      },
    }),
  ]);

  const estimatedArr = active * ANNUAL_PRICE_USD;
  const estimatedArrWithTrials = (active + trialing) * ANNUAL_PRICE_USD;

  // Simple 7-day signup trend
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const signupsLast7 = await prisma.foodHousehold.count({
    where: { createdAt: { gte: sevenDaysAgo } },
  });
  const trialingEndingSoon = await prisma.foodHousehold.count({
    where: {
      subscriptionStatus: "trialing",
      trialEndsAt: {
        gte: now,
        lt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      },
    },
  });

  const conversionRate =
    trialing + active > 0
      ? ((active / (trialing + active)) * 100).toFixed(1)
      : "0.0";

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "2rem",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div>
          <h1
            style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.25rem" }}
          >
            🍳 Kitchen Admin
          </h1>
          <p
            style={{ color: "var(--food-text-secondary)", margin: 0, fontSize: "0.9375rem" }}
          >
            Funnel state for Ruthann&apos;s Kitchen · {userEmail}
          </p>
        </div>
        <Link href="/food" className="food-btn food-btn-secondary">
          ← Back to kitchen
        </Link>
      </div>

      {/* ─── KPI tiles ─────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <KpiTile
          label="Estimated ARR"
          value={`$${estimatedArr.toLocaleString()}`}
          sub={`+$${(estimatedArrWithTrials - estimatedArr).toLocaleString()} if trials convert`}
          gradient
        />
        <KpiTile label="Active paid" value={String(active)} sub="subscriptionStatus = active" />
        <KpiTile
          label="In trial"
          value={String(trialing)}
          sub={
            trialingEndingSoon > 0
              ? `${trialingEndingSoon} ending in 72h ⏰`
              : "—"
          }
        />
        <KpiTile
          label="Trial → paid conversion"
          value={`${conversionRate}%`}
          sub={`${active}/${active + trialing} closed`}
        />
        <KpiTile label="Past due" value={String(pastDue)} sub={pastDue > 0 ? "dunning" : "—"} warn={pastDue > 0} />
        <KpiTile label="Canceled" value={String(canceled)} sub="lifetime" />
        <KpiTile
          label="Signups last 7 days"
          value={String(signupsLast7)}
          sub={`${total} households total`}
        />
        <KpiTile label="Recipes in library" value={recipeTotal.toLocaleString()} sub="across all households" />
        <KpiTile label="Unpaid shells" value={String(none)} sub="started signup, no card" />
      </div>

      {/* ─── Recent signups ─────────────────────── */}
      <section className="food-card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
        <h2
          style={{
            fontSize: "1.125rem",
            fontWeight: 600,
            marginBottom: "1rem",
          }}
        >
          Recent households
        </h2>
        {recentHouseholds.length === 0 ? (
          <p style={{ color: "var(--food-text-secondary)" }}>No households yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--food-text-secondary)" }}>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Kitchen</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Members</th>
                  <th style={thStyle}>Recipes</th>
                  <th style={thStyle}>Created</th>
                  <th style={thStyle}>Trial ends</th>
                </tr>
              </thead>
              <tbody>
                {recentHouseholds.map((h) => (
                  <tr
                    key={h.id}
                    style={{ borderTop: "1px solid rgba(244, 114, 182, 0.12)" }}
                  >
                    <td style={tdStyle}>{h.user.email || "—"}</td>
                    <td style={tdStyle}>{h.name}</td>
                    <td style={tdStyle}>
                      <StatusBadge status={h.subscriptionStatus} />
                    </td>
                    <td style={tdStyle}>{h._count.members}</td>
                    <td style={tdStyle}>{h._count.recipes}</td>
                    <td style={tdStyle}>
                      {h.createdAt.toLocaleDateString()}
                    </td>
                    <td style={tdStyle}>
                      {h.trialEndsAt ? h.trialEndsAt.toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ─── Activity feed ─────────────────────── */}
      {recentEvents.length > 0 && (
        <section className="food-card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1rem" }}>
            Recent activity ({recentEvents.length})
          </h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--food-text-secondary)" }}>
                  <th style={thStyle}>When</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Event</th>
                  <th style={thStyle}>Meta</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((e) => (
                  <tr key={e.id} style={{ borderTop: "1px solid rgba(244, 114, 182, 0.12)" }}>
                    <td style={tdStyle}>{e.createdAt.toLocaleString()}</td>
                    <td style={tdStyle}>{e.household.user.email || "—"}</td>
                    <td style={tdStyle}>
                      <code style={{ fontSize: "0.75rem" }}>{e.kind}</code>
                    </td>
                    <td style={{ ...tdStyle, color: "var(--food-text-secondary)", maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {e.meta ? JSON.stringify(e.meta) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ─── Recent cancels ─────────────────────── */}
      {recentCanceled.length > 0 && (
        <section className="food-card" style={{ padding: "1.5rem" }}>
          <h2
            style={{
              fontSize: "1.125rem",
              fontWeight: 600,
              marginBottom: "1rem",
            }}
          >
            Recent cancels (watch these)
          </h2>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {recentCanceled.map((h) => (
              <li
                key={h.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0.5rem 0",
                  fontSize: "0.875rem",
                  borderBottom: "1px solid rgba(244, 114, 182, 0.1)",
                }}
              >
                <span>{h.user.email || h.id}</span>
                <span style={{ color: "var(--food-text-secondary)" }}>
                  canceled {h.updatedAt.toLocaleDateString()}
                  {h.currentPeriodEnd && ` · access until ${h.currentPeriodEnd.toLocaleDateString()}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function KpiTile({
  label,
  value,
  sub,
  gradient,
  warn,
}: {
  label: string;
  value: string;
  sub: string;
  gradient?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className="food-card"
      style={{
        padding: "1.25rem",
        background: gradient
          ? "linear-gradient(135deg, rgba(244, 114, 182, 0.12), rgba(192, 132, 252, 0.12))"
          : warn
            ? "rgba(239, 68, 68, 0.08)"
            : undefined,
        border: warn ? "1px solid rgba(239, 68, 68, 0.25)" : undefined,
      }}
    >
      <div
        style={{
          fontSize: "0.75rem",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--food-text-secondary)",
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "1.75rem",
          fontWeight: 800,
          marginTop: "0.25rem",
          lineHeight: 1.1,
          background: gradient
            ? "linear-gradient(135deg, var(--food-pink), var(--food-lavender))"
            : undefined,
          WebkitBackgroundClip: gradient ? "text" : undefined,
          backgroundClip: gradient ? "text" : undefined,
          color: gradient ? "transparent" : warn ? "#b91c1c" : "var(--food-text)",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: "0.75rem",
          color: "var(--food-text-secondary)",
          marginTop: "0.375rem",
        }}
      >
        {sub}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    active: { bg: "rgba(110, 231, 183, 0.2)", color: "#047857", label: "active" },
    trialing: { bg: "rgba(147, 197, 253, 0.22)", color: "#1d4ed8", label: "trial" },
    past_due: { bg: "rgba(251, 191, 36, 0.22)", color: "#b45309", label: "past due" },
    canceled: { bg: "rgba(156, 163, 175, 0.2)", color: "#4b5563", label: "canceled" },
    none: { bg: "rgba(244, 114, 182, 0.12)", color: "#9d174d", label: "unpaid" },
  };
  const s = styles[status] || styles.none;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.125rem 0.5rem",
        borderRadius: "999px",
        background: s.bg,
        color: s.color,
        fontSize: "0.75rem",
        fontWeight: 600,
      }}
    >
      {s.label}
    </span>
  );
}

const thStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem 0.5rem 0",
  fontWeight: 600,
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const tdStyle: React.CSSProperties = {
  padding: "0.625rem 0.75rem 0.625rem 0",
  color: "var(--food-text)",
};
