import Link from "next/link";

export function TolleyHeader() {
  return <>
    <a href="#tolley-content" className="tolley-skip">Skip to content</a>
    <header className="tolley-header">
      <Link href="/" className="tolley-wordmark" aria-label="Tolley.io home">Tolley.io<span aria-hidden="true">●</span></Link>
      <nav aria-label="Tolley navigation">
        <Link href="/#products">Products</Link>
        <Link href="/pc">Custom PCs</Link>
        <Link href="/shop">Shop</Link>
        <Link href="/about">About</Link>
      </nav>
    </header>
  </>;
}

export function TolleyFooter() {
  return <footer className="tolley-footer">
    <div><Link href="/" className="tolley-wordmark" aria-label="Tolley.io home">Tolley.io<span aria-hidden="true">●</span></Link><p>AI software. Consumer technology.</p></div>
    <nav aria-label="Tolley footer navigation">
      <Link href="/agent">T-Agent</Link><Link href="/animate">Jelly Studio</Link><Link href="/shop">Tech resale</Link><Link href="/start">All services</Link><Link href="/services/agent">For AI agents</Link><Link href="/about">About</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link>
    </nav>
    <small>© {new Date().getFullYear()} Tolley.io</small>
  </footer>;
}
