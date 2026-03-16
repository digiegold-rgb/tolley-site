"use client";

import { useState } from "react";

export interface RepairItem {
  id: string;
  name: string;
  cost: number;
}

interface Props {
  items: RepairItem[];
  role: "tolley";
  onAdd: (name: string, cost: number) => void;
  onUpdate: (id: string, name: string, cost: number) => void;
  onDelete: (id: string) => void;
}

export function WdRepairsTable({ items, role, onAdd, onUpdate, onDelete }: Props) {
  const [newName, setNewName] = useState("");
  const [newCost, setNewCost] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCost, setEditCost] = useState("");

  const total = items.reduce((s, i) => s + i.cost, 0);
  const isTolley = role === "tolley";

  function handleAdd() {
    if (!newName.trim() || !newCost) return;
    onAdd(newName.trim(), parseFloat(newCost) || 0);
    setNewName("");
    setNewCost("");
  }

  function startEdit(item: RepairItem) {
    setEditId(item.id);
    setEditName(item.name);
    setEditCost(String(item.cost));
  }

  function saveEdit() {
    if (editId) {
      onUpdate(editId, editName, parseFloat(editCost) || 0);
      setEditId(null);
    }
  }

  return (
    <div style={{ maxWidth: 360 }}>
      <h4 style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 700 }}>Items &amp; Repairs</h4>
      <table className="repairs-table" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Item</th>
            <th style={{ textAlign: "right" }}>Cost</th>
            {isTolley && <th style={{ width: 50 }} />}
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              {editId === item.id ? (
                <>
                  <td><input className="edit-input" value={editName} onChange={e => setEditName(e.target.value)} /></td>
                  <td><input className="edit-input" type="number" value={editCost} onChange={e => setEditCost(e.target.value)} style={{ textAlign: "right" }} /></td>
                  <td>
                    <button className="edit-btn" onClick={saveEdit}>&#10003;</button>
                    <button className="edit-btn" onClick={() => setEditId(null)}>&#10007;</button>
                  </td>
                </>
              ) : (
                <>
                  <td>{item.name}</td>
                  <td style={{ textAlign: "right" }}>${item.cost}</td>
                  {isTolley && (
                    <td>
                      <button className="edit-btn" onClick={() => startEdit(item)}>&#9998;</button>
                      <button className="edit-btn" onClick={() => onDelete(item.id)} style={{ color: "#c44" }}>&#10005;</button>
                    </td>
                  )}
                </>
              )}
            </tr>
          ))}
          <tr className="repairs-total">
            <td>Total</td>
            <td style={{ textAlign: "right" }}>${total}</td>
            {isTolley && <td />}
          </tr>
        </tbody>
      </table>
      {isTolley && (
        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
          <input className="edit-input" placeholder="Item name" value={newName} onChange={e => setNewName(e.target.value)} style={{ flex: 1 }} />
          <input className="edit-input" type="number" placeholder="$" value={newCost} onChange={e => setNewCost(e.target.value)} style={{ width: 60 }} />
          <button className="btn btn-sm btn-primary" onClick={handleAdd}>+</button>
        </div>
      )}
    </div>
  );
}
