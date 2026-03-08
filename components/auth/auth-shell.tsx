import Link from "next/link";

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  alternatePrompt: string;
  alternateLabel: string;
  alternateHref: string;
};

export function AuthShell({
  title,
  subtitle,
  children,
  alternatePrompt,
  alternateLabel,
  alternateHref,
}: AuthShellProps) {
  return (
    <main className="portal-shell ambient-noise relative flex min-h-screen w-full items-center justify-center overflow-hidden px-5 py-10 sm:px-8">
      <div aria-hidden="true" className="portal-spotlight portal-spotlight-left" />
      <div aria-hidden="true" className="portal-spotlight portal-spotlight-right" />

      <section className="relative z-20 w-full max-w-md">
        <div className="mb-4 text-center">
          <p className="mb-3 text-[0.72rem] font-medium tracking-[0.42em] text-white/68 uppercase">
            t-agent
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
