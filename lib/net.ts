// Tolley Net — home and gaming network setup installed by Jared Tolley
// in Independence, MO and the Kansas City metro. Same business phone as
// Tolley Cleanouts. No public price list.

import { TC_PHONE, TC_PHONE_SMS, TC_PHONE_TEL } from "@/lib/cleanouts";

export const TN_PHONE = TC_PHONE;
export const TN_PHONE_TEL = TC_PHONE_TEL;
export const TN_PHONE_SMS = TC_PHONE_SMS;
export const TN_EMAIL = "Jared@yourkchomes.com";
export const TN_AREA = "Independence, MO and the Kansas City metro";
export const TN_URL = "https://www.tolley.io/net";

export const TN_TITLE = "Tolley Net — Kansas City Home and Gaming Network Setup";

export const TN_PURPOSE =
  "Tolley Net is home and gaming network setup in Independence, Missouri and the Kansas City metro, installed in person by Jared Tolley. Free 15-minute phone consult, then a custom quote. Services include a network audit and tune-up, gaming installs with wired runs and ping and bufferbloat tuning, full UniFi whole-home installs, and fiber passthrough. Call or text 913-283-3826.";

/**
 * PRICING_PLACEHOLDER — Jared to fill.
 * Leave this null. Do not assign a currency amount or a price string.
 * The public page renders this value, and null renders nothing.
 */
export const PRICING_PLACEHOLDER: null = null;

export const NET_PRICE_LINES = ["Free consult", "Custom quote after consult"] as const;

export function netPriceLines(): readonly string[] {
  return PRICING_PLACEHOLDER ?? NET_PRICE_LINES;
}

export interface NetOffer {
  title: string;
  desc: string;
}

export const TN_OFFERS: NetOffer[] = [
  {
    title: "Free 15-minute phone consult",
    desc: "Tell Jared what the network is doing. Fifteen minutes on the phone, no visit required, and no charge for the call.",
  },
  {
    title: "Network audit and tune-up visit",
    desc: "Jared comes to the house, finds what is slowing the network down, and tunes what you already have.",
  },
  {
    title: "Gaming network install",
    desc: "Wired runs to consoles, PCs, and Fire TVs, plus ping and bufferbloat tuning so games stop hitching.",
  },
  {
    title: "Full UniFi whole-home install",
    desc: "Gateway, 2.5G switching, Wi-Fi 6E or Wi-Fi 7 access points, a separate 6 GHz network for fast devices, and camera and smart-home cleanup.",
  },
  {
    title: "Fiber passthrough setup",
    desc: "Put a provider gateway, including AT&T fiber, into passthrough so your own router runs the house.",
  },
];

export interface NetProofStat {
  label: string;
  value: string;
}

/** Jared's own home network, measured November 19, 2026. Not a speed guarantee. */
export const TN_PROOF_MEASURED = "November 19, 2026";

export const TN_PROOF_STATS: NetProofStat[] = [
  { label: "Download", value: "About 851 Mbps" },
  { label: "Upload", value: "About 937 Mbps" },
  { label: "Ping", value: "About 4 ms" },
  { label: "Packet loss", value: "0%" },
];

export const TN_PROOF_NOTES = [
  "Fiber in passthrough to UniFi.",
  "Gigabit-class speeds on a phone over 6 GHz at 160 MHz.",
  "A rogue router — a Mac sharing its connection — was causing address conflicts. Jared found it and removed it.",
] as const;

export interface NetFaq {
  q: string;
  a: string;
}

export const TN_FAQ: NetFaq[] = [
  {
    q: "Who installs the network?",
    a: "Jared Tolley does the install himself, in Independence, Missouri and the Kansas City metro. You talk to Jared, and Jared sets up the network.",
  },
  {
    q: "How much does Tolley Net cost?",
    a: "The phone consult is free and takes about 15 minutes. The audit, gaming install, UniFi install, or fiber passthrough is a custom quote after that consult. There is no public price list.",
  },
  {
    q: "What can you set up?",
    a: "A network audit and tune-up, a gaming install with wired runs to consoles, PCs, and Fire TVs plus ping and bufferbloat tuning, a full UniFi whole-home install, or fiber passthrough for providers such as AT&T.",
  },
  {
    q: "What is in a UniFi whole-home install?",
    a: "A gateway, 2.5G switching, Wi-Fi 6E or Wi-Fi 7 access points, a separate 6 GHz network for fast devices, and cleanup of cameras and other smart-home gear that is fighting the Wi-Fi.",
  },
  {
    q: "Where do you work?",
    a: "Independence, MO and the Kansas City metro. Share your city when you write in so Jared can confirm he covers the address. Call or text 913-283-3826.",
  },
  {
    q: "Do I need to switch internet providers?",
    a: "No. Tolley Net sets up the network inside the home. That includes putting a fiber gateway such as AT&T into passthrough so a UniFi gateway can run the house. Your internet plan stays with your provider.",
  },
];

export interface ParsedNetQuote {
  name: string;
  phone: string;
  email: string;
  city: string;
  notes: string;
  gaming: boolean | null;
  devices: string;
  preferredTime: string;
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function parseGaming(value: unknown): boolean | null {
  if (value === true) return true;
  if (value === false) return false;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "yes" || normalized === "true") return true;
  if (normalized === "no" || normalized === "false") return false;
  return null;
}

/** Reachable contact, length caps, and a notes block. Invalid email is kept in notes, not the email column. */
export function parseNetQuote(body: Record<string, unknown>): { ok: true; value: ParsedNetQuote } | { ok: false; error: string } {
  const name = text(body.name, 120);
  const phone = text(body.phone, 40);
  const emailRaw = text(body.email, 200);
  const email = validEmail(emailRaw) ? emailRaw : "";
  const city = text(body.city, 120);
  const problem = text(body.problem ?? body.details, 2000);
  const devices = text(body.devices, 500);
  const preferredTime = text(body.preferredTime, 200);
  const gaming = parseGaming(body.gaming);
  const digits = phone.replace(/\D/g, "").length;
  if (!name && digits < 7 && !email) {
    return { ok: false, error: "Tell us a name, a phone number, or an email so we can reach you." };
  }
  const notes = [
    city ? `City: ${city}` : "",
    problem ? `What's wrong: ${problem}` : "",
    gaming === true ? "Gaming: yes" : gaming === false ? "Gaming: no" : "",
    devices ? `Devices: ${devices}` : "",
    preferredTime ? `Preferred time: ${preferredTime}` : "",
    emailRaw && !email ? `Email as typed: ${emailRaw}` : "",
  ].filter(Boolean).join("\n");
  return { ok: true, value: { name, phone, email, city, notes, gaming, devices, preferredTime } };
}

/** LocalBusiness + Service JSON-LD. No offers and no prices. */
export function netJsonLd(): Record<string, unknown> {
  const areaServed = [
    { "@type": "City", name: "Independence", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "AdministrativeArea", name: "Kansas City metro" },
  ];
  const jared = { "@type": "Person", name: "Jared Tolley" };
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LocalBusiness",
        "@id": `${TN_URL}#business`,
        name: "Tolley Net",
        description: TN_PURPOSE,
        url: TN_URL,
        telephone: TN_PHONE,
        email: TN_EMAIL,
        founder: jared,
        areaServed,
        address: {
          "@type": "PostalAddress",
          addressLocality: "Independence",
          addressRegion: "MO",
          addressCountry: "US",
        },
      },
      {
        "@type": "Service",
        "@id": `${TN_URL}#service`,
        name: "Home and gaming network setup",
        serviceType: "Home and gaming network setup",
        description: TN_PURPOSE,
        url: TN_URL,
        telephone: TN_PHONE,
        provider: jared,
        areaServed,
      },
    ],
  };
}
