export type VendorRecommendation = {
  name: string;
  specialty: string;
  note: string;
  eta: string;
};

export type SearchResponse = {
  title: string;
  summary: string;
  highlights: string[];
  vendors?: VendorRecommendation[];
  steps?: string[];
  checklist?: string[];
  requestId?: string;
  cached?: boolean;
  latency?: number;
  usage?: {
    remaining: number;
    limit: number;
    resetAt: string;
    plan: string;
  };
};
