import Link from "next/link";
import { money } from "@/lib/laundry/config";
import type { publicOperator } from "@/lib/laundry/store";
export function OperatorCard({
  op,
  zip,
}: {
  op: ReturnType<typeof publicOperator>;
  zip?: string;
}) {
  const price = op.prices.set || Math.min(...Object.values(op.prices));
  return (
    <article className="card">
      <span className="badge">
        {op.anchor ? "KC ANCHOR · AFFILIATED" : "LOCAL RENTAL OPERATOR"}
      </span>
      <p className="muted">
        {op.city}, {op.state}
      </p>
      <h3>
        <Link href={`/laundry/operators/${op.slug}`}>{op.name}</Link>
      </h3>
      <p>{op.description}</p>
      <div className="price">
        {money(price)}
        <small> / month · {op.prices.set ? "washer + dryer" : "from"}</small>
      </div>
      <p className="tiny">
        {op.deliveryFeeCents
          ? `${money(op.deliveryFeeCents)} delivery fee`
          : "Delivery included"}{" "}
        · Scheduling confirmed by operator
      </p>
      <div className="card-foot">
        <Link
          className="button"
          href={`/laundry/request?operator=${op.id}${zip ? `&zip=${encodeURIComponent(zip)}` : ""}`}
        >
          Request a rental ↗
        </Link>
        <Link className="tiny" href={`/laundry/operators/${op.slug}`}>
          View details
        </Link>
      </div>
    </article>
  );
}
