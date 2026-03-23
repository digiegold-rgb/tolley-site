"use client";

import { useEffect, useState, useRef } from "react";

interface DriverDoc {
  type: string;
  label: string;
  status: string;
  id?: string;
  fileUrl?: string;
  fileName?: string;
  expiresAt?: string;
  docNumber?: string;
  holderName?: string;
  issueState?: string;
  rejectedReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  approved: { bg: "bg-green-900/40", text: "text-green-400", label: "Approved" },
  pending: { bg: "bg-yellow-900/40", text: "text-yellow-400", label: "Under Review" },
  rejected: { bg: "bg-red-900/40", text: "text-red-400", label: "Rejected" },
  expired: { bg: "bg-red-900/40", text: "text-red-400", label: "Expired" },
  missing: { bg: "bg-gray-800", text: "text-gray-500", label: "Not Uploaded" },
};

export default function DriverDocumentsPage() {
  const [docs, setDocs] = useState<DriverDoc[]>([]);
  const [compliant, setCompliant] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function fetchDocs() {
    try {
      const res = await fetch("/api/dispatch/driver/documents");
      if (!res.ok) {
        setError(res.status === 404 ? "Not registered as a driver" : "Failed to load documents");
        return;
      }
      const data = await res.json();
      setDocs(data.documents);
      setCompliant(data.compliant);
    } catch {
      setError("Failed to load documents");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDocs();
  }, []);

  async function handleUpload(type: string) {
    const input = fileRefs.current[type];
    const file = input?.files?.[0];
    if (!file) return;

    // Get expiration date from the date input
    const dateInput = document.getElementById(`expires-${type}`) as HTMLInputElement;
    const expiresAt = dateInput?.value || "";

    setUploading(type);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);
      if (expiresAt) formData.append("expiresAt", expiresAt);

      const res = await fetch("/api/dispatch/driver/documents", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Upload failed");
        return;
      }

      setSuccess(`${type.replace(/_/g, " ")} uploaded successfully! Under review.`);
      if (input) input.value = "";
      if (dateInput) dateInput.value = "";
      await fetchDocs();
    } catch {
      setError("Upload failed — try again");
    } finally {
      setUploading(null);
    }
  }

  function daysUntilExpiry(expiresAt: string): number {
    return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  if (loading) {
    return (
      <main className="relative z-10 min-h-screen flex items-center justify-center">
        <div className="text-gray-400 text-lg">Loading documents...</div>
      </main>
    );
  }

  if (error && docs.length === 0) {
    return (
      <main className="relative z-10 min-h-screen py-12 px-4 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Documents</h1>
        <p className="text-gray-400">{error}</p>
        <a
          href="/drive/register"
          className="inline-block mt-4 px-6 py-3 bg-red-600 text-white font-semibold rounded-lg"
        >
          Register as Driver
        </a>
      </main>
    );
  }

  return (
    <main className="relative z-10 min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Documents</h1>
            <p className="text-sm text-gray-400">
              Upload your DL, insurance, and vehicle registration
            </p>
          </div>
          <a
            href="/drive/driver"
            className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700"
          >
            Back to Dashboard
          </a>
        </div>

        {/* Compliance banner */}
        {compliant ? (
          <div className="p-4 bg-green-900/20 border border-green-700/40 rounded-lg mb-6">
            <p className="text-green-400 font-semibold">All documents verified — you&apos;re cleared to drive.</p>
          </div>
        ) : (
          <div className="p-4 bg-yellow-900/20 border border-yellow-700/40 rounded-lg mb-6">
            <p className="text-yellow-400 font-semibold">
              Documents incomplete — upload all required documents to go online.
            </p>
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-900/40 border border-green-700 rounded-lg text-green-300 text-sm mb-4">
            {success}
          </div>
        )}
        {error && docs.length > 0 && (
          <div className="p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm mb-4">
            {error}
          </div>
        )}

        {/* Document cards */}
        <div className="space-y-4">
          {docs.map((doc) => {
            const statusStyle = STATUS_COLORS[doc.status] || STATUS_COLORS.missing;
            const expiryDays = doc.expiresAt ? daysUntilExpiry(doc.expiresAt) : null;

            return (
              <div
                key={doc.type}
                className="p-5 bg-gray-900/60 border border-gray-700 rounded-xl"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-semibold text-white">{doc.label}</h3>
                  <span
                    className={`px-3 py-1 rounded text-xs font-semibold ${statusStyle.bg} ${statusStyle.text}`}
                  >
                    {statusStyle.label}
                  </span>
                </div>

                {/* Current doc info */}
                {doc.fileUrl && (
                  <div className="mb-3 text-sm space-y-1">
                    <div className="flex items-center gap-3">
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 underline"
                      >
                        {doc.fileName}
                      </a>
                    </div>
                    {doc.holderName && (
                      <p className="text-gray-400">Name: {doc.holderName}</p>
                    )}
                    {doc.docNumber && (
                      <p className="text-gray-400">
                        #{doc.docNumber}
                        {doc.issueState ? ` (${doc.issueState})` : ""}
                      </p>
                    )}
                    {doc.expiresAt && (
                      <p
                        className={
                          expiryDays !== null && expiryDays <= 30
                            ? expiryDays <= 7
                              ? "text-red-400 font-semibold"
                              : "text-yellow-400"
                            : "text-gray-400"
                        }
                      >
                        Expires: {new Date(doc.expiresAt).toLocaleDateString()}
                        {expiryDays !== null && expiryDays > 0 && ` (${expiryDays} days)`}
                        {expiryDays !== null && expiryDays <= 0 && " (EXPIRED)"}
                      </p>
                    )}
                  </div>
                )}

                {/* Rejected reason */}
                {doc.status === "rejected" && doc.rejectedReason && (
                  <div className="p-3 bg-red-900/20 border border-red-800/40 rounded-lg mb-3">
                    <p className="text-red-400 text-sm">
                      <span className="font-semibold">Reason:</span> {doc.rejectedReason}
                    </p>
                  </div>
                )}

                {/* Upload form (show for missing, rejected, expired, or to update) */}
                {doc.status !== "pending" && (
                  <div className="mt-3 pt-3 border-t border-gray-700/50">
                    <p className="text-xs text-gray-500 mb-2">
                      {doc.status === "approved"
                        ? "Upload new version"
                        : `Upload your ${doc.label.toLowerCase()}`}
                    </p>
                    <div className="space-y-2">
                      <input
                        ref={(el) => { fileRefs.current[doc.type] = el; }}
                        type="file"
                        accept="image/*,.pdf"
                        className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-red-600 file:text-white hover:file:bg-red-700 file:cursor-pointer"
                      />
                      <div className="flex items-center gap-3">
                        <label className="text-xs text-gray-500">Expiration:</label>
                        <input
                          id={`expires-${doc.type}`}
                          type="date"
                          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-red-500"
                        />
                      </div>
                      <button
                        onClick={() => handleUpload(doc.type)}
                        disabled={uploading === doc.type}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white text-sm font-semibold rounded-lg transition-colors"
                      >
                        {uploading === doc.type ? "Uploading..." : "Upload"}
                      </button>
                    </div>
                  </div>
                )}

                {doc.status === "pending" && (
                  <p className="text-xs text-yellow-400/70 mt-2">
                    This document is being reviewed by our team. Usually within 24 hours.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Info section */}
        <div className="mt-8 p-5 bg-gray-900/40 border border-gray-700/50 rounded-xl">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Requirements</h3>
          <ul className="text-sm text-gray-500 space-y-1">
            <li>- Valid driver&apos;s license (not expired)</li>
            <li>- Active auto insurance covering delivery/commercial use</li>
            <li>- Current vehicle registration</li>
            <li>- Accepted formats: JPEG, PNG, WebP, PDF (max 10MB)</li>
            <li>- You&apos;ll be notified by SMS before any document expires</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
