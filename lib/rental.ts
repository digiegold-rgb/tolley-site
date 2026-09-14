export const RENTAL_CONTACT_PHONE = "913-283-3826";
export const RENTAL_CONTACT_EMAIL = "Jared@yourkchomes.com";
export const RENTAL_COMPANY = "Your KC Homes LLC";

export interface RentalItem {
  slug: string;
  name: string;
  tagline: string;
  startingPrice: string;
  image: string;
  href: string;
  accentColor: string;
  stripeLink?: string;
}

export const RENTAL_ITEMS: RentalItem[] = [
  {
    slug: "generator",
    name: "Generator",
    tagline: "Tri-fuel 9,400W — power anything, anywhere",
    startingPrice: "From $68/day",
    image: "/generator/gen-1.jpg",
    href: "/generator",
    accentColor: "#ffd000",
    stripeLink: "https://buy.stripe.com/9B6cMYg2qgwn5Q27JJ18c03",
  },
  {
    slug: "trailer",
    name: "Utility Trailers",
    tagline: "16ft–20ft, up to 10,000 lbs capacity",
    startingPrice: "From $68/day",
    image: "/trailer/20/20-1.jpg",
    href: "/trailer",
    accentColor: "#f59e0b",
    stripeLink: "https://buy.stripe.com/eVq8wIeYm5RJdiu9RR18c0d",
  },
  {
    slug: "wd",
    name: "Washer & Dryer",
    tagline: "Monthly rental with free delivery & maintenance",
    startingPrice: "$58/month",
    image: "/wd/wd-4.jpg",
    href: "/wd",
    accentColor: "#3b82f6",
    stripeLink: "https://buy.stripe.com/00w14g03sgwn4LYe8718c00",
  },
];
