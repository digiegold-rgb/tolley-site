// Growth HQ — client-side DTOs (JSON-serialized GrowthLead / GrowthTouch).

export interface HqTouch {
  id: string;
  leadId: string;
  channel: string;
  direction: string;
  status: string;
  subject: string | null;
  body: string | null;
  meta: unknown;
  createdAt: string;
  sentAt: string | null;
}

export interface HqLead {
  id: string;
  name: string;
  offer: string;
  category: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  emailSource: string | null;
  ownerName: string | null;
  website: string | null;
  websiteScore: number | null;
  websiteNotes: string | null;
  rating: number | null;
  reviews: number | null;
  placeId: string | null;
  stage: string;
  score: number | null;
  demoUrl: string | null;
  videoUrl: string | null;
  videoAssetUrl: string | null;
  source: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  touches: HqTouch[];
}

export interface HqQueueTouch extends HqTouch {
  lead: {
    id: string;
    name: string;
    offer: string;
    city: string | null;
    email: string | null;
    phone: string | null;
    stage: string;
    score: number | null;
  };
}

// ─── Money tab (GET /api/hq/money) ───

export interface HqMoneyPastDue {
  id: string;
  name: string;
  phone: string | null;
  unitCost: number;
  dunningStage: number;
  currentPeriodEnd: string | null;
  missedCount: number;
  amountBehind: number;
}

export interface HqMoneyPendingApproval {
  id: string;
  name: string;
  unitCost: number;
  createdAt: string;
}

export interface HqMoneyInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  contactName: string | null;
  amountDue: number;
  dueDate: string | null;
  issueDate: string;
  isOverdue: boolean;
}

export interface HqMoney {
  wd: {
    pastDue: HqMoneyPastDue[];
    pastDueTotal: number;
    pendingApproval: HqMoneyPendingApproval[];
    draftCount: number;
  };
  invoices: {
    open: HqMoneyInvoice[];
    totalDue: number;
    overdueDue: number;
  };
  week: {
    since: string;
    wdRevenue: number;
    wdPayments: number;
    invoiceRevenue: number;
    invoicePayments: number;
    totalRevenue: number;
    newLeads: number;
  };
  animate?: {
    monthRevenue: number;
    monthActions: number;
    videoOfferClients: number;
  };
}

export const STAGE_LABEL: Record<string, string> = {
  scraped: "Scraped",
  enriched: "Enriched",
  demo_built: "Demo Built",
  contacted: "Contacted",
  replied: "Replied",
  booked: "Booked",
  client: "Client",
  do_not_contact: "Do Not Contact",
  dead: "Dead",
};

export interface HqInboundLead {
  id: string;
  receiptToken: string;
  subsite: string;
  action: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  structured: Record<string, unknown> | null;
  status: string;
  statusNote: string | null;
  statusUpdatedAt: string | null;
  createdAt: string;
}

export const INBOUND_STATUS_LABEL: Record<string, string> = {
  new: "New",
  acknowledged: "Working",
  contacted: "Contacted",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost",
};

export const CHANNEL_ICON: Record<string, string> = {
  email: "✉",
  sms: "💬",
  call: "📞",
  demo: "🖥",
  note: "📝",
};

/** Read an { error } payload from a failed response without throwing. */
export async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (data && typeof data.error === "string") return data.error;
  } catch {
    // non-JSON error body — fall through to fallback
  }
  return `${fallback} (HTTP ${res.status})`;
}
