"use client";

import { WdDateBlock } from "./wd-date-block";
import type { WdClientData } from "./wd-client-row";

interface Props {
  clients: WdClientData[];
  role: "tolley" | "keegan";
  filter: "all" | "tolley" | "keegan";
  onPaymentStatus: (paymentId: string, status: string) => void;
  onConfirmToggle: (clientId: string, val: boolean) => void;
  onSave: (clientId: string, fields: Record<string, string | number>) => void;
}

function getDateBlock(installDate: string | null): string {
  if (!installDate) return "22-31";
  const day = new Date(installDate).getDate();
  if (day <= 7) return "1-7";
  if (day <= 14) return "8-14";
  if (day <= 21) return "15-21";
  return "22-31";
}

const BLOCKS = ["1-7", "8-14", "15-21", "22-31"] as const;

export function WdSpreadsheet({ clients, role, filter, onPaymentStatus, onConfirmToggle, onSave }: Props) {
  // Filter by source tab
  let filtered = clients;
  if (filter === "tolley") {
    filtered = clients.filter(c => c.source === "tolley");
  } else if (filter === "keegan") {
    filtered = clients.filter(c => c.source === "keegan" || c.source === "both");
  }

  const active = filtered.filter(c => c.active);
  const inactive = filtered.filter(c => !c.active);

  // Determine if split info shows
  // Split only on shared clients (source !== "tolley" when on tolley tab)
  const shouldShowSplit = (c: WdClientData) => {
    if (filter === "tolley") return false; // Solo clients, no split
    return c.source === "keegan" || c.source === "both";
  };

  // Max payments across all clients for column alignment
  const maxPayments = Math.max(1, ...filtered.map(c => c.payments.length));

  // Group active by date block
  const blocks = BLOCKS.map(block => ({
    label: `Install Day ${block}`,
    clients: active.filter(c => getDateBlock(c.installDate) === block),
  }));

  // For "all" or "keegan" tabs, we need to handle split per-row
  // Show split columns whenever filter is "keegan" or "all" has shared clients
  const showSplitCols = filter === "keegan" || (filter === "all" && filtered.some(c => c.source === "keegan" || c.source === "both"));

  return (
    <div>
      {blocks.map(b => (
        <WdDateBlock
          key={b.label}
          label={b.label}
          clients={b.clients}
          role={role}
          showSplit={showSplitCols}
          maxPayments={maxPayments}
          onPaymentStatus={onPaymentStatus}
          onConfirmToggle={onConfirmToggle}
          onSave={onSave}
        />
      ))}

      {inactive.length > 0 && (
        <WdDateBlock
          label="Inactive / Lost Clients"
          clients={inactive}
          role={role}
          showSplit={showSplitCols}
          maxPayments={maxPayments}
          onPaymentStatus={onPaymentStatus}
          onConfirmToggle={onConfirmToggle}
          onSave={onSave}
        />
      )}
    </div>
  );
}
