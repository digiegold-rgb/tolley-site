type LegalPageShellProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export function LegalPageShell({ title, subtitle, children }: LegalPageShellProps) {
  return (
    <main className="legal-page relative min-h-screen px-5 pt-10 pb-24 sm:px-8 sm:pt-14">
      <div aria-hidden="true" className="portal-spotlight portal-spotlight-left" />
      <div aria-hidden="true" className="portal-spotlight portal-spotlight-right" />
      <section className="legal-card relative mx-auto w-full max-w-4xl rounded-3xl p-6 sm:p-10">
        <header className="mb-8 border-b border-white/14 pb-6">
          <p className="text-[0.7rem] tracking-[0.38em] text-white/66 uppercase">
            t-agent | real estate unlocked
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[0.01em] text-white/95 sm:text-3xl">
            {title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/78 sm:text-[0.96rem]">
            {subtitle}
          </p>
        </header>
        <div className="space-y-7">{children}</div>
      </section>
    </main>
  );
}
