import type { Metadata } from "next";
import Link from "next/link";
import { EventTracker } from "@/components/analytics/site-tracker";
import { LegacyAgentLinks } from "@/components/homepage/legacy-agent-links";
import styles from "./tolley-home.module.css";

export const metadata: Metadata = {
  title: "Tolley | Tools, Creative Work & Kansas City Services",
  description: "Explore T-Agent real estate tools, Jelly Studio video creation, and Tolley's rentals, real estate, estate sales and local services.",
  alternates: { canonical: "https://www.tolley.io/" },
  openGraph: { title: "Tolley | Find what you need", description: "Tools for your work. A studio for your stories. Help close to home.", url: "https://www.tolley.io/", type: "website" },
};

const services = [
  { name: "Washer & dryer rentals", text: "Explore equipment rental options and request availability in your ZIP.", href: "/wd" },
  { name: "Homes & real estate", text: "Find Kansas City homes and connect with Jared about your next move.", href: "/homes" },
  { name: "Estate sales", text: "Browse upcoming sales or get help planning a sale of your own.", href: "/estate" },
  { name: "Rentals for the day", text: "Trailers, generators, tables and more for your next project or gathering.", href: "/rental" },
  { name: "Moving & cleanouts", text: "Find moving help, hauling and estate cleanout services.", href: "/cleanouts" },
  { name: "Shop the finds", text: "Explore furniture, household finds and the latest treasure hauls.", href: "/shop" },
];

export default function TolleyHome() {
  return <EventTracker site="home"><main className={`tolley-home ${styles.home}`}>
    <LegacyAgentLinks />
    <section id="main-content" className={styles.hero}>
      <p className={styles.eyebrow}>Independent ideas. Useful things.</p>
      <h1>What can Tolley<br />help you <em>do?</em></h1>
      <p className={styles.intro}>Tools for your work. A studio for your stories.<br />And hands-on help around Kansas City.</p>
      <a className={styles.jump} href="#products">Find your starting point <span aria-hidden="true">↓</span></a>
      <div className={styles.heroMark} aria-hidden="true"><span>T</span><i /></div>
    </section>
    <section id="products" className={styles.section} aria-labelledby="products-title">
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Built by Tolley</p><h2 id="products-title">Two ways to make more possible.</h2></div><span className={styles.sectionNote}>Choose the product that fits your work.</span></div>
      <div className={styles.products}>
        <article className={`${styles.product} ${styles.agent}`}>
          <div className={styles.productTop}><span>FOR REAL ESTATE AGENTS</span><span aria-hidden="true">↗</span></div>
          <div className={styles.agentArt} aria-hidden="true"><div><span>PROPERTY</span><i /><i /><i /></div><div><span>RESEARCH</span><i /><i /></div><div><span>NEXT ACTION</span><i /></div></div>
          <h3>T-Agent</h3><p>Get a clearer picture<br />of your next opportunity.</p>
          <div className={styles.productDescription}>Explore lead research, property dossiers, scoring and follow-up tools in one real estate workspace.</div>
          <div className={styles.actions}><Link className={styles.primary} href="/agent" data-track-event="product_click" data-track-label="agent">Explore T-Agent ↗</Link><Link className={styles.secondary} href="/login?callbackUrl=%2Fleads%2Fdashboard">T-Agent sign in</Link></div>
        </article>
        <article className={`${styles.product} ${styles.studio}`}>
          <div className={styles.productTop}><span>FOR PEOPLE WITH A STORY</span><span>PUBLIC BETA</span></div>
          <div className={styles.filmArt} aria-hidden="true"><div /><div /><div /><span>YOUR STORY. YOUR FILM.</span></div>
          <h3>Jelly Studio</h3><p>Turn a story worth telling<br />into a film worth sharing.</p>
          <div className={styles.productDescription}>Create with your script, narration and generated scenes. Explore the demos and pay-per-video studio.</div>
          <div className={styles.actions}><Link className={styles.primary} href="/animate" data-track-event="product_click" data-track-label="animate">Explore Jelly Studio ↗</Link><Link className={styles.secondary} href="/login?callbackUrl=%2Fanimate">Jelly Studio sign in</Link></div>
        </article>
      </div>
    </section>
    <section id="services" className={styles.section} aria-labelledby="services-title">
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Around Kansas City</p><h2 id="services-title">Help with the everyday.<br />And the next big step.</h2></div><Link href="/start" className={styles.textLink}>All services ↗</Link></div>
      <div className={styles.services}>{services.map((service, i) => <Link className={styles.service} href={service.href} key={service.href} data-track-event="service_click" data-track-label={service.href}>
        <div><span className={styles.serviceNumber}>0{i + 1}</span><span aria-hidden="true">↗</span></div><h3>{service.name}</h3><p>{service.text}</p>
      </Link>)}</div>
    </section>
    <section className={styles.about} aria-labelledby="about-title"><p className={styles.eyebrow}>A name behind the work</p><h2 id="about-title">Hi, I’m Jared Tolley.</h2><p>I build tools and run services from the Kansas City area. Each offering has its own home here, so you can go straight to the details, see what’s available, and take the next step.</p><Link href="/about" className={styles.textLink}>Meet Jared ↗</Link></section>
  </main></EventTracker>;
}
