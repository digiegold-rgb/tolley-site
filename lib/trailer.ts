export const TR_CONTACT_PHONE = "913-283-3826";
export const TR_CONTACT_EMAIL = "Jared@yourkchomes.com";
export const TR_FACEBOOK_URL = "https://www.facebook.com/share/18HRnGFpCc/?mibextid=wwXIfr";
export const TR_BRAND = "Trailer Rental";
export const TR_COMPANY = "Your KC Homes LLC";

export const TR_TRAILERS = [
  {
    name: "20ft Utility Trailer",
    size: "20 ft",
    capacity: "7,000 lbs",
    axles: "Dual Axle",
    pricing: { day: 98, week: 280, month: 840 },
    features: [
      "Detachable car ramps",
      "Wood deck floor",
      "Multiple tie-down points",
      "Heavy-duty frame",
      '2" ball hitch',
    ],
    images: [
      "/trailer/20/20-1.jpg",
      "/trailer/20/20-2.jpg",
      "/trailer/20/20-3.jpg",
      "/trailer/20/20-4.jpg",
      "/trailer/20/20-5.jpg",
      "/trailer/20/20-7.jpg",
    ],
    facebookUrl: "https://www.facebook.com/share/18HRnGFpCc/?mibextid=wwXIfr",
  },
  {
    name: "18ft Dual Axle Utility",
    size: "18 ft",
    capacity: "7,000 lbs",
    axles: "Dual Axle",
    pricing: { day: 98, week: 280, month: 840 },
    features: [
      "Detachable car ramps",
      "Wood deck floor",
      "Multiple tie-down points",
      "Easy hookup",
      '2" ball hitch',
    ],
    images: [
      "/trailer/18/18-1.jpg",
      "/trailer/18/18-2.jpg",
      "/trailer/18/18-3.jpg",
      "/trailer/18/18-4.jpg",
      "/trailer/18/18-5.jpg",
      "/trailer/18/18-6.jpg",
      "/trailer/18/18-7.jpg",
    ],
    facebookUrl: "https://www.facebook.com/share/1BgWyv6t1Q/?",
  },
  {
    name: "16ft Utility Trailer",
    size: "16 ft",
    capacity: "2,500 lbs",
    axles: "Single Axle",
    pricing: { day: 68, week: 180, month: 360 },
    features: [
      "Fold-down ramp gate",
      "Wood deck floor",
      "Multiple tie-down points",
      "Lightweight & easy to tow",
      '2" ball hitch',
    ],
    images: [
      "/trailer/16/16-1.jpg",
      "/trailer/16/16-2.jpg",
      "/trailer/16/16-3.jpg",
      "/trailer/16/16-4.jpg",
      "/trailer/16/16-5.jpg",
      "/trailer/16/16-6.jpg",
    ],
    facebookUrl: "",
  },
  {
    name: "20ft Car Hauler",
    size: "20 ft",
    capacity: "10,000 lbs",
    axles: "Dual Axle",
    pricing: { day: 228, week: 684, month: 1368 },
    features: [
      "Solid steel build by STAR (1988)",
      "Completely refurbished",
      "Dual 5,600 lb axles",
      "Winch included",
      '4" tie-down straps',
      '2" ball hitch',
      "Perfect for cross-country hauls",
    ],
    images: [] as string[],
    facebookUrl: "",
  },
] as const;
