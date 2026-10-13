import type { Metadata } from "next";
import Link from "next/link";

import { CleanoutLegalDocument } from "@/components/cleanouts/legal-document";
import {
  CK_PHONE,
  CK_PHONE_TEL,
  CK_PRIVACY_DESCRIPTION,
  CK_PRIVACY_TITLE,
  CK_TERMS_PATH,
  PRIVACY_SECTIONS,
} from "@/lib/legal-cleanouts";

export const metadata: Metadata = {
  title: { absolute: `${CK_PRIVACY_TITLE} | Your KC Homes LLC` },
  description: CK_PRIVACY_DESCRIPTION,
  alternates: { canonical: "https://www.tolley.io/cleanouts/privacy" },
};

export default function CleanoutPrivacyPage() {
  return (
    <CleanoutLegalDocument
      kicker="Privacy"
      title={CK_PRIVACY_TITLE}
      sections={PRIVACY_SECTIONS}
      footer={
        <>
          <p className="text-sm text-white/70">Questions about any of this? Call or text.</p>
          <a href={CK_PHONE_TEL} className="tc-btn-primary mt-4 inline-block rounded px-6 py-3 text-sm">
            {CK_PHONE}
          </a>
          <p className="mt-4 text-xs text-white/50">
            <Link href={CK_TERMS_PATH} className="hover:underline">
              Terms of Service
            </Link>
          </p>
        </>
      }
    />
  );
}
