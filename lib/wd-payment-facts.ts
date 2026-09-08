export function invoicePaymentFacts(invoice: {
  status?: string | null; status_transitions?: { paid_at?: number | null } | null;
  amount_paid: number; amount_due: number; attempt_count?: number;
}) {
  const paid = invoice.status === "paid";
  const timestamp = invoice.status_transitions?.paid_at;
  return {
    status: paid ? "paid" : "missed",
    amount: (paid ? invoice.amount_paid : invoice.amount_due) / 100,
    paidAt: paid && timestamp ? new Date(timestamp * 1000) : null,
    paidAtSource: paid && timestamp ? "stripe" : null,
    failureAttempts: invoice.attempt_count ?? 0,
  };
}

export function monthlySubscriptionAmount(items: { quantity?: number | null; price: {
  unit_amount?: number | null; recurring?: { interval: string; interval_count: number } | null;
} }[]) {
  let amount = 0;
  for (const { quantity, price } of items) {
    const recurring = price.recurring;
    if (!recurring || !["month", "year"].includes(recurring.interval) || price.unit_amount == null) return null;
    amount += price.unit_amount * (quantity ?? 1) / (recurring.interval_count * (recurring.interval === "year" ? 12 : 1));
  }
  return Math.round(amount) / 100;
}
