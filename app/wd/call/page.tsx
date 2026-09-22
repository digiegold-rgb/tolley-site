import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { cleanDialName, parseDialTarget } from "@/lib/wd/call-numbers";
import { mergeDialContacts } from "@/lib/wd/click-to-call";

import { WdDialer } from "./dialer";
import { WdCallShell } from "./shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wash & Dry Call",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "WD Call" },
};

export default async function WdCallPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string; name?: string }>;
}) {
  const sp = await searchParams;
  const phoneQuery = typeof sp.phone === "string" ? sp.phone : "";
  const nameQuery = typeof sp.name === "string" ? sp.name : "";
  const { authed } = await validateWdAdmin();
  if (!authed) {
    const back = new URLSearchParams();
    if (phoneQuery) back.set("phone", phoneQuery);
    if (nameQuery) back.set("name", nameQuery);
    const qs = back.toString();
    const dest = qs ? `/wd/call?${qs}` : "/wd/call";
    redirect(`/login?callbackUrl=${encodeURIComponent(dest)}`);
  }

  let rows: { id: string; name: string; phone: string | null; address: string | null; active: boolean }[] = [];
  try {
    rows = await prisma.wdClient.findMany({
      where: { phone: { not: null } },
      orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
      take: 40,
      select: { id: true, name: true, phone: true, address: true, active: true },
    });
  } catch (err) {
    console.error("[wd/call] tenant list failed", err);
  }

  const contacts = mergeDialContacts(rows);
  const focused = parseDialTarget(phoneQuery);
  const focus = focused.ok ? { phone: focused.phone, name: cleanDialName(nameQuery) } : null;

  return (
    <WdCallShell>
      <WdDialer contacts={contacts} focus={focus} />
    </WdCallShell>
  );
}
