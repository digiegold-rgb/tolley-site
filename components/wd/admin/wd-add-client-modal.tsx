"use client";

import { useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    unitDescription: string;
    unitCost: number;
    address: string;
    phone: string;
    email: string;
    notes: string;
    source: string;
    paidBy: string;
    installDate: string;
  }) => void;
}

export function WdAddClientModal({ open, onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [unitDescription, setUnitDescription] = useState("");
  const [unitCost, setUnitCost] = useState("200");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [source, setSource] = useState("tolley");
  const [paidBy, setPaidBy] = useState("tolley");
  const [installDate, setInstallDate] = useState("");

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !unitDescription.trim()) return;
    onSubmit({
      name: name.trim(),
      unitDescription: unitDescription.trim(),
      unitCost: parseFloat(unitCost) || 200,
      address: address.trim(),
      phone: phone.trim(),
      email: email.trim(),
      notes: notes.trim(),
      source,
      paidBy,
      installDate,
    });
    // Reset
    setName("");
    setUnitDescription("");
    setUnitCost("200");
    setAddress("");
    setPhone("");
    setEmail("");
    setNotes("");
    setSource("tolley");
    setPaidBy("tolley");
    setInstallDate("");
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-body" onClick={e => e.stopPropagation()}>
        <h3>Add New Client</h3>
        <form onSubmit={handleSubmit}>
          <label>Client Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} required />

          <label>Unit Description *</label>
          <input value={unitDescription} onChange={e => setUnitDescription(e.target.value)} required placeholder="e.g. Whirlpool W&D" />

          <label>Unit Cost ($)</label>
          <input type="number" value={unitCost} onChange={e => setUnitCost(e.target.value)} />

          <label>Install Date</label>
          <input type="date" value={installDate} onChange={e => setInstallDate(e.target.value)} />

          <label>Address</label>
          <input value={address} onChange={e => setAddress(e.target.value)} />

          <label>Phone</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} />

          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} />

          <label>Source</label>
          <select value={source} onChange={e => setSource(e.target.value)}>
            <option value="tolley">Tolley</option>
          </select>

          <label>Paid By</label>
          <select value={paidBy} onChange={e => setPaidBy(e.target.value)}>
            <option value="tolley">Tolley</option>
          </select>

          <label>Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />

          <div className="btn-row">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add Client</button>
          </div>
        </form>
      </div>
    </div>
  );
}
