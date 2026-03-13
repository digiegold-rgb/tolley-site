/**
 * Arbitrage margin calculator + mock pair generator
 */

import { type EbayProduct } from "./ebay-api";
import { type AmazonProduct } from "./amazon-api";

export interface MarginResult {
  ebayFees: number;
  profit: number;
  marginPercent: number;
  roi: number;
}

export function computeMargin(
  ebayPrice: number,
  amazonPrice: number,
  feeRate = 0.13
): MarginResult {
  const ebayFees = +(ebayPrice * feeRate).toFixed(2);
  const profit = +(ebayPrice - amazonPrice - ebayFees).toFixed(2);
  const marginPercent = +((profit / ebayPrice) * 100).toFixed(1);
  const roi = +((profit / amazonPrice) * 100).toFixed(1);
  return { ebayFees, profit, marginPercent, roi };
}

export interface MockPair {
  ebay: EbayProduct;
  amazon: AmazonProduct;
  category: string;
}

export function getMockPairs(): MockPair[] {
  return [
    {
      ebay: {
        itemId: "EB001",
        title: "Wireless Earbuds Pro — Noise Cancelling BT 5.3",
        price: 49.99,
        imageUrl: "https://placehold.co/300x300/0f172a/38bdf8?text=Earbuds+Pro",
        url: "https://ebay.com/itm/EB001",
        category: "Electronics",
      },
      amazon: {
        asin: "B0AZ001",
        title: "Wireless Earbuds — BT 5.3 In-Ear Headphones",
        price: 29.99,
        imageUrl: "https://placehold.co/300x300/0f172a/ff9900?text=Earbuds",
        url: "https://amazon.com/dp/B0AZ001",
        category: "Electronics",
      },
      category: "Electronics",
    },
    {
      ebay: {
        itemId: "EB002",
        title: "LED Desk Lamp USB — Touch Dimmer 3 Color Temps",
        price: 39.99,
        imageUrl: "https://placehold.co/300x300/0f172a/38bdf8?text=LED+Lamp",
        url: "https://ebay.com/itm/EB002",
        category: "Home",
      },
      amazon: {
        asin: "B0AZ002",
        title: "Dimmable LED Lamp — USB Powered Touch Control",
        price: 22.99,
        imageUrl: "https://placehold.co/300x300/0f172a/ff9900?text=LED+Lamp",
        url: "https://amazon.com/dp/B0AZ002",
        category: "Home",
      },
      category: "Home",
    },
    {
      ebay: {
        itemId: "EB003",
        title: "BT Speaker Waterproof — 20W Portable Bass Boost",
        price: 44.99,
        imageUrl: "https://placehold.co/300x300/0f172a/38bdf8?text=BT+Speaker",
        url: "https://ebay.com/itm/EB003",
        category: "Electronics",
      },
      amazon: {
        asin: "B0AZ003",
        title: "Waterproof BT Speaker — Portable 20W Outdoor",
        price: 24.99,
        imageUrl: "https://placehold.co/300x300/0f172a/ff9900?text=BT+Speaker",
        url: "https://amazon.com/dp/B0AZ003",
        category: "Electronics",
      },
      category: "Electronics",
    },
    {
      ebay: {
        itemId: "EB004",
        title: "Digital Kitchen Scale — 0.1g Precision USB-C",
        price: 29.99,
        imageUrl: "https://placehold.co/300x300/0f172a/38bdf8?text=Kitchen+Scale",
        url: "https://ebay.com/itm/EB004",
        category: "Kitchen",
      },
      amazon: {
        asin: "B0AZ004",
        title: "Kitchen Scale USB — Digital Food Scale 0.1g",
        price: 14.99,
        imageUrl: "https://placehold.co/300x300/0f172a/ff9900?text=Kitchen+Scale",
        url: "https://amazon.com/dp/B0AZ004",
        category: "Kitchen",
      },
      category: "Kitchen",
    },
    {
      ebay: {
        itemId: "EB005",
        title: "Magnetic Car Mount — MagSafe Dashboard Holder",
        price: 24.99,
        imageUrl: "https://placehold.co/300x300/0f172a/38bdf8?text=Car+Mount",
        url: "https://ebay.com/itm/EB005",
        category: "Automotive",
      },
      amazon: {
        asin: "B0AZ005",
        title: "Car Phone Holder — Magnetic Dashboard Mount",
        price: 11.99,
        imageUrl: "https://placehold.co/300x300/0f172a/ff9900?text=Car+Mount",
        url: "https://amazon.com/dp/B0AZ005",
        category: "Automotive",
      },
      category: "Automotive",
    },
  ];
}
