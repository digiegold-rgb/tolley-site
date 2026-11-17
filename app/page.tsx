import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { EventTracker } from "@/components/analytics/site-tracker";
import { LegacyAgentLinks } from "@/components/homepage/legacy-agent-links";
import { COMPANY, COMPANY_PRODUCTS, CREATOR_AUDIENCES } from "@/lib/company-profile";
import styles from "./tolley-home.module.css";

export const metadata: Metadata = {
  title: COMPANY.title, description: COMPANY.description,
  alternates: { canonical: "https://www.tolley.io/" },
  openGraph: { title: COMPANY.title, description: COMPANY.description, url: "https://www.tolley.io/", type: "website", images: [{ url: "/company-share.png", width: 1200, height: 630, alt: COMPANY.title }] },
  twitter: { card: "summary_large_image", title: COMPANY.title, description: COMPANY.description, images: ["/company-share.png"] },
};
export default function TolleyHome() {
  return <EventTracker site="home"><main className={styles.home}>
    <LegacyAgentLinks />
    <section id="main-content" className={styles.hero}>
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}><span className={styles.statusDot} /> INDEPENDENTLY BUILT. HUMAN AT HEART.</p>
        <h1><span className={styles.companyName}>Tolley.io</span>AI software &amp;<br /><em>consumer technology.</em></h1>
        <p className={styles.intro}>{COMPANY.introduction}</p>
        <div className={styles.actions}><a className={styles.primary} href="#products">Explore our products <span aria-hidden="true">↗</span></a><Link className={styles.textLink} href="/about">Meet the founder ↗</Link></div>
        <p className={styles.heroLocation}>INDEPENDENCE, MISSOURI <span> / </span> BUILT FOR WHAT’S NEXT</p>
      </div>
      <div className={styles.heroArt} aria-hidden="true">
        <div className={styles.artTop}><span>TOLLEY / TECHNOLOGY IN PRACTICE</span><span>01—03</span></div>
        <div className={styles.orbit}><div className={styles.orbitInner} /><div className={styles.monogram}>T<span>.</span></div><i /><b /></div>
        <div className={styles.artBottom}><span>SOFTWARE<br />HARDWARE<br />CREATIVITY</span><span className={styles.artArrow}>↗</span></div>
      </div>
    </section>
    <div className={styles.disciplines}><span>AI SOFTWARE</span><i>✳</i><span>CONSUMER ELECTRONICS</span><i>✳</i><span>CUSTOM COMPUTING</span><i>✳</i><span>CREATIVE TECHNOLOGY</span></div>
    <section id="products" className={styles.section} aria-labelledby="products-title">
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>01 / WHAT WE BUILD &amp; SELL</p><h2 id="products-title">Technology you can<br /><em>put to work.</em></h2></div><p>Software for professionals. Tools for creators. Electronics for everyday life.</p></div>
      <div className={styles.products}>{COMPANY_PRODUCTS.map((product, index) => <article key={product.kind} className={`${styles.product} ${styles[product.kind]}`}>
        <div className={styles.productTop}><span>{product.category}</span><span>0{index + 1}</span></div>
        <div className={styles.productArt} aria-hidden="true">{product.kind === "agent" ? <div className={styles.agentArt}><span>PROPERTY INTELLIGENCE</span><div /><div /><div /><b>RESEARCH → INSIGHT → ACTION</b></div> : product.kind === "studio" ? <div className={styles.filmArt}><i /><i /><i /><span>STORY → SCENE → FILM</span></div> : <div className={styles.deviceArt}><div /><i /><span>DISCOVER. REUSE. ENJOY.</span></div>}</div>
        <h3>{product.name}</h3><p className={styles.productHeadline}>{product.title}</p><p className={styles.productDescription}>{product.description}</p>
        <Link className={styles.productLink} href={product.href} data-track-event="product_click" data-track-label={product.kind}>{product.action} <span aria-hidden="true">↗</span></Link>
        {product.kind === "resale" && <a className={styles.whatnot} href={COMPANY.whatnot} target="_blank" rel="noopener noreferrer">Find us on Whatnot ↗</a>}
      </article>)}</div>
      <Link className={styles.hardwareBand} href="/pc"><span className={styles.hardwareIcon} aria-hidden="true">⌘</span><div><p className={styles.eyebrow}>TOLLEY PC / CUSTOM HARDWARE</p><h3>Your next machine. Built around you.</h3><p>Gaming PCs, creator workstations, and systems for local AI.</p></div><span className={styles.bandAction}>Explore custom builds ↗</span></Link>
    </section>
    <section className={styles.founderSection} aria-labelledby="founder-title"><div className={styles.founderGrid}>
      <div className={styles.portrait}><Image src="/homes/headshot.jpg" alt="Jared Tolley, Founder of Tolley.io" fill sizes="(max-width: 760px) 90vw, 420px" /><span>JARED TOLLEY / FOUNDER</span></div>
      <div className={styles.founderCopy}><p className={styles.eyebrow}>02 / THE PERSON BEHIND THE PRODUCTS</p><h2 id="founder-title">A builder’s mind.<br /><em>A creator’s perspective.</em></h2><p>From five years as an Apple Genius to Bitcoin mining hardware, AI software, and technology-rich homes, Jared Tolley brings hands-on experience to every side of the business.</p><p>Based in Independence, Missouri, he builds tools, shares what he learns, and connects people with technology they can actually use.</p><div className={styles.audiences}>{CREATOR_AUDIENCES.map(a => <a key={a.platform} href={a.url} target="_blank" rel="noopener noreferrer"><strong>~{a.count}</strong><span>{a.platform} {a.label} ↗</span></a>)}</div><p className={styles.audienceNote}>{COMPANY.audienceNote}</p><Link className={styles.textLink} href="/about">The full story ↗</Link></div>
    </div></section>
    <section className={styles.section} aria-labelledby="homes-title"><div className={styles.homesPanel}><div><p className={styles.eyebrow}>03 / WHERE TECHNOLOGY MEETS HOME</p><h2 id="homes-title">Extraordinary homes.<br /><em>An eye for what’s inside.</em></h2></div><div><p>Million-dollar homes. Advanced home technology. A real estate agent who understands the systems as well as the space.</p><p>Explore Jared’s real estate work through Your KC Homes, serving the Kansas City area.</p><Link className={styles.textLink} href="/homes">Explore homes &amp; real estate ↗</Link></div></div></section>
    <section className={styles.contactSection}><p className={styles.eyebrow}>LET’S MAKE SOMETHING USEFUL.</p><h2>Big ideas.<br /><em>A direct conversation.</em></h2><a className={styles.primary} href={`mailto:${COMPANY.email}`}>Get in touch <span aria-hidden="true">↗</span></a><div className={styles.localLinks}><span>Also around Kansas City</span><Link href="/cleanouts">Cleanouts</Link><Link href="/estate">Estate sales</Link><Link href="/rental">Rentals</Link><Link href="/start">All services ↗</Link></div></section>
  </main></EventTracker>;
}
