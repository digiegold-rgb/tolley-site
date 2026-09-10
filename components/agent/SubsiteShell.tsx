import { getSubsite } from "@/lib/subsites";
import { buildJsonLd } from "@/lib/json-ld";
import { JsonLd } from "./JsonLd";

/**
 * Drop-in agent contract for any public subsite.
 *
 *   // app/<name>/layout.tsx
 *   import { SubsiteShell } from "@/components/agent/SubsiteShell";
 *   export default function Layout({ children }: { children: React.ReactNode }) {
 *     return <><SubsiteShell name="<name>"/>{children}</>;
 *   }
 *
 * Mounts JSON-LD structured data (skipped if manifest.skipJsonLd).
 *
 * The agent-manifest <link rel="alternate"> and <meta name="agent-purpose">
 * tags are emitted via `subsiteMetadata(name)` — call from the layout's
 * `export const metadata`.
 */
export function SubsiteShell({ name }: { name: string }) {
  const manifest = getSubsite(name);
  if (!manifest) return null;
  const jsonLd = manifest.skipJsonLd ? null : buildJsonLd(manifest);
  return (
    <>
      {jsonLd && <JsonLd data={jsonLd} />}
    </>
  );
}
