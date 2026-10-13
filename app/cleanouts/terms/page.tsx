import type { Metadata } from "next";
import Link from "next/link";

import { CleanoutLegalDocument } from "@/components/cleanouts/legal-document";
import {
  CK_EMAIL,
  CK_PHONE,
  CK_PHONE_TEL,
  CK_PRIVACY_PATH,
  CK_TERMS_DESCRIPTION,
  CK_TERMS_TITLE,
  TERMS_SECTIONS,
} from "@/lib/legal-cleanouts";

export const metadata: Metadata = {
  title: { absolute: `${CK_TERMS_TITLE} | Your KC Homes LLC` },
  description: CK_TERMS_DESCRIPTION,
  alternates: { canonical: "https://www.tolley.io/cleanouts/terms" },
};

export default function CleanoutTermsPage() {
  return (
    <CleanoutLegalDocument
      kicker="Terms"
      title={CK_TERMS_TITLE}
      sections={TERMS_SECTIONS}
      footer={
        <>
          <p className="text-sm text-white/70">Questions before the job? Call or text.</p>
          <a href={CK_PHONE_TEL} className="tc-btn-primary mt-4 inline-block rounded px-6 py-3 text-sm">
            {CK_PHONE}
          </a>
          <p className="mt-4 text-xs text-white/50">
            <Link href={CK_PRIVACY_PATH} className="hover:underline">
              Privacy Policy
            </Link>
            {" · "}
            <a href={`mailto:${CK_EMAIL}`} className="hover:underline">
              {CK_EMAIL}
            </a>
          </p>
        </>
      }
    />
  );
}
