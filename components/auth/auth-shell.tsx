import Link from "next/link";

import { CinemaRoot } from "@/components/animate/cinema/CinemaRoot";
import { MicroLabel } from "@/components/animate/cinema/MicroLabel";
import { jellyDisplay, jellySerif } from "@/components/animate/fonts";
import { JELLY_TOKENS } from "@/components/animate/tokens";
import "@/app/animate/animate.css";

type AuthShellProps = {
  title: string;
  subtitle: string;
  /** Small eyebrow above the title. Defaults to the T-Agent brand. */
  brand?: string;
  children: React.ReactNode;
  alternatePrompt: string;
  alternateLabel: string;
  alternateHref: string;
};

/* Jelly Studio auth screens (brand === "jelly studio") render on the cinema
 * stage — same tokens, backdrop, glass card and gradient pill as the studio
 * itself — so a beta user who clicks "Sign in" never leaves the film. The
 * T-Agent screens are unchanged. */
function JellyAuthShell({ title, subtitle, children, alternatePrompt, alternateLabel, alternateHref }: AuthShellProps) {
  const t = JELLY_TOKENS.dark;
  return (
    <div className={`${jellyDisplay.variable} ${jellySerif.variable}`} style={{ display: "contents" }}>
      <CinemaRoot className="jc-auth" beam density="sparse">
        <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
          <Link href="/animate" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28, color: t.text, textDecoration: "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/animate/brand/logo.svg" alt="Jelly Studio" width={38} height={38} style={{ filter: "drop-shadow(0 0 14px rgba(143,125,255,0.6))" }} />
            <span style={{ fontWeight: 700, letterSpacing: "0.12em", fontSize: 14 }}>JELLY STUDIO</span>
          </Link>
          <section style={{ width: "100%", maxWidth: 440 }}>
            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <MicroLabel tone="cyan" style={{ marginBottom: 12 }}>{/^sign in/i.test(title) ? "— BOX OFFICE · SIGN IN —" : /reset|password/i.test(title) ? "— BOX OFFICE · RESET —" : "— BOX OFFICE · NEW ACCOUNT —"}</MicroLabel>
              <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600, letterSpacing: "-0.02em", color: t.text }}>{title}</h1>
              <p style={{ margin: "10px 0 0", fontSize: 14.5, lineHeight: 1.6, color: t.textSecondary }}>{subtitle}</p>
            </div>
            <div
              style={{
                background: t.card,
                border: `1px solid ${t.borderStrong}`,
                borderRadius: JELLY_TOKENS.radius.xxl,
                padding: 26,
                backdropFilter: t.glassBlur,
                boxShadow: `${t.cardShadow}, ${t.halo}`,
              }}
            >
              {children}
            </div>
            <p style={{ marginTop: 18, textAlign: "center", fontSize: 13.5, color: t.textSecondary }}>
              {alternatePrompt}{" "}
              <Link href={alternateHref} className="jc-link" style={{ fontWeight: 600 }}>
                {alternateLabel}
              </Link>
            </p>
            <p style={{ marginTop: 26, textAlign: "center", fontSize: 11.5, color: t.textFaint }}>
              <Link href="/animate/terms" className="jc-link" style={{ color: t.textFaint }}>Terms</Link>
              {" · "}
              <Link href="/animate/privacy" className="jc-link" style={{ color: t.textFaint }}>Privacy</Link>
              {" · "}
              <Link href="/animate/beta" className="jc-link" style={{ color: t.textFaint }}>Beta</Link>
            </p>
          </section>
        </main>
      </CinemaRoot>
    </div>
  );
}

export function AuthShell(props: AuthShellProps) {
  const { title, subtitle, brand = "t-agent", children, alternatePrompt, alternateLabel, alternateHref } = props;
  if (brand === "jelly studio") return <JellyAuthShell {...props} />;
  return (
    <main className="portal-shell ambient-noise relative flex min-h-screen w-full items-center justify-center overflow-hidden px-5 py-10 sm:px-8">
      <div aria-hidden="true" className="hp-dot-grid pointer-events-none fixed inset-0 z-0" />
      <div aria-hidden="true" className="portal-spotlight portal-spotlight-left" />
      <div aria-hidden="true" className="portal-spotlight portal-spotlight-right" />

      <section className="relative z-20 w-full max-w-md">
        <div className="mb-4 text-center">
          <p className="mb-3 text-[0.72rem] font-medium tracking-[0.42em] text-white/68 uppercase">
            {brand}
          </p>
          <h1 className="text-xl font-semibold tracking-[0.02em] text-white/95 sm:text-2xl">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/75">{subtitle}</p>
        </div>

        <div className="rounded-3xl border border-white/20 bg-[linear-gradient(145deg,rgba(255,255,255,0.2),rgba(141,82,230,0.12)),rgba(10,8,18,0.7)] p-6 shadow-[0_20px_48px_rgba(3,2,10,0.66)] backdrop-blur-2xl">
          {children}
        </div>

        <p className="mt-4 text-center text-sm text-white/72">
          {alternatePrompt}{" "}
          <Link
            href={alternateHref}
            className="font-semibold text-violet-200 transition hover:text-white"
          >
            {alternateLabel}
          </Link>
        </p>
      </section>
    </main>
  );
}
