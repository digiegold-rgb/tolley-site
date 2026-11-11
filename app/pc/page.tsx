import Image from 'next/image';
import Link from 'next/link';
import { subsiteMetadata } from '@/lib/subsite-metadata';
import { PublicOfferDetails } from '@/components/shared/public-offer-details';
import { PcBuildInquiry } from '@/components/pc/build-inquiry';
import { PcBuildArt } from '@/components/pc/build-art';
import { PC_PHONE, PC_PRICING, PC_SMS, PC_TEL, PC_USES } from '@/lib/pc';
import './pc.css';

const baseMetadata = subsiteMetadata('pc');
export const metadata = {
  ...baseMetadata,
  openGraph: { ...baseMetadata.openGraph, images: [{ url: '/pc/share.png', width: 1200, height: 630, alt: 'Tolley PC — Your next PC. Built around you. Custom builds by Jared Tolley in Kansas City.' }] },
  twitter: { ...baseMetadata.twitter, card: 'summary_large_image' as const, images: ['/pc/share.png'] },
};

export default function PcPage() {
  return <main className="pc-page">
    <a className="pc-skip" href="#main-content">Skip to content</a>
    <header className="pc-header pc-wrap">
      <Link href="/pc" aria-label="Tolley PC home" className="pc-brand">TOLLEY<span>PC</span><i aria-hidden="true"/></Link>
      <nav aria-label="PC navigation"><a href="#builds">The builds</a><a href="#builder">The builder</a><a className="pc-nav-cta" href="#request">Start your build <span aria-hidden="true">↗</span></a></nav>
    </header>
    <section className="pc-hero pc-wrap" id="main-content">
      <div className="pc-hero-copy"><p className="pc-eyebrow"><span className="pc-dot"/> KANSAS CITY · CUSTOM PC BUILDING</p>
        <h1>Your next PC.<br/>Built around <em>you.</em></h1>
        <p className="pc-lede">The games you play. The work you create. The ideas you haven’t tried yet. Let’s build a machine that fits.</p>
        <div className="pc-actions"><a className="pc-button" href="#request">Plan my build <span aria-hidden="true">↗</span></a><a className="pc-text-link" href={PC_SMS}>Talk to Jared</a></div>
        <p className="pc-hero-note">I can source the parts. Or you bring them.<br/>Either way, I build it with care.</p>
      </div>
      <div className="pc-hero-art"><div className="pc-art-heading"><span>DESIGNED FOR YOUR EVERYDAY.</span><span>01 / CUSTOM</span></div><PcBuildArt/></div>
    </section>
    <div className="pc-proof"><div className="pc-wrap"><span><strong>5 years</strong> as an Apple Genius</span><span><strong>Hands-on</strong> custom hardware experience</span><span><strong>One builder.</strong> Direct communication.</span></div></div>
    <section className="pc-wrap pc-section" id="builds">
      <div className="pc-section-heading"><div><p className="pc-eyebrow">THE BUILD STARTS WITH YOU</p><h2>What do you want<br/>to make possible?</h2></div><p>You don’t have to speak in specs. Tell me what you need your computer to do, and we’ll work back to the right parts.</p></div>
      <div className="pc-build-types">{PC_USES.map((use, i) => <article key={use.id}><span className="pc-index">0{i + 1}<span aria-hidden="true">↗</span></span><h3>{use.name}</h3><p>{use.detail}</p></article>)}</div>
    </section>
    <section className="pc-paths" aria-labelledby="pc-paths-title"><div className="pc-wrap pc-section"><p className="pc-eyebrow">TWO WAYS TO GET THERE</p><h2 id="pc-paths-title">Your parts. My parts list.<br/>The same attention to detail.</h2>
      <div className="pc-path-grid"><article><span className="pc-path-number">A / FROM AN IDEA</span><h3>Let’s plan the whole machine.</h3><p>Bring your goals and a budget. I’ll help choose compatible components, source parts from Micro Center or online retailers, and assemble your custom PC.</p><ul><li>Parts selected around your workload</li><li>A clear quote before ordering</li><li>Assembly and setup scoped to your needs</li></ul><a href="#request">Help me plan it <span aria-hidden="true">↗</span></a></article>
        <article><span className="pc-path-number">B / FROM YOUR PARTS</span><h3>You’ve got the parts. I’ve got the tools.</h3><p>Already have a cart, a stack of boxes, or a collection of components? Send the list. I’ll review the build with you and quote the assembly work.</p><ul><li>Customer-supplied parts welcome</li><li>Compatibility and fit reviewed together</li><li>Careful assembly and clean cable routing</li></ul><a href="#request">Build with my parts <span aria-hidden="true">↗</span></a></article></div>
      <p className="pc-pricing-note">{PC_PRICING}</p>
    </div></section>
    <section className="pc-wrap pc-section pc-builder" id="builder">
      <div className="pc-portrait"><Image src="/homes/headshot.jpg" alt="Jared Tolley, your custom PC builder" fill sizes="(max-width: 720px) 85vw, 380px"/><span>JARED TOLLEY / YOUR BUILDER</span></div>
      <div><p className="pc-eyebrow">EXPERIENCE AT THE WORKBENCH</p><h2>Hey, I’m Jared.<br/>I love a good build.</h2><p className="pc-builder-intro">I spent five years as an Apple Genius, repairing Macs—including machines valued at $10,000 or more—and helping people get the most out of them.</p><p>I helped open new stores and train employees. Later, I started my own mining company and custom-built the machines that powered it. Planning a system, putting it together cleanly, and getting the details right is work I enjoy.</p><p>Now I’m bringing that experience to your next PC. I have the tools, the hands-on background, and the patience to build a machine around what matters to you.</p><a className="pc-text-link" href={PC_TEL}>Talk through an idea <span aria-hidden="true">↗</span></a></div>
    </section>
    <section className="pc-process pc-wrap pc-section"><div className="pc-section-heading"><div><p className="pc-eyebrow">FROM FIRST IDEA TO FIRST BOOT</p><h2>A straightforward process.</h2></div></div><ol>
      <li><span>01</span><div><h3>Tell me what you’re building for.</h3><p>Share your use, budget, parts list if you have one, and preferred timing. We’ll talk through the possibilities.</p></div></li>
      <li><span>02</span><div><h3>Agree on the parts and the plan.</h3><p>We confirm compatibility, sourcing, assembly, testing, setup, and price before work begins. Handoff and timing are arranged directly.</p></div></li>
      <li><span>03</span><div><h3>Bring your build to life.</h3><p>I assemble your machine and walk you through the agreed setup and checks. You work directly with the person building your PC.</p></div></li>
    </ol></section>
    <section className="pc-request" id="request"><div className="pc-wrap pc-request-grid"><div className="pc-request-copy"><p className="pc-eyebrow">LET’S PUT SOMETHING TOGETHER</p><h2>Big idea.<br/>Parts in a box.<br/><em>Start here.</em></h2><p>A rough idea is enough. Tell me what you have in mind and I’ll get back to you to work out the details.</p><div className="pc-contact"><span>PREFER A CONVERSATION?</span><a href={PC_TEL}>{PC_PHONE}</a><p>Call or <a href={PC_SMS}>text Jared</a>.</p></div><p className="pc-small">Based in Independence, Missouri.<br/>Serving the Kansas City metro by arrangement.<br/>Share your city to confirm coverage and handoff.</p></div><PcBuildInquiry/></div></section>
    <div className="pc-details"><PublicOfferDetails name="pc"/></div>
    <footer className="pc-footer pc-wrap"><Link href="/" className="pc-brand">TOLLEY<span>PC</span></Link><p>Personal builds. Purposeful machines.</p><Link href="/services">More from Tolley ↗</Link></footer>
    <div className="pc-mobile-cta"><a href={PC_SMS}>Text Jared</a><a href="#request">Start your build ↗</a></div>
  </main>;
}
