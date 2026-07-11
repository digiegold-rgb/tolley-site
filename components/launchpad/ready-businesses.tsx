"use client";

import Image from "next/image";
import { LP_READY_BUSINESSES, type LpReadyBusiness } from "@/lib/sales";

const SITE_ORIGIN = "https://www.tolley.io";

function fbShareUrl(path: string) {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
    `${SITE_ORIGIN}${path}`,
  )}`;
}

/** Card CTA: preselect this business in the Claim Ticket and scroll to it. */
function selectBusiness(key: string) {
  window.dispatchEvent(new CustomEvent("lp:ready-select", { detail: { key } }));
  window.history.replaceState(null, "", `?ready=${key}#claim`);
  document.getElementById("claim")?.scrollIntoView({ behavior: "smooth" });
}

function ReadyCard({ biz }: { biz: LpReadyBusiness }) {
  return (
    <div className="lp-ready-card flex flex-col">
      {biz.shot && biz.href ? (
        <a href={biz.href} target="_blank" rel="noopener noreferrer" aria-label={`${biz.name} — live site`}>
          <Image
            src={biz.shot}
            alt={`${biz.name} — live at tolley.io${biz.href}`}
            width={1200}
            height={750}
            className="lp-receipt-shot"
          />
        </a>
      ) : (
        <div className="lp-ready-plate" aria-hidden="true">
          <span className="lp-mono text-[0.65rem] uppercase tracking-widest opacity-60">
            Supplier
          </span>
          <span className="lp-display mt-1 text-lg text-[color:var(--lp-paper)]">
            {biz.supplier}
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 p-5">
        <span className={`lp-status-badge lp-status-${biz.status}`}>{biz.statusLabel}</span>
        <h3 className="lp-display text-xl text-[color:var(--lp-paper)]">{biz.name}</h3>
        <p className="lp-mono text-[0.65rem] uppercase tracking-wider text-[color:var(--lp-steel)] opacity-80">
          Supplier: {biz.supplier}
        </p>
        <p className="text-sm leading-relaxed text-[color:var(--lp-steel)]">{biz.pitch}</p>

        <div>
          <p className="lp-field-label-dark mb-1.5">Already built</p>
          <ul className="lp-ready-check space-y-1 text-sm text-[color:var(--lp-steel)]">
            {biz.built.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div>
          <p className="lp-field-label-dark mb-1">What you do</p>
          <p className="text-sm leading-relaxed text-[color:var(--lp-paper)]">{biz.youDo}</p>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => selectBusiness(biz.key)}
            className="lp-btn-primary lp-ready-cta rounded px-5 py-2.5 text-sm font-bold"
          >
            I Want This One
          </button>
          {biz.href ? (
            <>
              <a
                href={biz.href}
                target="_blank"
                rel="noopener noreferrer"
                className="lp-mono text-xs text-[color:var(--lp-amber)] underline underline-offset-2 hover:opacity-80"
              >
                See it live →
              </a>
              <a
                href={fbShareUrl(biz.href)}
                target="_blank"
                rel="noopener noreferrer"
                className="lp-mono text-xs text-[color:var(--lp-steel)] underline underline-offset-2 hover:text-[color:var(--lp-amber)]"
              >
                Share on Facebook
              </a>
            </>
          ) : null}
          {biz.relatedHref ? (
            <a
              href={biz.relatedHref}
              target="_blank"
              rel="noopener noreferrer"
              className="lp-mono text-xs text-[color:var(--lp-steel)] underline underline-offset-2 hover:text-[color:var(--lp-amber)]"
            >
              Related: {biz.relatedLabel ?? biz.relatedHref} →
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ReadyBusinesses() {
  return (
    <div className="lp-ready-grid">
      {LP_READY_BUSINESSES.map((biz) => (
        <ReadyCard key={biz.key} biz={biz} />
      ))}
    </div>
  );
}
