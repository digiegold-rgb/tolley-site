import Link from "next/link";

const NAV_LINKS = [
  { label: "Hub", href: "/vater" },
  { label: "Dropship", href: "/vater/dropship" },
  { label: "Merch", href: "/vater/merch" },
  { label: "GovBids", href: "/vater/govbids" },
  { label: "YouTube", href: "/vater/youtube" },
  { label: "Courses", href: "/vater/courses" },
] as const;

export function VaterFooter() {
  return (
    <footer className="sticky bottom-0 z-50 border-t border-sky-500/20 bg-[#061020]/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-5xl items-center justify-center gap-1 px-4 py-3 sm:gap-3">
        {NAV_LINKS.map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-sky-400/10 hover:text-sky-400"
          >
            {label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
