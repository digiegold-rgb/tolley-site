/**
 * listing-api.ts — typed fetch helpers over lib/vater/listing/contract.ts.
 *
 * Every wizard/progress/library component talks to app/api/vater/listing/*
 * through here, so the route paths and body shapes live in exactly one place
 * on the client. 4xx → throws ListingApiError carrying the server envelope
 * (code / blockers / needCents) so callers can branch on `code` instead of
 * parsing strings.
 */
import type {
  AgentProfile,
  AgentProfilePatch,
  ListingApiError as ListingApiErrorBody,
  ListingBlocker,
  ListingBlockerCode,
  ListingJobDraft,
  ListingJobDto,
  ListingPreflight,
  PropertyImageRequest,
  PropertyImageResponse,
  VerifyLicenseRequest,
  VerifyLicenseResponse,
} from '@/lib/vater/listing/contract';

export const LISTING_API = '/api/vater/listing';

export class ListingApiError extends Error {
  status: number;
  code: ListingApiErrorBody['code'] | undefined;
  blockers: ListingBlocker[];
  needCents: number | undefined;
  body: Record<string, unknown>;

  constructor(status: number, body: Partial<ListingApiErrorBody> & Record<string, unknown>) {
    super(typeof body.error === 'string' && body.error ? body.error : `HTTP ${status}`);
    this.name = 'ListingApiError';
    this.status = status;
    this.code = body.code;
    this.blockers = Array.isArray(body.blockers) ? (body.blockers as ListingBlocker[]) : [];
    this.needCents = typeof body.needCents === 'number' ? body.needCents : undefined;
    this.body = body;
  }

  /** True for the one 402 the wizard turns into a "buy credits" flow. */
  get insufficientCredits(): boolean {
    if (this.status !== 402) return false;
    if (this.code === 'insufficient_credits') return true;
    const budget = this.body.budget as { reason?: string } | undefined;
    return budget?.reason === 'insufficient_credits';
  }

  /** Blocker codes carried on the envelope, for step routing. */
  get blockerCodes(): ListingBlockerCode[] {
    return this.blockers.map((b) => b.code);
  }
}

export function isListingApiError(e: unknown): e is ListingApiError {
  return e instanceof ListingApiError;
}

/** Plain-English message for any thrown value (never "[object Object]"). */
export function listingErrorMessage(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (isListingApiError(e)) return e.message || fallback;
  if (e instanceof Error) return e.message || fallback;
  return fallback;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) };
  const hasBody = init.body !== undefined && !(init.body instanceof FormData);
  if (hasBody && !headers['content-type']) headers['content-type'] = 'application/json';
  const res = await fetch(path, { cache: 'no-store', ...init, headers });
  const text = await res.text();
  let body: Record<string, unknown> = {};
  if (text) {
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      body = { error: text.slice(0, 300) };
    }
  }
  if (!res.ok) throw new ListingApiError(res.status, body as Partial<ListingApiErrorBody> & Record<string, unknown>);
  return body as T;
}

/** Routes may wrap the DTO as `{job}` or return it bare — accept both. */
function unwrapJob(body: unknown): ListingJobDto {
  const b = body as { job?: ListingJobDto } & Partial<ListingJobDto>;
  if (b && typeof b === 'object' && b.job && typeof b.job === 'object') return b.job;
  return b as ListingJobDto;
}

function unwrapJobs(body: unknown): ListingJobDto[] {
  if (Array.isArray(body)) return body as ListingJobDto[];
  const b = body as { jobs?: ListingJobDto[]; items?: ListingJobDto[] };
  if (Array.isArray(b?.jobs)) return b.jobs;
  if (Array.isArray(b?.items)) return b.items;
  return [];
}

export const listingApi = {
  async create(draft: ListingJobDraft = {}): Promise<ListingJobDto> {
    return unwrapJob(await request(LISTING_API, { method: 'POST', body: JSON.stringify(draft) }));
  },

  async list(): Promise<ListingJobDto[]> {
    return unwrapJobs(await request(LISTING_API));
  },

  async get(id: string): Promise<ListingJobDto> {
    return unwrapJob(await request(`${LISTING_API}/${encodeURIComponent(id)}`));
  },

  async patch(id: string, draft: ListingJobDraft): Promise<ListingJobDto> {
    return unwrapJob(
      await request(`${LISTING_API}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(draft) }),
    );
  },

  async propertyImage(req: PropertyImageRequest): Promise<PropertyImageResponse> {
    return request<PropertyImageResponse>(`${LISTING_API}/property-image`, { method: 'POST', body: JSON.stringify(req) });
  },

  async preflight(id: string): Promise<ListingPreflight> {
    return request<ListingPreflight>(`${LISTING_API}/${encodeURIComponent(id)}/preflight`);
  },

  async stage(id: string): Promise<ListingJobDto> {
    return unwrapJob(await request(`${LISTING_API}/${encodeURIComponent(id)}/stage`, { method: 'POST', body: '{}' }));
  },

  async approveStill(id: string): Promise<ListingJobDto> {
    return unwrapJob(
      await request(`${LISTING_API}/${encodeURIComponent(id)}/approve-still`, { method: 'POST', body: '{}' }),
    );
  },

  async restage(id: string): Promise<ListingJobDto> {
    return unwrapJob(await request(`${LISTING_API}/${encodeURIComponent(id)}/restage`, { method: 'POST', body: '{}' }));
  },

  async poll(id: string): Promise<ListingJobDto> {
    return unwrapJob(await request(`${LISTING_API}/${encodeURIComponent(id)}/poll`));
  },

  /** MLS-safe export is a file download — the caller opens this URL. */
  mlsExportUrl(id: string): string {
    return `${LISTING_API}/${encodeURIComponent(id)}/mls-export`;
  },

  async verifyLicense(req: VerifyLicenseRequest): Promise<VerifyLicenseResponse> {
    return request<VerifyLicenseResponse>(`${LISTING_API}/verify-license`, { method: 'POST', body: JSON.stringify(req) });
  },

  /** GET /api/vater/me → agentProfile (null until the API lands the field). */
  async me(): Promise<{ agentProfile: AgentProfile | null; license: boolean; product?: string }> {
    const body = await request<{ agentProfile?: AgentProfile | null; capabilities?: { license?: boolean }; product?: string }>(
      '/api/vater/me',
    );
    return {
      agentProfile: body.agentProfile ?? null,
      license: body.capabilities?.license === true,
      product: body.product,
    };
  },

  async saveAgentProfile(patch: AgentProfilePatch): Promise<AgentProfile | null> {
    const body = await request<{ agentProfile?: AgentProfile | null }>('/api/vater/me', {
      method: 'PATCH',
      body: JSON.stringify({ agentProfile: patch }),
    });
    return body.agentProfile ?? null;
  },

  /** Photo upload → Vercel Blob (10 MB cap). Returns the public URL. */
  async upload(file: File): Promise<string> {
    const fd = new FormData();
    fd.append('file', file);
    const body = await request<{ url?: string }>('/api/vater/upload', { method: 'POST', body: fd });
    if (!body.url) throw new Error('Upload did not return a file address.');
    return body.url;
  },

  /** Credit pack checkout; returns the Stripe URL to send the browser to. */
  async buyPack(pack: number, returnTo: string): Promise<string> {
    const body = await request<{ url?: string }>('/api/vater/billing/packs', {
      method: 'POST',
      body: JSON.stringify({ pack, returnTo }),
    });
    if (!body.url) throw new Error('Could not open checkout.');
    return body.url;
  },
};

/** Public proof page for a finished job (AB 723-style original vs generated). */
export function proofPageUrl(proofToken: string, origin?: string): string {
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : 'https://www.tolley.io');
  return `${base}/realestateanimated/proof/${encodeURIComponent(proofToken)}`;
}

export type { ListingJobDto, ListingJobDraft, ListingPreflight };
