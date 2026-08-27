/**
 * components/animate/brands.ts — the two front doors of the studio.
 *
 * Colour is delivered as CSS variables (`--jb-*`) set on the product layout;
 * `tokens.ts` reads them with Jelly fallbacks so /animate is unchanged when no
 * layout sets them. Strings/logo/nav come from `useProduct()`.
 *
 * ⚠️ Keep this importable from client components (no server-only deps).
 */
import type { Product } from "@/lib/vater/product";
import { PRODUCT_NAME, STUDIO_HOME } from "@/lib/vater/product";

export interface BrandSupport {
  email: string;
  /** E.164, e.g. "+19139149429". Renders tel:/sms: links when present. */
  phone?: string;
  sms?: string;
  hours?: string;
  /** Who answers — shown next to the call/text buttons. */
  who?: string;
}

export interface BrandLegal {
  terms: string;
  privacy: string;
  beta: string;
}

export interface Brand {
  product: Product;
  /** Full product name for titles/metadata. */
  name: string;
  /** Short wordmark shown in the sidebar lockup. */
  wordmark: string;
  /** Small eyebrow above the wordmark (e.g. "by Jelly!"). */
  eyebrow?: string;
  logoSrc: string;
  logoMonoSrc?: string;
  homePath: string;
  /** Route id the shell opens on sign-in. */
  defaultRoute: string;
  legal: BrandLegal;
  support: BrandSupport;
  themeColor: string;
  og: { image: string; title: string; description: string };
  /** `--jb-*` variables applied on the product layout (dark theme values). */
  cssVars: Record<string, string>;
  /** Overrides applied when the light theme is active. */
  cssVarsLight?: Record<string, string>;
}

export const JELLY_BRAND: Brand = {
  product: "jelly",
  name: PRODUCT_NAME.jelly,
  wordmark: "JELLY STUDIO",
  logoSrc: "/animate/brand/logo.svg",
  logoMonoSrc: "/animate/brand/logo-mono-white.svg",
  homePath: STUDIO_HOME.jelly,
  defaultRoute: "dashboard",
  legal: { terms: "/animate/terms", privacy: "/animate/privacy", beta: "/animate/beta" },
  support: { email: "support@tolley.io" },
  themeColor: "#0A0A14",
  og: {
    image: "/animate/brand/og-cinema-1200x630.png",
    title: "Jelly! Studio — faceless YouTube, animated",
    description: "Write it, voice it, animate it, post it. Pay per video.",
  },
  // Jelly sets nothing: tokens.ts fallbacks ARE the Jelly palette.
  cssVars: {},
};

/**
 * Listing Studio placeholder palette — navy / gold / ivory — until the Claude
 * Design pass returns tokens.json. Replace values here only; consumers read
 * the variables.
 */
export const LISTING_CSS_VARS: Record<string, string> = {
  "--jb-brand": "#1F5FA8",
  "--jb-brand-light": "#4F86CC",
  "--jb-brand-dark": "#0B1F3A",
  "--jb-brand-ghost": "rgba(31,95,168,0.14)",
  "--jb-brand-outline": "rgba(31,95,168,0.42)",
  "--jb-brand-glow": "rgba(31,95,168,0.35)",
  "--jb-cyan": "#C9A24A",
  "--jb-cyan-ghost": "rgba(201,162,74,0.16)",
  "--jb-accent": "#C9A24A",
  "--jb-accent-dark": "#9C7A2E",
  "--jb-grad-primary": "linear-gradient(135deg, #1F5FA8 0%, #C9A24A 100%)",
  "--jb-grad-text": "linear-gradient(90deg, #4F86CC 0%, #C9A24A 100%)",
  "--jb-grad-ticket": "linear-gradient(135deg, #0B1F3A 0%, #1F5FA8 100%)",
  "--jb-grad-chip-on": "linear-gradient(135deg, #1F5FA8 0%, #4F86CC 100%)",
  "--jb-grad-create": "linear-gradient(135deg, #1F5FA8 0%, #C9A24A 100%)",
  "--jb-grad-credits": "linear-gradient(135deg, #C9A24A 0%, #9C7A2E 100%)",
  "--jb-grad-upgrade": "linear-gradient(135deg, #0B1F3A 0%, #C9A24A 100%)",
  "--jb-grad-tutorial": "linear-gradient(135deg, #1F5FA8 0%, #0B1F3A 100%)",
  "--jb-on-gradient": "#FFFFFF",
  "--jb-body": "#0B1424",
  "--jb-card-alt": "#111D33",
  "--jb-panel": "#0E182B",
  "--jb-nebula": "#1A3358",
  "--jb-hover": "rgba(255,255,255,0.06)",
  "--jb-link": "#8FB4E8",
  "--jb-sidebar-bg": "#0B1424",
  "--jb-header-bg": "rgba(11,20,36,0.85)",
  "--jb-halo": "rgba(201,162,74,0.25)",
  "--jb-hero-wash": "radial-gradient(80% 60% at 50% 0%, rgba(31,95,168,0.30), transparent 70%)",
};

export const LISTING_CSS_VARS_LIGHT: Record<string, string> = {
  "--jb-body": "#F7F4EC",
  "--jb-card-alt": "#FFFFFF",
  "--jb-panel": "#FBF9F3",
  "--jb-nebula": "#DCE6F5",
  "--jb-hover": "rgba(11,31,58,0.05)",
  "--jb-link": "#1F5FA8",
  "--jb-sidebar-bg": "#F1EDE2",
  "--jb-header-bg": "rgba(247,244,236,0.9)",
  "--jb-halo": "rgba(201,162,74,0.20)",
  "--jb-hero-wash": "radial-gradient(80% 60% at 50% 0%, rgba(31,95,168,0.10), transparent 70%)",
};

export const LISTING_BRAND: Brand = {
  product: "realestate",
  name: PRODUCT_NAME.realestate,
  wordmark: "LISTING STUDIO",
  eyebrow: "by Jelly!",
  logoSrc: "/realestateanimated/brand/logo.svg",
  logoMonoSrc: "/realestateanimated/brand/logo-mono-white.svg",
  homePath: STUDIO_HOME.realestate,
  defaultRoute: "listing",
  legal: { terms: "/animate/terms", privacy: "/animate/privacy", beta: "/animate/beta" },
  support: {
    email: "support@tolley.io",
    phone: process.env.NEXT_PUBLIC_LISTING_SUPPORT_PHONE || "+19139149429",
    sms: process.env.NEXT_PUBLIC_LISTING_SUPPORT_PHONE || "+19139149429",
    hours: "8a–8p Central, 7 days",
    who: "Jared Tolley — licensed Missouri agent — answers himself",
  },
  themeColor: "#0B1F3A",
  og: {
    image: "/realestateanimated/brand/og-1200x630.png",
    title: "Listing Studio by Jelly! — listing videos from one photo",
    description:
      "Upload a photo, pick a video, pay per listing. Fair-Housing safe, MLS-aware, ready to post.",
  },
  cssVars: LISTING_CSS_VARS,
  cssVarsLight: LISTING_CSS_VARS_LIGHT,
};

export const BRANDS: Record<Product, Brand> = { jelly: JELLY_BRAND, realestate: LISTING_BRAND };
