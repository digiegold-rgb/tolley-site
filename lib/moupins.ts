export const MP_BRAND = "Maupin's Junk Removal";
export const MP_TAGLINE = "Junk Removal & Moving Services";
export const MP_PHONE = "816-442-2483";
export const MP_PHONE_TEL = "tel:+18164422483";
export const MP_SMS = "sms:+18164422483?body=Hey%20I%20need%20a%20quote%20for%20junk%20removal";
export const MP_OWNER = "Maupin";
export const MP_AREA = "Kansas City Metro";

export const MP_SERVICES = [
  {
    title: "Junk Removal",
    emoji: "\u{1F69A}",
    description:
      "Garage cleanouts, yard waste, old furniture, broken appliances — you point, we haul. Same-day removal available.",
    items: [
      "Garage cleanouts",
      "Old furniture",
      "Yard debris",
      "Broken appliances",
      "Construction waste",
      "Estate cleanouts",
    ],
  },
  {
    title: "Moving Services",
    emoji: "\u{1F4E6}",
    description:
      "Local moves, apartment moves, single-item pickups. We handle the heavy lifting so you don't have to.",
    items: [
      "Local moves",
      "Apartment moves",
      "Single-item moves",
      "Heavy lifting",
      "Load & unload",
      "Storage runs",
    ],
  },
  {
    title: "Appliance Removal",
    emoji: "\u{1F9CA}",
    description:
      "Fridges, washers, dryers, stoves, water heaters — we'll disconnect, haul, and dispose responsibly.",
    items: [
      "Refrigerators",
      "Washers & dryers",
      "Stoves & ovens",
      "Water heaters",
      "Dishwashers",
      "AC units",
    ],
  },
  {
    title: "Yard & Outdoor Cleanup",
    emoji: "\u{1F333}",
    description:
      "Brush piles, old fencing, sheds, hot tubs, play equipment — if it's in the yard and you want it gone, call us.",
    items: [
      "Brush & branches",
      "Old fencing",
      "Shed teardown",
      "Hot tub removal",
      "Swing sets",
      "Deck demo",
    ],
  },
] as const;

export const MP_WHY = [
  {
    title: "Free Quotes",
    emoji: "\u{1F4AC}",
    description: "Message us with what you've got. No obligation, no pressure.",
  },
  {
    title: "Same-Day Removal",
    emoji: "\u{26A1}",
    description: "Message early, we'll be there today. Fast turnaround.",
  },
  {
    title: "Fair & Honest Pricing",
    emoji: "\u{1F4B5}",
    description: "We price by the job, not the hour. No hidden fees.",
  },
  {
    title: "We Do the Heavy Lifting",
    emoji: "\u{1F4AA}",
    description: "You relax. We load, haul, and clean up after ourselves.",
  },
] as const;

export const MP_FAQ = [
  {
    q: "How much does junk removal cost?",
    a: "It depends on the size and type of load. Message us a photo of what you need hauled and we'll give you a free quote right away.",
  },
  {
    q: "Do you offer same-day service?",
    a: "Yes! If you message us early enough, we can usually get to you the same day. We hustle.",
  },
  {
    q: "What do you take?",
    a: "Almost everything — furniture, appliances, yard waste, construction debris, electronics, mattresses, hot tubs, sheds. If you're not sure, just ask.",
  },
  {
    q: "Do you do moves too?",
    a: "Absolutely. Local moves, apartment moves, or just moving a few heavy items across town. We've got the muscle and the truck.",
  },
  {
    q: "How do I get a quote?",
    a: "Just message us at 816-442-2483. Send a photo if you can — makes it faster. We'll get back to you with a price ASAP.",
  },
  {
    q: "What areas do you serve?",
    a: "All of Kansas City metro — Independence, Lee's Summit, Blue Springs, Raytown, Grandview, Belton, and surrounding areas.",
  },
  {
    q: "Do you recycle or donate items?",
    a: "Whenever possible, yes. Usable items get donated, metals get recycled. We try to keep as much out of the landfill as we can.",
  },
] as const;

export const MP_GALLERY_PLACEHOLDERS = [
  { alt: "Before & after garage cleanout", slot: 1 },
  { alt: "Truck loaded with junk removal haul", slot: 2 },
  { alt: "Appliance removal in progress", slot: 3 },
  { alt: "Yard cleanup finished", slot: 4 },
  { alt: "Moving day action shot", slot: 5 },
  { alt: "Happy customer thumbs up", slot: 6 },
] as const;
