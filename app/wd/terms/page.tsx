import type { Metadata } from "next";

import { WD_BRAND, WD_COMPANY, WD_CONTACT_EMAIL, WD_CONTACT_PHONE } from "@/lib/wd";

export const metadata: Metadata = {
  title: "Rental Agreement | Wash & Dry Rental",
  description:
    "Washer & Dryer Rental Agreement for Wash & Dry Rental (DBA YourKCHomes). Terms of service, coverage, payment, and privacy.",
};

type TermsSection = {
  heading: string;
  content: React.ReactNode;
};

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="wd-bullet" />
      <span>{children}</span>
    </li>
  );
}

const sections: TermsSection[] = [
  {
    heading: "1. Service Overview",
    content: (
      <p>
        Wash &amp; Dry Rental (DBA YourKCHomes) (&ldquo;Company&rdquo;) provides rental
        access to washer and dryer units for residential use. The standard monthly
        subscription amount varies by location and is billed automatically through Stripe.
      </p>
    ),
  },
  {
    heading: "2. Coverage & Included Services",
    content: (
      <>
        <p>Each active subscription includes:</p>
        <ul className="mt-2 space-y-2">
          <Bullet>
            Delivery &amp; Installation of units to the customer&apos;s designated address.
          </Bullet>
          <Bullet>Maintenance for Normal Wear and Tear at no extra charge.</Bullet>
          <Bullet>
            Replacement of Non-Functioning Units when mechanical failure occurs through
            no fault of the customer.
          </Bullet>
        </ul>
        <p className="mt-3">
          Service calls for misuse, flooding, improper hookup, electrical issues, or
          cosmetic complaints may incur a reasonable trip or repair fee.
        </p>
      </>
    ),
  },
  {
    heading: "3. Customer Responsibilities",
    content: (
      <>
        <p>The customer agrees to:</p>
        <ul className="mt-2 space-y-2">
          <Bullet>Keep the appliances in a clean, dry, and smoke-free environment.</Bullet>
          <Bullet>Use the machines only for household laundry purposes.</Bullet>
          <Bullet>Report performance issues, leaks, or damage within 48 hours of discovery.</Bullet>
          <Bullet>Maintain clear access for pickup, maintenance, or replacement.</Bullet>
          <Bullet>
            Remain responsible for damage or loss due to misuse, neglect, or
            unauthorized relocation of the units.
          </Bullet>
        </ul>
      </>
    ),
  },
  {
    heading: "4. Payment & Renewal",
    content: (
      <ul className="space-y-2">
        <Bullet>Payments are processed automatically via Stripe each month.</Bullet>
        <Bullet>
          Subscription renews monthly with no minimum commitment and may be cancelled
          at any time before the next billing date.
        </Bullet>
        <Bullet>
          Non-payment, chargeback, or failed billing will immediately suspend service,
          and Company reserves the right to retrieve equipment.
        </Bullet>
      </ul>
    ),
  },
  {
    heading: "5. Ownership & Access Rights",
    content: (
      <>
        <p>
          All rented appliances remain the sole property of Wash &amp; Dry Rental (DBA
          YourKCHomes).
        </p>
        <p className="mt-2">
          The customer grants Company reasonable access to the property for inspection,
          service, or recovery of equipment upon cancellation or default.
        </p>
      </>
    ),
  },
  {
    heading: "6. Liability & Indemnification",
    content: (
      <>
        <p>
          The customer assumes responsibility for any damages to floors, walls, plumbing,
          or surrounding property resulting from misuse, improper installation, or
          unreported leaks.
        </p>
        <p className="mt-2">
          Company is not liable for indirect or consequential damages (e.g., clothing
          damage, water overflow, loss of use).
        </p>
        <p className="mt-2">
          Maximum liability shall not exceed one month&apos;s rental fee.
        </p>
      </>
    ),
  },
  {
    heading: "7. Termination & Equipment Return",
    content: (
      <>
        <p>
          Either party may terminate this agreement at any time. Upon termination,
          customer must provide access for pickup within five (5) business days.
        </p>
        <p className="mt-2">
          Failure to allow pickup may be treated as equipment loss, and the customer may
          be billed for the current fair-market value of the equipment.
        </p>
      </>
    ),
  },
  {
    heading: "8. Privacy Policy",
    content: (
      <>
        <p>
          Personal and payment information is collected securely via Stripe and used only
          for billing and service purposes.
        </p>
        <p className="mt-2">
          The Company will never sell or share customer data except as required by law.
        </p>
        <p className="mt-2">
          For reference, our privacy practices align closely with RentSomethingKC&apos;s
          published standards:{" "}
          <a
            href="https://docs.google.com/document/d/1z21n6CiHZaeZVzYqG909H4KzTc7oH1zS_rzIcSDLX54/edit?usp=sharing"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-blue-600 underline decoration-blue-300 underline-offset-4 transition hover:text-blue-800"
          >
            View reference document
          </a>
        </p>
      </>
    ),
  },
  {
    heading: "9. Governing Law",
    content: (
      <>
        <p>This agreement is governed by the laws of the State of Missouri.</p>
        <p className="mt-2">
          Any dispute arising from this service shall be resolved in Jackson County,
          Missouri.
        </p>
      </>
    ),
  },
  {
    heading: "10. Customer Acknowledgment",
    content: (
      <p>
        By submitting payment through Stripe checkout, the customer acknowledges having
        reviewed and agreed to these terms and authorizes recurring monthly charges to the
        selected payment method.
      </p>
    ),
  },
];

export default function WdTermsPage() {
  return (
    <main className="relative z-10 min-h-screen px-5 py-10 sm:px-8 sm:py-14">
      <section className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow-lg shadow-blue-100/40 sm:p-10">
        <header className="mb-8 border-b border-blue-100 pb-6">
          <p className="text-xs font-semibold tracking-[0.3em] text-blue-400 uppercase">
            Wash &amp; Dry Rental
          </p>
          <h1 className="mt-3 text-2xl font-bold text-blue-900 sm:text-3xl">
            Rental Agreement
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Washer &amp; Dryer Rental Agreement for {WD_BRAND} (DBA {WD_COMPANY}).
          </p>
        </header>

        <div className="mb-8 grid gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-sm text-slate-700 sm:grid-cols-2">
          <p>
            <span className="font-semibold text-blue-900">Contact: </span>
            Jared Tolley
          </p>
          <p>
            <span className="font-semibold text-blue-900">Email: </span>
            <a
              className="text-blue-600 underline decoration-blue-300 underline-offset-4"
              href={`mailto:${WD_CONTACT_EMAIL}`}
            >
              {WD_CONTACT_EMAIL}
            </a>
          </p>
          <p>
            <span className="font-semibold text-blue-900">Phone: </span>
            <a
              className="text-blue-600 underline decoration-blue-300 underline-offset-4"
              href={`tel:${WD_CONTACT_PHONE}`}
            >
              {WD_CONTACT_PHONE}
            </a>
          </p>
          <p>
            <span className="font-semibold text-blue-900">Effective: </span>
            Upon first payment
          </p>
        </div>

        <div className="space-y-7">
          {sections.map((section) => (
            <section key={section.heading} className="space-y-3">
              <h2 className="text-lg font-bold text-blue-900 sm:text-xl">
                {section.heading}
              </h2>
              <div className="text-sm leading-6 text-slate-700 sm:text-[0.95rem]">
                {section.content}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-8 border-t border-blue-100 pt-5 text-center text-sm text-slate-500">
          <p>
            {WD_BRAND} (DBA {WD_COMPANY})
          </p>
          <p className="mt-1">
            <a
              href={`mailto:${WD_CONTACT_EMAIL}`}
              className="text-blue-600 underline decoration-blue-300 underline-offset-4"
            >
              {WD_CONTACT_EMAIL}
            </a>
            {" \u00B7 "}
            <a
              href={`tel:${WD_CONTACT_PHONE}`}
              className="text-blue-600 underline decoration-blue-300 underline-offset-4"
            >
              {WD_CONTACT_PHONE}
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
