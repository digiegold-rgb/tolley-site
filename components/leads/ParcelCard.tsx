"use client";

interface ParcelData {
  id: string;
  regridId: string;
  parcelnumb: string | null;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  county: string | null;
  owner: string | null;
  owntype: string | null;
  mailadd: string | null;
  mailcity: string | null;
  mailstate: string | null;
  mailzip: string | null;
  isAbsentee: boolean;
  isVacant: boolean;
  parval: number | null;
  landval: number | null;
  improvval: number | null;
  saleprice: number | null;
  saledate: string | null;
  taxamt: number | null;
  yearbuilt: number | null;
  ll_gisacre: number | null;
  ll_gissqft: number | null;
  zoning: string | null;
  zoning_description: string | null;
  usps_vacancy: string | null;
  qoz: boolean;
}

export default function ParcelCard({
  parcel,
  score,
  onRunDossier,
}: {
  parcel: ParcelData;
  score?: number;
  onRunDossier?: () => void;
}) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {/* Score + Address */}
          <div className="flex items-center gap-3">
            {score != null && (
              <div className="flex flex-col items-center min-w-[48px]">
                <span
                  className={`text-2xl font-bold tabular-nums leading-none ${
                    score >= 60
                      ? "text-red-400"
                      : score >= 40
                        ? "text-orange-400"
                        : score >= 25
                          ? "text-yellow-400"
                          : "text-white/50"
                  }`}
                >
                  {score}
                </span>
                <span className="text-[0.55rem] text-white/30 mt-0.5">SCORE</span>
              </div>
            )}
            <div>
              <h3 className="font-semibold text-white">{parcel.address}</h3>
              <p className="text-xs text-white/40">
                {parcel.city}{parcel.state ? `, ${parcel.state}` : ""} {parcel.zip || ""}
                {parcel.county && <span className="text-white/30"> | {parcel.county}</span>}
              </p>
            </div>
          </div>

          {/* Flags */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {parcel.isAbsentee && (
              <span className="rounded-full bg-orange-500/15 text-orange-300 px-2 py-0.5 text-[0.65rem] font-medium">
                Absentee
              </span>
            )}
            {parcel.isVacant && (
              <span className="rounded-full bg-red-500/15 text-red-300 px-2 py-0.5 text-[0.65rem] font-medium">
                Vacant
              </span>
            )}
            {parcel.qoz && (
              <span className="rounded-full bg-blue-500/15 text-blue-300 px-2 py-0.5 text-[0.65rem] font-medium">
                QOZ
              </span>
            )}
          </div>

          {/* Owner */}
          {parcel.owner && (
            <div className="mt-2">
              <span className="text-xs text-white/40">Owner: </span>
              <span className="text-sm text-white/70">{parcel.owner}</span>
              {parcel.owntype && (
                <span className="text-xs text-white/30 ml-1">({parcel.owntype})</span>
              )}
            </div>
          )}

          {/* Situs vs Mailing */}
          {parcel.isAbsentee && parcel.mailadd && (
            <div className="mt-1 text-xs text-orange-300/70">
              Mail: {[parcel.mailadd, parcel.mailcity, parcel.mailstate, parcel.mailzip]
                .filter(Boolean)
                .join(", ")}
            </div>
          )}

          {/* Details row */}
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-white/60">
            {parcel.parval != null && (
              <span className="font-medium text-white/80">
                ${parcel.parval.toLocaleString()} assessed
              </span>
            )}
            {parcel.saleprice != null && (
              <span>
                ${parcel.saleprice.toLocaleString()} last sale
                {parcel.saledate && <span className="text-white/30"> ({parcel.saledate})</span>}
              </span>
            )}
            {parcel.yearbuilt != null && <span>Built {parcel.yearbuilt}</span>}
            {parcel.ll_gisacre != null && <span>{parcel.ll_gisacre.toFixed(2)} ac</span>}
            {parcel.taxamt != null && <span>${parcel.taxamt.toLocaleString()}/yr tax</span>}
            {parcel.zoning && <span>{parcel.zoning}</span>}
          </div>

          {/* APN */}
          {parcel.parcelnumb && (
            <p className="mt-1 text-xs text-white/25">APN: {parcel.parcelnumb}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-2">
          {onRunDossier && (
            <button
              onClick={onRunDossier}
              className="text-xs rounded bg-purple-600/30 text-purple-300 px-2 py-1 hover:bg-purple-600/50"
            >
              Run Dossier
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
