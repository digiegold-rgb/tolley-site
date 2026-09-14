"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { DirectoryEntry, DirectoryGroup } from "@/lib/directory";

type Group = { group: DirectoryGroup; entries: DirectoryEntry[] };
const featuredPaths = ["/homes", "/wd", "/shop", "/sales"];

export function StartDirectory({ groups }: { groups: Group[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const entries = useMemo(
    () => groups.flatMap((group) => group.entries),
    [groups],
  );
  const featured = featuredPaths
    .map((path) => entries.find((entry) => entry.url === path))
    .filter((entry): entry is DirectoryEntry => Boolean(entry));
  const visible = groups
    .map((group) => ({
      ...group,
      entries: group.entries.filter((entry) => {
        const text =
          `${entry.title} ${entry.tagline} ${entry.bullets.join(" ")} ${group.group}`.toLowerCase();
        return (
          (category === "All" || category === group.group) &&
          text.includes(query.trim().toLowerCase())
        );
      }),
    }))
    .filter((group) => group.entries.length);
  const count = visible.reduce((sum, group) => sum + group.entries.length, 0);

  return (
    <main className="start-directory">
      <div className="sd-shell">
        <nav className="sd-nav" aria-label="Page navigation">
          <Link href="/" className="sd-wordmark">
            tolley<span>.io</span>
          </Link>
          <span className="sd-location">Kansas City & beyond</span>
          <Link href="/sales" className="sd-nav-link">
            Build with us <span aria-hidden="true">↗</span>
          </Link>
        </nav>
        <header className="sd-hero">
          <p className="sd-eyebrow">
            <span /> The Tolley directory
          </p>
          <h1>
            What can we
            <br />
            help you <em>do?</em>
          </h1>
          <p className="sd-intro">
            Find a home. Rent what you need. Build something of your own. Your
            next step starts here.
          </p>
          <a href="#directory" className="sd-primary">
            Explore the directory <span aria-hidden="true">↓</span>
          </a>
          <div className="sd-hero-note">
            <span>Based in Independence, Missouri.</span>
            <span>Local services. Tools that go anywhere.</span>
          </div>
        </header>
        {featured.length > 0 && (
          <section className="sd-featured" aria-label="Quick links">
            {featured.map((entry, index) => (
              <Link key={entry.name} href={entry.url}>
                <span className="sd-index">0{index + 1}</span>
                <div>
                  <h2>{entry.title}</h2>
                  <p>{entry.tagline}</p>
                </div>
                <span className="sd-arrow" aria-hidden="true">
                  ↗
                </span>
              </Link>
            ))}
          </section>
        )}
        <section
          id="directory"
          className="sd-directory"
          aria-labelledby="directory-title"
        >
          <div className="sd-section-head">
            <div>
              <p className="sd-eyebrow">Find your fit</p>
              <h2 id="directory-title">The directory.</h2>
            </div>
            <p>Choose a category or search below.</p>
          </div>
          <div className="sd-search">
            <label htmlFor="service-search">Search services & tools</label>
            <input
              id="service-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try rentals, homes, video…"
            />
          </div>
          <div className="sd-filters" aria-label="Filter by category">
            {["All", ...groups.map((group) => group.group)].map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={category === name}
                onClick={() => setCategory(name)}
              >
                {name}
              </button>
            ))}
          </div>
          <p className="sd-result-count" role="status">
            {count} {count === 1 ? "service" : "services"}
            {query.trim() ? ` matching “${query.trim()}”` : " to explore"}
          </p>
          <div className="sd-grid">
            {visible.flatMap(({ group, entries: items }) =>
              items.map((entry) => (
                <Link key={entry.name} href={entry.url} className="sd-card">
                  <div className="sd-card-top">
                    <span className="sd-category">{group}</span>
                    <span aria-hidden="true">↗</span>
                  </div>
                  <h3>{entry.title}</h3>
                  <p>{entry.tagline}</p>
                  <ul>
                    {entry.bullets.slice(0, 2).map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                </Link>
              )),
            )}
          </div>
          {!count && (
            <div className="sd-empty">
              <h3>No matches yet.</h3>
              <p>Try a broader search or browse all services.</p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setCategory("All");
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </section>
        <section className="sd-build">
          <p className="sd-eyebrow">Have an idea of your own?</p>
          <h2>Let’s put it to work.</h2>
          <p>
            The Launchpad brings websites, payments, and practical support to
            your next business.
          </p>
          <Link href="/sales" className="sd-primary">
            Meet the Launchpad <span aria-hidden="true">↗</span>
          </Link>
        </section>
        <footer className="sd-footer">
          <Link href="/" className="sd-wordmark">
            tolley<span>.io</span>
          </Link>
          <p>Independence, MO · © {new Date().getFullYear()}</p>
          <div className="sd-footer-links">
            <Link href="/about">About</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
