/**
 * Jelly Studio — legal constants for /animate/terms, /animate/privacy and
 * /animate/beta.
 *
 * Deliberately separate from lib/legal.ts (T-Agent | Real Estate Unlocked, an
 * SMS/A2P posture) and lib/legal-estate.ts (Tolley Estate Sales, an in-home
 * services posture). Jelly Studio is a third posture entirely: a prepaid,
 * usage-billed generative-AI beta with voice cloning, YouTube API access and a
 * promotional license. A studio customer must never land on an A2P SMS policy.
 *
 * TOS_VERSION is the click-wrap stamp. It is written to User.termsVersion at
 * signup alongside User.termsAcceptedAt, so we can tell later exactly which
 * text a given account agreed to. Bump it (and the Last Updated date) whenever
 * the substance of the Terms, Privacy Policy or Beta Addendum changes.
 */

export const ANIMATE_LEGAL_BRAND = "Jelly Studio";
export const ANIMATE_LEGAL_ENTITY =
  "Your KC Homes LLC, a Missouri limited liability company, d/b/a Jelly Studio / Tolley";
export const ANIMATE_LEGAL_ENTITY_SHORT = "Your KC Homes LLC";
export const ANIMATE_LEGAL_ADDRESS = "Independence, Missouri, United States";
export const ANIMATE_LEGAL_EMAIL = "jared@yourkchomes.com"; // tolley.io has no MX — support@ does not exist

/** Click-wrap version stamp — stored on User.termsVersion. */
export const TOS_VERSION = "2026-08-15";
export const ANIMATE_LEGAL_EFFECTIVE_DATE = "August 15, 2026";
export const ANIMATE_LEGAL_LAST_UPDATED = "August 15, 2026";

/** Operations fee per finished minute of delivered video, on top of compute at
 *  cost. Mirrors DEFAULT_OPS_RATE_PER_MIN in lib/vater/video-cost.ts — if that
 *  number moves, this text and the Beta Addendum example must move with it. */
export const ANIMATE_OPS_RATE_PER_MIN = 0.35;

/** Promotional (gifted) credits expire this many days after they are granted.
 *  Purchased credits never expire. */
export const ANIMATE_PROMO_CREDIT_EXPIRY_DAYS = 60;

/** Days a customer has to opt out of arbitration by emailing support. */
export const ANIMATE_ARBITRATION_OPT_OUT_DAYS = 30;

/** Statutory removal window we commit to for non-consensual intimate imagery
 *  reports (TAKE IT DOWN Act, 15 U.S.C. § 6851 note). */
export const ANIMATE_NCII_REMOVAL_HOURS = 48;

/** Liability cap floor, in USD. Cap is the greater of this or 3 months of fees. */
export const ANIMATE_LIABILITY_CAP_FLOOR_USD = 100;

/** Days finished renders stay on our CDN after delivery unless downloaded or
 *  pinned to a project. */
export const ANIMATE_RENDER_RETENTION_DAYS = 90;

export const ANIMATE_LINKS = {
  youtubeTerms: "https://www.youtube.com/t/terms",
  googlePrivacy: "https://policies.google.com/privacy",
  googleSecuritySettings: "https://security.google.com/settings/security/permissions",
  terms: "/animate/terms",
  privacy: "/animate/privacy",
  beta: "/animate/beta",
} as const;

export type Subprocessor = {
  name: string;
  purpose: string;
  /** Where the processing happens, when it is not "United States". */
  location?: string;
  /** True when the vendor is contracted but not yet wired in. */
  planned?: boolean;
};

/**
 * Every third party that can touch customer data. Named individually on
 * purpose: "we use industry-standard vendors" is not a disclosure.
 */
export const ANIMATE_SUBPROCESSORS: Subprocessor[] = [
  {
    name: "Vercel Inc.",
    purpose:
      "Application hosting, serverless functions, Postgres database, and Blob storage for uploads and finished renders.",
  },
  {
    name: "Stripe, Inc.",
    purpose:
      "Card storage, payment processing, and credit purchases. We never see or store your full card number.",
  },
  {
    name: "Modal Labs, Inc.",
    purpose: "GPU compute for image, video, and audio generation jobs.",
  },
  {
    name: "Google LLC",
    purpose:
      "Gemini models for scripting and analysis, and the YouTube Data API for publishing to channels you connect.",
  },
  {
    name: "ElevenLabs Inc.",
    purpose: "Text-to-speech and voice cloning, when you use a cloud voice.",
  },
  {
    name: "fal.ai (Features & Labels, Inc.)",
    purpose: "Hosted image and video model inference.",
  },
  {
    name: "Moonshot AI (Kimi), accessed through LiteLLM",
    purpose:
      "Long-context script planning and direction. Prompts routed to this model are processed by a provider operating in China; do not put anything in a prompt that you would not want processed outside the United States.",
    location: "China",
  },
  {
    name: "OpenAI, L.L.C.",
    purpose: "Whisper speech-to-text for transcription, captioning, and alignment.",
  },
  {
    name: "Sentry (Functional Software, Inc.)",
    purpose: "Application error monitoring and crash diagnostics.",
    planned: true,
  },
  {
    name: "Tolley-operated GPU server",
    purpose:
      "A physical server we own and administer, used for local model inference, text-to-speech, and rendering.",
    location: "Missouri, United States",
  },
];

export type RetentionRow = {
  data: string;
  period: string;
};

export const ANIMATE_RETENTION: RetentionRow[] = [
  {
    data: "Uploads, source images, scripts, and voice reference recordings",
    period:
      "Kept while your account is active, then deleted within 30 days of account closure or of your deleting the project.",
  },
  {
    data: "Finished renders (video and audio files)",
    period: `${ANIMATE_RENDER_RETENTION_DAYS} days on our CDN after delivery, unless you download them or pin them to a project. Download the ones you care about.`,
  },
  {
    data: "Account, project, and job metadata (titles, settings, cost lines)",
    period: "Kept while your account is active, then deleted within 30 days of closure.",
  },
  {
    data: "Application and access logs",
    period: "12 months, then deleted automatically.",
  },
  {
    data: "Billing and payment records",
    period: "7 years, as required for tax and business recordkeeping.",
  },
];
