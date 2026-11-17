import {
  WD_COMPANY,
  WD_CONTACT_EMAIL,
  WD_CONTACT_PHONE,
  WD_PRICE_BUNDLE,
  WD_PRICE_WASHER,
} from "@/lib/wd";
export const BRAND = "Laundry Rental Network";
export const COMPANY = WD_COMPANY;
export const EMAIL = WD_CONTACT_EMAIL;
export const PHONE = WD_CONTACT_PHONE;
export const FEE_CENTS = 4500;
export const CONSENT_VERSION = "2026-11-16-v1";
export const BASE =
  process.env.LAUNDRY_PUBLIC_ORIGIN || "https://www.tolley.io";
export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);
export const UNIT_NAMES: Record<string, string> = {
  washer: "Washer",
  dryer: "Dryer",
  set: "Washer + dryer",
  stackable: "Stackable set",
};
export type Prices = Partial<
  Record<"washer" | "dryer" | "set" | "stackable", number>
>;
export const ANCHOR = {
  id: "laundry-wash-dry",
  ownerId: "laundry-anchor-owner",
  slug: "wash-and-dry-kansas-city",
  name: "Wash & Dry Rental",
  legalName: COMPANY,
  email: EMAIL,
  phone: PHONE,
  address: "Kansas City metro — delivery service",
  city: "Kansas City",
  state: "MO",
  zip: "64111",
  zips: [
    "64111",
    "64112",
    "64113",
    "64114",
    "64118",
    "64119",
    "64133",
    "64050",
    "64052",
    "64055",
    "64057",
    "64063",
    "64064",
    "64081",
    "64082",
    "64086",
    "64014",
    "64015",
    "64030",
    "64068",
    "64012",
    "66101",
    "66102",
    "66103",
    "66104",
    "66106",
    "66202",
    "66204",
    "66207",
    "66210",
    "66212",
    "66213",
    "66215",
    "66061",
    "66062",
  ],
  radiusMiles: 0,
  description:
    "Local washer and dryer rentals across Kansas City. Delivery, installation, maintenance and replacement coverage are included. Month-to-month rentals with no deposit or credit check.",
  prices: { washer: WD_PRICE_WASHER * 100, set: WD_PRICE_BUNDLE * 100 },
  deliveryFeeCents: 0,
  rentalTerms:
    "Month-to-month rental. Delivery, installation, maintenance and replacement coverage are included. No deposit or credit check. Cancel before your next billing date; pickup is scheduled within five business days. Repairs or replacement within 48 hours. Existing compatible hookups are required. Delivery dates require operator confirmation. The operator collects rent separately. Full Wash & Dry rental terms: https://www.tolley.io/wd/terms",
  status: "approved",
  anchor: true,
  feeCents: 0,
  agreementVersion: CONSENT_VERSION,
};
export const CITIES = [
  {
    slug: "kansas-city-mo",
    name: "Kansas City",
    state: "MO",
    zip: "64111",
    detail:
      "Compare coverage for your address on the Missouri side of the metro. Building access, stairs and existing hookups help your operator plan delivery.",
  },
  {
    slug: "kansas-city-ks",
    name: "Kansas City",
    state: "KS",
    zip: "66103",
    detail:
      "Find service for Kansas City, Kansas. Check your exact ZIP before requesting a delivery; coverage can differ across the state line.",
  },
  {
    slug: "independence-mo",
    name: "Independence",
    state: "MO",
    zip: "64055",
    detail:
      "Wash & Dry serves Independence with delivery and installation included. Tell the operator about basement access and the connections at your home.",
  },
  {
    slug: "overland-park-ks",
    name: "Overland Park",
    state: "KS",
    zip: "66212",
    detail:
      "Find washer and dryer rentals in Overland Park. Apartment residents should confirm that their lease allows appliance installation and that hookups are available.",
  },
  {
    slug: "olathe-ks",
    name: "Olathe",
    state: "KS",
    zip: "66062",
    detail:
      "Request a month-to-month rental in Olathe. Include your preferred day and any gate or building access details so delivery can be confirmed.",
  },
  {
    slug: "lees-summit-mo",
    name: "Lee’s Summit",
    state: "MO",
    zip: "64063",
    detail:
      "Explore local rental options in Lee’s Summit. Specify whether you need a washer or a set and confirm the dryer connection type before installation.",
  },
];
