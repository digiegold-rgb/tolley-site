"use client";

/**
 * License Reviews panel — digest subscribers awaiting manual license
 * verification (all KS signups + MO signups during registry outages).
 * Rendered above the outreach drafts in the Growth HQ Approvals tab.
 * Approve keeps the digest flowing; Reject cancels their Stripe subscription
 * (during the 3-day trial = $0 charged).
 */

export interface HqLicenseReview {
  id: string;
  name: string;
  email: string;
  farmZips: string[];
  status: string;
  licenseState: string | null;
  licenseNumber: string | null;
  joinedAt: string;
}

const VERIFY_URL: Record<string, string> = {
  MO: "https://mopro.mo.gov/license/s/license-search",
  KS: "https://aca-prod.accela.com/KANSAS/Cap/CapHome.aspx?module=Licenses",
};

interface Props {
  reviews: HqLicenseReview[];
  loading: boolean;
  busyId: string | null;
  onRefresh: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export function HqLicenseReviews({
  reviews,
  loading,
  busyId,
  onRefresh,
  onApprove,
  onReject,
}: Props) {
  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          License reviews{" "}
          {reviews.length > 0 && <span style={{ color: "#b8860b" }}>({reviews.length})</span>}
        </div>
        <button className="btn btn-sm" onClick={onRefresh} disabled={loading}>
          {loading ? "…" : "Refresh"}
        </button>
      </div>

      {reviews.length === 0 && !loading && (
        <div style={{ fontSize: 13, color: "#999", padding: "8px 0" }}>
          No licenses waiting. Kansas digest signups (and Missouri ones during registry
          outages) land here — verify the number with the state, then approve or reject.
        </div>
      )}

      {reviews.map((r) => {
        const busy = busyId === r.id;
        const verifyUrl = VERIFY_URL[r.licenseState ?? ""] ?? VERIFY_URL.MO;
        return (
          <div
            key={r.id}
            style={{
              border: "1px solid #e5e5ea",
              borderRadius: 8,
              padding: "10px 12px",
              marginBottom: 8,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div style={{ flex: "1 1 240px", minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>
                {r.name}{" "}
                <span style={{ color: "#999", fontWeight: 400 }}>· {r.email}</span>
              </div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
                <b>{r.licenseState} #{r.licenseNumber}</b> · ZIPs {r.farmZips.join(", ")} ·
                signed up {new Date(r.joinedAt).toLocaleDateString()} · sub status{" "}
                {r.status}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <a
                className="btn btn-sm"
                href={verifyUrl}
                target="_blank"
                rel="noreferrer"
              >
                Look up ↗
              </a>
              <button
                className="btn btn-sm btn-primary"
                disabled={busy}
                onClick={() => onApprove(r.id)}
              >
                {busy ? "…" : "Approve"}
              </button>
              <button
                className="btn btn-sm"
                style={{ color: "#c44" }}
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      `Reject ${r.name}'s license and cancel their subscription? During the trial this means they're never charged.`
                    )
                  ) {
                    onReject(r.id);
                  }
                }}
              >
                {busy ? "…" : "Reject"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
