export const HVAC_BRAND = "The Cool Guys Heating & Air Conditioning";
export const HVAC_OWNER = "Josh";
export const HVAC_PHONE = "(816) 726-4054";
export const HVAC_PHONE_RAW = "8167264054";
export const HVAC_EMAIL = "thecoolguyskc@gmail.com";
export const HVAC_ADDRESS = "16504 E 29 Terrace S, Independence, MO 64055";
export const HVAC_HOURS = "Open 24 Hours";
export const HVAC_WEBSITE = "https://www.thecoolguyskc.com/";
export const HVAC_FACEBOOK = "https://www.facebook.com/thecoolguyskc";
export const HVAC_TAGLINE = "It's time to be cool. Call The Cool Guys!";
export const HVAC_RATING = 4.7;
export const HVAC_REVIEW_COUNT = 13;

export const HVAC_SERVICES = [
  {
    name: "Maintenance",
    description:
      "Keep your system running at peak efficiency. Regular tune-ups, filter changes, and inspections to prevent costly breakdowns before they happen.",
    image: "/hvac/condenser-1.jpg",
    icon: "snowflake" as const,
  },
  {
    name: "Repairs",
    description:
      "Fast, honest repairs when you need them most. Available 24/7 for emergency service. No upselling — just straightforward fixes that work.",
    image: "/hvac/furnace-interior.jpg",
    icon: "wrench" as const,
  },
  {
    name: "Installation",
    description:
      "New Goodman equipment installed right the first time. Energy-efficient systems sized for your home with clean, professional ductwork.",
    image: "/hvac/ductwork-1.jpg",
    icon: "house-gear" as const,
  },
] as const;

export const HVAC_GALLERY_PHOTOS = [
  { src: "/hvac/ductwork-2.jpg", alt: "New ductwork installation" },
  { src: "/hvac/ductwork-3.jpg", alt: "Professional ductwork" },
  { src: "/hvac/condenser-2.jpg", alt: "Condenser unit in garden" },
  { src: "/hvac/furnace-unit.jpg", alt: "Goodman furnace unit" },
  { src: "/hvac/condenser-1.jpg", alt: "Outdoor condenser unit" },
  { src: "/hvac/furnace-interior.jpg", alt: "Furnace burner flames" },
  { src: "/hvac/ductwork-1.jpg", alt: "New ductwork installation" },
  { src: "/hvac/team-install.jpg", alt: "Crew with customer after install" },
] as const;

export const HVAC_REVIEWS = [
  {
    name: "Dan Cockrell",
    rating: 5,
    timeAgo: "a year ago",
    text: "Josh was professional, punctual, and reasonably priced. He diagnosed and fixed my furnace issue quickly. Highly recommend The Cool Guys!",
  },
  {
    name: "Ashley Evans",
    rating: 5,
    timeAgo: "a year ago",
    text: "Amazing service! Josh came out same day and had our AC running perfectly. Fair pricing and honest work. Will definitely use again!",
  },
  {
    name: "Aaron Compton",
    rating: 5,
    timeAgo: "a year ago",
    text: "The Cool Guys lived up to their name. Quick response, great communication, and quality work. Josh really knows his stuff.",
  },
  {
    name: "Logan Paskell",
    rating: 5,
    timeAgo: "a year ago",
    text: "Josh was fantastic! He was very knowledgeable and took the time to explain everything. Great service at a great price.",
  },
  {
    name: "Michael Trinh",
    rating: 5,
    timeAgo: "a year ago",
    text: "Excellent experience from start to finish. Josh was honest about what needed to be done and didn't try to upsell. Refreshing!",
  },
  {
    name: "The Brown Team",
    rating: 5,
    timeAgo: "a year ago",
    text: "We've used The Cool Guys multiple times and they never disappoint. Reliable, affordable, and always professional. 10/10!",
  },
  {
    name: "Caleb James",
    rating: 5,
    timeAgo: "a year ago",
    text: "Called for an emergency repair and Josh was there within the hour. Fixed the issue fast and the price was very fair. Lifesaver!",
  },
  {
    name: "Mike N",
    rating: 5,
    timeAgo: "2 years ago",
    text: "Great job installing our new Goodman unit. The crew was professional and cleaned up everything when they were done. Highly recommend.",
  },
  {
    name: "Jim Mcconnell",
    rating: 5,
    timeAgo: "2 years ago",
    text: "Josh and his team are top notch. They replaced our entire HVAC system and it's been running perfectly ever since. Couldn't be happier.",
  },
  {
    name: "Sandy G",
    rating: 5,
    timeAgo: "2 years ago",
    text: "Very impressed with The Cool Guys. Josh was upfront about costs and the work was done quickly and correctly. Will use them for all future HVAC needs.",
  },
  {
    name: "Timothy Patrick",
    rating: 5,
    timeAgo: "2 years ago",
    text: "Best HVAC company in the KC area. Josh is honest, hardworking, and his prices can't be beat. Already recommended to friends and family.",
  },
] as const;
