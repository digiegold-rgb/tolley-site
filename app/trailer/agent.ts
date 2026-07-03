import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "trailer",
  title: "Enclosed Cargo Trailer Rental KC",
  purpose: "Same-day enclosed cargo trailer rental in the Kansas City metro for moves and hauls — 5x8, 6x12, and 7x14 sizes from $59/day, no hidden fees.",
  url: "/trailer",
  schemaType: "Service",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "trailer",
  shareEndpoint: "/api/share",
  mcpTools: ["get_trailer_fleet"],
  category: "marketing",
  status: "public",
  skipJsonLd: true,
  serviceArea: "Kansas City metro pickup (Independence, MO)",
  availability: "Same-day if booked before noon; weekend bookings encouraged 48hr ahead.",
  pricing: [
    { unit: "per day", amount: 59, currency: "USD", notes: "5x8 enclosed" },
    { unit: "per day", amount: 89, currency: "USD", notes: "6x12 enclosed" },
    { unit: "per day", amount: 119, currency: "USD", notes: "7x14 enclosed" }
  ],
  actions: [
    {
      verb: "book_trailer",
      description: "Reserve an enclosed cargo trailer for a date range. Creates a hold; we confirm by phone within an hour.",
      fields: {
        size: { type: "enum", required: true, enum: ["5x8", "6x12", "7x14"], description: "Trailer size" },
        pickup_date: { type: "date", required: true, example: "2026-05-15" },
        return_date: { type: "date", required: true, example: "2026-05-16" },
        zip: { type: "zip", required: true, description: "Pickup ZIP confirmation" }
      }
    }
  ]
};
