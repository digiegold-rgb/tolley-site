// /sales/admin — Jared's Launchpad approve queue (admin-only).
// Lists operators newest-first with their intake details (joined from the
// originating LeadAction). Approve unlocks Buy; Pause is the kill-switch.

import type { Metadata } from "next";

import { requireAdminPageSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { themeForKey } from "@/lib/demo-site";
import {
  AdminOperatorRow,
  type AdminOperator,
} from "@/components/launchpad/admin-operator-row";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Launchpad Admin | Tolley.io",
  robots: { index: false, follow: false },
};

type IntakeShape = AdminOperator["intake"];

function readIntake(structured: unknown): IntakeShape {
  if (!structured || typeof structured !== "object") return null;
  const s = structured as Record<string, unknown>;
  const pick = (k: string) => (typeof s[k] === "string" ? (s[k] as string) : undefined);
  return {
    idea: pick("idea"),
    stopping: pick("stopping"),
    need_first: pick("need_first"),
    heard_about: pick("heard_about"),
  };
}

export default async function LaunchpadAdminPage() {
  await requireAdminPageSession("/sales/admin");

  const operators = await prisma.operator.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      slug: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      notes: true,
      userId: true,
      leadActionId: true,
      createdAt: true,
      storefront: {
        select: {
          businessName: true,
          category: true,
          city: true,
          sales: { select: { amountCents: true } },
        },
      },
    },
  });

  // Batch-load the originating intakes.
  const leadIds = operators.map((o) => o.leadActionId).filter((x): x is string => Boolean(x));
  const leads = leadIds.length
    ? await prisma.leadAction.findMany({
        where: { id: { in: leadIds } },
        select: { id: true, structured: true },
      })
    : [];
  const intakeById = new Map(leads.map((l) => [l.id, readIntake(l.structured)]));

  const rows: AdminOperator[] = operators
    .filter((o) => o.storefront)
    .map((o) => {
      const sf = o.storefront!;
      const sales = sf.sales;
      return {
        slug: o.slug,
        name: o.name,
        email: o.email,
        phone: o.phone,
        status: o.status,
        businessName: sf.businessName,
        categoryLabel: themeForKey(sf.category).label,
        city: sf.city,
        createdAt: o.createdAt.toISOString(),
        notes: o.notes ?? "",
        salesCount: sales.length,
        salesTotalCents: sales.reduce((sum, s) => sum + s.amountCents, 0),
        claimed: o.userId !== null,
        intake: o.leadActionId ? intakeById.get(o.leadActionId) ?? null : null,
      };
    });

  const pending = rows.filter((r) => r.status === "pending").length;

  return (
    <main className="min-h-screen px-5 py-12 sm:px-8" style={{ backgroundColor: "#141518", color: "#f4f2ee" }}>
      <div className="mx-auto w-full max-w-4xl">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em]" style={{ color: "#ff8842" }}>
          The Launchpad · Admin
        </p>
        <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Operator approve queue</h1>
        <p className="mt-2 text-sm" style={{ color: "#a7a49d" }}>
          {rows.length} operator{rows.length === 1 ? "" : "s"} · {pending} awaiting the handshake
        </p>

        {rows.length === 0 ? (
          <p className="mt-10 text-sm" style={{ color: "#a7a49d" }}>
            No operators yet. Work Orders show up here the moment they&apos;re submitted.
          </p>
        ) : (
          <div className="mt-8 space-y-4">
            {rows.map((r) => (
              <AdminOperatorRow key={r.slug} operator={r} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
