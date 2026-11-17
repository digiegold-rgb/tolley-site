import Link from "next/link";
import type { Metadata } from "next";
import { BRAND, COMPANY, EMAIL, PHONE } from "@/lib/laundry/config";
import "./laundry.css";
export const metadata: Metadata = {
  title: {
    default: `${BRAND} | Find a washer and dryer rental`,
    template: `%s | ${BRAND}`,
  },
  description:
    "Find an independent washer and dryer rental operator near you. Compare prices, request delivery and sign online. Launching in Kansas City.",
  referrer: "no-referrer",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lrn">
      <a className="skip" href="#laundry-main">
        Skip to content
      </a>
      <header>
        <nav className="wrap" aria-label="Laundry Rental Network">
          <Link className="brand" href="/laundry">
            <span className="brand-mark" aria-hidden="true">
              ◉
            </span>
            <span>
              Laundry Rental
              <br />
              Network
            </span>
          </Link>
          <div className="navlinks">
            <Link className="optional" href="/laundry#find">
              Find a rental
            </Link>
            <Link href="/laundry/join">List your business ↗</Link>
            <Link href="/laundry/dashboard">Operator login</Link>
          </div>
        </nav>
      </header>
      <main id="laundry-main">{children}</main>
      <footer>
        <div className="wrap">
          <div className="footer-row">
            <div>
              <strong>{BRAND}</strong>
              <p className="tiny">
                Operated by {COMPANY} · Kansas City metro
                <br />
                <a href={`tel:${PHONE}`}>{PHONE}</a> ·{" "}
                <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
              </p>
            </div>
            <div className="footer-links">
              <Link href="/laundry/terms">Renter terms</Link>
              <Link href="/laundry/privacy">Privacy</Link>
              <Link href="/laundry/operator-agreement">Operator agreement</Link>
              <Link href="/laundry/websites">Operator websites</Link>
            </div>
          </div>
          <p className="tiny">
            Wash & Dry Rental is our affiliated Kansas City anchor and receives
            KC leads without a booking fee. Other providers are independent
            businesses. ZIP data:{" "}
            <a href="https://www.geonames.org/">GeoNames</a>, CC BY 4.0.
          </p>
        </div>
      </footer>
    </div>
  );
}
