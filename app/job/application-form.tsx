"use client";

import { useState, type FormEvent } from "react";
import { JOB, jobApplicationText, jobSmsHref, type JobApplication } from "@/lib/job";

export function ApplicationForm() {
  const [message, setMessage] = useState("");
  const [smsHref, setSmsHref] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fields = Object.fromEntries(["name", "phone", "crossStreets", "availability", "why"].map(key => [key, String(form.get(key) || "").trim()])) as JobApplication;
    if (Object.values(fields).some(value => !value)) {
      setError("Please fill in all five answers.");
      return;
    }
    const digits = fields.phone.replace(/\D/g, "");
    if (!/^\d{10}$/.test(digits) && !/^1\d{10}$/.test(digits)) {
      setError("Please enter a 10-digit phone number, including the area code.");
      return;
    }
    setError("");
    setCopyStatus("");
    const text = jobApplicationText(fields);
    const appleDevice = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);
    const href = jobSmsHref(text, appleDevice);
    setMessage(text);
    setSmsHref(href);
    window.location.href = href;
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopyStatus(`Copied. Paste into a text to ${JOB.phone}, then tap Send.`);
    } catch {
      setCopyStatus("Select and copy the message below, then paste it into your text app.");
    }
  }

  return (
    <form className="job-form" onSubmit={submit} onChange={() => { setMessage(""); setCopyStatus(""); }}>
      <div className="job-form-pair">
        <label htmlFor="job-name">Name<input id="job-name" name="name" autoComplete="name" placeholder="Your name" required maxLength={80} /></label>
        <label htmlFor="job-phone">Phone<input id="job-phone" name="phone" type="tel" autoComplete="tel" placeholder="(816) 555-0123" required maxLength={24} /></label>
      </div>
      <label htmlFor="job-cross-streets">Nearest cross streets<input id="job-cross-streets" name="crossStreets" placeholder="The two streets closest to home" required maxLength={140} aria-describedby="job-location-hint" /></label>
      <p id="job-location-hint" className="job-hint">No full address needed. You must live within about 1 mile of Three Trails Elementary.</p>
      <label htmlFor="job-availability">Availability<textarea id="job-availability" name="availability" placeholder="Days, times, and how much notice you need" required maxLength={300} rows={2} /></label>
      <label htmlFor="job-why">One line on why you<input id="job-why" name="why" placeholder="What makes you a good fit?" required maxLength={200} /></label>
      {error && <p className="job-error" role="alert">{error}</p>}
      <button className="job-button" type="submit">Text my application <span aria-hidden="true">↗</span></button>
      <p className="job-hint job-send-note">Opens your text app with your answers. Tap Send there to apply. Your answers stay on this device until you send them.</p>
      {message && <div className="job-message">
        <p role="status"><strong>One more step: tap Send in your text app.</strong><br />This page cannot confirm whether your text was sent.</p>
        <p>Text app didn’t open? <a href={smsHref}>Open it again</a>, or copy your application and text it to <a href={`sms:${JOB.smsPhone}`}>{JOB.phone}</a>.</p>
        <label htmlFor="job-message">Your application<textarea id="job-message" readOnly value={message} rows={8} onFocus={event => event.currentTarget.select()} /></label>
        <button type="button" className="job-copy" onClick={copy}>Copy application</button>
        <p role="status">{copyStatus}</p>
      </div>}
      <noscript><p>To apply, text your name, phone, nearest cross streets, availability, and one line on why you to <a href={`sms:${JOB.smsPhone}`}>{JOB.phone}</a>.</p></noscript>
    </form>
  );
}
