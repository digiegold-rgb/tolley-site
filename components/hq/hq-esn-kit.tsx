"use client";

import { useState } from "react";

import { useToast } from "@/components/ui/Toast";

/**
 * EstateSales.NET paste kit.
 *
 * ESN is filled in BY HAND — their ToS prohibits browsers/agents/automation
 * against the service and breach is automatic termination with no notice.
 * So this panel exists to make the manual work a two-tap job: every field
 * that has to be typed into ESN lives here with a copy button.
 *
 * Source of truth: ~/business-os/ESN-PASTE-KIT.md
 */

const ESN_FIELDS: {
  section: string;
  where: string;
  items: { label: string; value: string; note?: string }[];
}[] = [
  {
    section: "Company Information",
    where: "/account/company/settings",
    items: [
      {
        label: "Company Description",
        value: `Tolley Estate Sales is a small, owner-run estate sale company based in Independence, serving the whole Kansas City metro. Jared and Ruthann Tolley run every sale personally — the people you meet at the walkthrough are the people at your door on sale day.

We do things a little differently. Our commission is 30%, where most companies in Kansas City charge 35% to 50%. We have no minimum sale size, so if another company told you your estate was too small, please call us — that's exactly the work we want. And our entire client contract is published on our website, so you can read every word before anyone sets foot in your home.

Zero cost up front. We stage, research real sold prices, photograph everything, advertise hard, staff the doors, take every form of payment, and hand you an itemized settlement in days — not weeks. Whatever doesn't sell is handled the way you chose in writing: returned, donated with receipts for your taxes, hauled away, or sold on for you through our own resale shop.

Our first sale grossed over $5,000 in a single weekend and sold the home down to the walls. We can usually walk your house the same week you call.`,
      },
      {
        label: "Tagline",
        value:
          "No minimum, no upfront cost, 30% commission. We'll take the sale others turn down.",
        note: "Shows under your name on the Hire a Company page — your one line against ~60 local competitors.",
      },
      { label: "Website", value: "https://www.tolley.io/estate" },
      { label: "Phone", value: "913-283-3826" },
      { label: "Email", value: "jared@yourkchomes.com" },
      {
        label: "Facebook",
        value: "https://www.facebook.com/1192241847311343",
        note: "Corrected page ID. Do NOT use anything ending in 61588760760750 — that page does not resolve.",
      },
      {
        label: "Memberships",
        value: "",
        note: "LEAVE EMPTY. We are not members of AAA / ASEL / ISA / CAGA / ACNA / GIA. A false membership on the page families use to vet you is the one thing that could actually cost a client.",
      },
    ],
  },
  {
    section: "Lead settings — why you have zero leads",
    where: "/account/company/lead-settings",
    items: [
      {
        label: "LOCATIONS tab",
        value: "40",
        note: "Set 'Distance In Miles Around 64052' to 40 — covers both sides of the state line (Overland Park, Olathe, Lee's Summit, Liberty, Blue Springs). Confirm Kansas City KS-MO is checked. Leave Excluded Areas empty. SAVE.",
      },
      {
        label: "NOTIFICATIONS tab",
        value: "",
        note: "Turn everything on, especially email. Leads are a race — the family contacts several companies and hires whoever answers first.",
      },
      {
        label: "CANNED RESPONSE",
        value: `Hi [Name],

Jared Tolley here with Tolley Estate Sales — thanks for reaching out. I'd love to help.

A quick word on how we work, because we're a little different from most companies here. Our commission is 30%, where most Kansas City companies charge 35% to 50%. We have no minimum sale size, so if you've been told your estate is too small, that's exactly the work we want. You pay nothing up front, ever. And our entire contract is published at tolley.io/estate/agreement — you can read every word before I set foot in your home.

I can usually come walk the house within a few days, sometimes the same day. What works for you?

Jared Tolley
Tolley Estate Sales · Your KC Homes LLC
913-283-3826 · tolley.io/estate`,
        note: "Every ESN lead is blasted to every company in the metro. The reply IS the competition — an owner on the industry forums: 'most of them suck'.",
      },
    ],
  },
  {
    section: "Profile wizard (sitting at 10%)",
    where: "/account/company/self-guided",
    items: [
      {
        label: "Message to Potential Buyers",
        value: `Thanks for looking! A few things people usually ask: everything is priced and tagged, and we take cash, all major cards, tap-to-pay, and Venmo — nobody gets turned away over payment. Offers are welcome on any item, right down to the drapes, and we present every one to the owner. Doors open at the posted time sharp with no early entry; if a line forms we hand out numbered tickets so everyone gets a fair shot. Want the address of our next sale before the public does? Join the early list at tolley.io/estate.`,
      },
      {
        label: "Message to Potential Clients",
        value: `If you're weighing this decision, here's everything up front. We charge 30% of what the sale brings in; most companies in Kansas City charge 35% to 50%. There's no minimum — if you've been told your estate is too small to bother with, call us. You pay nothing up front and nothing at all if we never hold the sale. Our full contract is published at tolley.io/estate/agreement so you can read it before we ever meet. The walkthrough is free, there's no obligation, and we can usually come out the same week.`,
        note: "Highest-leverage text on the whole profile — this is what a family reads while deciding whether to call.",
      },
      {
        label: "Default Terms & Conditions",
        value: `All items sold as-is, where-is. All sales final — no refunds, returns, or exchanges. Payment due at time of purchase; we accept cash, all major credit and debit cards, tap-to-pay, and approved payment apps. Buyers are responsible for loading and removing their own purchases within the posted sale hours. Doors open at the posted time — no early entry. If a line forms, numbered entry tickets are issued in arrival order. Occupancy may be limited for safety. Offers are welcome on any item and are presented to the owner. Please treat the home, the family, and other shoppers with respect. Full terms: tolley.io/estate/terms`,
        note: "Auto-fills into every new sale listing.",
      },
    ],
  },
];

export function HqEsnKit() {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 1600);
      toast({ title: `${label} copied`, variant: "success" });
    } catch {
      toast({
        title: "Copy failed — select the text manually",
        variant: "error",
      });
    }
  }

  return (
    <details
      style={{
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 10,
        padding: "12px 14px",
        marginBottom: 18,
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 15 }}>
        📋 EstateSales.NET paste kit — every field, ready to copy
      </summary>

      <p style={{ fontSize: 12.5, opacity: 0.75, margin: "10px 0 4px" }}>
        ESN is filled in <strong>by hand</strong> — their terms prohibit
        browsers/agents against the service and breach is automatic termination
        with no notice. Tap Copy, paste into the form, hit{" "}
        <em>Save Information</em>.
      </p>
      <p style={{ fontSize: 12.5, opacity: 0.75, margin: "0 0 14px" }}>
        Fastest path if you want company: ESN support will walk the screens with
        you — <strong>(888) 653-8468</strong>, 7am–8pm Mon–Fri Central.
      </p>

      {ESN_FIELDS.map((group) => (
        <div key={group.section} style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 2 }}>
            {group.section}
          </div>
          <div
            style={{
              fontSize: 12,
              opacity: 0.6,
              fontFamily: "monospace",
              marginBottom: 8,
            }}
          >
            estatesales.net{group.where}
          </div>

          {group.items.map((item) => (
            <div
              key={item.label}
              style={{
                borderTop: "1px solid rgba(255,255,255,0.08)",
                padding: "9px 0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 500 }}>
                  {item.label}
                </span>
                {item.value ? (
                  <button
                    type="button"
                    onClick={() => copy(item.label, item.value)}
                    style={{
                      fontSize: 12,
                      padding: "3px 10px",
                      borderRadius: 6,
                      border: "1px solid rgba(255,255,255,0.2)",
                      background:
                        copied === item.label
                          ? "rgba(80,200,120,0.25)"
                          : "rgba(255,255,255,0.07)",
                      color: "inherit",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {copied === item.label ? "✓ Copied" : "Copy"}
                  </button>
                ) : null}
              </div>

              {item.note ? (
                <div
                  style={{
                    fontSize: 12,
                    opacity: 0.7,
                    marginTop: 4,
                    lineHeight: 1.45,
                  }}
                >
                  {item.note}
                </div>
              ) : null}

              {item.value ? (
                <pre
                  style={{
                    fontSize: 11.5,
                    opacity: 0.85,
                    margin: "6px 0 0",
                    padding: "8px 10px",
                    background: "rgba(0,0,0,0.28)",
                    borderRadius: 6,
                    maxHeight: 150,
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontFamily: "inherit",
                    lineHeight: 1.5,
                  }}
                >
                  {item.value}
                </pre>
              ) : null}
            </div>
          ))}
        </div>
      ))}

      <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.6 }}>
        <strong>Also worth doing in the same login:</strong> list future sales{" "}
        <em>under the company</em>, not as a private sale (Sale #1 was filed
        private, which is why the profile shows no sale history) · publish every
        listing <strong>at least 48h before doors open</strong> or it misses the
        subscriber email that drives the turnout · grab the Bronze Marketplace
        service fee off{" "}
        <code>/account/marketplace/company/marketplace-settings</code> — it is
        not published anywhere public.
      </div>
    </details>
  );
}
