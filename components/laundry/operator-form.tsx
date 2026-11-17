"use client";
import { useState } from "react";
import type { LaundryOperator } from "@prisma/client";
import { UNIT_NAMES, type Prices } from "@/lib/laundry/config";
export function OperatorForm({ op }: { op?: LaundryOperator }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const prices = (op?.prices || {}) as Prices;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const prices: Prices = {};
    for (const k of Object.keys(UNIT_NAMES) as Array<keyof Prices>) {
      const v = f.get(k);
      if (v) prices[k] = Math.round(Number(v) * 100);
    }
    const data = {
      id: op?.id,
      name: f.get("name"),
      legalName: f.get("legalName"),
      phone: f.get("phone"),
      address: f.get("address"),
      zip: f.get("zip"),
      zips: String(f.get("zips") || "")
        .split(/[\s,]+/)
        .filter(Boolean),
      radiusMiles: Number(f.get("radiusMiles") || 0),
      description: f.get("description"),
      prices,
      deliveryFeeCents: Math.round(Number(f.get("deliveryFee") || 0) * 100),
      rentalTerms: f.get("rentalTerms"),
      termsAccepted: f.get("termsAccepted") === "on",
      websiteRequested: f.get("websiteRequested") === "on",
    };
    try {
      const r = await fetch("/api/laundry/operators", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }),
        b = await r.json();
      if (!r.ok) throw new Error(b.error);
      window.location.assign("/laundry/dashboard");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save your application.",
      );
      setBusy(false);
    }
  }
  return (
    <form className="form card" onSubmit={submit}>
      <div className="fields">
        <label>
          Business name
          <input name="name" required defaultValue={op?.name} maxLength={100} />
        </label>
        <label>
          Legal business name
          <input
            name="legalName"
            required
            defaultValue={op?.legalName}
            maxLength={160}
          />
        </label>
        <label>
          Business phone
          <input name="phone" type="tel" required defaultValue={op?.phone} />
        </label>
        <label>
          Home ZIP
          <input
            name="zip"
            required
            pattern="[0-9]{5}"
            maxLength={5}
            defaultValue={op?.zip}
          />
        </label>
      </div>
      <label>
        Public business / mailing address
        <input
          name="address"
          required
          minLength={5}
          maxLength={300}
          defaultValue={op?.address}
        />
      </label>
      <label>
        Tell renters about your business
        <textarea
          name="description"
          required
          minLength={20}
          maxLength={2000}
          defaultValue={op?.description}
          rows={3}
        />
      </label>
      <h3>Where do you deliver?</h3>
      <div className="fields">
        <label>
          Service ZIPs (comma separated)
          <textarea name="zips" rows={3} defaultValue={op?.zips.join(", ")} />
        </label>
        <label>
          Or radius from your home ZIP (miles)
          <input
            name="radiusMiles"
            type="number"
            min={0}
            max={200}
            defaultValue={op?.radiusMiles || 0}
          />
          <span className="tiny">
            An explicit ZIP list overrides radius coverage.
          </span>
        </label>
      </div>
      <h3>Your monthly prices</h3>
      <p className="tiny">
        Leave machine types you do not supply blank. Prices are in dollars.
      </p>
      <div className="fields">
        {Object.entries(UNIT_NAMES).map(([k, n]) => (
          <label key={k}>
            {n}
            <input
              name={k}
              type="number"
              min={1}
              max={1000}
              step="0.01"
              defaultValue={
                prices[k as keyof Prices]
                  ? prices[k as keyof Prices]! / 100
                  : ""
              }
            />
          </label>
        ))}
      </div>
      <label>
        One-time delivery fee ($)
        <input
          name="deliveryFee"
          type="number"
          min={0}
          max={1000}
          step="0.01"
          defaultValue={(op?.deliveryFeeCents || 0) / 100}
        />
      </label>
      <label>
        Your renter agreement
        <textarea
          name="rentalTerms"
          required
          minLength={40}
          maxLength={15000}
          rows={8}
          defaultValue={op?.rentalTerms}
          placeholder="Include rental duration, deposits or other fees, payment schedule, delivery/installation, repairs, cancellation and pickup terms. These are shown to renters before signing."
        />
      </label>
      <label className="check">
        <input
          name="websiteRequested"
          type="checkbox"
          defaultChecked={op?.websiteRequested}
        />
        I’m interested in an optional operator website. Send me a quote; no
        purchase today.
      </label>
      <label className="check">
        <input name="termsAccepted" type="checkbox" required />
        <span>
          I am authorized to represent this business, confirm these details are
          accurate, and accept the{" "}
          <a
            href="/laundry/operator-agreement"
            target="_blank"
            rel="noreferrer"
          >
            operator agreement
          </a>
          , including the $45 charge when I confirm a marketplace delivery. I
          authorize storing a card with Stripe for those booking fees.
        </span>
      </label>
      {op && (
        <p className="tiny">
          Updates go back to the owner for approval before the listing accepts
          new requests. Existing signed agreements stay unchanged.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button disabled={busy}>
        {busy
          ? "Saving…"
          : op
            ? "Save changes for approval"
            : "Apply for a free listing"}
      </button>
      <p className="tiny">
        Next: save a card securely through Stripe. No charge until you confirm a
        booked delivery.
      </p>
    </form>
  );
}
