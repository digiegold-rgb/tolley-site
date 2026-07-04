// /demo/[slug] — category themes + copy for the Engine 1 auto-demo generator.
// Each scraped GrowthLead (offer=site) gets a one-page preview rendered from
// its REAL data only (name, category, rating, reviews, phone, address). The
// theme map below controls palette, fonts, iconography, and hero/services
// copy so an auto shop, a nail salon, and a lawn crew feel like different
// designers built them. NO fabricated testimonials, photos, or claims —
// copy speaks about the trade, never invents facts about the business.

import type { DemoIconName } from "@/components/demo/demo-icons";

// Cordless's business line — same constant value used by lib/wd.ts,
// lib/rental.ts, lib/homes.ts, etc.
export const DEMO_TOLLEY_PHONE = "913-283-3826";
export const DEMO_TOLLEY_PHONE_TEL = "tel:+19132833826";
export const DEMO_TOLLEY_SMS = "sms:+19132833826";

// ── Self-serve "buy this website" checkout (offer ①: $500 setup + $49/mo) ──
// Stripe product "Tolley Local Website" (prod_UgK4qSXvSYNVoB), provisioned by
// scripts/setup-demo-site-product.mjs. Two prices: a one-time $500 setup and a
// recurring $49/mo hosting line, both billed via one subscription checkout.
export const DEMO_SITE_PRODUCT_METADATA = "demo_site";
export const DEMO_SITE_SETUP_PRICE = "price_1TgxQ829zOZYc3GpHI8WOSv7"; // $500 one-time
export const DEMO_SITE_MONTHLY_PRICE = "price_1TgxQ829zOZYc3GpYvRZWB20"; // $49/mo

export interface DemoService {
  icon: DemoIconName;
  title: string;
  desc: string;
}

export interface DemoTheme {
  key: string;
  /** lowercase substrings matched against GrowthLead.category */
  match: string[];
  label: string;
  /** "serif" → Cormorant Garamond, "industrial" → Oswald, "rounded" → Fredoka, "sans" → Inter */
  font: "serif" | "industrial" | "rounded" | "sans";
  /** dark hero vs light hero treatment */
  mood: "dark" | "light";
  vars: {
    bg: string; // page background
    bg2: string; // alternating section background
    surface: string; // card background
    ink: string; // primary text on bg
    inkSoft: string; // secondary text on bg
    accent: string; // brand accent
    accentInk: string; // text on accent
    heroBg: string; // full CSS background for the hero
    heroInk: string; // hero text
    heroSoft: string; // hero secondary text
    border: string; // hairline borders
    star: string; // star color
  };
  eyebrow: string;
  headline: (name: string, city: string) => string;
  sub: (name: string, city: string) => string;
  servicesHeading: string;
  servicesIntro: (city: string) => string;
  services: DemoService[];
  ctaLabel: string; // e.g. "Call for an estimate"
  finalLine: (name: string, city: string) => string;
}

const THEMES: DemoTheme[] = [
  // ── Auto repair / tire ────────────────────────────────────────────────
  {
    key: "auto",
    match: ["auto repair", "tire", "automotive", "auto center", "mechanic", "oil change", "transmission", "brake", "muffler", "car repair"],
    label: "Auto Repair",
    font: "industrial",
    mood: "dark",
    vars: {
      bg: "#f4f4f2",
      bg2: "#eceae6",
      surface: "#ffffff",
      ink: "#16181d",
      inkSoft: "#5b6068",
      accent: "#e8590c",
      accentInk: "#ffffff",
      heroBg:
        "radial-gradient(90% 70% at 85% 0%, rgba(232,89,12,0.22), transparent 60%), linear-gradient(165deg, #16181d 0%, #1f2229 55%, #14161a 100%)",
      heroInk: "#f6f5f2",
      heroSoft: "rgba(246,245,242,0.66)",
      border: "rgba(22,24,29,0.12)",
      star: "#e8590c",
    },
    eyebrow: "Auto Repair & Service",
    headline: () => "Honest repairs. Straight answers. Back on the road.",
    sub: (name, city) =>
      `${name} keeps ${city} drivers moving — diagnostics, brakes, tires, and the repair your check-engine light keeps hinting at. No upsell, no runaround.`,
    servicesHeading: "In the bay",
    servicesIntro: (city) =>
      `From a quick oil change to a job you've been putting off — one shop, one call, done right for ${city}.`,
    services: [
      { icon: "gauge", title: "Diagnostics", desc: "Check-engine lights, weird noises, won't-start mornings — we find the real cause before you pay for parts." },
      { icon: "brake", title: "Brakes", desc: "Pads, rotors, lines, and that grinding you've been turning the radio up over." },
      { icon: "oil", title: "Oil & Fluids", desc: "Fast oil changes plus coolant, transmission, and brake fluid services that keep engines alive past 200k." },
      { icon: "tire", title: "Tires & Alignment", desc: "Mounting, balancing, rotation, and repairs — KC potholes don't stand a chance." },
      { icon: "battery", title: "Battery & Electrical", desc: "Testing, replacement, alternators, and starters — especially before the next Missouri cold snap." },
      { icon: "wrench", title: "General Repair", desc: "Suspension, steering, AC and heat, belts and hoses — the everything-else your car will eventually need." },
    ],
    ctaLabel: "Call the shop",
    finalLine: (name, city) =>
      `One call and your car's in good hands — ${name}, right here in ${city}.`,
  },

  // ── Nail salon ────────────────────────────────────────────────────────
  {
    key: "nails",
    match: ["nail salon", "nail"],
    label: "Nail Salon",
    font: "serif",
    mood: "light",
    vars: {
      bg: "#fdf6f3",
      bg2: "#f8ebe6",
      surface: "#ffffff",
      ink: "#3d2530",
      inkSoft: "#8c6a76",
      accent: "#b4536d",
      accentInk: "#ffffff",
      heroBg:
        "radial-gradient(80% 90% at 15% 10%, rgba(180,83,109,0.14), transparent 60%), radial-gradient(70% 60% at 90% 90%, rgba(214,150,134,0.18), transparent 65%), linear-gradient(170deg, #fdf6f3 0%, #f9ece8 100%)",
      heroInk: "#3d2530",
      heroSoft: "#8c6a76",
      border: "rgba(61,37,48,0.12)",
      star: "#b4536d",
    },
    eyebrow: "Nails & Self-Care",
    headline: () => "Fresh sets, clean lines, zero rush.",
    sub: (name, city) =>
      `${name} is where ${city} comes to sit back for an hour and leave with nails that get noticed. Walk-ins and appointments alike.`,
    servicesHeading: "The menu",
    servicesIntro: (city) =>
      `Classic to statement — every service finished with the detail ${city} regulars come back for.`,
    services: [
      { icon: "polish", title: "Manicures", desc: "Classic, gel, and dip powder — shaped, buffed, and polished to last well past payday." },
      { icon: "flower", title: "Pedicures", desc: "Soak, scrub, massage, polish. The hour of the week that's entirely yours." },
      { icon: "sparkle", title: "Full Sets & Fills", desc: "Acrylic and gel extensions in any length and shape — natural to dramatic." },
      { icon: "heart", title: "Nail Art", desc: "French tips, chrome, ombre, hand-drawn detail — bring a photo, leave with the real thing." },
      { icon: "hand", title: "Hand & Foot Care", desc: "Callus care, paraffin, and massage add-ons that make the basics feel like a spa day." },
      { icon: "gift", title: "Group & Special Occasions", desc: "Weddings, birthdays, girls' day — book chairs together and celebrate properly." },
    ],
    ctaLabel: "Call to book",
    finalLine: (name, city) =>
      `Your next set is one call away — ${name} in ${city}.`,
  },

  // ── Hair salon / barber / beauty ──────────────────────────────────────
  {
    key: "hair",
    match: ["hair salon", "barber", "beauty salon", "hairdresser", "hair studio", "stylist"],
    label: "Hair & Beauty",
    font: "serif",
    mood: "dark",
    vars: {
      bg: "#faf7f2",
      bg2: "#f1ece3",
      surface: "#ffffff",
      ink: "#2b2118",
      inkSoft: "#7a6a58",
      accent: "#a07a3f",
      accentInk: "#ffffff",
      heroBg:
        "radial-gradient(85% 80% at 80% 10%, rgba(160,122,63,0.28), transparent 60%), linear-gradient(160deg, #241b13 0%, #322619 60%, #1f1710 100%)",
      heroInk: "#f7f1e6",
      heroSoft: "rgba(247,241,230,0.65)",
      border: "rgba(43,33,24,0.12)",
      star: "#a07a3f",
    },
    eyebrow: "Hair & Beauty",
    headline: () => "Walk out feeling like the upgraded you.",
    sub: (name, city) =>
      `${name} — where ${city} gets cut, colored, and cared for by people who actually listen to what you asked for.`,
    servicesHeading: "In the chair",
    servicesIntro: (city) =>
      `Precision cuts to full transformations — the work speaks for itself all over ${city}.`,
    services: [
      { icon: "scissors", title: "Cuts & Styling", desc: "Precision cuts, fades, layers, and trims — for every texture and every age in the family." },
      { icon: "sparkle", title: "Color", desc: "Balayage, highlights, full color, and gray coverage that looks grown-in, not painted-on." },
      { icon: "comb", title: "Blowouts & Finishing", desc: "Event-ready styling, smoothing treatments, and the kind of blowout that survives the week." },
      { icon: "heart", title: "Treatments", desc: "Deep conditioning, scalp care, and repair for hair that's been through it." },
      { icon: "calendar", title: "Special Occasions", desc: "Weddings, proms, photos — show up with hair that holds from first look to last dance." },
      { icon: "star", title: "The Regular", desc: "Find your person, keep your look — standing appointments for clients who never want to explain it twice." },
    ],
    ctaLabel: "Call to book",
    finalLine: (name, city) =>
      `Good hair days start with one call — ${name} in ${city}.`,
  },

  // ── Lawn care / landscaping ───────────────────────────────────────────
  {
    key: "lawn",
    match: ["lawn", "landscap", "yard", "mowing", "tree service", "gardener"],
    label: "Lawn & Landscape",
    font: "industrial",
    mood: "dark",
    vars: {
      bg: "#f6f7f2",
      bg2: "#ecefe4",
      surface: "#ffffff",
      ink: "#1c2a1d",
      inkSoft: "#5e6e58",
      accent: "#3f7d33",
      accentInk: "#ffffff",
      heroBg:
        "radial-gradient(90% 75% at 85% 5%, rgba(141,198,63,0.25), transparent 55%), linear-gradient(165deg, #1c2a1d 0%, #27392a 60%, #16241a 100%)",
      heroInk: "#f3f7ec",
      heroSoft: "rgba(243,247,236,0.68)",
      border: "rgba(28,42,29,0.12)",
      star: "#3f7d33",
    },
    eyebrow: "Lawn Care & Landscaping",
    headline: () => "A lawn the neighbors notice.",
    sub: (name, city) =>
      `${name} keeps ${city} yards mowed, edged, and season-ready — without you giving up another Saturday.`,
    servicesHeading: "On the schedule",
    servicesIntro: (city) =>
      `Weekly upkeep to full cleanups — built around the Missouri seasons ${city} lawns actually live through.`,
    services: [
      { icon: "mower", title: "Mowing & Edging", desc: "Sharp lines, clean edges, on a schedule you never have to think about." },
      { icon: "leaf", title: "Seasonal Cleanups", desc: "Spring and fall cleanups, leaf removal, and bed refreshes that reset the whole yard." },
      { icon: "tree", title: "Trimming & Pruning", desc: "Shrubs, hedges, and small trees shaped before they take over the windows." },
      { icon: "shovel", title: "Mulch & Beds", desc: "Fresh mulch, defined beds, and plantings that make the front walk look intentional." },
      { icon: "droplet", title: "Fertilizing & Weed Control", desc: "Thicker, greener turf that crowds the weeds out instead of fighting them all summer." },
      { icon: "home", title: "Property Upkeep", desc: "Rentals, listings, and home sales — keep every property photo-ready year round." },
    ],
    ctaLabel: "Call for a quote",
    finalLine: (name, city) =>
      `Get on the route — ${name} is already working ${city}.`,
  },

  // ── Plumber ───────────────────────────────────────────────────────────
  {
    key: "plumber",
    match: ["plumb", "drain", "sewer", "water heater"],
    label: "Plumbing",
    font: "industrial",
    mood: "dark",
    vars: {
      bg: "#f3f6f8",
      bg2: "#e8eef2",
      surface: "#ffffff",
      ink: "#13283a",
      inkSoft: "#56707f",
      accent: "#1273b5",
      accentInk: "#ffffff",
      heroBg:
        "radial-gradient(90% 70% at 80% 0%, rgba(63,169,245,0.22), transparent 60%), linear-gradient(165deg, #13283a 0%, #1b3850 60%, #102233 100%)",
      heroInk: "#f1f6fa",
      heroSoft: "rgba(241,246,250,0.66)",
      border: "rgba(19,40,58,0.12)",
      star: "#1273b5",
    },
    eyebrow: "Plumbing Services",
    headline: () => "Plumbing problems don't wait. Neither do we.",
    sub: (name, city) =>
      `${name} handles ${city}'s leaks, clogs, and no-hot-water mornings — fixed right the first time, cleaned up before we leave.`,
    servicesHeading: "What we fix",
    servicesIntro: (city) =>
      `Drips to full repipes — licensed work for ${city} homes and businesses.`,
    services: [
      { icon: "droplet", title: "Leak Repair", desc: "Faucets, supply lines, slab leaks — found fast, fixed clean, before the water bill tells on it." },
      { icon: "pipe", title: "Drain Cleaning", desc: "Slow sinks, backed-up tubs, main-line clogs — cleared properly, not just plunged into next week." },
      { icon: "flame", title: "Water Heaters", desc: "Repair and replacement, tank and tankless — hot showers back on schedule." },
      { icon: "bath", title: "Fixtures & Remodels", desc: "Toilets, faucets, disposals, and bathroom/kitchen rough-in done to code." },
      { icon: "valve", title: "Gas & Supply Lines", desc: "Gas line work, shut-off valves, and pressure issues handled by people licensed to touch them." },
      { icon: "shield", title: "Emergency Calls", desc: "Burst pipe at the worst possible time? Call — that's the job." },
    ],
    ctaLabel: "Call a plumber",
    finalLine: (name, city) =>
      `Save the number before you need it — ${name}, serving ${city}.`,
  },

  // ── Bakery / cake shop ────────────────────────────────────────────────
  {
    key: "bakery",
    match: ["bakery", "cake", "pastry", "donut", "doughnut", "dessert"],
    label: "Bakery",
    font: "serif",
    mood: "light",
    vars: {
      bg: "#fdf8f0",
      bg2: "#f7ecdc",
      surface: "#ffffff",
      ink: "#42301f",
      inkSoft: "#8d7458",
      accent: "#b9772e",
      accentInk: "#ffffff",
      heroBg:
        "radial-gradient(75% 85% at 12% 12%, rgba(185,119,46,0.16), transparent 60%), radial-gradient(70% 60% at 90% 85%, rgba(224,170,98,0.2), transparent 65%), linear-gradient(170deg, #fdf8f0 0%, #f8eedd 100%)",
      heroInk: "#42301f",
      heroSoft: "#8d7458",
      border: "rgba(66,48,31,0.12)",
      star: "#b9772e",
    },
    eyebrow: "Fresh-Baked Daily",
    headline: () => "Baked this morning. Gone by noon.",
    sub: (name, city) =>
      `${name} bakes the kind of thing ${city} crosses town for — come early, the good stuff doesn't sit around.`,
    servicesHeading: "From the oven",
    servicesIntro: (city) =>
      `Everyday treats to once-a-year showpieces — made from scratch for ${city}.`,
    services: [
      { icon: "bread", title: "Breads & Pastries", desc: "Fresh loaves, rolls, and flaky pastries pulled from the oven every morning." },
      { icon: "cake", title: "Custom Cakes", desc: "Birthdays, weddings, quinceañeras — bring the idea, we'll bake the centerpiece." },
      { icon: "cookie", title: "Cookies & Treats", desc: "By the piece or by the dozen — the box that disappears before it gets home." },
      { icon: "coffee", title: "Morning Stop", desc: "Something warm with your coffee on the way in — the best meeting prep there is." },
      { icon: "gift", title: "Special Orders", desc: "Holiday pies, party trays, office boxes — order ahead and skip the morning gamble." },
      { icon: "calendar", title: "Events & Catering", desc: "Dessert tables and bulk orders for showers, graduations, and everything worth celebrating." },
    ],
    ctaLabel: "Call in an order",
    finalLine: (name, city) =>
      `Order ahead or take your chances — ${name} in ${city}.`,
  },

  // ── Restaurant ────────────────────────────────────────────────────────
  {
    key: "restaurant",
    match: ["restaurant", "bar & grill", "steak house", "diner", "cafe", "grill", "bbq", "barbecue", "taqueria", "pizzeria", "bistro", "eatery", "food"],
    label: "Restaurant",
    font: "serif",
    mood: "dark",
    vars: {
      bg: "#faf6f1",
      bg2: "#f2ebe1",
      surface: "#ffffff",
      ink: "#27211a",
      inkSoft: "#776a5a",
      accent: "#b3471e",
      accentInk: "#ffffff",
      heroBg:
        "radial-gradient(85% 75% at 85% 5%, rgba(230,126,67,0.24), transparent 60%), linear-gradient(165deg, #221c15 0%, #31271c 60%, #1d1812 100%)",
      heroInk: "#f8f2e9",
      heroSoft: "rgba(248,242,233,0.66)",
      border: "rgba(39,33,26,0.12)",
      star: "#b3471e",
    },
    eyebrow: "Local Kitchen",
    headline: () => "Good food, close to home.",
    sub: (name, city) =>
      `${name} is the ${city} spot for plates that taste like somebody actually cooks here — because somebody does.`,
    servicesHeading: "Why people come back",
    servicesIntro: (city) =>
      `The kind of place ${city} keeps in rotation — here's what to expect.`,
    services: [
      { icon: "plate", title: "Made to Order", desc: "Cooked when you order it, not held under a lamp — the difference you can taste." },
      { icon: "bowl", title: "House Favorites", desc: "The dishes regulars don't even open the menu for. Ask what's moving today." },
      { icon: "clock", title: "Lunch & Dinner", desc: "Quick lunch turnaround when you're on the clock, easy pace when you're not." },
      { icon: "chat", title: "Takeout", desc: "Call it in, pick it up hot — dinner solved on the way home." },
      { icon: "heart", title: "Family Friendly", desc: "Bring the kids, bring the crew — tables for two or twelve." },
      { icon: "calendar", title: "Groups & Gatherings", desc: "Birthdays, team lunches, after-the-game crowds — call ahead and we'll set you up." },
    ],
    ctaLabel: "Call the kitchen",
    finalLine: (name, city) =>
      `Tonight's dinner question, answered — ${name} in ${city}.`,
  },

  // ── Boutique / clothing ───────────────────────────────────────────────
  {
    key: "boutique",
    match: ["boutique", "clothing", "dress store", "apparel", "fashion"],
    label: "Boutique",
    font: "serif",
    mood: "light",
    vars: {
      bg: "#faf8f5",
      bg2: "#f1ede7",
      surface: "#ffffff",
      ink: "#211d1a",
      inkSoft: "#6f675e",
      accent: "#b05c3b",
      accentInk: "#ffffff",
      heroBg:
        "radial-gradient(70% 80% at 88% 15%, rgba(176,92,59,0.13), transparent 60%), linear-gradient(172deg, #faf8f5 0%, #f2ece4 100%)",
      heroInk: "#211d1a",
      heroSoft: "#6f675e",
      border: "rgba(33,29,26,0.12)",
      star: "#b05c3b",
    },
    eyebrow: "Shop Local",
    headline: () => "Style you won't see on everyone else.",
    sub: (name, city) =>
      `${name} hand-picks pieces for ${city} — small batches, real fitting-room honesty, and finds the big-box stores never carry.`,
    servicesHeading: "In the shop",
    servicesIntro: (city) =>
      `Curated racks that turn over fast — what ${city} shops here for.`,
    services: [
      { icon: "hanger", title: "New Arrivals", desc: "Fresh pieces landing all the time — when it's gone, it's gone, so follow along and come in early." },
      { icon: "sparkle", title: "Curated Looks", desc: "Outfits picked to work together, not a warehouse of maybes — styled help included." },
      { icon: "tag", title: "Accessories", desc: "Jewelry, bags, and the finishing touches that make an outfit yours." },
      { icon: "heart", title: "Honest Fit Advice", desc: "A real person in the fitting room telling you the truth — that's the boutique difference." },
      { icon: "gift", title: "Gifts", desc: "Birthday, thank-you, just-because — wrapped and ready, no mall required." },
      { icon: "calendar", title: "Event Dressing", desc: "Weddings, date nights, game day — come in with the occasion, leave with the look." },
    ],
    ctaLabel: "Call the shop",
    finalLine: (name, city) =>
      `Come see what just came in — ${name} in ${city}.`,
  },

  // ── Contractor / construction / remodel / handyman ────────────────────
  {
    key: "contractor",
    match: ["contractor", "construction", "remodel", "handyman", "handywoman", "handyperson", "renovation", "restoration", "roofing", "builder", "kitchen remodeler"],
    label: "Contracting & Remodeling",
    font: "industrial",
    mood: "dark",
    vars: {
      bg: "#f5f5f3",
      bg2: "#ebebe6",
      surface: "#ffffff",
      ink: "#23262b",
      inkSoft: "#62666e",
      accent: "#d9930d",
      accentInk: "#1d1a10",
      heroBg:
        "radial-gradient(90% 70% at 85% 0%, rgba(217,147,13,0.22), transparent 60%), linear-gradient(165deg, #23262b 0%, #2e3239 60%, #1d2025 100%)",
      heroInk: "#f5f4f0",
      heroSoft: "rgba(245,244,240,0.66)",
      border: "rgba(35,38,43,0.12)",
      star: "#d9930d",
    },
    eyebrow: "Contracting & Remodeling",
    headline: () => "Built right the first time.",
    sub: (name, city) =>
      `${name} takes ${city} projects from "we should really fix that" to finished — on a real timeline, with a real person answering the phone.`,
    servicesHeading: "On the job",
    servicesIntro: (city) =>
      `Punch lists to full remodels — work ${city} homeowners don't have to redo.`,
    services: [
      { icon: "home", title: "Remodels", desc: "Kitchens, bathrooms, basements — the rooms that change how the whole house lives." },
      { icon: "hammer", title: "Repairs & Punch Lists", desc: "The list on the fridge — drywall, doors, trim, fixtures — knocked out in one visit." },
      { icon: "ruler", title: "Carpentry & Trim", desc: "Framing, built-ins, decks, and finish work that's square, level, and meant to stay that way." },
      { icon: "paint", title: "Paint & Finish", desc: "Interior and exterior finishes that make old rooms read brand new." },
      { icon: "shield", title: "Done to Code", desc: "Permitted, inspected, insured — work that protects the house and the resale value." },
      { icon: "calendar", title: "Estimates & Scheduling", desc: "Clear scope, clear price, clear start date — then we actually show up." },
    ],
    ctaLabel: "Call for an estimate",
    finalLine: (name, city) =>
      `That project isn't fixing itself — ${name}, working ${city} now.`,
  },

  // ── Pet groomer ───────────────────────────────────────────────────────
  {
    key: "petgroomer",
    match: ["pet groom", "dog groom", "grooming", "paw", "pet salon", "pet spa"],
    label: "Pet Grooming",
    font: "rounded",
    mood: "light",
    vars: {
      bg: "#f4faf9",
      bg2: "#e7f3f1",
      surface: "#ffffff",
      ink: "#1f3d3a",
      inkSoft: "#5d8079",
      accent: "#13937e",
      accentInk: "#ffffff",
      heroBg:
        "radial-gradient(75% 85% at 12% 10%, rgba(19,147,126,0.13), transparent 60%), radial-gradient(65% 60% at 90% 88%, rgba(240,138,93,0.16), transparent 65%), linear-gradient(170deg, #f4faf9 0%, #e9f4f1 100%)",
      heroInk: "#1f3d3a",
      heroSoft: "#5d8079",
      border: "rgba(31,61,58,0.12)",
      star: "#f08a5d",
    },
    eyebrow: "Pet Grooming",
    headline: () => "Fresh cuts. Happy tails.",
    sub: (name, city) =>
      `${name} sends ${city} dogs home smelling great and strutting like they know it — gentle handling, breed-right cuts, no cattle-call kennels.`,
    servicesHeading: "The works",
    servicesIntro: (city) =>
      `Quick tidy-ups to the full spa day — every coat and temperament in ${city} welcome.`,
    services: [
      { icon: "scissors", title: "Full Grooms", desc: "Bath, cut, brush-out, nails, ears — the head-to-tail package that resets the whole dog." },
      { icon: "bath", title: "Bath & Brush", desc: "Deshed, deep-clean, and blow-dry between haircuts — goodbye, couch fur." },
      { icon: "paw", title: "Nail Trims", desc: "Quick, calm nail care — no more clicking across the kitchen floor." },
      { icon: "heart", title: "Gentle Handling", desc: "Nervous pups, seniors, and first-timers get the patience they need, not a rushed table." },
      { icon: "sparkle", title: "Breed Cuts & Styles", desc: "Doodle teddy bears to show-ready trims — cuts that fit the breed and your brushing schedule." },
      { icon: "bone", title: "Add-On Treats", desc: "Teeth brushing, paw balm, seasonal bandanas — the little extras that finish the look." },
    ],
    ctaLabel: "Call to book",
    finalLine: (name, city) =>
      `Your dog already loves car rides — ${name} in ${city} makes them worth it.`,
  },

  // ── Generic fallback ──────────────────────────────────────────────────
  {
    key: "generic",
    match: [],
    label: "Local Business",
    font: "sans",
    mood: "dark",
    vars: {
      bg: "#f6f6f8",
      bg2: "#ececf1",
      surface: "#ffffff",
      ink: "#1d2030",
      inkSoft: "#5e6276",
      accent: "#4453c6",
      accentInk: "#ffffff",
      heroBg:
        "radial-gradient(90% 70% at 85% 0%, rgba(110,126,235,0.22), transparent 60%), linear-gradient(165deg, #1d2030 0%, #272b40 60%, #181b29 100%)",
      heroInk: "#f4f4f8",
      heroSoft: "rgba(244,244,248,0.66)",
      border: "rgba(29,32,48,0.12)",
      star: "#4453c6",
    },
    eyebrow: "Local & Trusted",
    headline: (name) => `${name} — the local pick, for a reason.`,
    sub: (name, city) =>
      `${city} keeps choosing ${name}, and the Google reviews show it. Real people, real work, one phone call away.`,
    servicesHeading: "Why locals choose us",
    servicesIntro: (city) =>
      `The basics, done right — that's what keeps ${city} coming back.`,
    services: [
      { icon: "phone", title: "A Real Person Answers", desc: "Call and talk to someone who can actually help — no phone tree, no callback queue." },
      { icon: "star", title: "Earned Reputation", desc: "The rating up top isn't ours — it's what real customers said on Google." },
      { icon: "mappin", title: "Actually Local", desc: "Based right here, serving neighbors — your money stays in the community." },
      { icon: "check", title: "Straightforward Pricing", desc: "Know what it costs before the work starts. No surprises on the invoice." },
      { icon: "clock", title: "On Time", desc: "Your time matters — we show up when we said we would." },
      { icon: "heart", title: "Treated Like a Neighbor", desc: "Because you are one. Small-business service the big chains can't fake." },
    ],
    ctaLabel: "Give us a call",
    finalLine: (name, city) =>
      `Local looks good on you — ${name}, serving ${city}.`,
  },
];

export const GENERIC_THEME = THEMES[THEMES.length - 1];

/** {key,label} for every theme — powers the Launchpad Work Order category select. */
export const DEMO_THEME_OPTIONS: { key: string; label: string }[] = THEMES.map(
  (t) => ({ key: t.key, label: t.label }),
);

/** Look a theme up by its exact key (Storefront.category), generic fallback. */
export function themeForKey(key: string | null | undefined): DemoTheme {
  if (!key) return GENERIC_THEME;
  return THEMES.find((t) => t.key === key) ?? GENERIC_THEME;
}

/** Pick the best theme for a lead's Google category string. */
export function themeForCategory(category: string | null | undefined): DemoTheme {
  if (!category) return GENERIC_THEME;
  const c = category.toLowerCase();
  for (const theme of THEMES) {
    if (theme.match.some((m) => c.includes(m))) return theme;
  }
  return GENERIC_THEME;
}

/** "(816) 483-0469" → "+18164830469" for tel:/sms: links; null if unusable. */
export function phoneToE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/** City with a friendly fallback so copy never reads "in null". */
export function cityOrMetro(city: string | null | undefined): string {
  const c = city?.trim();
  return c && c.length > 0 ? c : "the KC metro";
}

/** Key-less Google Maps embed URL for an address. */
export function mapsEmbedUrl(address: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
}

export function mapsLinkUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
