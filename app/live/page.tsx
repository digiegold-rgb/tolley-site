import type { Metadata } from "next";
import Link from "next/link";
import { livePublicData } from "@/lib/live/store";
import { campaignSource } from "@/lib/live/core";
import { isLive, SHOW_TIME, SHOW_TAGLINE, SHIPPING_COPY } from "@/lib/live/campaign";
import CampaignVisit from "./visit";
import Countdown from "./countdown";
import JoinHaul from "./signup";
import ImpactPublisher from "./impact-publisher";
import { AFFILIATE_DISCLOSURE } from "@/lib/live/impact-core";
import { cachedImpactLink } from "@/lib/live/impact";
import { WHATNOT_PROFILE } from "@/lib/live/core";
import AffiliateProfileLink from "./affiliate-profile-link";
import "./live.css";
import { discoveryMetadata } from "@/lib/discovery";
import { PublicOfferDetails } from "@/components/shared/public-offer-details";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  ...discoveryMetadata("live"),
  openGraph: { title: "Treasure Hauls · 8:31 Central", description: "Come for the show. Stay for the steals. See our next confirmed show on Whatnot.", url: "https://www.tolley.io/live", images: [{ url: "https://www.tolley.io/live/poster?format=cover", width: 1640, height: 624, alt: "Treasure Hauls — most evenings at 8:31 PM Central" }] },
  twitter: { card: "summary_large_image", title: "Treasure Hauls · 8:31 Central", images: ["https://www.tolley.io/live/poster?format=cover"] },
};
const time = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(d);
export default async function LivePage({ searchParams }: { searchParams: Promise<{ utm_source?: string; utm_campaign?: string }> }) {
  const params = await searchParams;
  const source = campaignSource(params.utm_source || "live_hub");
  const campaign = campaignSource(params.utm_campaign || null);
  const data = await livePublicData();
  const profileAffiliate = await cachedImpactLink(WHATNOT_PROFILE);
  const live = data.shows.find(s => isLive(s));
  const next = data.shows.find(s => s.startsAt > new Date());
  const watch = (id?: string) => `/go/show?${new URLSearchParams({ utm_source: source, utm_campaign: campaign, ...(id ? { show: id } : {}) })}`;
  return <main className="haul-live"><CampaignVisit source={source} campaign={campaign}/>
    <nav><Link href="/">TOLLEY<span> / TREASURE HAULS</span></Link><a href="#schedule">The next haul ↗</a></nav>
    <p className="haul-small" style={{padding:"12px 0"}}>{AFFILIATE_DISCLOSURE}</p>
    <section className="haul-hero">
      <div><p className="haul-eyebrow">MOST EVENINGS · 8:31 PM CENTRAL</p><h1>Come for<br/>the show.<br/><em>Stay for the steals.</em></h1><p className="haul-intro">Real finds. Unexpected deals. Jared, Ruthann, and a table full of surprises. Pull up a chair, join the conversation, and help pick what comes next.</p><div className="haul-actions"><a className="haul-button" rel="sponsored" href={watch(live?.id || next?.id)}>{live ? "We’re live — come hang ↗" : next ? "Bookmark the next show ↗" : "Follow Treasure Hauls ↗"}</a><a href="#join">Join the drop list ↓</a></div><p className="haul-small">@treasure_hauls · {SHOW_TIME} · Check confirmed dates below</p>{next && !live && <Countdown startsAt={next.startsAt.toISOString()}/>}</div>
      <div className="haul-poster" aria-label="Treasure Hauls: a different find every day"><span className="haul-stamp">TOLLEY PRESENTS</span><strong>TREASURE<br/>HAULS<span>8:31 CENTRAL.<br/>YOU’RE INVITED.</span></strong><div className="haul-ticket">GADGETS / HOME / GARAGE / SURPRISES</div></div>
    </section>
    <section id="schedule" className="haul-section"><p className="haul-eyebrow">SAVE YOUR SPOT</p><h2>The next haul</h2>{data.shows.length ? <div className="haul-cards">{data.shows.map(s => <a className="haul-card" key={s.id} rel="sponsored" href={watch(s.id)}><span>{isLive(s) ? "LIVE NOW · " : ""}{time(s.startsAt)}</span><h3>{s.title}</h3><p>{s.category}{s.id.startsWith("whatnot_") ? " · Scheduled on Whatnot" : ` · ${s.durationMin / 60} hour${s.durationMin === 60 ? "" : "s"}`}</p><b>Bookmark on Whatnot ↗</b></a>)}</div> : <div className="haul-empty"><h3>The next show is coming.</h3><p>We’re lining up the next finds. Follow Treasure Hauls on Whatnot for the next show time.</p><a rel="sponsored" href={watch()}>See the Whatnot schedule ↗</a></div>}</section>
    <section className="haul-section haul-bottom"><div><p className="haul-eyebrow">FIRST TIME HERE?</p><h2>Meet your next favorite evening.</h2><p>Jared and Ruthann bring the finds. You bring the questions, the guesses, and the good company. {SHOW_TAGLINE}</p>{profileAffiliate ? <AffiliateProfileLink href={profileAffiliate} source={source} campaign={campaign}/> : <a className="haul-button" href={watch()}>Explore Treasure Hauls on Whatnot ↗</a>}<p className="haul-small">We may earn a commission on qualifying purchases. No purchase is needed to come watch.</p></div><div><h3>Your haul, on its way.</h3><p>{SHIPPING_COPY}</p><p>Arrange pickup through your Whatnot order. Shipping charges and tax are shown at checkout.</p></div></section>
    {data.deals.length > 0 && <section className="haul-section"><p className="haul-eyebrow">YES, THAT HAPPENED</p><h2>Deals from the show.</h2><div className="haul-cards">{data.deals.map(d => <article className="haul-card" key={d.id}><span>{time(d.soldAt)}</span><h3>{d.item}</h3><strong className="haul-price">${(d.priceCents / 100).toFixed(2)}</strong><p>Actual past sale. Shipping and tax extra. Item sold; future prices vary.</p></article>)}</div></section>}
    <section className="haul-section"><p className="haul-eyebrow">MORE THAN THE AUCTION</p><h2>Every find has a story.</h2><div className="haul-cards">{[["The useful stuff", "Tested gadgets, home helpers, and garage finds. We show you what works and what needs a little love."],["The unexpected stuff", "Odd discoveries, funny moments, and the finds we can’t quite explain. Your guesses are welcome."],["The people", "Ask questions, share what you know, and help decide what we hunt for next."]].map(([title,text]) => <article className="haul-card" key={title}><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    {data.clips.length > 0 && <section className="haul-section"><p className="haul-eyebrow">MISSED THE SHOW?</p><h2>From the garage</h2><div className="haul-cards">{data.clips.map(c => <article className="haul-card" key={c.id}><video src={c.mediaUrl} controls playsInline preload="metadata"/><h3>{c.title}</h3><p>From a previous show. Items may already be sold.</p></article>)}</div></section>}
    <section id="join" className="haul-join"><div><p className="haul-eyebrow">KEEP IN TOUCH</p><h2>Get the next good find.</h2><p>Join the Treasure Haul drop list for fresh finds by email. Unsubscribe any time.</p></div><JoinHaul/></section>
    <section className="haul-section haul-bottom"><div><h2>Have a haul of your own?</h2><p>Let’s talk surplus inventory, sourcing, estate finds, or resale opportunities.</p><Link href="/estate">Explore estate & sourcing services ↗</Link></div><div><h3>Part of Tolley.</h3><p>Practical businesses, creative work, and people helping people.</p><Link href="/shop">Browse the shop ↗</Link><br/><Link href="/">Explore Tolley ↗</Link></div></section>
    <PublicOfferDetails name="live" />
    <footer>Treasure Hauls by Tolley · Kansas City area · <Link href="/privacy">Privacy</Link><ImpactPublisher/></footer>
  </main>;
}
