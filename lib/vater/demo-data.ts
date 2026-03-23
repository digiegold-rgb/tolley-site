// ═══════════════════════════════════════════════════
// Vater Ventures — Demo Data (all client-side, no API)
// ═══════════════════════════════════════════════════

// ─── Dropship ───

export interface DemoDropshipPair {
  id: string;
  ebayTitle: string;
  ebayPrice: number;
  ebayImageUrl: string;
  amazonTitle: string;
  amazonPrice: number;
  amazonImageUrl: string;
  ebayFees: number;
  profit: number;
  marginPercent: number;
  roi: number;
  status: "pending" | "approved" | "rejected" | "listed";
  category: string;
  source: string;
}

const cats = ["Electronics", "Home & Garden", "Toys", "Kitchen", "Sports", "Tools", "Pet Supplies", "Automotive", "Health", "Office"];
const colors = ["0f172a/38bdf8", "1e293b/f59e0b", "0f172a/22c55e", "1e293b/ef4444", "0f172a/a78bfa"];

function dsPair(i: number, ebayT: string, amazonT: string, ebay: number, amazon: number, cat: string, status: DemoDropshipPair["status"]): DemoDropshipPair {
  const fees = +(ebay * 0.13).toFixed(2);
  const profit = +(ebay - amazon - fees).toFixed(2);
  const margin = +((profit / ebay) * 100).toFixed(1);
  const roi = +((profit / amazon) * 100).toFixed(1);
  const c = colors[i % colors.length];
  return {
    id: `demo-ds-${i}`,
    ebayTitle: ebayT,
    ebayPrice: ebay,
    ebayImageUrl: `https://placehold.co/400x400/${c}?text=eBay+${i + 1}`,
    amazonTitle: amazonT,
    amazonPrice: amazon,
    amazonImageUrl: `https://placehold.co/400x400/${c}?text=Amazon+${i + 1}`,
    ebayFees: fees,
    profit,
    marginPercent: margin,
    roi,
    status,
    category: cat,
    source: "ai-scanner",
  };
}

export const DEMO_DROPSHIP_PAIRS: DemoDropshipPair[] = [
  dsPair(0, "Anker USB-C Hub 7-in-1 Dock", "Anker 7-in-1 USB C Hub Adapter", 54.99, 34.99, "Electronics", "pending"),
  dsPair(1, "Ninja BL660 Professional Blender 72oz", "Ninja Professional Blender BL660", 89.99, 59.99, "Kitchen", "pending"),
  dsPair(2, "Ring Video Doorbell Pro 2 WiFi", "Ring Video Doorbell Pro 2", 179.99, 129.99, "Electronics", "pending"),
  dsPair(3, "Hydro Flask 32oz Wide Mouth Bottle", "Hydro Flask Wide Mouth 32 oz", 44.99, 28.99, "Sports", "approved"),
  dsPair(4, "iRobot Roomba 694 Robot Vacuum", "iRobot Roomba 694 WiFi Robot Vacuum", 249.99, 179.99, "Home & Garden", "approved"),
  dsPair(5, "Sony WH-1000XM5 Headphones Black", "Sony WH-1000XM5 Noise Cancelling Headphones", 328.00, 248.00, "Electronics", "pending"),
  dsPair(6, "Milwaukee M12 Cordless Drill Kit", "Milwaukee 2407-22 M12 Drill Driver Kit", 119.99, 79.99, "Tools", "pending"),
  dsPair(7, "Cricut Maker 3 Cutting Machine", "Cricut Maker 3 Smart Cutting Machine", 349.99, 269.99, "Home & Garden", "approved"),
  dsPair(8, "YETI Rambler 30oz Tumbler Navy", "YETI Rambler 30 oz Tumbler", 38.00, 24.50, "Kitchen", "listed"),
  dsPair(9, "Blink Outdoor 4 Camera System", "Blink Outdoor 4 Wireless Camera (3-pack)", 179.99, 119.99, "Electronics", "pending"),
  dsPair(10, "Dyson V8 Absolute Cordless Vacuum", "Dyson V8 Absolute Vacuum Cleaner", 399.99, 299.99, "Home & Garden", "approved"),
  dsPair(11, "JBL Flip 6 Bluetooth Speaker Red", "JBL Flip 6 Portable Speaker", 99.95, 69.95, "Electronics", "listed"),
  dsPair(12, "Keurig K-Elite Coffee Maker", "Keurig K-Elite Single Serve Coffee Maker", 149.99, 99.99, "Kitchen", "pending"),
  dsPair(13, "Fitbit Charge 6 Fitness Tracker", "Fitbit Charge 6 Advanced Tracker", 139.95, 99.95, "Electronics", "rejected"),
  dsPair(14, "Coleman 8-Person Camping Tent", "Coleman Montana 8-Person Tent", 199.99, 139.99, "Sports", "pending"),
  dsPair(15, "Instant Pot Duo 8-Quart", "Instant Pot Duo 7-in-1 8 Quart", 89.95, 59.95, "Kitchen", "approved"),
  dsPair(16, "Tile Pro 4-Pack Bluetooth Tracker", "Tile Pro (2022) 4-Pack", 84.99, 54.99, "Electronics", "pending"),
  dsPair(17, "KitchenAid Stand Mixer 5qt Silver", "KitchenAid Artisan 5-Qt Stand Mixer", 379.99, 279.99, "Kitchen", "listed"),
  dsPair(18, "Shark Navigator Lift-Away Vacuum", "Shark Navigator Lift-Away NV352", 159.99, 109.99, "Home & Garden", "pending"),
  dsPair(19, "RENPHO Body Scale Bluetooth", "RENPHO Digital Bathroom Scale", 29.99, 17.99, "Health", "approved"),
  dsPair(20, "TP-Link Deco Mesh WiFi 6 (3-Pack)", "TP-Link Deco X55 WiFi 6 Mesh", 199.99, 149.99, "Electronics", "pending"),
  dsPair(21, "Stanley Quencher 40oz Tumbler", "Stanley Adventure Quencher 40 oz", 45.00, 29.00, "Kitchen", "listed"),
  dsPair(22, "Logitech MX Master 3S Mouse", "Logitech MX Master 3S Wireless Mouse", 99.99, 69.99, "Electronics", "rejected"),
  dsPair(23, "DeWalt 20V MAX Impact Driver Kit", "DeWalt DCF787C1 20V Impact Driver", 129.99, 89.99, "Tools", "pending"),
  dsPair(24, "Furminator Deshedding Tool Large Dog", "Furminator deShedding Tool for Dogs", 34.99, 19.99, "Pet Supplies", "approved"),
];

// ─── Merch ───

export interface DemoMerchDesign {
  id: string;
  title: string;
  productType: "t-shirt" | "hoodie" | "mug" | "sticker" | "poster" | "phone-case";
  trendSource: "TikTok" | "Reddit" | "Google Trends" | "Pinterest" | "X/Twitter";
  trendScore: number; // 0-100
  price: number;
  cost: number;
  profit: number;
  sales: number;
  status: "trending" | "design-ready" | "listed" | "sold";
  imageUrl: string;
  createdAt: string;
}

const productTypes: DemoMerchDesign["productType"][] = ["t-shirt", "hoodie", "mug", "sticker", "poster", "phone-case"];
const trendSources: DemoMerchDesign["trendSource"][] = ["TikTok", "Reddit", "Google Trends", "Pinterest", "X/Twitter"];
const productColors: Record<string, string> = {
  "t-shirt": "0f172a/38bdf8",
  hoodie: "1e293b/a78bfa",
  mug: "0f172a/f59e0b",
  sticker: "1e293b/22c55e",
  poster: "0f172a/ec4899",
  "phone-case": "1e293b/06b6d4",
};

function merchItem(i: number, title: string, pt: DemoMerchDesign["productType"], src: DemoMerchDesign["trendSource"], trendScore: number, price: number, cost: number, sales: number, status: DemoMerchDesign["status"]): DemoMerchDesign {
  return {
    id: `demo-merch-${i}`,
    title,
    productType: pt,
    trendSource: src,
    trendScore,
    price,
    cost,
    profit: +(price - cost).toFixed(2),
    sales,
    status,
    imageUrl: `https://placehold.co/400x400/${productColors[pt]}?text=${encodeURIComponent(pt)}`,
    createdAt: new Date(Date.now() - i * 86400000 * 1.5).toISOString(),
  };
}

export const DEMO_MERCH_DESIGNS: DemoMerchDesign[] = [
  merchItem(0, "Retro Sunset Pilot Wings", "t-shirt", "TikTok", 92, 29.99, 12.50, 47, "sold"),
  merchItem(1, "Dad Mode: Activated 2025", "hoodie", "Reddit", 88, 44.99, 22.00, 31, "sold"),
  merchItem(2, "Aviation Alphabet Phonetic", "mug", "Pinterest", 75, 18.99, 7.50, 63, "listed"),
  merchItem(3, "Sky King Silhouette", "t-shirt", "Google Trends", 81, 24.99, 11.00, 22, "listed"),
  merchItem(4, "Crypto Bull Neon Art", "poster", "X/Twitter", 67, 19.99, 6.00, 15, "listed"),
  merchItem(5, "First Time Dad Survival Kit", "t-shirt", "TikTok", 95, 27.99, 11.50, 89, "sold"),
  merchItem(6, "Airplane Mode On", "sticker", "Reddit", 72, 5.99, 1.50, 142, "listed"),
  merchItem(7, "Ground Control Coffee Mug", "mug", "Pinterest", 84, 19.99, 8.00, 38, "sold"),
  merchItem(8, "Hustle Harder Minimalist", "hoodie", "TikTok", 90, 49.99, 24.00, 19, "listed"),
  merchItem(9, "Side Hustle Blueprint", "t-shirt", "Google Trends", 63, 24.99, 10.50, 27, "sold"),
  merchItem(10, "Pilot License Loading...", "phone-case", "Reddit", 77, 22.99, 9.00, 34, "listed"),
  merchItem(11, "New Dad Energy Drink", "sticker", "TikTok", 85, 4.99, 1.20, 201, "sold"),
  merchItem(12, "Fly High Typography", "poster", "Pinterest", 58, 16.99, 5.50, 11, "listed"),
  merchItem(13, "Diaper Duty Champion", "t-shirt", "Reddit", 91, 26.99, 11.00, 56, "sold"),
  merchItem(14, "Cloud Nine Aviation", "hoodie", "Google Trends", 70, 42.99, 21.00, 8, "listed"),
  merchItem(15, "AI Powered Everything", "mug", "X/Twitter", 82, 17.99, 7.00, 44, "sold"),
  merchItem(16, "Cleared for Takeoff Badge", "sticker", "TikTok", 88, 5.49, 1.30, 178, "listed"),
  merchItem(17, "Night Shift Dad Club", "t-shirt", "Reddit", 79, 25.99, 11.00, 33, "sold"),
  merchItem(18, "Altitude Attitude", "phone-case", "Pinterest", 65, 21.99, 8.50, 12, "design-ready"),
  merchItem(19, "Turbulence Expected", "poster", "Google Trends", 73, 18.99, 6.00, 0, "design-ready"),
  merchItem(20, "Baby's Co-Pilot", "t-shirt", "TikTok", 94, 26.99, 11.00, 0, "trending"),
  merchItem(21, "E-Commerce Grind Set", "hoodie", "X/Twitter", 68, 44.99, 22.00, 0, "trending"),
  merchItem(22, "Roger That Vintage", "mug", "Reddit", 76, 18.99, 7.50, 0, "design-ready"),
  merchItem(23, "Sleep When They Sleep LOL", "sticker", "TikTok", 93, 5.99, 1.40, 0, "trending"),
  merchItem(24, "Autopilot Dad Mode", "t-shirt", "Pinterest", 87, 27.99, 12.00, 0, "trending"),
  merchItem(25, "Preflight Checklist Poster", "poster", "Google Trends", 61, 17.99, 5.50, 0, "design-ready"),
  merchItem(26, "Dad Jokes Loading", "phone-case", "Reddit", 80, 22.99, 9.00, 0, "trending"),
  merchItem(27, "Mayday Mayday Coffee", "mug", "TikTok", 86, 19.99, 8.00, 0, "design-ready"),
  merchItem(28, "Side Hustle Pilot", "hoodie", "X/Twitter", 74, 46.99, 23.00, 0, "trending"),
  merchItem(29, "Clear Skies Ahead", "t-shirt", "Pinterest", 69, 24.99, 10.50, 0, "design-ready"),
];

// ─── GovBids ───

export interface DemoGovBid {
  id: string;
  solicitationNumber: string;
  agency: "DoD" | "GSA" | "VA" | "DHS" | "USDA";
  title: string;
  description: string;
  estimatedValue: number;
  deadline: string;
  naicsCode: string;
  marginPercent: number;
  setAside: string | null;
  status: "open" | "bid-submitted" | "under-review" | "won" | "lost";
}

function govBid(i: number, sol: string, agency: DemoGovBid["agency"], title: string, desc: string, value: number, daysOut: number, naics: string, margin: number, setAside: string | null, status: DemoGovBid["status"]): DemoGovBid {
  const d = new Date();
  d.setDate(d.getDate() + daysOut);
  return {
    id: `demo-gov-${i}`,
    solicitationNumber: sol,
    agency,
    title,
    description: desc,
    estimatedValue: value,
    deadline: d.toISOString(),
    naicsCode: naics,
    marginPercent: margin,
    setAside,
    status,
  };
}

export const DEMO_GOVBIDS: DemoGovBid[] = [
  govBid(0, "W912DQ-25-R-0042", "DoD", "Portable Solar Generator Units (Qty 200)", "Supply of portable solar power stations for field operations. Must meet MIL-STD specifications.", 485000, 18, "335911", 22, "SDVOSB", "open"),
  govBid(1, "47QFCA-25-Q-0088", "GSA", "IT Equipment Refresh — Laptops & Docks", "Dell Latitude laptops, docking stations, and monitors for 3 regional offices.", 312000, 12, "334111", 18, null, "open"),
  govBid(2, "VA261-25-R-0115", "VA", "Medical Supply Kits — PPE Bulk Order", "N95 masks, gloves, gowns, face shields for 14 VA medical centers.", 890000, 25, "339113", 15, "SDVOSB", "open"),
  govBid(3, "70DCSA25R00021", "DHS", "Surveillance Camera System Upgrade", "IP camera systems with NVR storage for 6 border stations.", 267000, 8, "334290", 24, null, "bid-submitted"),
  govBid(4, "AG-6395-S-25-0034", "USDA", "Portable Weather Station Array", "IoT weather monitoring stations for 40 research sites.", 178000, 5, "334519", 28, "8(a)", "bid-submitted"),
  govBid(5, "W56KGZ-25-C-0019", "DoD", "Tactical Communication Headsets", "Peltor-compatible headsets with PTT adapters. Qty 500.", 225000, 30, "334220", 20, null, "open"),
  govBid(6, "GS-07F-0112Y", "GSA", "Office Furniture — Standing Desks", "Height-adjustable desks for GSA Schedule 71 delivery.", 156000, 22, "337214", 19, "HUBZone", "open"),
  govBid(7, "VA257-25-Q-0203", "VA", "Wheelchair Replacement Program", "Lightweight manual wheelchairs for 8 VA facilities.", 420000, 15, "339113", 16, "SDVOSB", "under-review"),
  govBid(8, "HSCEDM-25-R-0007", "DHS", "Drone Fleet — Inspection UAVs", "DJI Matrice 350 RTK units with thermal cameras. Qty 25.", 375000, 3, "336411", 21, null, "bid-submitted"),
  govBid(9, "AG-3142-P-25-0089", "USDA", "Soil Testing Lab Equipment", "Portable soil analysis kits and spectrophotometers.", 92000, 28, "334516", 32, "8(a)", "open"),
  govBid(10, "W911QY-25-R-0067", "DoD", "MRE Ration Supplements (10,000 cases)", "Supplemental nutrition bars meeting NSN specs.", 340000, 20, "311999", 14, null, "won"),
  govBid(11, "47QFCA-25-Q-0142", "GSA", "Cloud Migration Services — Phase 2", "AWS GovCloud setup and data migration for 2 agencies.", 520000, 35, "541519", 26, null, "open"),
  govBid(12, "VA256-25-C-0044", "VA", "Telehealth Tablet Distribution", "Samsung Galaxy Tab A9+ units pre-configured for VA Video Connect.", 680000, 10, "334111", 17, "SDVOSB", "under-review"),
  govBid(13, "70DCSA25Q00055", "DHS", "Body-Worn Camera Program", "Axon Body 4 cameras with Evidence.com licenses. Qty 300.", 450000, 2, "334290", 19, null, "bid-submitted"),
  govBid(14, "AG-6395-B-25-0012", "USDA", "Greenhouse Automation Controllers", "Smart irrigation and climate control systems.", 134000, 40, "333415", 30, "8(a)", "open"),
  govBid(15, "W912DQ-25-R-0058", "DoD", "Night Vision Goggle Batteries", "CR123A lithium batteries. Qty 50,000.", 175000, 14, "335912", 25, null, "won"),
  govBid(16, "GS-35F-0228T", "GSA", "Cybersecurity Assessment — FedRAMP", "Penetration testing and compliance audit for 3 systems.", 289000, 19, "541512", 23, null, "open"),
  govBid(17, "VA261-25-Q-0178", "VA", "Patient Transport Van Conversion", "ADA-compliant van upfits. Qty 12.", 540000, 7, "336211", 13, "SDVOSB", "lost"),
  govBid(18, "HSCEDM-25-R-0015", "DHS", "Portable X-Ray Screening Units", "Backscatter X-ray systems for checkpoint use.", 820000, 32, "334517", 18, null, "open"),
  govBid(19, "AG-3142-S-25-0045", "USDA", "GPS Tracking Collars — Wildlife", "Satellite-enabled GPS collars for elk research. Qty 200.", 86000, 24, "334511", 35, "8(a)", "won"),
  govBid(20, "W56KGZ-25-R-0033", "DoD", "Field Water Purification Units", "Reverse osmosis systems meeting TWPS specs.", 290000, 16, "333318", 20, null, "under-review"),
  govBid(21, "47QFCA-25-R-0201", "GSA", "Managed Print Services", "Nationwide copier/printer fleet management.", 410000, 26, "811212", 22, "HUBZone", "open"),
  govBid(22, "VA257-25-R-0089", "VA", "Prosthetic Limb Components", "Below-knee prosthetic components and liners.", 360000, 11, "339113", 15, "SDVOSB", "lost"),
  govBid(23, "70DCSA25R00034", "DHS", "License Plate Reader Systems", "ALPR cameras with analytics software. 50 units.", 580000, 9, "334290", 21, null, "bid-submitted"),
  govBid(24, "W912DQ-25-C-0071", "DoD", "Tactical Backpack Lots (Qty 2000)", "MOLLE-compatible assault packs meeting Berry Amendment.", 196000, 21, "314999", 27, null, "won"),
];

// ─── YouTube ───

export interface DemoYouTubeVideo {
  id: string;
  title: string;
  niche: "aviation" | "finance" | "tech" | "history" | "science";
  stage: "idea" | "script-ready" | "in-production" | "published";
  views: number;
  retention: number; // percent
  revenue: number;
  scriptPreview: string;
  thumbnailUrl: string;
  publishedAt: string | null;
}

export interface DemoYouTubeTrend {
  id: string;
  topic: string;
  searchVolume: number;
  competition: "low" | "medium" | "high";
  estimatedCPM: number;
}

const nicheColors: Record<string, string> = {
  aviation: "0f172a/38bdf8",
  finance: "1e293b/22c55e",
  tech: "0f172a/a78bfa",
  history: "1e293b/f59e0b",
  science: "0f172a/ec4899",
};

function ytVideo(i: number, title: string, niche: DemoYouTubeVideo["niche"], stage: DemoYouTubeVideo["stage"], views: number, retention: number, revenue: number, script: string): DemoYouTubeVideo {
  return {
    id: `demo-yt-${i}`,
    title,
    niche,
    stage,
    views,
    retention,
    revenue,
    scriptPreview: script,
    thumbnailUrl: `https://placehold.co/640x360/${nicheColors[niche]}?text=${encodeURIComponent(niche)}`,
    publishedAt: stage === "published" ? new Date(Date.now() - i * 86400000 * 3).toISOString() : null,
  };
}

export const DEMO_YOUTUBE_VIDEOS: DemoYouTubeVideo[] = [
  ytVideo(0, "Why Planes Don't Fly Over the Pacific Ocean", "aviation", "published", 284000, 62, 1420, "You've probably noticed that most flights between North America and Asia..."),
  ytVideo(1, "I Tried Every Passive Income Idea — Here's What Actually Works", "finance", "published", 156000, 55, 780, "Over the past 12 months, I tested 15 different passive income streams..."),
  ytVideo(2, "The $1 Trillion Chip War Explained", "tech", "published", 412000, 58, 2060, "Taiwan Semiconductor makes over 90% of the world's advanced chips..."),
  ytVideo(3, "The Lost City Found Under the Ocean", "history", "published", 198000, 61, 594, "In 2023, marine archaeologists discovered something extraordinary..."),
  ytVideo(4, "What Happens If You Fall Into a Black Hole", "science", "published", 521000, 64, 2605, "The moment you cross the event horizon, something strange happens..."),
  ytVideo(5, "How Pilots Land in Zero Visibility", "aviation", "published", 167000, 59, 835, "Category III ILS approaches allow pilots to land when they literally..."),
  ytVideo(6, "5 Businesses You Can Start With $0", "finance", "published", 89000, 51, 445, "The barrier to starting a business has never been lower..."),
  ytVideo(7, "The AI Robot That Scared Its Creators", "tech", "published", 347000, 56, 1735, "When researchers at Anthropic first tested their latest model..."),
  ytVideo(8, "The Real Reason the Titanic Sank", "history", "published", 275000, 63, 825, "Most people think the Titanic sank because it hit an iceberg..."),
  ytVideo(9, "Scientists Just Found Water on Mars — Again", "science", "published", 143000, 52, 715, "NASA's Perseverance rover has detected the strongest evidence yet..."),
  ytVideo(10, "The Secret Airport No One Knows About", "aviation", "in-production", 0, 0, 0, "Deep in the Nevada desert, there's a 12,000-foot runway..."),
  ytVideo(11, "How I Built a $10K/Month Dropship Business", "finance", "in-production", 0, 0, 0, "Six months ago, I launched an Amazon-to-eBay arbitrage operation..."),
  ytVideo(12, "NVIDIA's New Chip Changes Everything", "tech", "in-production", 0, 0, 0, "The GB200 Blackwell architecture isn't just faster..."),
  ytVideo(13, "The Civilization That Disappeared Overnight", "history", "in-production", 0, 0, 0, "The Minoan civilization on Crete was the most advanced in the world..."),
  ytVideo(14, "What NASA Found at the Bottom of the Ocean", "science", "in-production", 0, 0, 0, "In partnership with NOAA, NASA sent their deep-sea probe..."),
  ytVideo(15, "Why Fighter Jets Cost $100 Million Each", "aviation", "script-ready", 0, 0, 0, "An F-35 Lightning II costs $80 million per unit..."),
  ytVideo(16, "The Credit Card Hack Banks Don't Want You to Know", "finance", "script-ready", 0, 0, 0, "Most people leave hundreds of dollars on the table each year..."),
  ytVideo(17, "This AI Can Clone Your Voice in 3 Seconds", "tech", "script-ready", 0, 0, 0, "ElevenLabs just released a model that can perfectly replicate..."),
  ytVideo(18, "The Ancient Map That Shouldn't Exist", "history", "script-ready", 0, 0, 0, "The Piri Reis map from 1513 shows the coastline of Antarctica..."),
  ytVideo(19, "What's Inside a Neutron Star", "science", "script-ready", 0, 0, 0, "A single teaspoon of neutron star material weighs about 6 billion tons..."),
  ytVideo(20, "How Autopilot Actually Works", "aviation", "script-ready", 0, 0, 0, "Most passengers assume autopilot flies the entire plane..."),
  ytVideo(21, "Print on Demand in 2025 — Still Worth It?", "finance", "idea", 0, 0, 0, ""),
  ytVideo(22, "The Quantum Computer That Broke Encryption", "tech", "idea", 0, 0, 0, ""),
  ytVideo(23, "Why Ancient Egypt's Pyramids Are Impossible", "history", "idea", 0, 0, 0, ""),
  ytVideo(24, "The Sound You Can't Unhear", "science", "idea", 0, 0, 0, ""),
  ytVideo(25, "What Pilots See at Night", "aviation", "idea", 0, 0, 0, ""),
  ytVideo(26, "Government Contracts: The $700B Side Hustle", "finance", "idea", 0, 0, 0, ""),
  ytVideo(27, "Why Your Phone is Listening to You", "tech", "idea", 0, 0, 0, ""),
  ytVideo(28, "The Viking Map That Rewrote History", "history", "idea", 0, 0, 0, ""),
  ytVideo(29, "Can Humans Breathe Liquid?", "science", "idea", 0, 0, 0, ""),
  ytVideo(30, "Inside the Most Dangerous Airport on Earth", "aviation", "published", 92000, 67, 460, "Lukla Airport in Nepal has a 527-meter runway on a cliff..."),
  ytVideo(31, "How to Make Money While You Sleep", "finance", "published", 203000, 48, 1015, "Passive income isn't a myth, but it's not what most gurus sell..."),
  ytVideo(32, "The Dark Side of Self-Driving Cars", "tech", "published", 178000, 54, 890, "Tesla's Full Self-Driving has logged over 1 billion miles..."),
  ytVideo(33, "The Spy Satellite You Can See From Earth", "history", "idea", 0, 0, 0, ""),
  ytVideo(34, "Why Space Smells Like Steak", "science", "idea", 0, 0, 0, ""),
];

export const DEMO_YOUTUBE_TRENDS: DemoYouTubeTrend[] = [
  { id: "trend-0", topic: "AI agents autonomous business", searchVolume: 48000, competition: "low", estimatedCPM: 14.50 },
  { id: "trend-1", topic: "government contract side hustle", searchVolume: 22000, competition: "low", estimatedCPM: 18.20 },
  { id: "trend-2", topic: "pilot license cost 2025", searchVolume: 35000, competition: "medium", estimatedCPM: 12.80 },
  { id: "trend-3", topic: "passive income dropshipping", searchVolume: 67000, competition: "high", estimatedCPM: 8.90 },
  { id: "trend-4", topic: "DGX Spark review", searchVolume: 15000, competition: "low", estimatedCPM: 22.40 },
  { id: "trend-5", topic: "faceless YouTube channel AI", searchVolume: 41000, competition: "medium", estimatedCPM: 11.60 },
  { id: "trend-6", topic: "new dad survival guide", searchVolume: 29000, competition: "medium", estimatedCPM: 9.40 },
  { id: "trend-7", topic: "print on demand 2025 trends", searchVolume: 38000, competition: "high", estimatedCPM: 7.80 },
  { id: "trend-8", topic: "Blackwell GPU benchmark", searchVolume: 52000, competition: "medium", estimatedCPM: 19.70 },
  { id: "trend-9", topic: "SAM.gov bidding tutorial", searchVolume: 8500, competition: "low", estimatedCPM: 24.30 },
  { id: "trend-10", topic: "eBay arbitrage automation", searchVolume: 19000, competition: "medium", estimatedCPM: 13.10 },
  { id: "trend-11", topic: "Tesla vs pilot salary", searchVolume: 31000, competition: "low", estimatedCPM: 16.50 },
];

// ─── Courses ───

export interface DemoCourseEnrollment {
  id: string;
  name: string;
  course: "pilot" | "newdad";
  modulesCompleted: number;
  totalModules: number;
  rating: number | null;
  source: "organic" | "affiliate" | "clickbank";
  enrolledAt: string;
}

export interface DemoCourseAffiliate {
  id: string;
  name: string;
  sales: number;
  commission: number;
  topCourse: "pilot" | "newdad";
}

export interface DemoRevenueMonth {
  month: string;
  pilot: number;
  newdad: number;
  affiliate: number;
}

const firstNames = ["James", "Sarah", "Mike", "Emily", "David", "Jessica", "Chris", "Ashley", "Matt", "Lauren", "Ryan", "Megan", "Tyler", "Rachel", "Josh", "Amanda", "Brandon", "Nicole", "Kevin", "Stephanie", "Brian", "Kayla", "Jake", "Heather", "Alex", "Brittany", "Cody", "Tiffany", "Derek", "Amber", "Trevor", "Courtney", "Zach", "Rebecca", "Sean", "Victoria", "Drew", "Olivia", "Marcus", "Hannah", "Grant", "Sophia", "Ethan", "Madison", "Noah"];
const lastInits = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "P", "R", "S", "T", "V", "W", "Z"];

function enrollment(i: number): DemoCourseEnrollment {
  const course = i % 3 === 0 ? "newdad" as const : "pilot" as const;
  const totalModules = 10;
  const completed = Math.min(totalModules, Math.floor(Math.random() * 12));
  const sources: DemoCourseEnrollment["source"][] = ["organic", "organic", "organic", "affiliate", "affiliate", "clickbank"];
  return {
    id: `demo-enroll-${i}`,
    name: `${firstNames[i % firstNames.length]} ${lastInits[i % lastInits.length]}.`,
    course,
    modulesCompleted: completed,
    totalModules,
    rating: completed >= 7 ? +(3.5 + Math.random() * 1.5).toFixed(1) : null,
    source: sources[i % sources.length],
    enrolledAt: new Date(Date.now() - i * 86400000 * 2.5).toISOString(),
  };
}

// Pre-generate with deterministic seeds
const seededEnrollments: DemoCourseEnrollment[] = [];
// Use a simple seeded approach for deterministic data
const completions = [10, 8, 10, 6, 9, 3, 10, 7, 5, 10, 2, 8, 10, 4, 9, 1, 7, 10, 6, 8, 10, 3, 9, 5, 10, 7, 2, 8, 4, 10, 9, 6, 10, 1, 7, 8, 3, 10, 5, 9, 10, 4, 8, 6, 10];
for (let i = 0; i < 45; i++) {
  const course = i % 3 === 0 ? "newdad" as const : "pilot" as const;
  const sources: DemoCourseEnrollment["source"][] = ["organic", "organic", "organic", "affiliate", "affiliate", "clickbank"];
  const completed = completions[i];
  seededEnrollments.push({
    id: `demo-enroll-${i}`,
    name: `${firstNames[i % firstNames.length]} ${lastInits[i % lastInits.length]}.`,
    course,
    modulesCompleted: completed,
    totalModules: 10,
    rating: completed >= 7 ? +(3.5 + (((i * 7 + 3) % 15) / 10)).toFixed(1) : null,
    source: sources[i % sources.length],
    enrolledAt: new Date(Date.now() - i * 86400000 * 2.5).toISOString(),
  });
}

export const DEMO_COURSE_ENROLLMENTS: DemoCourseEnrollment[] = seededEnrollments;

export const DEMO_COURSE_AFFILIATES: DemoCourseAffiliate[] = [
  { id: "aff-0", name: "FlyDreams Blog", sales: 23, commission: 161.00, topCourse: "pilot" },
  { id: "aff-1", name: "DadLife Podcast", sales: 19, commission: 133.00, topCourse: "newdad" },
  { id: "aff-2", name: "SkywardBound YT", sales: 15, commission: 105.00, topCourse: "pilot" },
  { id: "aff-3", name: "NewParentHub", sales: 12, commission: 84.00, topCourse: "newdad" },
  { id: "aff-4", name: "AviationStack", sales: 9, commission: 63.00, topCourse: "pilot" },
  { id: "aff-5", name: "FirstTimeDads IG", sales: 8, commission: 56.00, topCourse: "newdad" },
  { id: "aff-6", name: "PilotPathway", sales: 6, commission: 42.00, topCourse: "pilot" },
  { id: "aff-7", name: "ParentingWins", sales: 4, commission: 28.00, topCourse: "newdad" },
];

export const DEMO_REVENUE_HISTORY: DemoRevenueMonth[] = [
  { month: "Apr 2025", pilot: 54, newdad: 27, affiliate: 12 },
  { month: "May 2025", pilot: 81, newdad: 54, affiliate: 21 },
  { month: "Jun 2025", pilot: 108, newdad: 81, affiliate: 35 },
  { month: "Jul 2025", pilot: 135, newdad: 108, affiliate: 42 },
  { month: "Aug 2025", pilot: 189, newdad: 135, affiliate: 56 },
  { month: "Sep 2025", pilot: 216, newdad: 162, affiliate: 70 },
  { month: "Oct 2025", pilot: 270, newdad: 189, affiliate: 84 },
  { month: "Nov 2025", pilot: 297, newdad: 216, affiliate: 98 },
  { month: "Dec 2025", pilot: 351, newdad: 270, affiliate: 119 },
  { month: "Jan 2026", pilot: 378, newdad: 297, affiliate: 133 },
  { month: "Feb 2026", pilot: 405, newdad: 324, affiliate: 147 },
  { month: "Mar 2026", pilot: 432, newdad: 351, affiliate: 168 },
];

// ─── Activity Feed ───

export interface DemoActivity {
  id: string;
  venture: "dropship" | "merch" | "govbids" | "youtube" | "courses";
  icon: string;
  message: string;
  timestamp: string;
}

export const DEMO_ACTIVITIES: DemoActivity[] = [
  { id: "act-0", venture: "dropship", icon: "📦", message: "New pair found: Sony XM5 Headphones — $80 profit margin", timestamp: new Date(Date.now() - 1800000).toISOString() },
  { id: "act-1", venture: "merch", icon: "🎨", message: "\"Baby's Co-Pilot\" t-shirt trending on TikTok (score: 94)", timestamp: new Date(Date.now() - 3600000).toISOString() },
  { id: "act-2", venture: "youtube", icon: "▶️", message: "\"Pacific Ocean\" video hit 284K views", timestamp: new Date(Date.now() - 5400000).toISOString() },
  { id: "act-3", venture: "courses", icon: "🎓", message: "New enrollment: James A. — Pilot Course", timestamp: new Date(Date.now() - 7200000).toISOString() },
  { id: "act-4", venture: "govbids", icon: "🏛️", message: "Won: Tactical Backpack Lots — $196K contract", timestamp: new Date(Date.now() - 10800000).toISOString() },
  { id: "act-5", venture: "dropship", icon: "✅", message: "YETI Rambler listed on eBay — $13.50 expected profit", timestamp: new Date(Date.now() - 14400000).toISOString() },
  { id: "act-6", venture: "merch", icon: "💰", message: "\"Airplane Mode On\" stickers — 142 units sold", timestamp: new Date(Date.now() - 18000000).toISOString() },
  { id: "act-7", venture: "youtube", icon: "📝", message: "Script generated: \"Why Fighter Jets Cost $100M Each\"", timestamp: new Date(Date.now() - 21600000).toISOString() },
  { id: "act-8", venture: "courses", icon: "⭐", message: "New 5-star review on Pilot Course from Chris D.", timestamp: new Date(Date.now() - 25200000).toISOString() },
  { id: "act-9", venture: "govbids", icon: "📋", message: "Bid submitted: DHS Drone Fleet — $375K value", timestamp: new Date(Date.now() - 28800000).toISOString() },
  { id: "act-10", venture: "dropship", icon: "🔍", message: "Scanner found 3 new pairs in Electronics category", timestamp: new Date(Date.now() - 32400000).toISOString() },
  { id: "act-11", venture: "merch", icon: "🎨", message: "6 new designs queued for Printful upload", timestamp: new Date(Date.now() - 36000000).toISOString() },
  { id: "act-12", venture: "youtube", icon: "📊", message: "Channel growth: +127 subscribers today", timestamp: new Date(Date.now() - 39600000).toISOString() },
  { id: "act-13", venture: "courses", icon: "🎓", message: "Mike C. completed all 10 Pilot Course modules", timestamp: new Date(Date.now() - 43200000).toISOString() },
  { id: "act-14", venture: "govbids", icon: "⏰", message: "Deadline alert: DHS Body Camera bid due in 2 days", timestamp: new Date(Date.now() - 46800000).toISOString() },
  { id: "act-15", venture: "dropship", icon: "📦", message: "KitchenAid Mixer listed — highest profit pair ($50.01)", timestamp: new Date(Date.now() - 50400000).toISOString() },
  { id: "act-16", venture: "merch", icon: "📈", message: "\"First Time Dad Survival Kit\" — 89 sales, top seller", timestamp: new Date(Date.now() - 54000000).toISOString() },
  { id: "act-17", venture: "youtube", icon: "💵", message: "Monthly revenue update: $2,340 estimated", timestamp: new Date(Date.now() - 57600000).toISOString() },
  { id: "act-18", venture: "courses", icon: "🤝", message: "New affiliate: PilotPathway — 6 referrals", timestamp: new Date(Date.now() - 61200000).toISOString() },
  { id: "act-19", venture: "govbids", icon: "🏆", message: "Won: GPS Wildlife Collars — $86K (35% margin)", timestamp: new Date(Date.now() - 64800000).toISOString() },
];

// ═══════════════════════════════════════════════════
// Helper / Stats Functions
// ═══════════════════════════════════════════════════

export function getDemoDropshipStats(pairs: DemoDropshipPair[]) {
  const active = pairs.filter((p) => p.status !== "rejected");
  const totalProfit = active.reduce((s, p) => s + p.profit, 0);
  const listed = pairs.filter((p) => p.status === "listed").length;
  const pending = pairs.filter((p) => p.status === "pending").length;
  const approved = pairs.filter((p) => p.status === "approved").length;
  return { activePairs: active.length, totalProfit: +totalProfit.toFixed(2), listed, pending, approved };
}

export function getDemoMerchStats(designs: DemoMerchDesign[]) {
  const active = designs.filter((d) => d.status === "listed" || d.status === "sold");
  const totalRevenue = designs.reduce((s, d) => s + d.sales * d.price, 0);
  const totalProfit = designs.reduce((s, d) => s + d.sales * d.profit, 0);
  const avgProfit = active.length ? totalProfit / active.length : 0;
  return {
    totalDesigns: designs.length,
    activeListings: designs.filter((d) => d.status === "listed").length,
    revenue: +totalRevenue.toFixed(2),
    avgProfit: +avgProfit.toFixed(2),
  };
}

export function getDemoGovBidStats(bids: DemoGovBid[]) {
  const decided = bids.filter((b) => b.status === "won" || b.status === "lost");
  const won = bids.filter((b) => b.status === "won");
  const winRate = decided.length ? +((won.length / decided.length) * 100).toFixed(0) : 0;
  const pipelineValue = bids.filter((b) => b.status === "open" || b.status === "bid-submitted" || b.status === "under-review").reduce((s, b) => s + b.estimatedValue, 0);
  const revenueWon = won.reduce((s, b) => s + b.estimatedValue, 0);
  return { winRate, totalBids: bids.length, pipelineValue, revenueWon };
}

export function getDemoYouTubeStats(videos: DemoYouTubeVideo[]) {
  const published = videos.filter((v) => v.stage === "published");
  const totalViews = published.reduce((s, v) => s + v.views, 0);
  const monthlyRevenue = published.reduce((s, v) => s + v.revenue, 0);
  return {
    subscribers: 4827,
    monthlyViews: totalViews,
    monthlyRevenue: +monthlyRevenue.toFixed(2),
    growthRate: 12.4,
  };
}

export function getDemoCourseStats(enrollments: DemoCourseEnrollment[]) {
  const pilot = enrollments.filter((e) => e.course === "pilot");
  const newdad = enrollments.filter((e) => e.course === "newdad");

  function courseStats(list: DemoCourseEnrollment[]) {
    const completed = list.filter((e) => e.modulesCompleted === e.totalModules);
    const rated = list.filter((e) => e.rating !== null);
    const avgRating = rated.length ? +(rated.reduce((s, e) => s + (e.rating || 0), 0) / rated.length).toFixed(1) : 0;
    return {
      enrollments: list.length,
      completionPercent: list.length ? +((completed.length / list.length) * 100).toFixed(0) : 0,
      avgRating,
      revenue: list.length * 27,
    };
  }

  return { pilot: courseStats(pilot), newdad: courseStats(newdad), total: courseStats(enrollments) };
}

export function getHubStats() {
  const ds = getDemoDropshipStats(DEMO_DROPSHIP_PAIRS);
  const merch = getDemoMerchStats(DEMO_MERCH_DESIGNS);
  const gov = getDemoGovBidStats(DEMO_GOVBIDS);
  const yt = getDemoYouTubeStats(DEMO_YOUTUBE_VIDEOS);
  const courses = getDemoCourseStats(DEMO_COURSE_ENROLLMENTS);
  const combinedRevenue = ds.totalProfit + merch.revenue + gov.revenueWon + yt.monthlyRevenue + courses.total.revenue;
  return { ds, merch, gov, yt, courses, combinedRevenue };
}

export function getDaysUntil(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr);
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86400000));
}

export function formatCurrency(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
