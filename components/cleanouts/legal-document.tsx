import Link from "next/link";
import type { ReactNode } from "react";

import {
  CK_ADDRESS,
  CK_CONTACT_NAME,
  CK_EFFECTIVE_DATE,
  CK_EMAIL,
  CK_ENTITY,
  CK_LAST_UPDATED,
  CK_PHONE,
  CK_PHONE_TEL,
  type LegalItem,
  type LegalSection,
} from "@/lib/legal-cleanouts";

function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={index} className="font-semibold text-white">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

function ItemList({ items }: { items: LegalItem[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {items.map((item, index) => (
        <li key={`${item.text}-${index}`} className="text-sm leading-relaxed text-white/70">
          <span className="text-[#ff7a1a]">· </span>
          <RichText text={item.text} />
          {item.items ? (
            <div className="pl-4">
              <ItemList items={item.items} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function CleanoutLegalDocument({
  kicker,
  title,
  sections,
  footer,
}: {
  kicker: string;
  title: string;
  sections: LegalSection[];
  footer: ReactNode;
}) {
  return (
    <main className="relative z-10 min-h-screen px-5 pb-20 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <nav className="pt-6 text-xs text-white/50">
          <Link href="/cleanouts" className="hover:text-white hover:underline">
            ← Cleanouts
          </Link>
        </nav>

        <header className="mt-10 text-center">
          <div className="mx-auto inline-block rounded bg-white px-4 py-2">
            <img
              src="/homes/logo.svg"
              alt="Your KC Homes LLC"
              width={260}
              height={61}
            />
          </div>
          <p className="tc-kicker mt-8">{kicker}</p>
          <h1 className="tc-display mt-4 text-3xl font-semibold text-white sm:text-4xl">{title}</h1>
          <p className="mx-auto mt-4 max-w-lg text-sm text-white/60">
            {CK_ENTITY} · {CK_ADDRESS}
            <br />
            {CK_CONTACT_NAME} ·{" "}
            <a href={CK_PHONE_TEL} className="text-[#ff7a1a] hover:underline">
              {CK_PHONE}
            </a>{" "}
            ·{" "}
            <a href={`mailto:${CK_EMAIL}`} className="hover:underline">
              {CK_EMAIL}
            </a>
            <br />
            Effective {CK_EFFECTIVE_DATE} · Last updated {CK_LAST_UPDATED}
          </p>
        </header>

        <div className="mt-10 space-y-4">
          {sections.map((section) => (
            <section key={section.heading} className="tc-form p-6">
              <h2 className="tc-display text-lg text-[#ff7a1a]">{section.heading}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="mt-2 text-sm leading-relaxed text-white/70">
                  <RichText text={paragraph} />
                </p>
              ))}
              {section.items ? <ItemList items={section.items} /> : null}
            </section>
          ))}
        </div>

        <div className="tc-diff mt-12 p-8 text-center">{footer}</div>
      </div>
    </main>
  );
}
