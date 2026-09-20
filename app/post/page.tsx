import type { Metadata } from "next";
import styles from "./post.module.css";

export const metadata: Metadata = {
  title: "Tolley Post — Start with a photo",
  description: "A separate workspace for turning product photos into editable marketplace drafts. Tolley Post is in development.",
  alternates: { canonical: "https://www.tolley.io/post" },
};

export default function PostDoorway() {
  // New, additive flag. Keep the link disabled until the independent app is live.
  const appAvailable = process.env.POST_APP_AVAILABLE === "true";
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a href="/post" className={styles.brand}>tolley<span>post</span></a>
        <span className={styles.preview}>In development</span>
      </header>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>A LITTLE LESS LISTING. A LOT MORE LIVING.</p>
          <h1>Your next listing<br />starts with<br /><em>a photo.</em></h1>
          <p className={styles.description}>Photograph your finds. Get an editable first draft. Make it yours, then choose the marketplaces you sell on.</p>
          {appAvailable ? (
            <div>
              <a className={styles.button} href="https://post.tolley.io/demo">Try the live demo ↗</a>
              <p className={styles.demoNote}>No login needed. Edit sample products and watch simulated marketplace delivery.</p>
            </div>
          ) : (
            <p className={styles.launchNote}>A new seller workspace is taking shape.<br />Public signup and subscriptions are not open yet.</p>
          )}
        </div>
        <div className={styles.workflow}>
          <div className={styles.workflowTop}><span>✦</span> YOUR FINDS, TAKING SHAPE</div>
          {[
            ["01", "Photograph your find", "A few clear angles. One item or a whole batch."],
            ["02", "Make the draft yours", "Review the title, description, condition, and suggested price."],
            ["03", "Choose its next stop", "Track each marketplace draft separately."],
          ].map(([number, title, description]) => (
            <article key={number}><span>{number}</span><div><h2>{title}</h2><p>{description}</p></div></article>
          ))}
          <p className={styles.reviewNote}>You review everything before delivery.</p>
        </div>
      </section>
      <section className={styles.platforms}>
        <p>BUILDING FOR THE PLACES YOU SELL</p>
        <div>{["Facebook Marketplace", "eBay", "Mercari", "Poshmark", "Depop"].map(name => <span key={name}>{name}</span>)}</div>
        <small>Each connection opens after customer onboarding and draft delivery pass testing.</small>
      </section>
      <footer className={styles.footer}><span>Made for the habit of selling.</span><a href="/">Back to Tolley ↗</a></footer>
    </main>
  );
}
