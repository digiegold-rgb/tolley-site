export const TBL_BRAND = "Tables & Chairs Rental";
export const TBL_COMPANY = "Your KC Homes LLC";
export const TBL_CONTACT_EMAIL = "Jared@yourkchomes.com";
export const TBL_CONTACT_PHONE = "913-283-3826";
export const TBL_FACEBOOK_URLS = [
  "https://www.facebook.com/marketplace/item/1128288392562563/",
] as const;
export const TBL_STRIPE_CHECKOUT_TABLE_URL = "https://buy.stripe.com/14A5kwdUi93V4LYe8718c0a";
export const TBL_DELIVERY_PER_MILE = 3;
export const TBL_PRICE_TABLE = 6;
export const TBL_PRICE_CHAIR = 12; // $12/day for the full set of 4 chairs (not per chair)

// Tiered refundable deposits (matches FB listing)
export const TBL_DEPOSIT_PER_TABLE = 20;
export const TBL_DEPOSIT_CHAIRS = 20;
export const TBL_DEPOSIT_PICNIC = 60;

export const TBL_TABLES = [
  { name: "Round Table",          dimensions: '31" diameter, 43½" tall',  qty: 1, price: 6 },
  { name: "6ft Table",            dimensions: "6 feet long",               qty: 3, price: 6 },
  { name: "8ft Table",            dimensions: "8 feet long",               qty: 1, price: 6 },
  { name: "4ft Adjustable Table", dimensions: "4 feet, adjustable height", qty: 1, price: 6 },
  { name: "Folding Chairs (Set of 4)", dimensions: "Standard folding",     qty: 1, price: 12 },
  { name: "6ft Picnic Table",     dimensions: "6 feet, LifeTime brand",    qty: 1, price: 25 },
] as const;

export const TBL_IMAGES = [
  "/tables/tables-1.jpg",
  "/tables/tables-2.jpg",
  "/tables/tables-3.jpg",
  "/tables/tables-4.jpg",
  "/tables/tables-5.jpg",
  "/tables/tables-6.jpg",
  "/tables/tables-7.jpg",
  "/tables/tables-8.jpg",
  "/tables/tables-9.jpg",
  "/tables/tables-10.jpg",
  "/tables/tables-11.jpg",
] as const; // HD originals from Shared/Rentals/Tables
