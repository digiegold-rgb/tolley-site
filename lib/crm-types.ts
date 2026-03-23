export const PIPELINE_STAGES = [
  { id: "new", label: "New Lead", color: "blue" },
  { id: "contacted", label: "Contacted", color: "yellow" },
  { id: "interested", label: "Interested", color: "orange" },
  { id: "referred", label: "Referred", color: "purple" },
  { id: "closed", label: "Closed", color: "emerald" },
  { id: "dead", label: "Dead", color: "red" },
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number]["id"];

export interface CrmLead {
  id: string;
  score: number;
  status: string;
  ownerName: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
  notes: string | null;
  source: string | null;
  referredTo: string | null;
  referralStatus: string | null;
  referralFee: number | null;
  contactedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  listing: {
    id: string;
    address: string;
    city: string | null;
    zip: string | null;
    listPrice: number | null;
    beds: number | null;
    baths: number | null;
    sqft: number | null;
    photoUrls: string[];
    status: string;
  } | null;
}

export interface CrmTag {
  id: string;
  name: string;
  color: string;
  category: string;
  _count?: { contacts: number };
}

export interface CrmTask {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  status: string;
  dueDate: string | null;
  completedAt: string | null;
  leadId: string | null;
  clientId: string | null;
  dealId: string | null;
  lead?: {
    ownerName: string | null;
    listing?: { address: string } | null;
  } | null;
  client?: { firstName: string; lastName: string } | null;
  deal?: { title: string } | null;
  createdAt: string;
}

export interface CrmActivity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface CrmDeal {
  id: string;
  title: string;
  type: string;
  stage: string;
  salePrice: number | null;
  expectedRevenue: number | null;
  actualRevenue: number | null;
  closingDate: string | null;
  closedDate: string | null;
  leadId: string | null;
  clientId: string | null;
  createdAt: string;
}

export interface SmartListDef {
  id: string;
  name: string;
  icon: string | null;
  filters: Record<string, unknown>;
  sortBy: string;
  sortDir: string;
  isPinned: boolean;
}
