"use client";

interface Props {
  paymentId: string;
  amount: number;
  status: string;
  onStatusChange: (paymentId: string, status: string) => void;
}

const STATUS_CYCLE: Record<string, string> = {
  paid: "late",
  late: "missed",
  missed: "paid",
};

export function WdPaymentCell({ paymentId, amount, status, onStatusChange }: Props) {
  const cls = status === "paid" ? "pay-paid" : status === "late" ? "pay-late" : "pay-missed";

  return (
    <td style={{ textAlign: "center", padding: "4px 2px" }}>
      <span
        className={`pay-pill ${cls}`}
        onClick={() => onStatusChange(paymentId, STATUS_CYCLE[status] || "paid")}
        title={`$${amount.toFixed(0)} — ${status} (click to change)`}
        style={{ cursor: "pointer" }}
      >
        ${amount.toFixed(0)}
      </span>
    </td>
  );
}
