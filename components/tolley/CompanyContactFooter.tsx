import Link from "next/link";
import { COMPANY } from "@/lib/company-profile";
/** Server-rendered on every page, including independently branded products. */
export function CompanyContactFooter() {
  return <footer className="company-contact-footer" aria-label="Company contact">
    <Link href="/">{COMPANY.name}</Link><span>{COMPANY.city}, {COMPANY.state}</span>
    <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a><Link href="/about">About the company ↗</Link>
  </footer>;
}
