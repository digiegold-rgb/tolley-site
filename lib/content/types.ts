/**
 * Content Engine — Platform adapter interface & shared types.
 *
 * Follows the DossierPlugin pattern from lib/dossier/types.ts:
 * each social platform is a "plugin" that implements PlatformAdapter.
 */

// ── Platform Adapter Interface ──────────────────────────────

export interface PlatformAdapter {
  /** Platform identifier (matches ContentPost.platform) */
  platform: PlatformType;
  /** Human-readable name */
  label: string;
  /** Platform constraints */
  limits: PlatformLimits;

  // ── OAuth ──
  /** Generate OAuth authorization URL */
  getAuthUrl(state: string, redirectUri: string): string;
  /** Exchange callback code for tokens */
  handleCallback(code: string, redirectUri: string): Promise<PlatformTokens>;
  /** Refresh an expired token */
  refreshToken(refreshToken: string): Promise<PlatformTokens>;

  // ── Publishing ──
  /** Publish a post to the platform */
  publishPost(post: PublishRequest, tokens: PlatformTokens): Promise<PublishResult>;
  /** Delete a published post */
  deletePost(platformPostId: string, tokens: PlatformTokens): Promise<void>;
  /** Fetch engagement metrics for a published post */
  getPostEngagement(platformPostId: string, tokens: PlatformTokens): Promise<EngagementMetrics>;
}

// ── Platform Types ──────────────────────────────────────────

export type PlatformType =
  | "linkedin"
  | "twitter"
  | "facebook"
  | "instagram"
  | "youtube"
  | "tiktok";

export interface PlatformLimits {
  maxTextLength: number;
  supportsImages: boolean;
  supportsVideo: boolean;
  supportsCarousel: boolean;
  maxImages: number;
  maxHashtags: number;
  rateLimitPerDay: number;
}

// ── OAuth Types ─────────────────────────────────────────────

export interface PlatformTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes?: string[];
  platformAccountId: string;
  platformUsername?: string;
  pageId?: string;
  pageName?: string;
}

// ── Publishing Types ────────────────────────────────────────

export interface PublishRequest {
  body: string;
  mediaUrls?: string[];
  hashtags?: string[];
  contentType: "text" | "image" | "carousel" | "video" | "reel";
  /** For scheduled posts (platform-native scheduling) */
  scheduledAt?: Date;
}

export interface PublishResult {
  platformPostId: string;
  platformUrl: string;
}

export interface EngagementMetrics {
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  clicks: number;
}

// ── Content Generation Types ────────────────────────────────

export interface ContentGenerateInput {
  platform: PlatformType;
  category: ContentCategory;
  tone?: string;
  /** Optional listing context */
  listing?: {
    address: string;
    city?: string | null;
    zip?: string | null;
    listPrice?: number | null;
    beds?: number | null;
    baths?: number | null;
    sqft?: number | null;
    daysOnMarket?: number | null;
    status?: string;
    propertyType?: string | null;
    photoUrls?: string[];
  };
  /** Optional client context */
  client?: {
    firstName: string;
    lastName: string;
    buyerSeller?: string;
    preferredCities?: string[];
    moveTimeline?: string | null;
  };
  /** Optional dossier context */
  dossier?: {
    motivationScore?: number | null;
    motivationFlags?: string[];
    researchSummary?: string | null;
    owners?: unknown[];
  };
  /** Optional custom template prompt */
  templatePrompt?: string;
  /** Custom instructions from user */
  customInstructions?: string;
}

export type ContentCategory =
  | "market_update"
  | "listing_promo"
  | "neighborhood_spotlight"
  | "seller_tip"
  | "buyer_guide"
  | "just_sold"
  | "open_house"
  | "personal_brand";

// ── Post Status Flow ────────────────────────────────────────

export type PostStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed";
