import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Credit Command Center | Tolley",
  robots: "noindex, nofollow",
};

export default function CreditLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="credit-page portal-shell ambient-noise relative min-h-screen overflow-hidden px-5 py-8 sm:px-8">
      <div
        aria-hidden="true"
        className="portal-spotlight portal-spotlight-left"
      />
      <div
        aria-hidden="true"
        className="portal-spotlight portal-spotlight-right"
      />
      <section className="relative z-20 mx-auto w-full max-w-7xl">
        {children}
      </section>
    </main>
  );
}
