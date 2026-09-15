/** Credit Recovery dashboard contract (ledger → site). Additive, nullable scores. */

export type ScoreSource =
  | "manual"
  | "kikoff"
  | "plaid"
  | "annualcreditreport"
  | "scraper"
  | (string & {});

export type BureauReading = {
  value: number | null;
  date: string | null;
  pulledAt?: string | null;
  source: ScoreSource | null;
  model?: string | null;
  previous: number | null;
  change: number | null;
  ageDays: number | null;
};

export type ScoreTrend = {
  transunion?: number;
  equifax?: number;
  experian?: number;
};

export type ScoresBlock = {
  latest?: Record<string, number | null> | null;
  previous?: Record<string, number | null> | null;
  perBureau: {
    transunion: BureauReading;
    equifax: BureauReading;
    experian: BureauReading;
    kickoff_score: BureauReading;
  };
  bestScore: number | null;
  avgScore: number | null;
  startScore: number | null;
  startDate: string | null;
  trend: ScoreTrend | null;
  historyCount: number;
  lastScoreSyncAt?: string | null;
};

export type DisputeDoc = {
  label: string;
  pathOrUrl: string;
  kind: "letter" | "court_order" | "id" | "address_proof" | "other";
};

export type DisputeType =
  | "fcra_dispute"
  | "609_request"
  | "fdcpa_validation"
  | "goodwill"
  | "pay_for_delete"
  | "instant_dispute"
  | "kikoff_dispute";

export type DisputeBureau = "transunion" | "equifax" | "experian" | "all" | null;

export type DisputeChannel =
  | "online"
  | "kikoff"
  | "certified_mail"
  | "email"
  | "other"
  | null;

export type DisputeStatus =
  | "draft"
  | "sent"
  | "pending_response"
  | "resolved"
  | "escalated";

export type DisputeRow = {
  id: string;
  type: DisputeType | string;
  bureau: DisputeBureau | string | null;
  creditor: string;
  accountLast4?: string | null;
  debtId: string | null;
  caseNumber?: string | null;
  fileNumber?: string | null;
  channel?: DisputeChannel | string | null;
  status: DisputeStatus | string;
  filedDate?: string | null;
  sentDate: string | null;
  responseDeadline: string | null;
  deliveredDate?: string | null;
  resolvedDate: string | null;
  outcome: string | null;
  trackingNumber: string | null;
  docs?: DisputeDoc[];
  notes: string | null;
};

export type OnePaySnapshot = {
  provider: "onepay";
  accountLast4: string | null;
  status: "current" | "late" | "paid_off" | "unknown" | null;
  nextDueDate: string | null;
  nextAmount: number | null;
  remainingBalance: number | null;
  installmentCountRemaining: number | null;
  lastStatementDate: string | null;
  lastSyncAt: string | null;
  notes: string | null;
};

export type MortgageSnapshot = {
  lender: "M&T" | string;
  accountLast4: string | null;
  balance: number | null;
  principalAndInterest: number | null;
  escrow: number | null;
  totalPayment: number | null;
  nextDueDate: string | null;
  ratePct: number | null;
  pmiActive: boolean | null;
  aheadOfSchedule: boolean | null;
  lastSyncAt: string | null;
  source: "manual" | "statement" | "plaid" | "other" | null;
};

export type AltBureauPlaceholder = {
  id: "business" | "auto";
  label: string;
  status: "not_started" | "monitoring" | "n_a";
  score: number | null;
  asOf: string | null;
  vendor: string | null;
  notes: string | null;
};

export type KikoffDisputedAccount = {
  creditor: string;
  accountLast4: string | null;
  status: string;
};

export type KikoffStatus = {
  plan: "basic" | "premium" | "ultimate" | "unknown" | null;
  monthlyFeeUsd: number | null;
  tradelineLimitReported: number | null;
  reportsTo: ("equifax" | "experian" | "transunion")[];
  membershipStatus: "active" | "paused" | "canceled" | "unknown" | null;
  lastPaymentOnTime: boolean | null;
  openDisputesFiledAt: string | null;
  disputedAccounts: KikoffDisputedAccount[];
  lastSyncAt: string | null;
};

export const DEFAULT_ALT_BUREAUS: AltBureauPlaceholder[] = [
  {
    id: "business",
    label: "Business credit (Dun & Bradstreet / Experian Biz)",
    status: "not_started",
    score: null,
    asOf: null,
    vendor: null,
    notes: null,
  },
  {
    id: "auto",
    label: "Auto insurance / LexisNexis",
    status: "not_started",
    score: null,
    asOf: null,
    vendor: null,
    notes: null,
  },
];

export type HelocEquity = {
  homeValue: number | null;
  mortgageBalance: number | null;
  equity: number | null;
  available80: number | null;
  available85: number | null;
  met: boolean;
};
