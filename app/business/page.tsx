import Image from "next/image";
import Link from "next/link";
import { subsiteMetadata } from "@/lib/subsite-metadata";
import { BUSINESS_EMAIL, BUSINESS_PRICING, BUSINESS_WORKFLOWS, businessJsonLd } from "@/lib/business";
import { serializeJsonLd } from "@/lib/json-ld";
import { PublicOfferDetails } from "@/components/shared/public-offer-details";
import { BusinessInquiry } from "@/components/business/project-inquiry";
import { WorkflowPreview } from "@/components/business/workflow-preview";
import styles from "./business.module.css";

const base = subsiteMetadata("business");
export const metadata = { ...base,
  openGraph: { ...base.openGraph, images: [{ url: "/business/opengraph-image", width: 1200, height: 630, alt: "Tolley Business — practical software for the work you do every day. Remote, worldwide." }] },
  twitter: { ...base.twitter, card: "summary_large_image" as const, images: ["/business/opengraph-image"] },
};

export default function BusinessPage() {
  return <main className={styles.page}>
    <a href="#main-content" className={styles.skip}>Skip to content</a>
    <header className={`${styles.header} ${styles.wrap}`}><Link href="/" className={styles.brand}>Tolley<span>/ business</span></Link><nav aria-label="Business navigation"><a href="#workflows">The work</a><a href="#approach">The process</a><a href="#project" className={styles.navCta}>Let’s talk</a></nav></header>
    <section id="main-content" className={`${styles.hero} ${styles.wrap}`}>
      <div><p className={styles.eyebrow}>CUSTOM SOFTWARE · REMOTE, WORLDWIDE</p><h1>Software for the work you keep doing <em>by hand.</em></h1>
        <p className={styles.lede}>I turn the repeated work behind your business into software that fits. Job paperwork, inventory, orders, billing—the pieces that need to work together.</p>
        <div className={styles.actions}><a href="#project" className={styles.button}>Show me the repetitive part</a><a href="#workflows" className={styles.textLink}>See what we could simplify</a></div>
        <div className={styles.heroSignature}><Image src="/homes/headshot.jpg" alt="" width={48} height={48}/><p><strong>Jared Tolley</strong><span>Your builder. Your direct point of contact.</span></p></div>
      </div><WorkflowPreview/>
    </section>
    <div className={styles.promise}><div className={styles.wrap}><span>One useful workflow to start</span><span>Scope &amp; price agreed together</span><span>Built with you, wherever you work</span></div></div>
    <section id="workflows" className={`${styles.section} ${styles.wrap}`}><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>START WITH THE WORK</p><h2>“We still do<br/>that by hand.”</h2></div><p>Show me where information gets copied, jobs get stuck, or the same task eats another evening. That’s a useful place to start.</p></div>
      <div className={styles.workflowList}>{BUSINESS_WORKFLOWS.map(w => <article key={w.id}><div><p className={styles.eyebrow}>{w.audience}</p><h3>{w.title}</h3></div><p>{w.before}</p><div><span className={styles.possibility}>WHAT WE COULD BUILD</span><p>{w.outcome}</p></div></article>)}</div>
      <p className={styles.openDoor}>Different business, familiar problem? <a href="#project">Tell me how your work happens.</a></p>
    </section>
    <section className={styles.builder}><div className={`${styles.wrap} ${styles.builderGrid}`}>
      <div className={styles.portrait}><Image src="/homes/headshot.jpg" alt="Jared Tolley, founder and software builder" fill sizes="(max-width: 760px) 90vw, 380px"/><span>JARED TOLLEY / TOLLEY.IO</span></div>
      <div><p className={styles.eyebrow}>BUILT FROM RUNNING THE BUSINESS</p><h2>I understand the work<br/>behind the screen.</h2><p>I’ve worked with deliveries, resale inventory, rental operations, customer messages, and billing. I also spent five years as an Apple Genius and built the computers for my own mining company.</p><p>That mix of hands-on operations, hardware, and software shapes how I build: understand the real process, connect the useful pieces, and make the result something people can use.</p><p>Based in Missouri. Working remotely with business owners worldwide.</p><Link className={styles.textLink} href="/about">More about Jared</Link></div>
    </div></section>
    <section id="approach" className={`${styles.section} ${styles.wrap}`}><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>A PRACTICAL WAY TO BUILD</p><h2>One problem.<br/>A working solution.</h2></div><p>A small, useful first project gives us something real to test. We expand when the work calls for it.</p></div>
      <ol className={styles.process}>
        <li><h3>Show me the process.</h3><p>Walk through a recent example: what comes in, who handles it, which tools you use, and where time gets lost.</p></li>
        <li><h3>Agree on the improvement.</h3><p>Define the first workflow, deliverables, price, timing, and a success measure—such as less retyping or faster invoice preparation.</p></li>
        <li><h3>Build, test, and hand over.</h3><p>Try the solution with your actual workflow. Review important outputs, test exceptions, and learn how to use the finished system.</p></li>
        <li><h3>Keep what works. Improve it.</h3><p>Use real feedback to choose the next step. Repeated needs can become reusable software; maintenance and further work are agreed separately.</p></li>
      </ol>
      <div className={styles.scope}><div><p className={styles.eyebrow}>CLEAR BEFORE WE START</p><h3>A quote for your actual project.</h3></div><p>{BUSINESS_PRICING}</p></div>
    </section>
    <section className={`${styles.work} ${styles.wrap}`} aria-labelledby="work-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>EXPLORE THE WORK</p><h2 id="work-title">Things I’m building<br/>and operating.</h2></div><p>Explore the public projects behind this approach. Each has its own purpose and stage of development.</p></div>
      <div className={styles.workGrid}>
        <Link href="/shop"><span>RESALE OPERATION</span><h3>Treasure Haul</h3><p>A real storefront for the inventory, condition, and fulfillment work that software needs to support.</p><b>Explore the shop</b></Link>
        <Link href="/post"><span>IN DEVELOPMENT · DEMO</span><h3>Tolley Post</h3><p>A photo-to-listing workspace in development. The public demo uses sample products and simulated marketplace delivery.</p><b>Explore the demo</b></Link>
        <Link href="/animate"><span>PUBLIC BETA</span><h3>Jelly Studio</h3><p>A creative workflow connecting scripts, generated scenes, narration, and finished video.</p><b>Explore the studio</b></Link>
      </div>
    </section>
    <section id="project" className={styles.project}><div className={`${styles.wrap} ${styles.projectGrid}`}><div className={styles.projectCopy}><p className={styles.eyebrow}>LET’S MAKE THE WORK EASIER</p><h2>Tell me what<br/>you keep<br/>{" "}<em>doing twice.</em></h2><p>You don’t need a software specification. A description of the task is enough to start a conversation.</p><p>Remote collaboration, worldwide. Share your country and time zone; we’ll work out how to review the project together.</p><a className={styles.email} href={`mailto:${BUSINESS_EMAIL}`}>{BUSINESS_EMAIL}</a><p className={styles.small}>Prefer email? Include the repeated task, your current tools, and what you want to improve.</p></div><BusinessInquiry/></div></section>
    <div className={styles.details}><PublicOfferDetails name="business"/></div>
    <footer className={`${styles.footer} ${styles.wrap}`}><Link href="/" className={styles.brand}>Tolley<span>/ business</span></Link><p>Practical software. Built around the work.</p><Link href="/services">Explore Tolley</Link></footer>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(businessJsonLd()) }}/>
  </main>;
}
