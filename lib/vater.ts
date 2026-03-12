// ─── Vater Ventures — Constants & Data ───

export const VATER_BRAND = "Vater Ventures";
export const VATER_TAGLINE = "Five Runways. One Mission.";
export const VATER_DESCRIPTION =
  "Five AI-powered passive-income businesses, built for a pilot who thinks in flight plans.";

// ─── Theme Colors ───
export const VATER_COLORS = {
  bg: "#061020",
  bgAlt: "#0a1628",
  primary: "#38bdf8",
  cta: "#f59e0b",
  text: "#e2e8f0",
  card: "#0f172a",
  muted: "#94a3b8",
} as const;

// ─── Ventures ───
export interface VaterVenture {
  slug: string;
  title: string;
  subtitle: string;
  icon: string;
  badges: string[];
  description: string;
  href: string;
}

export const VATER_VENTURES: VaterVenture[] = [
  {
    slug: "dropship",
    title: "Dropship",
    subtitle: "Amazon → eBay Arbitrage",
    icon: "📦",
    badges: ["AI-Powered", "Auto-Fulfill", "Price Gap Detection"],
    description:
      "Scan Amazon for underpriced products, auto-list on eBay at markup, fulfill direct from Amazon. Zero inventory.",
    href: "/vater/dropship",
  },
  {
    slug: "merch",
    title: "Merch",
    subtitle: "Print-on-Demand Empire",
    icon: "👕",
    badges: ["Etsy", "Printful", "AI Designs", "Zero Inventory"],
    description:
      "AI-generated designs trending on Etsy, auto-listed and fulfilled by Printful. No stock, no shipping.",
    href: "/vater/merch",
  },
  {
    slug: "govbids",
    title: "GovBids",
    subtitle: "Government & Military Contracts",
    icon: "🏛️",
    badges: ["SAM.gov", "Low Competition", "High Margin"],
    description:
      "Win government supply contracts by undercutting incumbents. AI scans bids, calculates margins, submits proposals.",
    href: "/vater/govbids",
  },
  {
    slug: "youtube",
    title: "YouTube",
    subtitle: "Faceless Content Machine",
    icon: "🎬",
    badges: ["AI Scripts", "Human Voice", "Automated Editing"],
    description:
      "AI-scripted, AI-edited faceless YouTube channels. Source trending topics, generate scripts, publish at scale.",
    href: "/vater/youtube",
  },
  {
    slug: "courses",
    title: "Courses",
    subtitle: "Digital Knowledge Products",
    icon: "🎓",
    badges: ["Pilot Course", "New Dad Course", "Passive Revenue"],
    description:
      "Two flagship digital courses built from real experience — flight training and first-time fatherhood.",
    href: "/vater/courses",
  },
];

// ─── Dropship ───
export const DROPSHIP_STEPS = [
  {
    step: 1,
    title: "Scan",
    description: "AI crawls Amazon for products with price gaps vs eBay listings.",
    icon: "🔍",
  },
  {
    step: 2,
    title: "List",
    description: "Auto-generate optimized eBay listings with AI-written descriptions.",
    icon: "📝",
  },
  {
    step: 3,
    title: "Sell",
    description: "Customer buys on eBay at marked-up price. You keep the spread.",
    icon: "💰",
  },
  {
    step: 4,
    title: "Fulfill",
    description: "Order auto-placed on Amazon, shipped direct to buyer. Hands-off.",
    icon: "🚀",
  },
];

export const DROPSHIP_SETUP = [
  { item: "eBay Seller Account", status: "required" },
  { item: "eBay API Credentials (App ID, Cert ID, OAuth Token)", status: "required" },
  { item: "Amazon Associates / PA-API Access", status: "required" },
  { item: "Stripe Account (for additional payment processing)", status: "optional" },
  { item: "VPN / Proxy for price scanning", status: "recommended" },
];

export const DROPSHIP_FAQ = [
  {
    q: "Is Amazon-to-eBay dropshipping allowed?",
    a: "Yes, with caveats. You must be the seller of record, handle returns, and not use Amazon Prime for arbitrage fulfillment. Our system uses standard Amazon orders.",
  },
  {
    q: "What margins can I expect?",
    a: "Typical margins range 15-35% after fees. The AI focuses on items with at least 20% price gaps before eBay fees.",
  },
  {
    q: "How many listings can the bot manage?",
    a: "The system can manage 500-2,000+ active listings simultaneously, auto-repricing and delisting when margins shrink.",
  },
  {
    q: "What if Amazon raises the price after I sell?",
    a: "The bot monitors prices in real-time. If a margin drops below threshold, it auto-pauses the listing before orders come in.",
  },
];

// ─── Merch ───
export const MERCH_STEPS = [
  {
    step: 1,
    title: "Trend Research",
    description: "AI scans Etsy, Pinterest, and Google Trends for hot niches and keywords.",
    icon: "📊",
  },
  {
    step: 2,
    title: "AI Design",
    description: "Generate print-ready designs using DALL-E / Midjourney with trend-matched prompts.",
    icon: "🎨",
  },
  {
    step: 3,
    title: "Auto-List",
    description: "Listings created on Etsy with SEO-optimized titles, tags, and mockup photos.",
    icon: "🏪",
  },
  {
    step: 4,
    title: "POD Fulfills",
    description: "Printful prints and ships on demand. No inventory, no shipping, no hassle.",
    icon: "📬",
  },
];

export const MERCH_PLATFORMS = [
  {
    name: "Etsy",
    role: "Primary storefront",
    description: "180M+ annual buyers actively searching for unique, niche designs.",
  },
  {
    name: "Printful",
    role: "Print & fulfill",
    description: "Auto-syncs with Etsy. Prints, packs, and ships with your brand label.",
  },
  {
    name: "Printify",
    role: "Backup fulfiller",
    description: "Secondary POD for products Printful doesn't offer. Wider product catalog.",
  },
];

export const MERCH_SETUP = [
  { item: "Etsy Seller Account + API Key", status: "required" },
  { item: "Printful Account + API Key", status: "required" },
  { item: "OpenAI API Key (image generation)", status: "required" },
  { item: "Printify Account (optional backup)", status: "optional" },
];

export const MERCH_FAQ = [
  {
    q: "Do I need design skills?",
    a: "No. The AI generates designs based on trending keywords. You approve or tweak, then it auto-lists.",
  },
  {
    q: "What products sell best?",
    a: "T-shirts, mugs, and tote bags are the bread and butter. Seasonal items (holidays, events) spike hard.",
  },
  {
    q: "How much per sale?",
    a: "Average Etsy POD profit is $5-15 per item after Printful cost and Etsy fees. Volume is the game.",
  },
  {
    q: "Can I sell on Amazon Merch too?",
    a: "Yes, Amazon Merch on Demand is invite-only but a great add-on once approved. The AI can cross-list.",
  },
];

// ─── GovBids ───
export const GOVBIDS_STEPS = [
  {
    step: 1,
    title: "Research",
    description: "AI monitors SAM.gov for new solicitations matching your NAICS codes.",
    icon: "🔎",
  },
  {
    step: 2,
    title: "Cost Calc",
    description: "Auto-calculate landed cost, shipping, and margin for each opportunity.",
    icon: "🧮",
  },
  {
    step: 3,
    title: "Bid",
    description: "Generate compliant bid packages with pricing sheets and capability statements.",
    icon: "📋",
  },
  {
    step: 4,
    title: "Win & Fulfill",
    description: "Win the contract, source product, ship to government facility. Repeat.",
    icon: "🏆",
  },
];

export const GOVBIDS_REQUIREMENTS = [
  { item: "SAM.gov Registration", description: "System for Award Management — required for all federal contracts", required: true },
  { item: "UEI Number", description: "Unique Entity Identifier, replaces DUNS", required: true },
  { item: "CAGE Code", description: "Commercial and Government Entity code", required: true },
  { item: "NAICS Codes", description: "Industry classification codes for your supply categories", required: true },
  { item: "EIN (Tax ID)", description: "Employer Identification Number from IRS", required: true },
  { item: "Capability Statement", description: "1-2 page company overview for contracting officers", required: true },
  { item: "Small Business Certification", description: "SBA size standards — unlocks set-aside contracts", required: false },
  { item: "Past Performance Record", description: "Documentation of completed contracts (builds over time)", required: false },
];

export const GOVBIDS_SETUP = [
  { item: "SAM.gov Registration + API Key", status: "required" },
  { item: "UEI + CAGE Code", status: "required" },
  { item: "Business Entity (LLC/Corp) + EIN", status: "required" },
  { item: "Shipping Account (UPS/FedEx)", status: "required" },
  { item: "Wholesale supplier accounts", status: "recommended" },
];

export const GOVBIDS_FAQ = [
  {
    q: "Do I need prior government experience?",
    a: "No. Many micro-purchase contracts ($0-$10K) require no past performance. Start small, build a track record.",
  },
  {
    q: "How long does SAM.gov registration take?",
    a: "Typically 7-10 business days for new registrations. Renewals are faster. Start this immediately.",
  },
  {
    q: "What products should I bid on?",
    a: "Office supplies, janitorial products, safety equipment, and general commodities have the lowest barriers. AI will identify best-margin opportunities.",
  },
  {
    q: "Is this actually profitable?",
    a: "Government contracts are $700B+/year. Small businesses get 23% by law. Margins on supply contracts typically run 20-40%.",
  },
];

// ─── YouTube ───
export const YOUTUBE_STEPS = [
  {
    step: 1,
    title: "Source",
    description: "AI identifies trending topics, viral hooks, and content gaps in your niche.",
    icon: "📡",
  },
  {
    step: 2,
    title: "Script",
    description: "GPT-4 writes engaging scripts optimized for retention and watch time.",
    icon: "✍️",
  },
  {
    step: 3,
    title: "Voiceover",
    description: "ElevenLabs generates natural-sounding voiceover from the script.",
    icon: "🎙️",
  },
  {
    step: 4,
    title: "Edit",
    description: "Auto-edit with stock footage, transitions, captions, and thumbnails.",
    icon: "🎞️",
  },
  {
    step: 5,
    title: "Publish",
    description: "Schedule and publish via YouTube API with optimized titles, tags, and descriptions.",
    icon: "📺",
  },
];

export const YOUTUBE_MILESTONES = [
  {
    subs: "1K",
    revenue: "$100-500/mo",
    description: "Monetization unlocked. Ad revenue begins. Focus on consistency.",
  },
  {
    subs: "10K",
    revenue: "$1K-5K/mo",
    description: "Sponsors start reaching out. Affiliate links become meaningful.",
  },
  {
    subs: "100K",
    revenue: "$5K-25K/mo",
    description: "Silver play button. Brand deals, course upsells, and merchandise.",
  },
];

export const YOUTUBE_SETUP = [
  { item: "YouTube Channel + API Key", status: "required" },
  { item: "Google OAuth (Client ID + Secret)", status: "required" },
  { item: "ElevenLabs API Key (voiceover)", status: "required" },
  { item: "OpenAI API Key (scripting)", status: "required" },
  { item: "Stock footage subscription (Pexels/Storyblocks)", status: "recommended" },
];

export const YOUTUBE_FAQ = [
  {
    q: "Is faceless YouTube actually viable?",
    a: "Yes. Channels like Bright Side, Aperture, and dozens of finance/tech channels run faceless with millions of subs. Content quality matters, not your face.",
  },
  {
    q: "What niches work best?",
    a: "Finance, tech explainers, true crime, history, and 'top 10' formats consistently perform. Aviation content is underserved and high-CPM.",
  },
  {
    q: "How often should I post?",
    a: "3-5 videos/week for the first 6 months to train the algorithm. The AI pipeline makes this feasible without burnout.",
  },
  {
    q: "Will YouTube detect AI content?",
    a: "YouTube requires AI disclosure for realistic content. Faceless channels with AI narration and stock footage are fully compliant when labeled properly.",
  },
];

// ─── Courses ───
export interface CourseModule {
  number: number;
  title: string;
  description: string;
}

export interface VaterCourse {
  slug: string;
  title: string;
  subtitle: string;
  price: number;
  audience: string;
  icon: string;
  moduleCount: number;
  modules: CourseModule[];
  stripePriceEnv: string;
}

export const PILOT_COURSE: VaterCourse = {
  slug: "pilot",
  title: "How to Become a Pilot",
  subtitle: "From zero hours to certified — the real roadmap",
  price: 27,
  audience: "Aspiring pilots, career changers, aviation enthusiasts",
  icon: "✈️",
  moduleCount: 10,
  stripePriceEnv: "STRIPE_PILOT_PRICE_ID",
  modules: [
    { number: 1, title: "Is Flying Right for You?", description: "Costs, time commitment, medical requirements, and the honest truth about pilot life." },
    { number: 2, title: "Understanding Pilot Licenses", description: "Student, Private, Instrument, Commercial, ATP — what each one unlocks and costs." },
    { number: 3, title: "Choosing a Flight School", description: "Part 61 vs Part 141, red flags, cost comparison, and how to evaluate instructors." },
    { number: 4, title: "The FAA Medical Exam", description: "Classes of medical certificates, what disqualifies you, and how to prepare for your exam." },
    { number: 5, title: "Ground School Essentials", description: "Aerodynamics, weather, navigation, regulations — the knowledge test blueprint." },
    { number: 6, title: "Your First Flight Lessons", description: "What to expect in the cockpit, pre-flight checks, basic maneuvers, and building hours." },
    { number: 7, title: "Solo Flight & Cross-Country", description: "Earning your solo endorsement, cross-country planning, and building PIC time." },
    { number: 8, title: "The Checkride", description: "Oral exam prep, practical test standards, common failures, and how to pass first try." },
    { number: 9, title: "Building Hours & Ratings", description: "Instrument rating, multi-engine, CFI path, and the most cost-effective hour-building strategies." },
    { number: 10, title: "Career Paths in Aviation", description: "Airlines, corporate, charter, cargo, military, and non-flying aviation careers." },
  ],
};

export const NEWDAD_COURSE: VaterCourse = {
  slug: "newdad",
  title: "New Dad's First 2 Years",
  subtitle: "The no-BS guide from a dad who's been there",
  price: 27,
  audience: "Expecting fathers, new dads, partners wanting to be prepared",
  icon: "👶",
  moduleCount: 10,
  stripePriceEnv: "STRIPE_NEWDAD_PRICE_ID",
  modules: [
    { number: 1, title: "The Delivery Room", description: "What to pack, what to expect, how to actually be useful, and the moments that change everything." },
    { number: 2, title: "First 48 Hours", description: "Hospital protocols, skin-to-skin, first diaper, and surviving on zero sleep." },
    { number: 3, title: "Feeding Fundamentals", description: "Breastfeeding support, bottle basics, formula options, and how dad fits into feeding." },
    { number: 4, title: "Sleep Strategy", description: "Safe sleep setup, swaddling, wake windows, and the sleep regression survival guide." },
    { number: 5, title: "The First 3 Months", description: "Colic, growth spurts, tummy time, and finding your rhythm as a new family." },
    { number: 6, title: "Months 3-6: Finding Your Groove", description: "Rolling, laughing, solid foods intro, daycare decisions, and reclaiming date night." },
    { number: 7, title: "Months 6-12: The Mobile Baby", description: "Crawling, baby-proofing, teething hell, separation anxiety, and first words." },
    { number: 8, title: "The Toddler Transition", description: "Walking, tantrums, discipline basics, screen time, and keeping your sanity." },
    { number: 9, title: "Keeping Your Relationship Alive", description: "Communication, division of labor, intimacy after kids, and being a team." },
    { number: 10, title: "Dad's Mental Health", description: "Postpartum depression in dads, burnout, asking for help, and building your support network." },
  ],
};

export const VATER_COURSES = [PILOT_COURSE, NEWDAD_COURSE];

// ─── Credential Placeholders (for PDF) ───
export interface CredentialEntry {
  venture: string;
  name: string;
  envVar: string;
  signupUrl: string;
}

export const VATER_CREDENTIALS: CredentialEntry[] = [
  // Dropship
  { venture: "Dropship", name: "eBay App ID", envVar: "EBAY_APP_ID", signupUrl: "https://developer.ebay.com/" },
  { venture: "Dropship", name: "eBay Cert ID", envVar: "EBAY_CERT_ID", signupUrl: "https://developer.ebay.com/" },
  { venture: "Dropship", name: "eBay OAuth Token", envVar: "EBAY_OAUTH_TOKEN", signupUrl: "https://developer.ebay.com/" },
  { venture: "Dropship", name: "Amazon Access Key", envVar: "AMAZON_ACCESS_KEY", signupUrl: "https://affiliate-program.amazon.com/" },
  { venture: "Dropship", name: "Amazon Secret Key", envVar: "AMAZON_SECRET_KEY", signupUrl: "https://affiliate-program.amazon.com/" },
  { venture: "Dropship", name: "Amazon Partner Tag", envVar: "AMAZON_PARTNER_TAG", signupUrl: "https://affiliate-program.amazon.com/" },
  // Merch
  { venture: "Merch", name: "Etsy API Key", envVar: "ETSY_API_KEY", signupUrl: "https://www.etsy.com/developers/" },
  { venture: "Merch", name: "Etsy API Secret", envVar: "ETSY_API_SECRET", signupUrl: "https://www.etsy.com/developers/" },
  { venture: "Merch", name: "Printful API Key", envVar: "PRINTFUL_API_KEY", signupUrl: "https://www.printful.com/dashboard/developer" },
  { venture: "Merch", name: "OpenAI API Key", envVar: "OPENAI_API_KEY", signupUrl: "https://platform.openai.com/" },
  // GovBids
  { venture: "GovBids", name: "SAM.gov API Key", envVar: "SAM_API_KEY", signupUrl: "https://sam.gov/" },
  { venture: "GovBids", name: "UEI Number", envVar: "GOV_UEI", signupUrl: "https://sam.gov/" },
  { venture: "GovBids", name: "CAGE Code", envVar: "GOV_CAGE_CODE", signupUrl: "https://cage.dla.mil/" },
  { venture: "GovBids", name: "UPS API Key", envVar: "UPS_API_KEY", signupUrl: "https://developer.ups.com/" },
  { venture: "GovBids", name: "FedEx API Key", envVar: "FEDEX_API_KEY", signupUrl: "https://developer.fedex.com/" },
  // YouTube
  { venture: "YouTube", name: "YouTube API Key", envVar: "YOUTUBE_API_KEY", signupUrl: "https://console.cloud.google.com/" },
  { venture: "YouTube", name: "Google Client ID", envVar: "GOOGLE_CLIENT_ID", signupUrl: "https://console.cloud.google.com/" },
  { venture: "YouTube", name: "Google Client Secret", envVar: "GOOGLE_CLIENT_SECRET", signupUrl: "https://console.cloud.google.com/" },
  { venture: "YouTube", name: "ElevenLabs API Key", envVar: "ELEVENLABS_API_KEY", signupUrl: "https://elevenlabs.io/" },
  { venture: "YouTube", name: "OpenAI API Key (Scripts)", envVar: "OPENAI_API_KEY", signupUrl: "https://platform.openai.com/" },
  // Courses
  { venture: "Courses", name: "Stripe Secret Key", envVar: "STRIPE_SECRET_KEY", signupUrl: "https://dashboard.stripe.com/" },
  { venture: "Courses", name: "Stripe Pilot Price ID", envVar: "STRIPE_PILOT_PRICE_ID", signupUrl: "https://dashboard.stripe.com/products" },
  { venture: "Courses", name: "Stripe New Dad Price ID", envVar: "STRIPE_NEWDAD_PRICE_ID", signupUrl: "https://dashboard.stripe.com/products" },
  { venture: "Courses", name: "ConvertKit API Key", envVar: "CONVERTKIT_API_KEY", signupUrl: "https://convertkit.com/" },
];
