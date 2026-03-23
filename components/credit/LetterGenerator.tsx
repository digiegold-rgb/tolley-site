"use client";

import { useState } from "react";

type Debt = {
  id: string;
  creditor: string;
  accountLast4: string;
  balance: number;
  status: string;
};

const letterTypes = [
  {
    value: "fcra_dispute",
    label: "FCRA Dispute (Section 611)",
    desc: "Dispute inaccurate info with a credit bureau",
  },
  {
    value: "609_request",
    label: "609 Information Request",
    desc: "Demand bureau produce verification documentation",
  },
  {
    value: "fdcpa_validation",
    label: "FDCPA Debt Validation (Section 809)",
    desc: "Demand collector prove the debt is valid",
  },
  {
    value: "goodwill",
    label: "Goodwill Letter",
    desc: "Request creditor remove negative mark",
  },
  {
    value: "pay_for_delete",
    label: "Pay-for-Delete",
    desc: "Settlement offer contingent on deletion",
  },
];

export function LetterGenerator({ debts }: { debts?: Debt[] }) {
  const [type, setType] = useState("fcra_dispute");
  const [bureau, setBureau] = useState("transunion");
  const [debtId, setDebtId] = useState("");
  const [reason, setReason] = useState("");
  const [offerAmount, setOfferAmount] = useState("");
  const [generating, setGenerating] = useState(false);
  const [letter, setLetter] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedDebt = debts?.find((d) => d.id === debtId);

  const generate = async () => {
    setGenerating(true);
    setLetter(null);
    try {
      const res = await fetch("/api/credit/disputes/letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          bureau,
          debtId: debtId || undefined,
          creditor: selectedDebt?.creditor,
          accountLast4: selectedDebt?.accountLast4,
          amount: selectedDebt?.balance,
          reason,
          offerAmount: offerAmount || undefined,
        }),
      });
      const data = await res.json();
      setLetter(data.letter?.content || data.error || "Generation failed");
    } catch {
      setLetter("Error: could not reach server");
    }
    setGenerating(false);
  };

  const copyToClipboard = () => {
    if (letter) {
      navigator.clipboard.writeText(letter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1117] p-5">
      <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-[#00d4ff]">
        AI Dispute Letter Generator
      </h3>

      <div className="mb-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-white/50">
              Letter Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white"
            >
              {letterTypes.map((lt) => (
                <option key={lt.value} value={lt.value}>
                  {lt.label}
                </option>
              ))}
            </select>
            <p className="mt-0.5 text-xs text-white/30">
              {letterTypes.find((lt) => lt.value === type)?.desc}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/50">
              Target Bureau
            </label>
            <select
              value={bureau}
              onChange={(e) => setBureau(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white"
            >
              <option value="transunion">TransUnion</option>
              <option value="equifax">Equifax</option>
              <option value="experian">Experian</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-white/50">
              Related Debt
            </label>
            <select
              value={debtId}
              onChange={(e) => setDebtId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white"
            >
              <option value="">-- Select debt --</option>
              {debts?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.creditor} ****{d.accountLast4} ($
                  {d.balance.toLocaleString()})
                </option>
              ))}
            </select>
          </div>
          {type === "pay_for_delete" && (
            <div>
              <label className="mb-1 block text-xs text-white/50">
                Settlement Offer $
              </label>
              <input
                value={offerAmount}
                onChange={(e) => setOfferAmount(e.target.value)}
                placeholder="e.g., 2000"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/20"
              />
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs text-white/50">
            Reason / Details
          </label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Balance is incorrect, account was paid in full"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/20"
          />
        </div>

        <button
          onClick={generate}
          disabled={generating}
          className="rounded-lg bg-[#00d4ff] px-4 py-2 text-xs font-bold text-black hover:bg-[#00b4d8] disabled:opacity-50"
        >
          {generating ? "Generating..." : "Generate Letter"}
        </button>
      </div>

      {letter && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase text-white/50">
              Generated Letter
            </h4>
            <button
              onClick={copyToClipboard}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60 hover:bg-white/10"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-4">
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-white/70">
              {letter}
            </pre>
          </div>
          <div className="mt-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
            <p className="text-xs font-medium text-yellow-400">
              Certified Mail Instructions:
            </p>
            <ul className="mt-1 space-y-0.5 text-xs text-yellow-400/70">
              <li>1. Print this letter on plain white paper</li>
              <li>
                2. Send via USPS Certified Mail with Return Receipt Requested
              </li>
              <li>
                3. Cost: ~$8 (certified mail $4.35 + return receipt $3.55)
              </li>
              <li>4. Keep the green card (return receipt) when it comes back</li>
              <li>
                5. Track at usps.com — save tracking number in Dispute Tracker
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
