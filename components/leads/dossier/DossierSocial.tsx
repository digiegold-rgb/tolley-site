"use client";

import type { SocialProfile, WebMention } from "./types";

export default function DossierSocial({
  socialProfiles,
  webMentions,
}: {
  socialProfiles: SocialProfile[];
  webMentions: WebMention[];
}) {
  if (socialProfiles.length === 0 && webMentions.length === 0) {
    return (
      <p className="text-white/30 text-sm">
        No social profiles or web mentions found via automated search.
      </p>
    );
  }

  return (
    <>
      {socialProfiles.length > 0 && (
        <div className="mb-3">
          <h4 className="text-xs font-medium text-white/50 mb-2">Social Profiles</h4>
          <div className="flex flex-wrap gap-2">
            {socialProfiles.map((p, i) => (
              <a
                key={i}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-white/[0.05] border border-white/10 px-3 py-1.5 text-sm text-blue-400 hover:bg-white/10"
              >
                <span className="capitalize">{p.platform}</span>
                <span className="text-white/20 ml-1 text-xs">
                  ({Math.round(p.confidence * 100)}%)
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
      {webMentions.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-white/50 mb-2">Web Mentions</h4>
          <div className="space-y-2">
            {webMentions.map((m, i) => (
              <a
                key={i}
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg bg-white/[0.03] p-2 hover:bg-white/[0.06]"
              >
                <p className="text-sm text-blue-400">{m.title}</p>
                <p className="text-xs text-white/30 mt-0.5 line-clamp-2">
                  {m.snippet}
                </p>
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
