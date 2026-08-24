import Link from "next/link";
import { notFound } from "next/navigation";

/**
 * Preview-only index for the try-five Animate ship PRs.
 * 404 everywhere except Vercel Preview. This branch is DO NOT MERGE.
 */
export const dynamic = "force-dynamic";

const SHIPS = [
  {
    pr: 69,
    title: "ElevenLabs key reminder",
    href: "/animate/demo",
    blurb:
      "Own-script intake reminds you that multilingual / ElevenLabs voices need your key in Voices.",
  },
  {
    pr: 70,
    title: "Posted to YouTube badge",
    href: "/animate",
    blurb:
      "Finished Library videos can show Posted to YouTube, including a manual mark after a Studio/VidIQ upload.",
  },
  {
    pr: 71,
    title: "Own-script path polish",
    href: "/animate/demo",
    blurb:
      "Starting from a script you already have is the obvious first click next to Jelly writing it.",
  },
  {
    pr: 72,
    title: "Library queue status",
    href: "/animate",
    blurb:
      "Library and Queue show queued → in progress → done so a render is not a black box.",
  },
  {
    pr: 73,
    title: "Library motion layer",
    href: "/animate",
    blurb:
      "Finished cuts can take an opening motion layer from Library without leaving the grid.",
  },
] as const;

export default function TryFivePreviewPage() {
  if (process.env.VERCEL_ENV !== "preview") {
    notFound();
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0A0A14",
        color: "#f4f0ff",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        padding: "32px 20px 48px",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <p
          style={{
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#b7a9d1",
            margin: "0 0 8px",
          }}
        >
          Preview only — DO NOT MERGE
        </p>
        <h1 style={{ fontSize: 28, lineHeight: 1.2, margin: "0 0 12px" }}>
          Try-five Animate ships
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: "#ddd0f4", margin: "0 0 24px" }}>
          Signed-out walkthrough first. Full studio needs the share/SSO link,
          then email/password at{" "}
          <Link href="/login?callbackUrl=/animate" style={{ color: "#c4b5fd" }}>
            /login?callbackUrl=/animate
          </Link>
          . There is no Google NextAuth login.
        </p>
        <p style={{ margin: "0 0 28px", display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Link href="/animate" style={{ color: "#c4b5fd" }}>
            /animate
          </Link>
          <Link href="/animate/demo" style={{ color: "#c4b5fd" }}>
            /animate/demo
          </Link>
        </p>
        <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
          {SHIPS.map((ship) => (
            <li
              key={ship.pr}
              style={{
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 12,
                padding: 16,
                background: "#120f1c",
              }}
            >
              <div style={{ fontSize: 12, color: "#b7a9d1", marginBottom: 4 }}>
                #{ship.pr}
              </div>
              <Link
                href={ship.href}
                style={{ color: "#f8f3ff", fontWeight: 600, fontSize: 16 }}
              >
                {ship.title}
              </Link>
              <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.55, color: "#ddd0f4" }}>
                {ship.blurb}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
