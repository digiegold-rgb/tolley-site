// Tolley Haul & Clean — the unified hauling / cleanout / moving / transport
// brand for Your KC Homes LLC. One crew, one number: cleanouts, junk & trash
// removal, furniture moving, and car / truck / equipment transport — backed by
// a fleet of utility trailers and a 10,000 lb car hauler.
//
// Angle that ties it together:
//   • Run by a LICENSED Missouri real estate agent + a trusted full-time crew.
//   • One call clears it, hauls it, or moves it — flat quote, given in person.
//   • Anything with resale value comes off your bill (resale flows into /shop).
//   • Delivery / transport runs $3 a loaded mile.
//
// Shares the business line used across lib/cleanouts.ts, lib/trailer.ts,
// lib/wd.ts, lib/moving.ts. Quote form posts to /api/cleanouts/quote.

export const CL_PHONE = "913-283-3826";
export const CL_PHONE_TEL = "tel:+19132833826";
export const CL_PHONE_SMS = "sms:+19132833826";
export const CL_EMAIL = "Jared@yourkchomes.com";

export const CL_BRAND = "Tolley Haul & Clean";
export const CL_COMPANY = "Your KC Homes LLC";
export const CL_AREA = "Kansas City Metro";
export const CL_PER_MILE = "$3";

// ── Trust chips under the hero ───────────────────────────────────────────
export const CL_TRUST: string[] = [
  "Licensed MO real estate agent",
  "Locally owned · KC metro",
  "Free quotes, no surprises",
  "$3 / loaded mile delivery",
];

// ── Services ─────────────────────────────────────────────────────────────
export interface ClService {
  title: string;
  tag: string;
  desc: string;
  image: string;
  points: string[];
}

export const CL_SERVICES: ClService[] = [
  {
    title: "Junk & Trash Removal",
    tag: "Haul-away",
    desc: "One pile or a whole property — we load it, sweep up, and haul it off the same visit. No dumpster to rent, no second trip.",
    image: "/lastmile/trailer-clean.jpg",
    points: [
      "Furniture, appliances, mattresses, yard debris",
      "We do the lifting and loading",
      "Broom-clean when we leave",
    ],
  },
  {
    title: "Estate & Rental Cleanouts",
    tag: "Whole-property",
    desc: "Full houses, rentals between tenants, garages and basements cleared to bare walls in one visit — handled respectfully, with before/after photos.",
    image: "/moving/mv-1.jpg",
    points: [
      "Estate, foreclosure & hoarding-scale jobs",
      "Rental turnovers ready for paint & carpet",
      "Resale value credited off your bill",
    ],
  },
  {
    title: "Moving & Furniture Hauling",
    tag: "Local moves",
    desc: "Need a couch, a bedroom set, or a few rooms moved across town? Our crew, truck, and trailers move it without the full-day moving-company price.",
    image: "/moving/mv-3.jpg",
    points: [
      "Single items to full apartments",
      "Blankets, straps & dollies on the truck",
      "Furniture protected and tied down",
    ],
  },
  {
    title: "Car, Truck & Equipment Transport",
    tag: "10,000 lb car hauler",
    desc: "A refurbished STAR car hauler with a winch and 4\" straps. We move running or dead vehicles, project cars, and heavy equipment — local or cross-country.",
    image: "/lastmile/car-haul.jpg",
    points: [
      "Cars, trucks, ATVs, project & non-runners",
      "Bobcats, mowers, pallets & jobsite gear",
      "Winch-loaded and strapped down right",
    ],
  },
  {
    title: "Trailer & Equipment Rental",
    tag: "DIY option",
    desc: "Rather do it yourself? Rent the same gear we use — 16ft, 18ft, and 20ft utility trailers plus the car hauler — by the day, week, or month.",
    image: "/trailer/20/20-1.jpg",
    points: [
      "16ft / 18ft / 20ft utility trailers",
      "20ft car hauler up to 10,000 lbs",
      "No plates needed · all payments accepted",
    ],
  },
  {
    title: "Hauling & Delivery",
    tag: "$3 / loaded mile",
    desc: "Picked something up too big for your car? Marketplace find, lumber run, appliance, or jobsite drop — we deliver it for a flat $3 a loaded mile.",
    image: "/lastmile/lumber-delivery.jpg",
    points: [
      "Marketplace, auction & store pickups",
      "Materials, appliances & jobsite drops",
      "Flat $3 / loaded mile, quoted up front",
    ],
  },
];

// ── "The rigs" photo strip ───────────────────────────────────────────────
export interface ClShot {
  src: string;
  alt: string;
}

export const CL_GALLERY: ClShot[] = [
  { src: "/lastmile/car-haul.jpg", alt: "Vehicle loaded on our 20ft car hauler" },
  { src: "/lastmile/equipment-haul.jpg", alt: "Heavy equipment loaded for transport" },
  { src: "/lastmile/bobcat-pov.jpg", alt: "Bobcat skid-steer ready to load" },
  { src: "/lastmile/cargo-secured.jpg", alt: "Cargo strapped and secured on the trailer" },
  { src: "/lastmile/jared-pallet.jpg", alt: "Loading a palletized delivery" },
  { src: "/lastmile/warehouse-load.jpg", alt: "Loading freight at the warehouse" },
  { src: "/trailer/18/18-1.jpg", alt: "18ft dual-axle utility trailer" },
  { src: "/lastmile/trailer-clean.jpg", alt: "Trailer cleared and ready for the next job" },
];

// ── How it works ─────────────────────────────────────────────────────────
export interface ClStep {
  num: string;
  title: string;
  desc: string;
}

export const CL_STEPS: ClStep[] = [
  {
    num: "1",
    title: "Call or text 913-283-3826",
    desc: "Tell us what you've got — a pile, a full house, a move, or a vehicle to haul. Snap a few photos and text them over; that's the fastest way to a number.",
  },
  {
    num: "2",
    title: "We quote it in person, flat",
    desc: "For anything sizable we come look at it — free — and give you one flat price before we touch a thing. Resale value we spot gets credited off that number.",
  },
  {
    num: "3",
    title: "We clear it, move it, or haul it",
    desc: "One trip. We load, sweep up, and haul everything — or move and deliver it where it needs to go. Delivery runs a flat $3 a loaded mile.",
  },
];

// ── FAQ ──────────────────────────────────────────────────────────────────
export interface ClFaq {
  q: string;
  a: string;
}

export const CL_FAQ: ClFaq[] = [
  {
    q: "How do I get a price?",
    a: "Call or text 913-283-3826. For small loads we can often quote from photos; for cleanouts, moves, and transport we come look at it in person — free — and give you one flat number before any work starts.",
  },
  {
    q: "What does delivery and transport cost?",
    a: "Delivery and hauling run a flat $3 per loaded mile, quoted up front. Bigger jobs like cleanouts and moves are priced flat per job after a quick look, based on volume, access, and labor — never a surprise at the end.",
  },
  {
    q: "What can you haul?",
    a: "Just about anything: furniture, appliances, mattresses, trash and debris, whole-house cleanouts, moving loads, lumber and materials, and vehicles or heavy equipment on our 10,000 lb car hauler. Hazardous materials (paint, chemicals, asbestos) are the main exception and we'll point you to the right disposal.",
  },
  {
    q: "Who actually shows up?",
    a: "A local, full-time crew run by a licensed Missouri real estate agent — not a random day-labor truck. We treat your property like it's listed: careful, on time, and cleaned up when we leave.",
  },
  {
    q: "Do items with resale value lower my bill?",
    a: "Yes. On cleanouts and junk removal, anything with resale value we spot gets credited against your quote before you say yes. We resell it, you save — usable goods get donated, the rest is disposed of properly.",
  },
  {
    q: "Can I just rent the trailer instead?",
    a: "Absolutely. We rent 16ft, 18ft, and 20ft utility trailers plus the 20ft car hauler by the day, week, or month — no plates needed and all forms of payment accepted. Ask when you call.",
  },
];

// ── Service options for the quote form ───────────────────────────────────
export const CL_SERVICE_OPTIONS: string[] = [
  "Junk / trash removal",
  "Estate or rental cleanout",
  "Moving / furniture hauling",
  "Car / truck / equipment transport",
  "Delivery ($3/mile)",
  "Trailer rental",
  "Not sure yet",
];
