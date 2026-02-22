export type UsageMeta = {
  remaining: number;
  limit: number;
  resetAt: string;
  plan: string;
};

export type ListingCard = {
  type?: string;
  address: string;
  price?: number | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  summaryBullets?: string[];
  link?: string;
  source?: string;
};

export type AskApiResponse = {
  answer?: string;
  cards?: ListingCard[];
  followUps?: string[];
  memoryUpdates?: string[];
  requestId?: string;
  cached?: boolean;
  latency?: number;
  usage?: UsageMeta;
  conversationId?: string;
  error?: string;
  resetAt?: string;
  [key: string]: unknown;
};

export type AgentMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  cards?: ListingCard[];
  followUps?: string[];
  requestId?: string;
  cached?: boolean;
  latency?: number;
  createdAt: string;
};

export type ConversationState = {
  conversationId: string;
  messages: AgentMessage[];
  updatedAt: string;
};

export type MemorySummary = {
  preferences?: Record<string, unknown>;
  savedListings?: Array<Record<string, unknown>>;
  savedVendors?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};
