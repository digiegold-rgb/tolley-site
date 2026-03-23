"use client";

import type { PluginOutput, Listing } from "./types";

export default function DossierParcel({
  pluginData,
  listing,
}: {
  pluginData: Record<string, PluginOutput>;
  listing: Listing;
}) {
  const regrid = pluginData["regrid"];
  if (!regrid?.success) return null;

  const rd = regrid.data;
  const l = listing;

  const isAbsentee = rd.isAbsentee === true;
  const isVacant = rd.isVacant === true;
  const isQoz = rd.qoz === true;
  const portfolioSize = typeof rd.portfolioSize === "number" ? rd.portfolioSize : 0;
  const portfolioParcels = (rd.portfolioParcels || []) as {
    address: string;
    city: string | null;
    parval: number | null;
  }[];
  const mailingAddress =
    typeof rd.mailingAddress === "string" ? rd.mailingAddress : "";
  const assessedValue =
    typeof rd.assessedValue === "number" ? rd.assessedValue : null;
  const landValue = typeof rd.landValue === "number" ? rd.landValue : null;
  const improvementValue =
    typeof rd.improvementValue === "number" ? rd.improvementValue : null;
  const taxAmount = typeof rd.taxAmount === "number" ? rd.taxAmount : null;
  const lastSalePrice =
    typeof rd.lastSalePrice === "number" ? rd.lastSalePrice : null;
  const lastSaleDate =
    typeof rd.lastSaleDate === "string" ? rd.lastSaleDate : "";
  const yearBuilt = typeof rd.yearBuilt === "number" ? rd.yearBuilt : null;
  const lotAcres = typeof rd.lotAcres === "number" ? rd.lotAcres : null;
  const zoning = typeof rd.zoning === "string" ? rd.zoning : "";
  const zoningDescription =
    typeof rd.zoningDescription === "string" ? rd.zoningDescription : "";
  const apn = typeof rd.apn === "string" ? rd.apn : "";

  return (
    <div className="space-y-3">
      {/* Flags row */}
      <div className="flex flex-wrap gap-1.5">
        {isAbsentee && (
          <span className="rounded-full bg-orange-500/15 text-orange-300 px-2.5 py-0.5 text-xs font-medium">
            ABSENTEE OWNER
          </span>
        )}
        {isVacant && (
          <span className="rounded-full bg-red-500/15 text-red-300 px-2.5 py-0.5 text-xs font-medium">
            USPS VACANT
          </span>
        )}
        {isQoz && (
          <span className="rounded-full bg-blue-500/15 text-blue-300 px-2.5 py-0.5 text-xs font-medium">
            QOZ
          </span>
        )}
        {portfolioSize >= 3 && (
          <span className="rounded-full bg-purple-500/15 text-purple-300 px-2.5 py-0.5 text-xs font-medium">
            {portfolioSize} PROPERTIES
          </span>
        )}
      </div>

      {/* Owner + Mailing comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg bg-white/[0.03] p-3">
          <div className="text-[0.65rem] font-medium text-white/40 uppercase mb-1">
            Property Address
          </div>
          <div className="text-sm text-white/80">{l.address}</div>
          <div className="text-xs text-white/40">
            {l.city}, {l.state} {l.zip}
          </div>
        </div>
        {mailingAddress && (
          <div
            className={`rounded-lg p-3 ${
              isAbsentee
                ? "bg-orange-500/5 border border-orange-500/20"
                : "bg-white/[0.03]"
            }`}
          >
            <div className="text-[0.65rem] font-medium text-white/40 uppercase mb-1">
              Mailing Address{" "}
              {isAbsentee && <span className="text-orange-300">(DIFFERENT)</span>}
            </div>
            <div className="text-sm text-white/80">{mailingAddress}</div>
          </div>
        )}
      </div>

      {/* Assessment & Tax */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        {assessedValue != null && (
          <div>
            <div className="text-[0.6rem] text-white/30 uppercase">Assessed Value</div>
            <div className="text-white/80 font-medium">
              ${assessedValue.toLocaleString()}
            </div>
          </div>
        )}
        {landValue != null && (
          <div>
            <div className="text-[0.6rem] text-white/30 uppercase">Land</div>
            <div className="text-white/60">${landValue.toLocaleString()}</div>
          </div>
        )}
        {improvementValue != null && (
          <div>
            <div className="text-[0.6rem] text-white/30 uppercase">Improvements</div>
            <div className="text-white/60">${improvementValue.toLocaleString()}</div>
          </div>
        )}
        {taxAmount != null && (
          <div>
            <div className="text-[0.6rem] text-white/30 uppercase">Annual Tax</div>
            <div className="text-white/80 font-medium">
              ${taxAmount.toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {/* Sale + Structure */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        {lastSalePrice != null && (
          <div>
            <div className="text-[0.6rem] text-white/30 uppercase">Last Sale</div>
            <div className="text-white/80">${lastSalePrice.toLocaleString()}</div>
            {lastSaleDate && (
              <div className="text-[0.6rem] text-white/30">{lastSaleDate}</div>
            )}
          </div>
        )}
        {yearBuilt != null && (
          <div>
            <div className="text-[0.6rem] text-white/30 uppercase">Year Built</div>
            <div className="text-white/60">{yearBuilt}</div>
          </div>
        )}
        {lotAcres != null && (
          <div>
            <div className="text-[0.6rem] text-white/30 uppercase">Lot Size</div>
            <div className="text-white/60">{lotAcres.toFixed(2)} acres</div>
          </div>
        )}
        {zoning && (
          <div>
            <div className="text-[0.6rem] text-white/30 uppercase">Zoning</div>
            <div className="text-white/60">{zoning}</div>
            {zoningDescription && (
              <div className="text-[0.6rem] text-white/30">{zoningDescription}</div>
            )}
          </div>
        )}
      </div>

      {/* APN */}
      {apn && <div className="text-xs text-white/30">APN: {apn}</div>}

      {/* Portfolio parcels */}
      {portfolioParcels.length > 0 && (
        <div>
          <div className="text-[0.65rem] font-medium text-white/40 uppercase mb-2">
            Owner&apos;s Other Properties ({portfolioSize} total)
          </div>
          <div className="space-y-1">
            {portfolioParcels.map((pp, i) => (
              <div
                key={i}
                className="flex justify-between text-xs text-white/50"
              >
                <span>
                  {pp.address}
                  {pp.city ? `, ${pp.city}` : ""}
                </span>
                {pp.parval != null && (
                  <span className="text-white/30">
                    ${pp.parval.toLocaleString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
