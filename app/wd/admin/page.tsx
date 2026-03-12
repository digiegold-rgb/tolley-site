"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

// ─── Types ───

interface WdPayment {
  id: string;
  amount: number;
  month: string;
  note: string | null;
  createdAt: string;
}

interface RevenueSplit {
  totalRevenue: number;
  tolleySplit: number;
  keeganSplit: number;
  paybackComplete: boolean;
  paybackRemaining: number;
}

interface WdClient {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  unitDescription: string;
  unitCost: number;
  installDate: string | null;
  active: boolean;
  notes: string | null;
  photoUrls: string[];
  receiptUrls: string[];
  source: string;
  paidBy: string;
  needsReview: boolean;
  blockedFields?: string[];
  locked: boolean;
  stripeCustomerId: string | null;
  payments: WdPayment[];
  split: RevenueSplit;
  createdAt: string;
}

type WdRole = "tolley" | "keegan";
type TabFilter = "all" | "tolley" | "keegan";

// ─── Helpers ───

function fmt(n: number) {
  return "$" + n.toFixed(2);
}

function pct(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.min(100, Math.round((part / whole) * 100));
}

// ─── Component ───

export default function WdAdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [role, setRole] = useState<WdRole | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");

  const [clients, setClients] = useState<WdClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<TabFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [success, setSuccess] = useState("");

  // Inline editing
  const [editingField, setEditingField] = useState<{
    clientId: string;
    field: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");

  // Add payment form
  const [payMonth, setPayMonth] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [payingFor, setPayingFor] = useState<string | null>(null);

  // New client form
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newCost, setNewCost] = useState("200");
  const [newInstall, setNewInstall] = useState("");
  const [newSource, setNewSource] = useState("tolley");
  const [newPaidBy, setNewPaidBy] = useState("tolley");
  const [newNotes, setNewNotes] = useState("");
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Photo upload for existing client
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const receiptRef = useRef<HTMLInputElement>(null);

  // Stripe verification
  const [showStripe, setShowStripe] = useState(false);
  const [stripeSubs, setStripeSubs] = useState<
    {
      id: string;
      status: string;
      amount: number;
      customerName: string | null;
      customerEmail: string | null;
      customerId: string;
    }[]
  >([]);
  const [stripeLoading, setStripeLoading] = useState(false);

  // ─── Auth check on mount ───

  useEffect(() => {
    fetch("/api/wd/clients")
      .then((r) => {
        if (r.ok) return r.json();
        throw new Error("not authed");
      })
      .then((data) => {
        setAuthed(true);
        setRole(data.role);
        setClients(data.clients);
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  // ─── Data loaders ───

  async function loadClients() {
    setLoading(true);
    try {
      const res = await fetch("/api/wd/clients");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setClients(data.clients);
      setRole(data.role);
    } catch (err) {
      console.error("Failed to load clients:", err);
    }
    setLoading(false);
  }

  async function handlePin(e: React.FormEvent) {
    e.preventDefault();
    setPinError("");
    const res = await fetch("/api/wd/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) {
      const data = await res.json();
      setAuthed(true);
      setRole(data.role);
      loadClients();
    } else {
      setPinError("Wrong PIN");
    }
  }

  // ─── Client CRUD ───

  async function handleAddClient(e: React.FormEvent) {
    e.preventDefault();
    if (!newName || !newUnit) return;
    setPosting(true);

    try {
      // Upload photos
      const photoUrls: string[] = [];
      for (const file of newPhotos) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("type", "photo");
        const upRes = await fetch("/api/wd/upload", { method: "POST", body: fd });
        if (!upRes.ok) throw new Error("Upload failed");
        const { url } = await upRes.json();
        photoUrls.push(url);
      }

      const res = await fetch("/api/wd/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          address: newAddress || undefined,
          phone: newPhone || undefined,
          email: newEmail || undefined,
          unitDescription: newUnit,
          unitCost: parseFloat(newCost) || 200,
          installDate: newInstall || undefined,
          source: newSource,
          paidBy: newPaidBy,
          notes: newNotes || undefined,
          photoUrls,
        }),
      });

      if (!res.ok) throw new Error("Create failed");

      // Reset form
      setNewName("");
      setNewAddress("");
      setNewPhone("");
      setNewEmail("");
      setNewUnit("");
      setNewCost("200");
      setNewInstall("");
      setNewSource("tolley");
      setNewPaidBy("tolley");
      setNewNotes("");
      setNewPhotos([]);
      setNewPreviews([]);
      setShowForm(false);
      setSuccess("Client added!");
      setTimeout(() => setSuccess(""), 3000);
      loadClients();
    } catch (err) {
      alert("Failed: " + (err instanceof Error ? err.message : "Unknown"));
    }
    setPosting(false);
  }

  async function saveField(clientId: string, field: string, value: unknown) {
    const res = await fetch(`/api/wd/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (res.ok) {
      setEditingField(null);
      loadClients();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Update failed");
    }
  }

  async function toggleActive(c: WdClient) {
    await saveField(c.id, "active", !c.active);
  }

  async function toggleLock(c: WdClient) {
    await saveField(c.id, "locked", !c.locked);
  }

  async function toggleBlockField(c: WdClient, field: string) {
    const blocked = c.blockedFields || [];
    const next = blocked.includes(field)
      ? blocked.filter((f) => f !== field)
      : [...blocked, field];
    await saveField(c.id, "blockedFields", next);
  }

  async function deleteClient(id: string) {
    if (!confirm("Delete this client and all payments?")) return;
    await fetch(`/api/wd/clients/${id}`, { method: "DELETE" });
    loadClients();
  }

  // ─── Payments ───

  async function addPayment(clientId: string) {
    if (!payAmount || !payMonth) return;
    const res = await fetch(`/api/wd/clients/${clientId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: parseFloat(payAmount),
        month: payMonth,
        note: payNote || undefined,
      }),
    });
    if (res.ok) {
      setPayMonth("");
      setPayAmount("");
      setPayNote("");
      setPayingFor(null);
      loadClients();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Failed");
    }
  }

  async function deletePayment(clientId: string, paymentId: string) {
    if (!confirm("Delete this payment?")) return;
    await fetch(`/api/wd/clients/${clientId}/payments?paymentId=${paymentId}`, {
      method: "DELETE",
    });
    loadClients();
  }

  // ─── Photo upload for existing client ───

  async function handlePhotoUpload(
    clientId: string,
    file: File,
    type: "photo" | "receipt"
  ) {
    setUploadingFor(clientId);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", type);
    const upRes = await fetch("/api/wd/upload", { method: "POST", body: fd });
    if (!upRes.ok) {
      alert("Upload failed");
      setUploadingFor(null);
      return;
    }
    const { url } = await upRes.json();

    const client = clients.find((c) => c.id === clientId);
    if (!client) return;

    const field = type === "receipt" ? "receiptUrls" : "photoUrls";
    const current = type === "receipt" ? client.receiptUrls : client.photoUrls;
    await saveField(clientId, field, [...current, url]);
    setUploadingFor(null);
  }

  // ─── Stripe verification ───

  async function loadStripe() {
    setStripeLoading(true);
    try {
      const res = await fetch("/api/wd/stripe");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setStripeSubs(data.subscriptions);
    } catch {
      alert("Failed to load Stripe data");
    }
    setStripeLoading(false);
  }

  // ─── New client photo handling ───

  function handleNewPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    setNewPhotos((p) => [...p, ...files]);
    files.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (ev) =>
        setNewPreviews((p) => [...p, ev.target?.result as string]);
      reader.readAsDataURL(f);
    });
  }

  // ─── Filtered clients ───

  const filtered = clients.filter((c) => {
    if (tab === "tolley") return c.source === "tolley" || c.source === "both";
    if (tab === "keegan") return c.source === "keegan";
    return true;
  });

  const activeClients = clients.filter((c) => c.active);
  const totalMonthlyRevenue = clients.reduce((sum, c) => {
    const lastPayment = c.payments.length > 0 ? c.payments[c.payments.length - 1] : null;
    return sum + (lastPayment && c.active ? lastPayment.amount : 0);
  }, 0);
  const allTimeRevenue = clients.reduce((s, c) => s + c.split.totalRevenue, 0);
  const tolleyTotal = clients.reduce((s, c) => s + c.split.tolleySplit, 0);
  const keeganTotal = clients.reduce((s, c) => s + c.split.keeganSplit, 0);

  // ─── Render ───

  if (checking) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p style={{ color: "rgba(59,130,246,0.5)" }}>Loading...</p>
      </div>
    );
  }

  // PIN gate
  if (!authed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <form
          onSubmit={handlePin}
          className="w-full max-w-xs rounded-2xl p-6 text-center"
          style={{
            background: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(59,130,246,0.2)",
          }}
        >
          <h2 className="text-lg font-bold text-blue-900">WD Admin Access</h2>
          <p className="mt-1 text-sm" style={{ color: "rgba(30,64,175,0.5)" }}>
            Enter your PIN
          </p>
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="mt-4 w-full rounded-lg px-4 py-3 text-center text-2xl tracking-[0.3em]"
            style={{
              background: "rgba(255,255,255,0.7)",
              border: "1px solid rgba(59,130,246,0.3)",
              color: "#1e3a5f",
            }}
            placeholder="----"
          />
          {pinError && <p className="mt-2 text-sm text-red-500">{pinError}</p>}
          <button
            type="submit"
            className="mt-4 w-full rounded-lg px-4 py-3 font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)" }}
          >
            Enter
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4" style={{ position: "relative", zIndex: 2 }}>
      {/* Role badge */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-blue-900">WD Admin</h1>
        <span
          className="rounded-full px-3 py-1 text-xs font-semibold text-white"
          style={{
            background:
              role === "tolley"
                ? "linear-gradient(135deg, #3b82f6, #1d4ed8)"
                : "linear-gradient(135deg, #8b5cf6, #6d28d9)",
          }}
        >
          {role === "tolley" ? "Tolley" : "Keegan"}
        </span>
      </div>

      {/* Stats banner */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {[
          { label: "Total Clients", value: clients.length, color: "#1e40af" },
          { label: "Active", value: activeClients.length, color: "#059669" },
          { label: "Monthly Rev", value: fmt(totalMonthlyRevenue), color: "#1e40af" },
          { label: "All-Time Rev", value: fmt(allTimeRevenue), color: "#1e40af" },
          { label: "Tolley Split", value: fmt(tolleyTotal), color: "#2563eb" },
          { label: "Keegan Split", value: fmt(keeganTotal), color: "#7c3aed" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl p-3 text-center"
            style={{
              background: "rgba(255,255,255,0.7)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(59,130,246,0.15)",
            }}
          >
            <p className="text-lg font-bold" style={{ color: s.color }}>
              {s.value}
            </p>
            <p className="text-[10px]" style={{ color: "rgba(30,64,175,0.5)" }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Success */}
      {success && (
        <div
          className="mt-3 rounded-lg px-4 py-2 text-center text-sm font-medium"
          style={{
            background: "rgba(16,185,129,0.15)",
            border: "1px solid rgba(16,185,129,0.3)",
            color: "#059669",
          }}
        >
          {success}
        </div>
      )}

      {/* Tab bar */}
      <div className="mt-4 flex gap-1 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.5)" }}>
        {(["all", "tolley", "keegan"] as TabFilter[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-all"
            style={{
              background: tab === t ? "#2563eb" : "transparent",
              color: tab === t ? "#fff" : "#1e40af",
            }}
          >
            {t === "all" ? "All" : t === "tolley" ? "Your KC Homes" : "Keegan's"}
          </button>
        ))}
      </div>

      {/* Add client */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="mt-4 w-full rounded-xl px-4 py-4 text-lg font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)" }}
        >
          + Add Client
        </button>
      ) : (
        <form
          onSubmit={handleAddClient}
          className="mt-4 rounded-xl p-4"
          style={{
            background: "rgba(255,255,255,0.8)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(59,130,246,0.2)",
          }}
        >
          <h3 className="font-semibold text-blue-900">New Client</h3>

          {/* Photo upload */}
          <div className="mt-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handleNewPhotos}
              className="hidden"
            />
            {newPreviews.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {newPreviews.map((src, i) => (
                  <div
                    key={i}
                    className="relative h-20 w-20 overflow-hidden rounded-lg"
                  >
                    <Image src={src} alt="" fill className="object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setNewPhotos((p) => p.filter((_, j) => j !== i));
                        setNewPreviews((p) => p.filter((_, j) => j !== i));
                      }}
                      className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-xs text-white"
                    >
                      x
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed text-2xl"
                  style={{ borderColor: "rgba(59,130,246,0.3)", color: "rgba(59,130,246,0.4)" }}
                >
                  +
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center rounded-xl py-8"
                style={{ background: "rgba(59,130,246,0.05)", border: "2px dashed rgba(59,130,246,0.2)" }}
              >
                <div className="text-center">
                  <p className="text-3xl">📷</p>
                  <p className="mt-1 text-sm" style={{ color: "rgba(30,64,175,0.4)" }}>
                    Tap to add unit photo
                  </p>
                </div>
              </button>
            )}
          </div>

          <input
            type="text"
            placeholder="Client name *"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            className="wd-input mt-3 w-full"
          />
          <input
            type="text"
            placeholder="Address"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            className="wd-input mt-2 w-full"
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              type="tel"
              placeholder="Phone"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              className="wd-input w-full"
            />
            <input
              type="email"
              placeholder="Email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="wd-input w-full"
            />
          </div>
          <input
            type="text"
            placeholder="Unit description (e.g. Whirlpool W & Amana D) *"
            value={newUnit}
            onChange={(e) => setNewUnit(e.target.value)}
            required
            className="wd-input mt-2 w-full"
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Unit cost"
              value={newCost}
              onChange={(e) => setNewCost(e.target.value)}
              className="wd-input w-full"
            />
            <input
              type="date"
              placeholder="Install date"
              value={newInstall}
              onChange={(e) => setNewInstall(e.target.value)}
              className="wd-input w-full"
            />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <select
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              className="wd-input w-full"
            >
              <option value="tolley">Source: Tolley</option>
              <option value="keegan">Source: Keegan</option>
              <option value="both">Source: Both</option>
            </select>
            <select
              value={newPaidBy}
              onChange={(e) => setNewPaidBy(e.target.value)}
              className="wd-input w-full"
            >
              <option value="tolley">Paid by: Tolley</option>
              <option value="keegan">Paid by: Keegan</option>
            </select>
          </div>
          <textarea
            placeholder="Notes"
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            rows={2}
            className="wd-input mt-2 w-full resize-none"
          />

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={posting || !newName || !newUnit}
              className="flex-1 rounded-lg py-3 font-semibold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)" }}
            >
              {posting ? "Saving..." : "Add Client"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setNewPhotos([]);
                setNewPreviews([]);
              }}
              className="rounded-lg px-4 py-3 text-sm"
              style={{ border: "1px solid rgba(59,130,246,0.2)", color: "#2563eb" }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Stripe verification (Tolley only) */}
      {role === "tolley" && (
        <div className="mt-4">
          <button
            onClick={() => {
              setShowStripe(!showStripe);
              if (!showStripe && stripeSubs.length === 0) loadStripe();
            }}
            className="w-full rounded-xl px-4 py-3 text-sm font-semibold"
            style={{
              background: "rgba(255,255,255,0.6)",
              border: "1px solid rgba(59,130,246,0.15)",
              color: "#1e40af",
            }}
          >
            {showStripe ? "Hide" : "Verify with"} Stripe
          </button>
          {showStripe && (
            <div
              className="mt-2 rounded-xl p-4"
              style={{
                background: "rgba(255,255,255,0.7)",
                border: "1px solid rgba(59,130,246,0.15)",
              }}
            >
              {stripeLoading ? (
                <p className="text-center text-sm" style={{ color: "#2563eb" }}>
                  Loading Stripe...
                </p>
              ) : stripeSubs.length === 0 ? (
                <p className="text-center text-sm" style={{ color: "rgba(30,64,175,0.5)" }}>
                  No WD subscriptions found
                </p>
              ) : (
                <div className="space-y-2">
                  {stripeSubs.map((s) => {
                    const matched = clients.find(
                      (c) => c.stripeCustomerId === s.customerId
                    );
                    return (
                      <div
                        key={s.id}
                        className="flex items-center justify-between rounded-lg p-2 text-sm"
                        style={{
                          background: matched
                            ? "rgba(16,185,129,0.1)"
                            : "rgba(239,68,68,0.1)",
                          border: `1px solid ${matched ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
                        }}
                      >
                        <div>
                          <p className="font-medium" style={{ color: "#1e3a5f" }}>
                            {s.customerName || s.customerEmail || "Unknown"}
                          </p>
                          <p style={{ color: "rgba(30,64,175,0.5)" }}>
                            {fmt(s.amount)}/mo - {s.status}
                          </p>
                        </div>
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{
                            background: matched ? "#dcfce7" : "#fef2f2",
                            color: matched ? "#059669" : "#dc2626",
                          }}
                        >
                          {matched ? "Matched" : "Unmatched"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Client cards */}
      <div className="mt-4 space-y-3">
        {loading && clients.length === 0 ? (
          <p className="py-8 text-center" style={{ color: "rgba(59,130,246,0.4)" }}>
            Loading...
          </p>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center" style={{ color: "rgba(59,130,246,0.4)" }}>
            No clients in this tab
          </p>
        ) : (
          filtered.map((c) => {
            const isExpanded = expandedId === c.id;
            const paybackPct = pct(c.unitCost - c.split.paybackRemaining, c.unitCost);

            return (
              <div
                key={c.id}
                className="overflow-hidden rounded-xl"
                style={{
                  background: "rgba(255,255,255,0.75)",
                  backdropFilter: "blur(8px)",
                  border: `1px solid ${c.needsReview ? "rgba(245,158,11,0.4)" : "rgba(59,130,246,0.15)"}`,
                }}
              >
                {/* Card header — always visible */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                  className="flex w-full items-center gap-3 p-4 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-blue-900">
                        {c.name}
                      </span>
                      {!c.active && (
                        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                          Inactive
                        </span>
                      )}
                      {c.locked && (
                        <span className="text-xs" title="Locked">
                          🔒
                        </span>
                      )}
                      {c.needsReview && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{ background: "#fef3c7", color: "#92400e" }}
                        >
                          Needs Review
                        </span>
                      )}
                    </div>
                    <p className="text-xs" style={{ color: "rgba(30,64,175,0.5)" }}>
                      {c.unitDescription}
                    </p>
                    <div className="mt-1 flex items-center gap-3 text-xs">
                      <span style={{ color: "#2563eb" }}>
                        T: {fmt(c.split.tolleySplit)}
                      </span>
                      <span style={{ color: "#7c3aed" }}>
                        K: {fmt(c.split.keeganSplit)}
                      </span>
                      <span style={{ color: "rgba(30,64,175,0.4)" }}>
                        Total: {fmt(c.split.totalRevenue)}
                      </span>
                    </div>
                    {/* Payback progress bar */}
                    <div className="mt-1.5">
                      <div
                        className="h-1.5 w-full overflow-hidden rounded-full"
                        style={{ background: "rgba(59,130,246,0.1)" }}
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${paybackPct}%`,
                            background: c.split.paybackComplete
                              ? "#10b981"
                              : "linear-gradient(90deg, #3b82f6, #2563eb)",
                          }}
                        />
                      </div>
                      <p className="mt-0.5 text-[10px]" style={{ color: "rgba(30,64,175,0.4)" }}>
                        {c.split.paybackComplete
                          ? "Payback complete"
                          : `${fmt(c.split.paybackRemaining)} remaining of ${fmt(c.unitCost)}`}
                      </p>
                    </div>
                  </div>
                  <span
                    className="text-lg transition-transform"
                    style={{
                      transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                      color: "rgba(59,130,246,0.4)",
                    }}
                  >
                    ▼
                  </span>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div
                    className="border-t px-4 pb-4 pt-3"
                    style={{ borderColor: "rgba(59,130,246,0.1)" }}
                  >
                    {/* Editable fields */}
                    {(
                      [
                        { key: "address", label: "Address" },
                        { key: "phone", label: "Phone" },
                        { key: "email", label: "Email" },
                        { key: "notes", label: "Notes" },
                        { key: "unitDescription", label: "Unit" },
                      ] as { key: string; label: string }[]
                    ).map(({ key, label }) => {
                      const val = c[key as keyof WdClient];
                      const isBlocked =
                        role === "keegan" && c.blockedFields?.includes(key);
                      const isEditing =
                        editingField?.clientId === c.id &&
                        editingField.field === key;
                      const canEdit =
                        !c.locked || role === "tolley"
                          ? !isBlocked
                          : false;

                      return (
                        <div
                          key={key}
                          className="mt-2 flex items-start gap-2"
                        >
                          <span
                            className="w-16 shrink-0 text-xs font-medium"
                            style={{ color: "rgba(30,64,175,0.5)" }}
                          >
                            {label}
                          </span>
                          {isBlocked ? (
                            <span className="text-sm" style={{ color: "rgba(30,64,175,0.3)" }}>
                              ---
                            </span>
                          ) : isEditing ? (
                            <div className="flex flex-1 gap-1">
                              <input
                                autoFocus
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="wd-input flex-1 text-sm"
                              />
                              <button
                                onClick={() => saveField(c.id, key, editValue || null)}
                                className="rounded px-2 text-xs text-white"
                                style={{ background: "#2563eb" }}
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingField(null)}
                                className="rounded px-2 text-xs"
                                style={{ color: "#2563eb" }}
                              >
                                X
                              </button>
                            </div>
                          ) : (
                            <span
                              className={`flex-1 text-sm ${canEdit ? "cursor-pointer" : ""}`}
                              style={{ color: val ? "#1e3a5f" : "rgba(30,64,175,0.3)" }}
                              onClick={() => {
                                if (!canEdit) return;
                                setEditingField({ clientId: c.id, field: key });
                                setEditValue((val as string) || "");
                              }}
                            >
                              {(val as string) || "—"}
                            </span>
                          )}
                          {/* Block toggle (Tolley only) */}
                          {role === "tolley" && (
                            <button
                              onClick={() => toggleBlockField(c, key)}
                              className="shrink-0 text-xs"
                              title={
                                c.blockedFields?.includes(key)
                                  ? "Unblock for Keegan"
                                  : "Block from Keegan"
                              }
                              style={{
                                color: c.blockedFields?.includes(key)
                                  ? "#dc2626"
                                  : "rgba(30,64,175,0.3)",
                              }}
                            >
                              {c.blockedFields?.includes(key) ? "🙈" : "👁"}
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {/* Source / Paid by */}
                    <div className="mt-3 flex gap-4 text-xs" style={{ color: "rgba(30,64,175,0.5)" }}>
                      <span>Source: <strong style={{ color: "#1e3a5f" }}>{c.source}</strong></span>
                      <span>Paid by: <strong style={{ color: "#1e3a5f" }}>{c.paidBy}</strong></span>
                      {c.installDate && (
                        <span>
                          Installed:{" "}
                          <strong style={{ color: "#1e3a5f" }}>
                            {new Date(c.installDate).toLocaleDateString()}
                          </strong>
                        </span>
                      )}
                    </div>

                    {/* Action buttons (Tolley) */}
                    {role === "tolley" && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => toggleActive(c)}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium"
                          style={{
                            background: c.active ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)",
                            color: c.active ? "#dc2626" : "#059669",
                            border: `1px solid ${c.active ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)"}`,
                          }}
                        >
                          {c.active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => toggleLock(c)}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium"
                          style={{
                            background: "rgba(59,130,246,0.1)",
                            color: "#2563eb",
                            border: "1px solid rgba(59,130,246,0.2)",
                          }}
                        >
                          {c.locked ? "Unlock" : "Lock"}
                        </button>
                        <button
                          onClick={() => saveField(c.id, "needsReview", !c.needsReview)}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium"
                          style={{
                            background: "rgba(245,158,11,0.1)",
                            color: "#92400e",
                            border: "1px solid rgba(245,158,11,0.2)",
                          }}
                        >
                          {c.needsReview ? "Clear Review" : "Flag Review"}
                        </button>
                        <button
                          onClick={() => deleteClient(c.id)}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium"
                          style={{
                            background: "rgba(239,68,68,0.1)",
                            color: "#dc2626",
                            border: "1px solid rgba(239,68,68,0.2)",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    )}

                    {/* Payment history */}
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-blue-900">
                        Payments ({c.payments.length})
                      </h4>
                      {c.payments.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {[...c.payments]
                            .sort((a, b) => b.month.localeCompare(a.month))
                            .map((p) => (
                              <div
                                key={p.id}
                                className="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm"
                                style={{ background: "rgba(59,130,246,0.05)" }}
                              >
                                <span style={{ color: "#1e3a5f" }}>
                                  {p.month} — {fmt(p.amount)}
                                  {p.note && (
                                    <span style={{ color: "rgba(30,64,175,0.4)" }}>
                                      {" "}
                                      ({p.note})
                                    </span>
                                  )}
                                </span>
                                {role === "tolley" && (
                                  <button
                                    onClick={() => deletePayment(c.id, p.id)}
                                    className="text-xs"
                                    style={{ color: "rgba(239,68,68,0.6)" }}
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            ))}
                        </div>
                      )}

                      {/* Add payment mini-form */}
                      {payingFor === c.id ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <input
                            type="text"
                            placeholder="YYYY-MM"
                            value={payMonth}
                            onChange={(e) => setPayMonth(e.target.value)}
                            className="wd-input w-24 text-sm"
                          />
                          <input
                            type="number"
                            placeholder="Amount"
                            step="0.01"
                            value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)}
                            className="wd-input w-24 text-sm"
                          />
                          <input
                            type="text"
                            placeholder="Note"
                            value={payNote}
                            onChange={(e) => setPayNote(e.target.value)}
                            className="wd-input flex-1 text-sm"
                          />
                          <button
                            onClick={() => addPayment(c.id)}
                            disabled={!payMonth || !payAmount}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                            style={{ background: "#2563eb" }}
                          >
                            Add
                          </button>
                          <button
                            onClick={() => setPayingFor(null)}
                            className="text-xs"
                            style={{ color: "#2563eb" }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setPayingFor(c.id);
                            setPayMonth("");
                            setPayAmount("");
                            setPayNote("");
                          }}
                          className="mt-2 rounded-lg px-3 py-1.5 text-xs font-medium"
                          style={{
                            background: "rgba(59,130,246,0.1)",
                            color: "#2563eb",
                            border: "1px solid rgba(59,130,246,0.2)",
                          }}
                        >
                          + Add Payment
                        </button>
                      )}
                    </div>

                    {/* Photos */}
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-blue-900">
                        Unit Photos ({c.photoUrls.length})
                      </h4>
                      <input
                        ref={photoRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handlePhotoUpload(c.id, f, "photo");
                          e.target.value = "";
                        }}
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        {c.photoUrls.map((url, i) => (
                          <div
                            key={i}
                            className="relative h-20 w-20 overflow-hidden rounded-lg"
                          >
                            <Image
                              src={url}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="80px"
                            />
                          </div>
                        ))}
                        <button
                          onClick={() => photoRef.current?.click()}
                          disabled={uploadingFor === c.id}
                          className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed text-xl"
                          style={{
                            borderColor: "rgba(59,130,246,0.3)",
                            color: "rgba(59,130,246,0.4)",
                          }}
                        >
                          {uploadingFor === c.id ? "..." : "+"}
                        </button>
                      </div>
                    </div>

                    {/* Receipts */}
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-blue-900">
                        Receipts ({c.receiptUrls.length})
                      </h4>
                      <input
                        ref={receiptRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handlePhotoUpload(c.id, f, "receipt");
                          e.target.value = "";
                        }}
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        {c.receiptUrls.map((url, i) => (
                          <div
                            key={i}
                            className="relative h-20 w-20 overflow-hidden rounded-lg"
                          >
                            <Image
                              src={url}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="80px"
                            />
                          </div>
                        ))}
                        <button
                          onClick={() => receiptRef.current?.click()}
                          disabled={uploadingFor === c.id}
                          className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed text-xl"
                          style={{
                            borderColor: "rgba(59,130,246,0.3)",
                            color: "rgba(59,130,246,0.4)",
                          }}
                        >
                          {uploadingFor === c.id ? "..." : "+"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
