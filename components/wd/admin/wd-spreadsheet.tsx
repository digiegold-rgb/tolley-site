"use client";

import { WdDateBlock } from "./wd-date-block";
import type { WdClientData } from "./wd-client-row";

interface Props {
  clients: WdClientData[];
  role: "tolley";
  filter: "all" | "tolley";
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
  }

  const active = filtered.filter(c => c.active);
  const inactive = filtered.filter(c => !c.active);

  // Max payments across all clients for column alignment
  const maxPayments = Math.max(1, ...filtered.map(c => c.payments.length));

  // Group active by date block
  const blocks = BLOCKS.map(block => ({
    label: `Install Day ${block}`,
    clients: active.filter(c => getDateBlock(c.installDate) === block),
  }));

  return (
    <div>
      {blocks.map(b => (
        <WdDateBlock
          key={b.label}
          label={b.label}
          clients={b.clients}
          role={role}
          showSplit={false}
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
          showSplit={false}
          maxPayments={maxPayments}
          onPaymentStatus={onPaymentStatus}
          onConfirmToggle={onConfirmToggle}
          onSave={onSave}
        />
      )}
    </div>
  );
}
