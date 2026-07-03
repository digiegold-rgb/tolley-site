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
    slug: "kerplunk",
    name: "Giant Kerplunk",
    tagline: "The ultimate party game — life-sized fun",
    startingPrice: "$18/day",
    image: "/kerplunk/kerplunk-1.jpg",
    href: "/kerplunk",
    accentColor: "#e040a0",
    stripeLink: "https://buy.stripe.com/bJe9AMbMa1Bt6U64xx18c08",
  },
  {
    slug: "picnic-table",
    name: "Picnic Table",
    tagline: "Folding picnic table — take the party outside",
    startingPrice: "$25/day",
    image: "/picnic-table/picnic-1.jpg",
    href: "/picnic-table",
    accentColor: "#8b6c3e",
    stripeLink: "https://buy.stripe.com/aFa9AMeYm93Vceq6FF18c09",
  },
  {
    slug: "tables",
    name: "Tables & Chairs",
    tagline: "Round, 6ft, 8ft tables + chairs for any event",
    startingPrice: "From $6/day",
    image: "/tables/tables-1.jpg",
    href: "/tables",
    accentColor: "#c8a84e",
    stripeLink: "https://buy.stripe.com/14A5kwdUi93V4LYe8718c0a",
  },
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
    slug: "moving",
    name: "Moving Supplies",
    tagline: "Totes, blankets, and bands — skip the cardboard",
    startingPrice: "From $38/day",
    image: "/moving/mv-1.jpg",
    href: "/moving",
    accentColor: "#10b981",
    stripeLink: "https://buy.stripe.com/dRm3co5nM1BtguG4xx18c0c",
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
