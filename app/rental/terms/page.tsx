import type { Metadata } from "next";
import { RENTAL_CONTACT_EMAIL, RENTAL_CONTACT_PHONE, RENTAL_COMPANY } from "@/lib/rental";

export const metadata: Metadata = {
  title: "Rental Terms & Conditions | Your KC Homes LLC",
  description:
    "General rental terms and conditions for all equipment rentals from Your KC Homes LLC — tables, chairs, trailers, generators, moving supplies, and more.",
};

const BRAND = "Your KC Homes LLC Rentals";

type Section = {
  heading: string;
  content: React.ReactNode;
};

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500/60" />
      <span>{children}</span>
    </li>
  );
}

const sections: Section[] = [
  {
    heading: "1. Rental Agreement",
    content: (
      <p>
        By renting any equipment from {BRAND} (operated by {RENTAL_COMPANY}), you
        agree to the following terms. This agreement is effective upon pickup or
        delivery of the rented equipment.
      </p>
    ),
  },
  {
    heading: "2. Renter Requirements",
    content: (
      <ul className="space-y-2">
        <Bullet>You must be at least 18 years of age.</Bullet>
        <Bullet>A valid government-issued ID may be required before pickup.</Bullet>
        <Bullet>You must have the means to safely transport or receive the equipment.</Bullet>
        <Bullet>
          For trailer rentals, you must have a vehicle with sufficient towing capacity and verify
          your vehicle&apos;s towing rating before hookup.
        </Bullet>
      </ul>
    ),
  },
  {
    heading: "3. Payment Terms",
    content: (
      <>
        <p>Rental fees and deposits are due at the time of pickup or delivery. We accept:</p>
        <ul className="mt-2 space-y-2">
          <Bullet>Cash</Bullet>
          <Bullet>Credit/debit card (processed via Stripe)</Bullet>
          <Bullet>Venmo, Zelle, CashApp</Bullet>
        </ul>
        <p className="mt-2">
          A refundable deposit is required for most items. Deposits are returned upon
          return of the equipment in the same condition it was rented.
        </p>
        <p className="mt-2">
          Non-payment or payment disputes may result in collection action and
          prohibition from future rentals.
        </p>
      </>
    ),
  },
  {
    heading: "4. Condition & Return",
    content: (
      <ul className="space-y-2">
        <Bullet>
          Inspect all equipment before accepting it. Note any pre-existing damage with the
          owner. Failure to report pre-existing damage may result in you being held
          responsible.
        </Bullet>
        <Bullet>
          Return all equipment in the same condition it was rented — clean and free of damage.
        </Bullet>
        <Bullet>Late returns may incur additional daily charges at the standard rental rate.</Bullet>
        <Bullet>Equipment must be returned to the agreed pickup/drop-off location.</Bullet>
      </ul>
    ),
  },
  {
    heading: "5. Damage, Neglect & Abuse",
    content: (
      <>
        <p>
          You are fully responsible for any damage to the equipment during the rental
          period, including but not limited to:
        </p>
        <ul className="mt-2 space-y-2">
          <Bullet>Physical damage from misuse, overloading, or negligence</Bullet>
          <Bullet>Loss or theft of equipment during your rental period</Bullet>
          <Bullet>Damage caused by improper setup or operation</Bullet>
          <Bullet>Any damage resulting from use outside the intended purpose</Bullet>
        </ul>
        <p className="mt-3">
          Normal wear and tear is expected and will not be charged. Abuse and neglect are not
          normal wear.
        </p>
        <p className="mt-2">
          Repair or replacement costs will be assessed at fair market value and billed to
          the renter. Failure to pay may result in legal action.
        </p>
      </>
    ),
  },
  {
    heading: "6. Prohibited Uses",
    content: (
      <ul className="space-y-2">
        <Bullet>Use beyond the equipment&apos;s rated capacity or intended purpose</Bullet>
        <Bullet>Subletting or re-renting equipment to a third party</Bullet>
        <Bullet>Use in connection with any illegal activity</Bullet>
        <Bullet>Transporting hazardous materials (trailers)</Bullet>
        <Bullet>Operating trailer rentals without a valid license or proper hitch</Bullet>
      </ul>
    ),
  },
  {
    heading: "7. Delivery",
    content: (
      <p>
        Delivery is available for most items at a rate of $3 per mile (one-way).
        Delivery charges are confirmed at time of booking. You are responsible for
        ensuring a safe and accessible location for delivery and pickup.
      </p>
    ),
  },
  {
    heading: "8. Trailers — License & Insurance",
    content: (
      <>
        <p>
          Our trailers do not carry license plates. When hitched to your vehicle,
          insurance coverage falls under your auto insurance policy.
        </p>
        <p className="mt-2">
          You are responsible for confirming with your insurance provider that you
          have adequate liability and property coverage for towing a trailer.
          {" "}{RENTAL_COMPANY} is not responsible for any gaps in your insurance coverage.
        </p>
        <p className="mt-2">
          If your state requires separate trailer registration or plates, it is
          your responsibility to comply with local regulations before operating the
          trailer on public roads.
        </p>
      </>
    ),
  },
  {
    heading: "9. Limitation of Liability",
    content: (
      <>
        <p>
          {RENTAL_COMPANY} is not liable for any injuries, property damage, or losses
          incurred during the rental period, including damage to your property,
          cargo, or third-party property.
        </p>
        <p className="mt-2">
          Maximum liability of {RENTAL_COMPANY} shall not exceed the rental fee paid
          for the specific rental period.
        </p>
      </>
    ),
  },
  {
    heading: "10. Indemnification",
    content: (
      <p>
        You agree to indemnify and hold harmless {RENTAL_COMPANY} and its owners,
        employees, and agents from any claims, damages, losses, or expenses
        arising from your use of the rented equipment, including legal fees.
      </p>
    ),
  },
  {
    heading: "11. Governing Law",
    content: (
      <>
        <p>This agreement is governed by the laws of the State of Missouri.</p>
        <p className="mt-2">Any disputes shall be resolved in Jackson County, Missouri.</p>
      </>
    ),
  },
  {
    heading: "12. Acknowledgment",
    content: (
      <p>
        By taking possession of or accepting delivery of rented equipment, you acknowledge
        that you have read, understood, and agreed to these terms. You confirm the equipment
        was in acceptable condition at the time of pickup/delivery and that you accept full
        responsibility during the rental period.
      </p>
    ),
  },
];

export default function RentalTermsPage() {
  return (
    <main className="relative z-10 min-h-screen px-5 py-10 sm:px-8 sm:py-14">
      <section className="mx-auto max-w-4xl rounded-xl border border-neutral-800 bg-neutral-900 p-6 sm:p-10">
        <header className="mb-8 border-b border-neutral-800 pb-6">
          <p className="text-xs font-bold tracking-[0.3em] text-amber-500/70 uppercase">
            {RENTAL_COMPANY}
          </p>
          <h1 className="mt-3 text-2xl font-black tracking-wide text-white uppercase sm:text-3xl">
            Rental Terms &amp; Conditions
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-light leading-6 text-neutral-400">
            General equipment rental agreement for all items rented through {BRAND}.
            Covers tables, chairs, trailers, generators, moving supplies, and all other
            rental products.
          </p>
        </header>

        <div className="mb-8 grid gap-3 rounded-lg border border-amber-500/15 bg-amber-500/[0.04] p-4 text-sm text-neutral-400 sm:grid-cols-2">
          <p>
            <span className="font-bold text-white">Contact: </span>Jared Tolley
          </p>
          <p>
            <span className="font-bold text-white">Email: </span>
            <a
              className="text-amber-400 underline decoration-amber-500/30 underline-offset-4"
              href={`mailto:${RENTAL_CONTACT_EMAIL}`}
            >
              {RENTAL_CONTACT_EMAIL}
            </a>
          </p>
          <p>
            <span className="font-bold text-white">Phone: </span>
            <a
              className="text-amber-400 underline decoration-amber-500/30 underline-offset-4"
              href={`tel:${RENTAL_CONTACT_PHONE}`}
            >
              {RENTAL_CONTACT_PHONE}
            </a>
          </p>
          <p>
            <span className="font-bold text-white">Location: </span>Independence, MO
          </p>
        </div>

        <div className="space-y-7">
          {sections.map((section) => (
            <section key={section.heading} className="space-y-3">
              <h2 className="text-lg font-black tracking-wide text-amber-400 uppercase sm:text-xl">
                {section.heading}
              </h2>
              <div className="text-sm font-light leading-6 text-neutral-400 sm:text-[0.95rem]">
                {section.content}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-8 border-t border-neutral-800 pt-5 text-center text-sm text-neutral-500">
          <p>{BRAND} &mdash; {RENTAL_COMPANY}</p>
          <p className="mt-1">
            <a
              href={`mailto:${RENTAL_CONTACT_EMAIL}`}
              className="text-amber-400 underline decoration-amber-500/30 underline-offset-4"
            >
              {RENTAL_CONTACT_EMAIL}
            </a>
            {" \u00B7 "}
            <a
              href={`tel:${RENTAL_CONTACT_PHONE}`}
              className="text-amber-400 underline decoration-amber-500/30 underline-offset-4"
            >
              {RENTAL_CONTACT_PHONE}
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
