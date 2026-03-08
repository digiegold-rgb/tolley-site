import type { Metadata } from "next";

import { TR_BRAND, TR_COMPANY, TR_CONTACT_EMAIL, TR_CONTACT_PHONE } from "@/lib/trailer";

export const metadata: Metadata = {
  title: "Rental Terms | Trailer Rental",
  description:
    "Utility Trailer Rental Terms & Conditions for Your KC Homes LLC. Damage policy, liability, insurance, and renter responsibilities.",
};

type Section = {
  heading: string;
  content: React.ReactNode;
};

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="trailer-bullet" />
      <span>{children}</span>
    </li>
  );
}

const sections: Section[] = [
  {
    heading: "1. Rental Agreement",
    content: (
      <p>
        By renting a trailer from {TR_BRAND} (operated by {TR_COMPANY}), you
        agree to the following terms. This agreement is effective upon pickup of
        the trailer and presentation of a valid driver&apos;s license.
      </p>
    ),
  },
  {
    heading: "2. Renter Requirements",
    content: (
      <ul className="space-y-2">
        <Bullet>You must be at least 18 years of age.</Bullet>
        <Bullet>A valid driver&apos;s license must be presented before every rental. No exceptions.</Bullet>
        <Bullet>You must have a vehicle capable of safely towing the trailer.</Bullet>
        <Bullet>You are responsible for verifying your vehicle&apos;s towing capacity before hookup.</Bullet>
      </ul>
    ),
  },
  {
    heading: "3. License Plates & Insurance",
    content: (
      <>
        <p>
          Our trailers do not carry license plates. When hitched to your vehicle,
          insurance coverage falls under your auto insurance policy.
        </p>
        <p className="mt-2">
          You are responsible for confirming with your insurance provider that you
          have adequate liability and property coverage for towing a trailer.
          {TR_COMPANY} is not responsible for any gaps in your insurance coverage.
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
    heading: "4. Payment Terms",
    content: (
      <>
        <p>Rental fees are due at the time of pickup or return. We accept:</p>
        <ul className="mt-2 space-y-2">
          <Bullet>Cash (cash box available at trailer location for after-hours)</Bullet>
          <Bullet>Credit/debit card</Bullet>
          <Bullet>Venmo, Zelle, CashApp</Bullet>
        </ul>
        <p className="mt-2">
          Non-payment or payment disputes may result in collection action and
          prohibition from future rentals.
        </p>
      </>
    ),
  },
  {
    heading: "5. Condition & Return",
    content: (
      <ul className="space-y-2">
        <Bullet>
          Inspect the trailer before pickup. Note any pre-existing damage with the
          owner. Failure to report pre-existing damage may result in you being held
          responsible.
        </Bullet>
        <Bullet>
          Return the trailer in the same condition it was rented. Clean out all
          debris, remove straps and cargo.
        </Bullet>
        <Bullet>
          Late returns may incur additional charges.
        </Bullet>
      </ul>
    ),
  },
  {
    heading: "6. Damage, Neglect & Abuse",
    content: (
      <>
        <p>
          You are fully responsible for any damage to the trailer during the rental
          period, including but not limited to:
        </p>
        <ul className="mt-2 space-y-2">
          <Bullet>Structural damage to the frame, axles, or hitch</Bullet>
          <Bullet>Damage to the deck, ramp gate, or side rails</Bullet>
          <Bullet>Tire blowouts caused by overloading or reckless driving</Bullet>
          <Bullet>Damage from improper loading or unsecured cargo</Bullet>
          <Bullet>Any damage resulting from negligence or misuse</Bullet>
        </ul>
        <p className="mt-3">
          Normal wear and tear (minor scratches, surface dirt) is expected and will
          not be charged. Abuse and neglect are not normal wear.
        </p>
        <p className="mt-2">
          Repair or replacement costs will be assessed at fair market value and
          billed to the renter. Failure to pay may result in legal action.
        </p>
      </>
    ),
  },
  {
    heading: "7. Prohibited Uses",
    content: (
      <ul className="space-y-2">
        <Bullet>Overloading beyond the trailer&apos;s rated capacity</Bullet>
        <Bullet>Transporting hazardous materials</Bullet>
        <Bullet>Subletting or re-renting the trailer to a third party</Bullet>
        <Bullet>Operating the trailer without a valid license or proper hitch equipment</Bullet>
        <Bullet>Any illegal activity</Bullet>
      </ul>
    ),
  },
  {
    heading: "8. Limitation of Liability",
    content: (
      <>
        <p>
          {TR_COMPANY} is not liable for any injuries, property damage, or losses
          incurred during the rental period, including damage to your vehicle,
          cargo, or third-party property.
        </p>
        <p className="mt-2">
          Maximum liability of {TR_COMPANY} shall not exceed the rental fee paid
          for the specific rental period.
        </p>
      </>
    ),
  },
  {
    heading: "9. Indemnification",
    content: (
      <p>
        You agree to indemnify and hold harmless {TR_COMPANY} and its owners,
        employees, and agents from any claims, damages, losses, or expenses
        arising from your use of the trailer, including legal fees.
      </p>
    ),
  },
  {
    heading: "10. Governing Law",
    content: (
      <>
        <p>
          This agreement is governed by the laws of the State of Missouri.
        </p>
        <p className="mt-2">
          Any disputes shall be resolved in Jackson County, Missouri.
        </p>
      </>
    ),
  },
  {
    heading: "11. Acknowledgment",
    content: (
      <p>
        By taking possession of the trailer, you acknowledge that you have read,
        understood, and agreed to these terms. You confirm the trailer was in
        acceptable condition at pickup and that you accept full responsibility
        during the rental period.
      </p>
    ),
  },
];

export default function TrailerTermsPage() {
  return (
    <main className="relative z-10 min-h-screen px-5 py-10 sm:px-8 sm:py-14">
      <section className="mx-auto max-w-4xl rounded-xl border border-neutral-800 bg-neutral-900 p-6 sm:p-10">
        <header className="mb-8 border-b border-neutral-800 pb-6">
          <p className="text-xs font-bold tracking-[0.3em] text-amber-500/70 uppercase">
            {TR_BRAND}
          </p>
          <h1 className="mt-3 text-2xl font-black tracking-wide text-white uppercase sm:text-3xl">
            Rental Terms &amp; Conditions
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-light leading-6 text-neutral-400">
            Utility Trailer Rental Agreement for {TR_BRAND}, operated by {TR_COMPANY}.
          </p>
        </header>

        <div className="mb-8 grid gap-3 rounded-lg border border-amber-500/15 bg-amber-500/[0.04] p-4 text-sm text-neutral-400 sm:grid-cols-2">
          <p>
            <span className="font-bold text-white">Contact: </span>Jared Tolley
          </p>
          <p>
            <span className="font-bold text-white">Email: </span>
            <a className="text-amber-400 underline decoration-amber-500/30 underline-offset-4" href={`mailto:${TR_CONTACT_EMAIL}`}>
              {TR_CONTACT_EMAIL}
            </a>
          </p>
          <p>
            <span className="font-bold text-white">Phone: </span>
            <a className="text-amber-400 underline decoration-amber-500/30 underline-offset-4" href={`tel:${TR_CONTACT_PHONE}`}>
              {TR_CONTACT_PHONE}
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
          <p>{TR_BRAND} &mdash; {TR_COMPANY}</p>
          <p className="mt-1">
            <a href={`mailto:${TR_CONTACT_EMAIL}`} className="text-amber-400 underline decoration-amber-500/30 underline-offset-4">
              {TR_CONTACT_EMAIL}
            </a>
            {" \u00B7 "}
            <a href={`tel:${TR_CONTACT_PHONE}`} className="text-amber-400 underline decoration-amber-500/30 underline-offset-4">
              {TR_CONTACT_PHONE}
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
