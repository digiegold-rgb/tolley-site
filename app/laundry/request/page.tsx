import { publicOperators } from "@/lib/laundry/store";
import { RequestForm } from "@/components/laundry/request-form";
export const metadata = {
  title: "Request a rental",
  robots: { index: false, follow: true },
};
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ operator?: string; zip?: string }>;
}) {
  const q = await searchParams;
  const ops = await publicOperators(q.zip || "");
  return (
    <div className="wrap page">
      <p className="eyebrow">One request. One local operator.</p>
      <h1>Let’s get laundry home.</h1>
      <p>
        Choose your equipment, tell us where it’s going, and request a day that
        works for you.
      </p>
      <RequestForm
        operators={ops}
        initialOperator={ops.some((o) => o.id === q.operator) ? q.operator : ""}
        initialZip={q.zip}
      />
    </div>
  );
}
