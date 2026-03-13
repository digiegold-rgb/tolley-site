"use client";

import { useState } from "react";

interface Props {
  onSubmit: (data: {
    amount: number;
    date: string;
    description: string;
    category: string;
    status: string;
  }) => void;
}

export function KeeganAddPayment({ onSubmit }: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("labor");
  const [status, setStatus] = useState("paid");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || !amount) return;
    onSubmit({
      amount: parseFloat(amount),
      date,
      description: description.trim(),
      category,
      status,
    });
    setAmount("");
    setDescription("");
    setCategory("labor");
    setStatus("paid");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors"
      >
        + Add Payment
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Amount ($)</label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            required
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            required
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
        <input
          value={description}
          onChange={e => setDescription(e.target.value)}
          required
          placeholder="e.g. Garage cleanout, WD split - Feb 2026"
          className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
          <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm">
            <option value="wd">W&D Rental</option>
            <option value="trailer">Trailer Rental</option>
            <option value="labor">Labor</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm">
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">
          Cancel
        </button>
        <button type="submit" className="px-4 py-1.5 bg-gray-900 text-white text-sm font-semibold rounded hover:bg-gray-800">
          Add
        </button>
      </div>
    </form>
  );
}
