"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function AddressSearch() {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("MO");
  const [zip, setZip] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/leads/dossier/address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          zip: zip.trim(),
          ...(ownerName.trim() ? { ownerName: ownerName.trim() } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error || "Failed to start research");
        return;
      }

      // Redirect to the dossier detail page
      router.push(`/leads/dossier/${data.jobId}`);
    } catch {
      setStatus("error");
      setErrorMsg("Network error");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-lg shadow-sky-500/5 backdrop-blur-sm mb-6">
      <h2 className="text-sm font-semibold text-white mb-3">Research any address</h2>
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Street address (e.g. 3525 Woodland Court)"
          className="flex-1 min-w-[200px] rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-sky-300/60 focus:ring-2 focus:ring-sky-400/20"
        />
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City"
          className="w-36 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-sky-300/60 focus:ring-2 focus:ring-sky-400/20"
        />
        <input
          type="text"
          value={state}
          onChange={(e) => setState(e.target.value)}
          placeholder="ST"
          className="w-16 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-sky-300/60 focus:ring-2 focus:ring-sky-400/20"
        />
        <input
          type="text"
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          placeholder="Zip"
          className="w-24 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-sky-300/60 focus:ring-2 focus:ring-sky-400/20"
        />
        <input
          type="text"
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          placeholder="Owner name (optional)"
          className="w-48 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-sky-300/60 focus:ring-2 focus:ring-sky-400/20"
        />
        <button
          type="submit"
          disabled={status === "loading" || !address.trim()}
          className="rounded-lg bg-gradient-to-br from-sky-400 to-cyan-500 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-sky-500/40 transition-all hover:shadow-lg hover:shadow-cyan-500/50 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === "loading" ? "Starting..." : "Research"}
        </button>
      </div>
      {errorMsg && <p className="text-xs text-red-400 mt-2">{errorMsg}</p>}
    </form>
  );
}
