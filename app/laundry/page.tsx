import Link from "next/link";
import { PublicOfferDetails } from "@/components/shared/public-offer-details";
import { publicOperators } from "@/lib/laundry/store";
import { OperatorCard } from "@/components/laundry/operator-card";
import { CITIES } from "@/lib/laundry/config";
export const dynamic = "force-dynamic";
export const metadata = {
  alternates: {
    canonical:
      (process.env.LAUNDRY_PUBLIC_ORIGIN || "https://www.tolley.io") +
      "/laundry",
  },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = (await searchParams).q?.trim().slice(0, 100) || "";
  const ops = await publicOperators(q);
  return (
    <>
      <div className="wrap hero">
        <div>
          <p className="eyebrow">Local people. Laundry at home.</p>
          <h1>
            Your laundry.
            <br />
            Your place.
            <br />
            <span style={{ color: "#628444" }}>Your local rental.</span>
          </h1>
          <p>
            Find a washer and dryer without buying a set. Connect with a local
            operator who delivers, installs and keeps you running.
          </p>
          <form className="search" action="/laundry#find">
            <label className="sr-only" htmlFor="place">
              City and state or ZIP code
            </label>
            <input
              id="place"
              name="q"
              placeholder="Enter ZIP or city, state"
              defaultValue={q}
              required
              maxLength={100}
            />
            <button>Find my rental ↗</button>
          </form>
          <span className="tiny">
            Free to request · No payment to the directory · Starting in KC
          </span>
        </div>
        <div
          className="art"
          role="img"
          aria-label="Illustration of a washer and dryer at home"
        >
          <span className="art-label">A little more room to live.</span>
          <div className="machine">
            <div className="drum" />
          </div>
          <div className="machine">
            <div className="drum" />
          </div>
          <div className="art-note">
            <span>LESS HAULING. MORE HOME.</span>
            <span>WASH · DRY · REPEAT</span>
          </div>
        </div>
      </div>
      <div className="wrap strip">
        <span>↳ Independent local businesses</span>
        <span>↳ Prices before you sign</span>
        <span>↳ One operator for your request</span>
      </div>
      <section className="wrap section" id="find">
        <div className="section-head">
          <div>
            <p className="eyebrow">Find your local operator</p>
            <h2>
              {q ? `Rentals near ${q}` : "Kansas City, meet your anchor."}
            </h2>
          </div>
          <span className="muted">
            {ops.length} {ops.length === 1 ? "operator" : "operators"}
            {q ? " matching your search" : " accepting requests"}
          </span>
        </div>
        {ops.length ? (
          <div className="grid two">
            {ops.map((op) => (
              <OperatorCard
                key={op.id}
                op={op}
                zip={/^\d{5}$/.test(q) ? q : undefined}
              />
            ))}
          </div>
        ) : (
          <div className="card">
            <h3>We’re growing into your neighborhood.</h3>
            <p>
              No approved operator currently matches this search. Try a
              five-digit ZIP, or leave your details so we know where service is
              needed.
            </p>
            <Link
              className="button"
              href={`/laundry/request${/^\d{5}$/.test(q) ? `?zip=${q}` : ""}`}
            >
              Join the local interest list
            </Link>
          </div>
        )}
      </section>
      <section className="wrap section">
        <p className="eyebrow">From search to spin cycle</p>
        <h2>Laundry, with fewer moving parts.</h2>
        <div className="grid" style={{ marginTop: 35 }}>
          {[
            [
              "01",
              "Find your fit",
              "Search your ZIP. Compare real operators, rental prices and the machines they offer.",
            ],
            [
              "02",
              "Make it yours",
              "Choose your equipment and preferred day. Read and sign your operator’s rental agreement online.",
            ],
            [
              "03",
              "Let them handle the heavy lifting",
              "Your operator confirms delivery and handles installation and service under their rental terms.",
            ],
          ].map(([n, t, d]) => (
            <div key={n}>
              <span className="number">{n}</span>
              <h3>{t}</h3>
              <p className="muted">{d}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="wrap section">
        <div className="cta">
          <div>
            <p className="eyebrow">For the people who keep laundry moving</p>
            <h2>
              Your next customer
              <br />
              could be right around the corner.
            </h2>
            <p>
              List your rental business for free. Accept the requests that fit.
              Pay $45 when you confirm a delivery—keep every dollar of monthly
              rent.
            </p>
          </div>
          <Link className="button light" href="/laundry/join">
            Join the network ↗
          </Link>
        </div>
      </section>
      <section className="wrap section">
        <h2>Growing from Kansas City.</h2>
        <p className="muted">
          Check your exact ZIP for coverage and ask your operator to confirm
          availability.
        </p>
        <div className="actions">
          {CITIES.map((c) => (
            <Link
              className="button ghost"
              key={c.slug}
              href={`/laundry/cities/${c.slug}`}
            >
              {c.name}, {c.state}
            </Link>
          ))}
        </div>
      </section>
      <PublicOfferDetails name="laundry" />
    </>
  );
}
