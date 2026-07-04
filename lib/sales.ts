// The Launchpad — tolley.io/sales. Jared's offer to people who can't start a
// business the normal way: no license, no bank account, a record, no money.
// He supplies the platform (LLC, Stripe/Plaid rails, same-day site, supplier
// and logistics access, marketing automation); they supply the idea and the
// hustle. Handshake basis, ends (or doesn't) at the Buyout Button.
// Source of truth: ~/Shared/launchpad/brief.md

// TODO(Cordless): confirm public number for the Launchpad before this goes
// live for real. This is a PLACEHOLDER — do not treat as a working line.
// The form above it is the primary path in and is already wired to notify
// you directly, so the phone isn't load-bearing yet.
export const LP_PHONE = "913-283-3826";
export const LP_PHONE_TEL = "tel:+19132833826";
export const LP_PHONE_SMS = "sms:+19132833826";

export interface LpArsenalItem {
  label: string;
  desc: string;
}

export const LP_ARSENAL: LpArsenalItem[] = [
  {
    label: "A business that already exists",
    desc: "LLC, licensing, business bank accounts, insurance relationships — the paperwork you can't get, already done.",
  },
  {
    label: "Money that already moves",
    desc: "Stripe subscriptions, invoicing, payment links — customers can pay you day one, no bank account of your own required.",
  },
  {
    label: "A website, same day",
    desc: "Your own page under tolley.io, checkout and booking wired in, live in hours — not weeks.",
  },
  {
    label: "Supplies, wholesale",
    desc: "Buckeye Cleaning, Aramsco, Pool Corp, trailer supply, paint, stone — open accounts, already stocked.",
  },
  {
    label: "Trucks and trailers",
    desc: "Last-mile delivery running daily, plus Bobcat and heavy-equipment moves when a job needs muscle.",
  },
  {
    label: "Hands, when you need them",
    desc: "Welding, auto work, equipment sourcing. Kid wants a lawn company? I buy the mower.",
  },
  {
    label: "A marketing machine",
    desc: "Facebook, Marketplace, auto-posting, real email domains, AI-made promo video — built and already running.",
  },
  {
    label: "A back office that never sleeps",
    desc: "Invoicing, reminders, bookkeeping feeds, AI text responders — the stuff that eats a whole Saturday, automated.",
  },
];

export interface LpStep {
  num: string;
  title: string;
  desc: string;
  highlight?: boolean;
}

export const LP_STEPS: LpStep[] = [
  {
    num: "1",
    title: "Bring the idea",
    desc: "Call, text, or fill out the form below. We talk it through. This part's a handshake — I decide who I build with.",
  },
  {
    num: "2",
    title: "We build it same-day",
    desc: "Your storefront or booking page goes up under tolley.io. Stripe's wired in. Supplies get sourced if the idea needs them. Sometimes a small startup investment — usually $500 to $1,000 — covers inventory, a mower, first materials.",
  },
  {
    num: "3",
    title: "You sell tonight",
    desc: "You do the thing you're good at. The platform handles the rest — payments, the page, the paperwork.",
  },
  {
    num: "4",
    title: "I take a small cut",
    desc: "While you're running on my rails. I'm not here to take a big cut — my goal is volume, not extraction. No fees up front, no course to buy.",
  },
  {
    num: "5",
    title: "The Buyout Button",
    desc: "Once you're established, buy yourself out — the clients, the history, the site, the whole operation becomes yours. Small run that fizzled? That's a $0–100 buyout. Built a $5K/month machine? Tens of thousands, and you walk away the owner. Or never buy out — stay on the rails forever. Both are wins.",
    highlight: true,
  },
];

export interface LpPlay {
  tag: string;
  title: string;
  desc: string;
}

export const LP_PLAYS: LpPlay[] = [
  {
    tag: "Essentials Box",
    title: "The Essentials Box",
    desc: "Neighbor wants to sell monthly household boxes — soap concentrate cut to size, paper towels off a wholesale pallet, TP. I supply it through Buckeye, they pack and deliver, customers pay a Stripe subscription on their own page. Live in a day.",
  },
  {
    tag: "Lawn Kid",
    title: "The Lawn Kid",
    desc: "Teenager, no mower, no license. I buy the mower, build the booking page, a parent drives or he bikes it local. Kid mows. Money lands.",
  },
  {
    tag: "The Distributor",
    title: "The Distributor",
    desc: "Someone with hustle wants to resell pool supplies, cleaning supplies, or paint to local businesses. My wholesale accounts, delivery trucks, and invoicing — they're a supplier by Friday.",
  },
];

export interface LpStopOption {
  code: string;
  label: string;
}

// Judgment-free multi-select. Codes map to the `stopping` field on the
// launchpad_intake action (see app/sales/agent.ts).
export const LP_STOP_OPTIONS: LpStopOption[] = [
  { code: "no_license", label: "No driver's license" },
  { code: "no_bank", label: "Can't open a bank account" },
  { code: "record", label: "A record" },
  { code: "money", label: "Money's tight right now" },
  { code: "dont_know_how", label: "Not sure where to even start" },
  { code: "other", label: "Something else" },
];

export interface LpNeedOption {
  value: string;
  label: string;
}

export const LP_NEED_OPTIONS: LpNeedOption[] = [
  { value: "site", label: "A website or booking page" },
  { value: "supplies", label: "Supplies or inventory" },
  { value: "equipment", label: "Equipment — mower, trailer, tools" },
  { value: "customers", label: "Customers, marketing" },
  { value: "all", label: "All of it — I'm starting from zero" },
];
