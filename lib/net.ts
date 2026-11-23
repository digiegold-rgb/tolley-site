// Tolley Net — network consulting and installation by Jared Tolley
// in Independence, MO and the Kansas City metro. Same business phone as
// Tolley Cleanouts. No public price list.

import { TC_PHONE, TC_PHONE_SMS, TC_PHONE_TEL } from "@/lib/cleanouts";

export const TN_PHONE = TC_PHONE;
export const TN_PHONE_TEL = TC_PHONE_TEL;
export const TN_PHONE_SMS = TC_PHONE_SMS;
export const TN_EMAIL = "Jared@yourkchomes.com";
export const TN_AREA = "Independence, MO and the Kansas City metro";
export const TN_URL = "https://www.tolley.io/net";

export const TN_TITLE = "Network Consulting & Wi-Fi Setup in Kansas City | Tolley Net";

export const TN_PURPOSE =
  "Network infrastructure consulting and setup for homes, gaming, home offices, and small businesses in Independence, Missouri and the Kansas City metro. Work directly with Jared Tolley on Wi-Fi, wired networks, UniFi, shared storage, backups, and remote-access planning. Start with a free 15-minute phone consult; assessments and installation are quoted separately before work begins. Call or text 913-283-3826.";

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
    title: "Small-business network consulting",
    desc: "Opening an office, expanding a shop, or fixing unreliable connectivity? Plan Wi-Fi coverage, wired workstations, switches, guest access, and equipment around the way your team works.",
  },
  {
    title: "Shared storage, backups & remote access",
    desc: "Talk through NAS and shared-file needs, backup and recovery priorities, and access for people working away from the office. Assessment, configuration, and testing are scoped to your systems.",
  },
  {
    title: "Free 15-minute phone consult",
    desc: "Tell Jared what the network is doing. Fifteen minutes on the phone, no visit required, and no charge for the call.",
  },
  {
    title: "Network audit and tune-up visit",
    desc: "Review coverage, equipment, wired connections, and the symptoms you are seeing. Identify likely bottlenecks and improvements to your existing setup before recommending new equipment.",
  },
  {
    title: "Gaming network install",
    desc: "Plan wired connections for consoles, PCs, and streaming devices. Check latency under load and tune supported equipment to address local congestion.",
  },
  {
    title: "Full UniFi whole-home install",
    desc: "Plan a gateway, switches, access points, and separate guest or smart-device networks around your space and devices. Equipment and cabling are selected for your needs and agreed budget.",
  },
  {
    title: "Fiber passthrough setup",
    desc: "Review your provider gateway and set up passthrough where supported so your own router can manage the network. Compatibility depends on the provider and equipment.",
  },
];

export interface NetFaq {
  q: string;
  a: string;
}

export const TN_FAQ: NetFaq[] = [
  {
    q: "Can I hire you to plan a business network before buying equipment?",
    a: "Yes. Start with a free phone consult about your space, team, current equipment, and goals. Jared can quote an assessment and a network plan before you commit to equipment or installation. Share your city to confirm coverage.",
  },
  {
    q: "What do I receive from an assessment?",
    a: "Agree the deliverables before booking. An assessment can include an equipment and coverage review, a simple network layout, a prioritized improvement list, equipment recommendations, and a proposed installation scope. The free phone consult establishes what needs a closer look; it is not an on-site audit.",
  },
  {
    q: "Can you work with the equipment I already own?",
    a: "Yes. Share your router, switch, access-point, and internet-provider details if you know them. Jared reviews compatibility and reuse options first. Any recommended purchases, labor, cabling, travel, and follow-up work are included in the agreed scope or quoted separately before proceeding.",
  },
  {
    q: "Can you guarantee a particular speed or ping?",
    a: "Results depend on the internet connection, building, devices, interference, and remote services. We agree useful checks for your setup and review the results at handoff. No fixed speed, ping, or whole-building coverage is promised before assessment.",
  },
  {
    q: "Is ongoing IT support included?",
    a: "Follow-up help is agreed as part of the quote. This is project-based consulting and setup; ongoing monitoring, support hours, and response times need a separate agreement.",
  },
  {
    q: "Who installs the network?",
    a: "You work directly with Jared Tolley for planning and the agreed setup in Independence, Missouri and the Kansas City metro.",
  },
  {
    q: "How much does Tolley Net cost?",
    a: "The phone consult is free and takes about 15 minutes. Assessments, business consulting, and installation receive a custom quote after that consult. There is no public price list.",
  },
  {
    q: "What can you set up?",
    a: "Home and small-business network planning, Wi-Fi and wired networks, gaming connections, UniFi setup, shared-storage and backup planning, remote-access planning, and compatible fiber passthrough. Exact configuration and installation are agreed after reviewing your needs.",
  },
  {
    q: "What is in a UniFi whole-home install?",
    a: "The quote can cover a gateway, switches, access points, and guest or smart-device networks. Hardware, cabling routes, placement, and testing depend on your space, compatible devices, and budget.",
  },
  {
    q: "Where do you work?",
    a: "Independence, MO and the Kansas City metro. Share your city when you write in so Jared can confirm he covers the address. Call or text 913-283-3826.",
  },
  {
    q: "Do I need to switch internet providers?",
    a: "You can start with your current provider. Jared reviews the network at your home or business and can discuss compatible gateway settings. Internet service and provider-side faults remain with your ISP.",
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
  const phoneRaw = text(body.phone, 40);
  const phone = phoneRaw.replace(/\D/g, "").length >= 7 ? phoneRaw : "";
  const emailRaw = text(body.email, 200);
  const email = validEmail(emailRaw) ? emailRaw : "";
  const city = text(body.city, 120);
  const problem = text(body.problem ?? body.details, 2000);
  const devices = text(body.devices, 500);
  const preferredTime = text(body.preferredTime, 200);
  const gaming = parseGaming(body.gaming);
  const projectType = text(body.projectType, 120);
  const organization = text(body.organization, 160);
  const timeline = text(body.timeline, 200);
  if (!phone && !email) {
    return { ok: false, error: "Add a phone number with at least 7 digits or a valid email so Jared can reach you." };
  }
  const notes = [
    projectType ? `Project type: ${projectType}` : "",
    organization ? `Business / organization: ${organization}` : "",
    timeline ? `Project timing: ${timeline}` : "",
    city ? `City: ${city}` : "",
    problem ? `Project needs: ${problem}` : "",
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
        name: "Network infrastructure consulting and setup",
        serviceType: "Home and small-business network consulting, Wi-Fi and wired network setup",
        description: TN_PURPOSE,
        url: TN_URL,
        telephone: TN_PHONE,
        provider: jared,
        areaServed,
      },
    ],
  };
}
