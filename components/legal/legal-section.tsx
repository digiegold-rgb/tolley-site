import type { ReactNode } from "react";

export type LegalSectionContent = {
  heading: string;
  /** Plain paragraphs, rendered in order before any bullets. */
  paragraphs?: string[];
  /** Bulleted items, rendered after the paragraphs. */
  bullets?: string[];
  /** Anything that needs real markup (links, tables) goes here, last. */
  children?: ReactNode;
  /** Draws the section as a highlighted callout — use for the parts a reader
   *  must not skim past (money, prohibited uses, arbitration). */
  emphasis?: boolean;
};

/**
 * One numbered section of a legal page. Shared by the Jelly Studio Terms,
 * Privacy Policy, and Beta Addendum so the three read as one document set.
 */
export function LegalSection({
  heading,
  paragraphs,
  bullets,
  children,
  emphasis,
}: LegalSectionContent) {
  const body = (
    <>
      <h2 className="text-lg font-semibold text-white/94 sm:text-xl">{heading}</h2>
      {paragraphs?.map((paragraph) => (
        <p key={paragraph} className="text-sm leading-6 text-white/83 sm:text-[0.95rem]">
          {paragraph}
        </p>
      ))}
      {bullets?.length ? (
        <ul className="space-y-2 text-sm leading-6 text-white/83 sm:text-[0.95rem]">
          {bullets.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden="true" className="text-white/45">
                ·
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {children}
    </>
  );

  if (emphasis) {
    return (
      <section className="space-y-3 rounded-2xl border border-violet-200/25 bg-violet-300/[0.06] p-4 sm:p-5">
        {body}
      </section>
    );
  }

  return <section className="space-y-3">{body}</section>;
}
