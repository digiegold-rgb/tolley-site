// ─── Video Generation SaaS Constants ──────────────────

export const VIDEO_COMPANY = "Tolley.io";
export const VIDEO_CONTACT_EMAIL = "video@tolley.io";
export const VIDEO_CONTACT_PHONE = "816-898-1864";

// ─── Cloud Tiers ─────────────────────────────────────────
export type VideoTier = "basic" | "cinematic" | "premium" | "ultra";

export interface VideoTierConfig {
  id: VideoTier;
  name: string;
  badge: string;
  description: string;
  modelId: string;         // fal.ai model key
  modelLabel: string;      // display name
  resolution: string;
  duration: string;
  credits: number;         // cost in credits
  priceCents: number;      // retail price equivalent in cents
  costCents: number;       // our fal.ai cost in cents
  strengths: string[];
  hasAudio: boolean;
  estimatedTime: string;
}

export const VIDEO_TIERS: VideoTierConfig[] = [
  {
    id: "basic",
    name: "Basic",
    badge: "Best Value",
    description: "Fast AI video from text prompts. Ideal for social media clips, quick property teasers, and concept previews.",
    modelId: "wan26-720p",
    modelLabel: "Wan 2.6",
    resolution: "720p",
    duration: "5 seconds",
    credits: 1,
    priceCents: 500,
    costCents: 25,
    strengths: ["Social media", "Quick previews", "Product shots", "Teasers"],
    hasAudio: false,
    estimatedTime: "~30 seconds",
  },
  {
    id: "cinematic",
    name: "Cinematic",
    badge: "Most Popular",
    description: "Full HD cinematic video with extended duration. Perfect for listing walkthroughs, brand videos, and professional content.",
    modelId: "wan26-1080p",
    modelLabel: "Wan 2.6",
    resolution: "1080p",
    duration: "10 seconds",
    credits: 3,
    priceCents: 1500,
    costCents: 75,
    strengths: ["Listings", "Walkthroughs", "Brand content", "Presentations"],
    hasAudio: false,
    estimatedTime: "~45 seconds",
  },
  {
    id: "premium",
    name: "Premium",
    badge: "With Audio",
    description: "Google Veo 3 with AI-generated audio. Cinematic quality with synchronized sound for immersive property showcases.",
    modelId: "veo3-fast",
    modelLabel: "Veo 3 Fast",
    resolution: "1080p + Audio",
    duration: "5 seconds",
    credits: 5,
    priceCents: 2500,
    costCents: 200,
    strengths: ["Audio sync", "Immersive", "Showcases", "Luxury listings"],
    hasAudio: true,
    estimatedTime: "~60 seconds",
  },
  {
    id: "ultra",
    name: "Ultra",
    badge: "Best Quality",
    description: "Full Veo 3 standard — the most cinematic AI video available. Extended duration with audio for hero listing videos.",
    modelId: "veo3-standard",
    modelLabel: "Veo 3",
    resolution: "1080p + Audio",
    duration: "8 seconds",
    credits: 10,
    priceCents: 4900,
    costCents: 500,
    strengths: ["Hero videos", "Luxury", "Full production", "Portfolio"],
    hasAudio: true,
    estimatedTime: "~90 seconds",
  },
] as const;

export function getTierConfig(tierId: VideoTier): VideoTierConfig {
  return VIDEO_TIERS.find((t) => t.id === tierId) || VIDEO_TIERS[0];
}

// ─── Credit Packs ────────────────────────────────────────
export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  perCreditCents: number;
  envKey: string;         // Stripe price env var name
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: "starter", name: "Starter", credits: 5, priceCents: 2500, perCreditCents: 500, envKey: "STRIPE_PRICE_VIDEO_PACK_5" },
  { id: "producer", name: "Producer", credits: 20, priceCents: 8000, perCreditCents: 400, envKey: "STRIPE_PRICE_VIDEO_PACK_20" },
  { id: "studio", name: "Studio", credits: 50, priceCents: 17500, perCreditCents: 350, envKey: "STRIPE_PRICE_VIDEO_PACK_50" },
];

// ─── Subscription Plans ──────────────────────────────────
export interface SubscriptionPlan {
  id: string;
  name: string;
  credits: number;       // monthly allotment
  priceCents: number;    // monthly price
  perCreditCents: number;
  envKey: string;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  { id: "basic", name: "Basic", credits: 12, priceCents: 4900, perCreditCents: 408, envKey: "STRIPE_PRICE_VIDEO_BASIC" },
  { id: "pro", name: "Pro", credits: 48, priceCents: 14900, perCreditCents: 310, envKey: "STRIPE_PRICE_VIDEO_PRO" },
  { id: "unlimited", name: "Unlimited", credits: 150, priceCents: 39900, perCreditCents: 266, envKey: "STRIPE_PRICE_VIDEO_UNLIMITED" },
];

// ─── Use Cases ───────────────────────────────────────────
export const VIDEO_USE_CASES = [
  {
    title: "Real Estate Listings",
    description: "Generate cinematic property walkthrough previews from text descriptions or addresses.",
    icon: "home",
  },
  {
    title: "Product Showcases",
    description: "Create professional product reveal videos for shop listings and social posts.",
    icon: "cube",
  },
  {
    title: "Social Media Content",
    description: "Generate scroll-stopping video content for TikTok, Instagram Reels, and YouTube Shorts.",
    icon: "share",
  },
  {
    title: "Brand Storytelling",
    description: "Bring brand narrative to life with custom cinematic sequences.",
    icon: "film",
  },
  {
    title: "Event Promos",
    description: "Create eye-catching event teasers and promotional videos in minutes.",
    icon: "calendar",
  },
  {
    title: "E-commerce",
    description: "Generate lifestyle product videos for shop and Facebook Marketplace listings.",
    icon: "cart",
  },
] as const;

// ─── FAQ ─────────────────────────────────────────────────
export const VIDEO_FAQ = [
  {
    q: "How does it work?",
    a: "Enter a text prompt describing your video. Our cloud GPU infrastructure generates cinematic AI video in under 90 seconds using Wan 2.6 or Google Veo 3.",
  },
  {
    q: "How long are the clips?",
    a: "5-10 seconds depending on the tier. Perfect for social media hooks, listing teasers, and property showcases. Premium and Ultra tiers include AI-generated audio.",
  },
  {
    q: "What resolution?",
    a: "Basic tier is 720p. Cinematic, Premium, and Ultra tiers are full 1080p. Premium and Ultra include synchronized AI audio.",
  },
  {
    q: "How fast is generation?",
    a: "30-90 seconds depending on the tier — delivered via cloud GPUs with unlimited parallelism. No waiting in queue.",
  },
  {
    q: "What are credits?",
    a: "Credits are the currency for video generation. 1 credit = 1 Basic video. Higher tiers cost more credits. Buy packs or subscribe monthly for better rates.",
  },
  {
    q: "Can I use these for listings?",
    a: "Absolutely. Real estate agents use Tolley.io to generate property teaser videos from descriptions, saving hundreds compared to traditional videography.",
  },
] as const;

export const VIDEO_PROCESS_STEPS = [
  {
    step: 1,
    title: "Write a Prompt",
    description: "Describe the scene — property details, style, mood, camera angle. The more detail, the better the output.",
  },
  {
    step: 2,
    title: "Cloud GPU Generates",
    description: "Wan 2.6 or Veo 3 renders your video on cloud GPUs. Results in under 90 seconds.",
  },
  {
    step: 3,
    title: "Download & Share",
    description: "Preview, download MP4, and share directly to social media or listing platforms.",
  },
] as const;
