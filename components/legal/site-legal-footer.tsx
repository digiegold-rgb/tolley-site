import Link from "next/link";

export function SiteLegalFooter() {
  return (
    <footer className="site-legal-footer fixed inset-x-0 bottom-4 z-40 flex items-center justify-center px-4">
      <nav
        aria-label="Legal links"
        className="rounded-full border border-white/18 bg-black/35 px-4 py-2 backdrop-blur-xl"
      >
        <ul className="flex items-center gap-4 text-[0.7rem] tracking-[0.08em] text-white/72 uppercase">
          <li>
            <Link className="transition hover:text-white" href="/privacy">
              Privacy Policy
            </Link>
          </li>
          <li aria-hidden="true" className="text-white/45">
            |
          </li>
          <li>
            <Link className="transition hover:text-white" href="/terms">
              Terms & Conditions
            </Link>
          </li>
        </ul>
      </nav>
    </footer>
  );
}
