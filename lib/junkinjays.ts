export const JJ_BRAND = "Junkin' Jay's";
export const JJ_TAGLINE = "Scrap Metal Pickup & Junk Hauling";
export const JJ_PHONE = "816-206-2897";
export const JJ_PHONE_TEL = "tel:+18162062897";
export const JJ_OWNER = "Jay";
export const JJ_AREA = "Kansas City Metro";

export const JJ_SERVICES = [
  {
    title: "Scrap Metal Pickup",
    emoji: "\u{1F69A}",
    description: "We come to you and haul it away. Appliances, car parts, grills, lawn mowers, and more. Prices vary by job.",
    icon: "truck",
    items: ["Appliances", "Car parts", "Grills", "Lawn mowers", "Metal furniture", "Fencing & gates"],
  },
  {
    title: "Batteries & Metals",
    emoji: "\u{1F50B}",
    description: "Car batteries, lawn mower batteries, copper, brass, aluminum, and wire. Call for a quote.",
    icon: "battery",
    items: ["Car batteries", "Lawn mower batteries", "Copper wire", "Brass fittings", "Aluminum cans & scrap", "Insulated wire"],
  },
  {
    title: "Driveway & Snow Clearing",
    emoji: "\u{2744}\u{FE0F}",
    description: "Out with a shovel when the snow hits. Quick, reliable, and affordable driveway clearing.",
    icon: "snow",
    items: ["Driveway clearing", "Walkway clearing", "Salt & de-ice", "Same-day service"],
  },
  {
    title: "Junk Removal",
    emoji: "\u{1F5D1}\u{FE0F}",
    description: "Got a pile of junk? We'll sort it, haul it, and recycle what we can. You point, we load. Priced by the load.",
    icon: "junk",
    items: ["Garage cleanouts", "Yard debris", "Old equipment", "Construction scrap", "Estate cleanups"],
  },
] as const;

export const JJ_METALS = [
  { name: "Copper", emoji: "\u{1FA99}", note: "Highest value — pipes, wire, fittings" },
  { name: "Brass", emoji: "\u{1F527}", note: "Valves, faucets, plumbing fittings" },
  { name: "Aluminum", emoji: "\u{1F964}", note: "Cans, siding, window frames, wheels" },
  { name: "Steel & Iron", emoji: "\u{2699}\u{FE0F}", note: "Appliances, car parts, structural" },
  { name: "Batteries", emoji: "\u{1F50B}", note: "Car, truck, lawn mower, marine" },
  { name: "Wire", emoji: "\u{1F50C}", note: "Insulated & bare — all gauges" },
] as const;

export const JJ_WHY = [
  { title: "Free Quotes", emoji: "\u{1F4B0}", description: "Call or text for a no-obligation quote. No surprises." },
  { title: "Same-Day Service", emoji: "\u{26A1}", description: "Call before noon, we're there today." },
  { title: "Eco-Friendly", emoji: "\u{267B}\u{FE0F}", description: "Everything gets recycled properly. Zero landfill." },
  { title: "Licensed & Insured", emoji: "\u{2705}", description: "Professional service you can trust." },
] as const;

export const JJ_FAQ = [
  {
    q: "How much does scrap metal pickup cost?",
    a: "Prices vary by job — it depends on what you have, how much, and where you are. Call or text for a free quote. No obligation.",
  },
  {
    q: "What metals do you take?",
    a: "All of them. Steel, iron, aluminum, copper, brass, wire, batteries — if it's metal, we want it.",
  },
  {
    q: "Do you pick up appliances?",
    a: "Absolutely. Washers, dryers, fridges, stoves, dishwashers, water heaters, AC units — call for a quote.",
  },
  {
    q: "What about old cars or car parts?",
    a: "We take car parts, engines, transmissions, rims, and more. For whole vehicles, call us and we'll work it out.",
  },
  {
    q: "How fast can you come?",
    a: "Usually same day if you call before noon. Next day at the latest. We're always on the move.",
  },
  {
    q: "Do you do driveway snow clearing?",
    a: "Yes! When it snows, we're out with shovels. Call or text for a quick quote.",
  },
  {
    q: "What areas do you serve?",
    a: "All of Kansas City metro — Independence, Lee's Summit, Blue Springs, Raytown, Grandview, and surrounding areas.",
  },
] as const;
