// Red Alert Dispatch, LLC — Last-Mile Delivery
// tolley.io/lastmile

export const LM_COMPANY = "Red Alert Dispatch, LLC";
export const LM_OWNER = "Jared";
export const LM_PHONE = "(913) 283-3826";
export const LM_PHONE_RAW = "9132833826";
export const LM_EMAIL = "Jared@yourkchomes.com";
export const LM_LOCATION = "Independence, MO";
export const LM_HOURS = "Weekdays, Weekends, Overnight";
export const LM_FACEBOOK = "https://www.facebook.com/share/1DK4HvKzh5/?mibextid=wwXIfr";
export const LM_MARKETPLACE =
  "https://www.facebook.com/marketplace/item/1392076332315968/";
export const LM_RATE = "$2/mile";
export const LM_DELIVERIES = "3,000+";
export const LM_STARS = 4.8;
export const LM_YEARS = "3+";

export const LM_PAYMENT_METHODS = [
  "Cash",
  "Cash App",
  "Venmo",
  "Apple Cash",
  "Tap-to-Pay",
  "Credit/Debit",
  "Stripe",
] as const;

export const LM_FLEET = [
  {
    name: "Honda Ridgeline",
    capacity: "Primary Vehicle",
    feature: "Daily driver — fast urban delivery",
    icon: "truck",
  },
  {
    name: "450 GMC Dually",
    capacity: "Heavy Towing",
    feature: "Max towing power for heavy loads",
    icon: "dually",
  },
  {
    name: '10x15ft Covered Trailer',
    capacity: "5,000 lbs",
    feature: "Weather-protected cargo",
    icon: "covered",
  },
  {
    name: "14ft Single Axle Utility",
    capacity: "3,500 lbs",
    feature: "Quick material runs",
    icon: "utility",
  },
  {
    name: "18ft Dual Axle Utility",
    capacity: "7,000 lbs",
    feature: "Bulk lumber & supply loads",
    icon: "utility",
  },
  {
    name: "20ft Dual Axle Utility",
    capacity: "7,000 lbs",
    feature: "Full-size equipment hauling",
    icon: "utility",
  },
  {
    name: "20ft Dual Axle Car Hauler",
    capacity: "10,000 lbs",
    feature: "Vehicles, Bobcats, skid-steers",
    icon: "hauler",
  },
  {
    name: "Temperature-Controlled Cab",
    capacity: "4' x 2' x 4'",
    feature: "Sensitive & perishable items",
    icon: "temp",
  },
] as const;

export const LM_SERVICES = [
  {
    category: "Construction",
    icon: "hardhat",
    items: [
      "Lumber",
      "Tile",
      "HVAC",
      "Plumbing",
      "Electrical",
      "Flooring",
      "Fencing",
    ],
    image: "/lastmile/lumber-delivery.jpg",
  },
  {
    category: "Equipment & Supply",
    icon: "wrench",
    items: [
      "Tanks",
      "Batteries",
      "Tools",
      "Paint",
      "Pool",
      "Security",
      "Farm",
      "Feed",
    ],
    image: "/lastmile/warehouse-load.jpg",
  },
  {
    category: "Special Handling",
    icon: "shield",
    items: [
      "Legal Documents",
      "Sensitive Materials",
      "Temperature-Controlled",
    ],
    image: "/lastmile/cargo-secured.jpg",
  },
] as const;

export const LM_GALLERY_PHOTOS = [
  { src: "/lastmile/jared-bobcat.jpg", alt: "Jared with Bobcat on trailer" },
  { src: "/lastmile/trailer-clean.jpg", alt: "Honda Ridgeline with 20ft utility trailer" },
  { src: "/lastmile/equipment-haul.jpg", alt: "Hauling Bobcat skid-steer" },
  { src: "/lastmile/warehouse-load.jpg", alt: "Loading RipSaw pallets at warehouse" },
  { src: "/lastmile/lumber-delivery.jpg", alt: "Lumber delivery to residential site" },
  { src: "/lastmile/car-haul.jpg", alt: "Car on flatbed car hauler" },
  { src: "/lastmile/cargo-secured.jpg", alt: "Netted cargo secured on trailer" },
  { src: "/lastmile/bobcat-pov.jpg", alt: "POV from Bobcat loading onto trailer" },
  { src: "/lastmile/jared-pallet.jpg", alt: "Jared with wrapped pallet delivery" },
] as const;

export const LM_CLIENTS = [
  "Contractors",
  "Builders",
  "B2B",
  "B2C",
  "C2C",
  "Owner-Operators",
  "Foremen",
] as const;

export const LM_STORES = [
  "Home Depot",
  "Lowe's",
  "Menards",
] as const;
