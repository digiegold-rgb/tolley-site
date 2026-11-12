import type { Metadata } from "next";
import { JOB } from "@/lib/job";
import { ApplicationForm } from "./application-form";
import "./job.css";

export const metadata: Metadata = {
  title: JOB.title,
  description: JOB.description,
  alternates: { canonical: "https://www.tolley.io/job" },
  openGraph: { title: JOB.title, description: JOB.description, url: "https://www.tolley.io/job", type: "website", images: [{ url: "/wd/wd-3.jpg", width: 960, height: 540, alt: "Washer and dryer set" }] },
  twitter: { card: "summary_large_image", title: JOB.title, description: JOB.description, images: ["/wd/wd-3.jpg"] },
};

export default function JobPage() {
  return <div className="job-page">
    <header className="job-header job-wrap"><a href="/wd" className="job-brand">TOLLEY<span>Wash &amp; Dry Rental</span></a><span className="job-local">Independence, MO</span></header>
    <main id="job-main" className="job-wrap">
      <section className="job-hero" aria-labelledby="job-title">
        <div className="job-intro">
          <p className="job-eyebrow"><span aria-hidden="true" /> Local help wanted</p>
          <h1 id="job-title">Part-Time Helper <span className="job-title-dash">— </span><span className="job-rate">$28/hr,</span><span className="job-title-benefits">Paid Daily,<br />Truck Provided</span></h1>
          <p className="job-lead">Hands-on work. Close to home.<br />Get paid at the end of every workday.</p>
          <a className="job-button job-hero-apply" href="#apply">Apply now <span aria-hidden="true">↗</span></a>
          <p className="job-small">Five quick answers. No résumé needed.</p>
        </div>
        <figure className="job-photo">
          {/* Existing public W/D photo, kept local and available without a third-party image request. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/wd/wd-3.jpg" alt="A washer and dryer set installed side by side" width={960} height={540} fetchPriority="high" />
          <figcaption><span>The work</span>Deliver. Hook up. Get paid.</figcaption>
          <div className="job-photo-stamp">We bring<br /><strong>the gear.</strong></div>
        </figure>
      </section>
      <aside className="job-nearby"><span className="job-nearby-icon" aria-hidden="true">↳</span><div><h2>Live near Three Trails Elementary?</h2><p>You must live <strong>within about 1 mile</strong> of the school in Independence, MO, and be <strong>available on short notice.</strong></p></div></aside>
      <div className="job-content">
        <div className="job-details">
          <section><p className="job-section-number">01 / THE WORK</p><h2>A useful extra set of hands.</h2><ul className="job-task-list">{JOB.duties.map(duty => <li key={duty}><span aria-hidden="true">↗</span>{duty}</li>)}</ul></section>
          <section><p className="job-section-number">02 / THE SETUP</p><h2>We provide everything.</h2><p>{JOB.equipment}</p><p className="job-no-repairs">No repairs. We handle those.</p></section>
          <section><p className="job-section-number">03 / HOURS &amp; PAY</p><h2>Start with about 10 hrs/week.</h2><p><strong>$28/hr, paid at the end of every workday.</strong> Average 2.5+ installs a week for your first month and your hours go up.</p><div className="job-pay-example"><span>EXAMPLE WEEK</span><p>10 hrs <span>× $28 =</span> <strong>$280</strong></p><small>Paid daily, as you work.</small></div></section>
          <section><p className="job-section-number">04 / WHAT YOU BRING</p><h2>Reliable. Ready to help.</h2><ul className="job-requirements">{JOB.requirements.map(item => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}</ul></section>
        </div>
        <section id="apply" className="job-apply" aria-labelledby="job-apply-title">
          <p className="job-section-number">LET’S GET TO WORK</p><h2 id="job-apply-title">Sound like you?<br />Apply right here.</h2><p className="job-apply-intro">Tell Jared a little about yourself. Your answers go straight into a text to him.</p><ApplicationForm />
        </section>
      </div>
    </main>
    <footer className="job-footer job-wrap"><a href="/wd">Wash &amp; Dry Rental · Your KC Homes LLC</a><span>Questions? <a href={`sms:${JOB.smsPhone}`}>Text Jared: {JOB.phone}</a></span></footer>
    <div className="job-mobile-bar"><span><strong>$28/hr</strong> · Paid daily</span><a href="#apply">Apply now <span aria-hidden="true">↗</span></a></div>
  </div>;
}
