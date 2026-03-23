"use client";

import type { Owner } from "./types";

export default function DossierOwners({
  owners,
  entityType,
  entityName,
}: {
  owners: Owner[];
  entityType?: string | null;
  entityName?: string | null;
}) {
  if (owners.length === 0) {
    return (
      <p className="text-white/30 text-sm">
        No owner data found. Check source links below to search manually.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {owners.map((owner, i) => (
        <div key={i} className="rounded-lg bg-white/[0.03] p-3">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium text-white">
                {owner.name}
                <span className="ml-2 text-xs text-white/30 capitalize">
                  {owner.role}
                </span>
              </h4>
              {owner.age && <p className="text-xs text-white/40">Age: ~{owner.age}</p>}
              {owner.address && (
                <p className="text-xs text-white/40">Mailing: {owner.address}</p>
              )}
            </div>
            <span className="text-xs text-white/20">
              {Math.round(owner.confidence * 100)}% confidence
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            {owner.phone && (
              <a href={`tel:${owner.phone}`} className="text-blue-400 hover:underline">
                {owner.phone}
              </a>
            )}
            {owner.email && (
              <a
                href={`mailto:${owner.email}`}
                className="text-blue-400 hover:underline"
              >
                {owner.email}
              </a>
            )}
            {owner.facebook && (
              <a
                href={owner.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                Facebook
              </a>
            )}
            {owner.linkedin && (
              <a
                href={owner.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                LinkedIn
              </a>
            )}
          </div>
        </div>
      ))}
      {entityType && entityType !== "individual" && entityType !== "joint" && (
        <p className="text-xs text-white/40">
          Entity: <span className="text-white/60">{entityName || entityType}</span> (
          {entityType})
        </p>
      )}
    </div>
  );
}
