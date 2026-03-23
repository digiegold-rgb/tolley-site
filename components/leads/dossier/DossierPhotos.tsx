"use client";

import type { Listing, DossierResult } from "./types";

export default function DossierPhotos({
  listing,
  result,
}: {
  listing: Listing;
  result: DossierResult | null;
}) {
  const l = listing;
  const r = result;

  return (
    <div className="space-y-4">
      {/* MLS Photos */}
      {l.photoUrls.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-white/50 mb-2">
            MLS Photos ({l.photoUrls.length})
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {l.photoUrls.slice(0, 6).map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                <img
                  src={url}
                  alt={`Property photo ${i + 1}`}
                  className="rounded-lg w-full h-32 object-cover"
                />
              </a>
            ))}
          </div>
          {l.photoUrls.length > 6 && (
            <p className="text-xs text-white/30 mt-1">
              +{l.photoUrls.length - 6} more photos
            </p>
          )}
        </div>
      )}

      {/* Street View / Satellite */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {r?.streetViewUrl && (
          <div>
            <h4 className="text-xs font-medium text-white/50 mb-1">Street View</h4>
            <img
              src={r.streetViewUrl}
              alt="Street View"
              className="rounded-lg w-full h-48 object-cover"
            />
          </div>
        )}
        {r?.satelliteUrl && (
          <div>
            <h4 className="text-xs font-medium text-white/50 mb-1">Satellite</h4>
            <img
              src={r.satelliteUrl}
              alt="Satellite"
              className="rounded-lg w-full h-48 object-cover"
            />
          </div>
        )}
      </div>
    </div>
  );
}
