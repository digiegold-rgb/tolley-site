import type { Metadata } from "next";
import Link from "next/link";
import { livePublicData } from "@/lib/live/store";
import { campaignSource } from "@/lib/live/core";
import JoinHaul from "./signup";
import "./live.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Treasure Hauls Live | Tolley", description: "Unexpected finds, good company, and a different haul every day. Watch Treasure Hauls on Whatnot, catch the highlights, and find your next treasure.", alternates: { canonical: "/live" } };
const time = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(d);
export default async function LivePage({ searchParams }: { searchParams: Promise<{ utm_source?: string }> }) {
  const source = campaignSource((await searchParams).utm_source || "live_hub");
  const data = await livePublicData();
  const live = data.shows.find(s => s.confirmedUntil && s.confirmedUntil > new Date());
  return <main className="haul-live">
    <nav><Link href="/">TOLLEY<span> / TREASURE HAULS</span></Link><a href="#schedule">The next haul ↗</a></nav>
    <section className="haul-hero">
      <div><p className="haul-eyebrow">GOOD FINDS. BETTER COMPANY.</p><h1>You never know<br/>what’s in<br/><em>the next haul.</em></h1><p className="haul-intro">Garage finds, useful gadgets, and the occasional “what even is that?” Come for the treasures. Stay for the people.</p><div className="haul-actions"><a className="haul-button" href={live?.whatnotUrl || `/go/whatnot?utm_source=${source}`}>{live ? "Watch the show live ↗" : "Find us on Whatnot ↗"}</a><a href="#join">Join the drop list ↓</a></div><p className="haul-small">@treasure_hauls · Daily shows, 1–3 hours{data.dailyTime ? ` · ${data.dailyTime} Central` : ""}</p></div>
      <div className="haul-poster" aria-label="Treasure Hauls: a different find every day"><span className="haul-stamp">TOLLEY PRESENTS</span><strong>TREASURE<br/>HAULS<span>LIVE & A LITTLE<br/>UNPREDICTABLE.</span></strong><div className="haul-ticket">GADGETS / HOME / GARAGE / SURPRISES</div></div>
    </section>
    <section id="schedule" className="haul-section"><p className="haul-eyebrow">SAVE YOUR SPOT</p><h2>The next haul</h2>{data.shows.length ? <div className="haul-cards">{data.shows.map(s => <a className="haul-card" key={s.id} href={s.whatnotUrl}><span>{s.confirmedUntil && s.confirmedUntil > new Date() ? "LIVE NOW · " : ""}{time(s.startsAt)}</span><h3>{s.title}</h3><p>{s.category} · {s.durationMin / 60} hour{s.durationMin === 60 ? "" : "s"}</p><b>Bookmark on Whatnot ↗</b></a>)}</div> : <div className="haul-empty"><h3>A new haul every day.</h3><p>We’re lining up the next finds. Follow Treasure Hauls on Whatnot for the next show time.</p><a href={data.watchUrl}>See the Whatnot schedule ↗</a></div>}</section>
    <section className="haul-section"><p className="haul-eyebrow">MORE THAN THE AUCTION</p><h2>Every find has a story.</h2><div className="haul-cards">{[["The useful stuff", "Tested gadgets, home helpers, and garage finds. We show you what works and what needs a little love."],["The unexpected stuff", "Odd discoveries, funny moments, and the finds we can’t quite explain. Your guesses are welcome."],["The people", "Ask questions, share what you know, and help decide what we hunt for next."]].map(([title,text]) => <article className="haul-card" key={title}><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    {data.clips.length > 0 && <section className="haul-section"><p className="haul-eyebrow">MISSED THE SHOW?</p><h2>From the garage</h2><div className="haul-cards">{data.clips.map(c => <article className="haul-card" key={c.id}><video src={c.mediaUrl} controls playsInline preload="metadata"/><h3>{c.title}</h3><p>From a previous show. Items may already be sold.</p></article>)}</div></section>}
    <section id="join" className="haul-join"><div><p className="haul-eyebrow">KEEP IN TOUCH</p><h2>Get the next good find.</h2><p>Join the Treasure Haul drop list for fresh finds by email. Unsubscribe any time.</p></div><JoinHaul/></section>
    <section className="haul-section haul-bottom"><div><h2>Have a haul of your own?</h2><p>Let’s talk surplus inventory, sourcing, estate finds, or resale opportunities.</p><Link href="/estate">Explore estate & sourcing services ↗</Link></div><div><h3>Part of Tolley.</h3><p>Practical businesses, creative work, and people helping people.</p><Link href="/shop">Browse the shop ↗</Link><br/><Link href="/">Explore Tolley ↗</Link></div></section>
    <footer>Treasure Hauls by Tolley · Kansas City area · <Link href="/privacy">Privacy</Link></footer>
  </main>;
}
