import type { Metadata } from "next";
import Link from "next/link";

import {
  CinemaLegalMeta,
  CinemaLegalShell,
} from "@/components/animate/legal/CinemaLegalShell";
import {
  CinemaLegalSection,
  LEGAL_BODY_STYLE,
  LEGAL_LINK_STYLE,
  LEGAL_STRONG_STYLE,
} from "@/components/animate/legal/CinemaLegalSection";
import type { LegalSectionContent } from "@/components/legal/legal-section";
import { JELLY_TOKENS } from "@/components/animate/tokens";
import {
  ANIMATE_ARBITRATION_OPT_OUT_DAYS,
  ANIMATE_LEGAL_ADDRESS,
  ANIMATE_LEGAL_BRAND,
  ANIMATE_LEGAL_EFFECTIVE_DATE,
  ANIMATE_LEGAL_EMAIL,
  ANIMATE_LEGAL_ENTITY,
  ANIMATE_LEGAL_ENTITY_SHORT,
  ANIMATE_LEGAL_LAST_UPDATED,
  ANIMATE_LIABILITY_CAP_FLOOR_USD,
  ANIMATE_LINKS,
  ANIMATE_NCII_REMOVAL_HOURS,
  ANIMATE_OPS_RATE_PER_MIN,
  ANIMATE_PROMO_CREDIT_EXPIRY_DAYS,
  ANIMATE_RENDER_RETENTION_DAYS,
  TOS_VERSION,
} from "@/lib/legal-animate";

export const metadata: Metadata = {
  title: "Terms of Service | Jelly Studio",
  description:
    "Terms of Service for Jelly Studio, the AI video studio operated by Your KC Homes LLC — beta status, credits and pricing, content ownership, voice cloning consent, prohibited uses, and dispute resolution.",
  alternates: { canonical: "https://www.tolley.io/animate/terms" },
};

const SECTIONS: LegalSectionContent[] = [
  {
    heading: "1. Who we are, and what you are agreeing to",
    paragraphs: [
      `${ANIMATE_LEGAL_BRAND} is operated by ${ANIMATE_LEGAL_ENTITY}, of ${ANIMATE_LEGAL_ADDRESS}. In these Terms, "we", "us", and "Tolley" mean that company, and "you" means the person using the Studio.`,
      "These Terms, together with the Privacy Policy and the Beta Addendum, are the entire agreement between us about the Studio. You accept them when you check the box at signup, and again each time you sign in or render a video. If you do not accept them, do not use the Studio.",
      `This is version ${TOS_VERSION} of these Terms. We record which version your account accepted, and when.`,
    ],
  },
  {
    heading: "2. Eligibility and your account",
    bullets: [
      "You must be at least 18 years old. The Studio is not offered to anyone under 18, and we do not knowingly create accounts for minors.",
      "The Studio is hosted in the United States and intended for United States users. If you use it from elsewhere, you do so on your own initiative and are responsible for your local law.",
      "Access during the beta is by invitation. Your invitation and your account are personal to you and are not transferable — do not share, sell, or lend your login.",
      "You are responsible for everything that happens under your account, including what anyone you give access to does with it. Keep your password to yourself and tell us promptly if you think it has been compromised.",
      "If you sign up on behalf of a company, you are telling us you have authority to bind that company, and these Terms bind it.",
    ],
  },
  {
    heading: "3. Support access to your account",
    paragraphs: [
      "So that we can actually help when something breaks, our operators can open a support session that renders the Studio as your account sees it — the same projects, jobs, and errors you see. We are telling you this plainly rather than burying it.",
      "Every such session is logged with the operator, the account, and the time. We use it only to diagnose problems, honor your requests, investigate abuse, or comply with law. We do not use it to browse your work for our own interest.",
    ],
  },
  {
    heading: "4. The Studio is a beta",
    paragraphs: [
      "The Studio is pre-release software. It is provided as-is and as-available, with no service level agreement, no uptime commitment, and no guarantee that any particular feature, model, price, or output quality will still exist tomorrow. Renders fail, models change, and features get added and removed.",
      "We may change, suspend, or discontinue any part of the Studio at any time. We will give reasonable notice of changes that materially affect paid credits, and Section 6 says what happens to your balance if we shut the service down.",
    ],
    children: (
      <p style={LEGAL_BODY_STYLE}>
        The{" "}
        <Link href={ANIMATE_LINKS.beta} className="jc-link" style={LEGAL_LINK_STYLE}>
          Beta Addendum
        </Link>{" "}
        explains this in plain English, with a worked pricing example. It is part of
        these Terms.
      </p>
    ),
  },
  {
    heading: "5. What a render costs",
    emphasis: true,
    paragraphs: [
      `Pricing is compute at cost, plus an operations fee of $${ANIMATE_OPS_RATE_PER_MIN.toFixed(2)} per finished minute of delivered video. "Compute at cost" means what our providers actually charge us for that job — GPU seconds, model calls, speech synthesis — passed through without markup. The operations fee is our only margin.`,
      "You see an estimate before a render starts and the actual all-in cost after it finishes, itemized. If the two differ, the itemized actual is what you are charged.",
      "Failed renders are never charged. If a job errors out, is cancelled by us, or does not deliver a usable file, no credits are deducted — and if any were, they are returned to your balance.",
    ],
  },
  {
    heading: "6. Credits, your card, and refunds",
    emphasis: true,
    bullets: [
      "The Studio runs on prepaid credits. You buy credits, renders draw them down, and you can see the ledger at any time.",
      "We store a card on file through Stripe using a setup intent. Adding a card does not charge it. Nothing is charged until you buy credits or until you have authorized us to top up your balance.",
      "Purchased credits do not expire. They stay on your account for as long as your account exists.",
      `Promotional credits — anything we gift you, grant for testing, or issue as goodwill — expire ${ANIMATE_PROMO_CREDIT_EXPIRY_DAYS} days after they are granted. Promotional credits are spent before purchased credits.`,
      "Prepaid credits are non-refundable, with one exception: if we shut down the Studio or terminate your account for reasons other than your breach of these Terms, we will refund the unused balance of your purchased credits. Promotional credits have no cash value and are never refunded.",
      "You may not resell, sublicense, or broker access to our compute, credits, or API. Using the Studio to operate a competing render service for third parties is a breach of these Terms.",
      "Prices are in US dollars and exclusive of any applicable taxes. You are responsible for taxes other than taxes on our income.",
      "If you dispute a charge, email us first. A chargeback filed without contacting us may result in suspension while we sort it out.",
    ],
  },
  {
    heading: "7. Your content, and what we may do with it",
    paragraphs: [
      'You keep ownership of what you put in and what comes out. "Inputs" means scripts, prompts, images, audio, voice reference recordings, and anything else you upload or type. "Outputs" means the videos, images, audio, and text the Studio produces for you. As between you and us, the Outputs are yours.',
      "To run the Studio at all, we need permission to handle your material — store it, send it to the model providers listed in the Privacy Policy, transcode it, and deliver it back to you.",
      "You grant us a perpetual, worldwide, non-exclusive, royalty-free, sublicensable license to use, host, store, reproduce, modify, adapt, and publicly display and perform your Inputs and Outputs for three purposes: to operate the Studio, to improve it, and to promote it — showcases, demo reels, sample galleries, social posts, and marketing material. Sublicensable means we can pass that permission to the vendors and platforms that host or distribute the material for us.",
    ],
    children: (
      <p style={LEGAL_BODY_STYLE}>
        <span style={LEGAL_STRONG_STYLE}>The promotional half is optional. </span>
        Your account has a showcase opt-out toggle. Turn it on and we will not use your
        Inputs or Outputs in new marketing, showcases, or demos from that point forward.
        Opting out does not reach backwards — material already published or already
        distributed to a platform may stay up — and it does not affect the operate-and-
        improve half of the license, which we need in order to run the service for you.
      </p>
    ),
  },
  {
    heading: "8. Your promises about what you upload",
    bullets: [
      "You have the rights to every Input you provide, including images, footage, music, and recordings, and providing them to us does not infringe anyone's copyright, trademark, publicity, or privacy rights.",
      "Nothing you upload is confidential information of a third party that you are not allowed to share with a processor.",
      "You will not upload anyone's personal information beyond what a project genuinely needs, and never anyone's sensitive information — health, financial account, biometric, or government identifier data.",
      "Outputs from generative models are not unique. Other users may receive similar or identical results from similar prompts, and we make no representation that an Output is original, non-infringing, or protectable by copyright. Under current US Copyright Office guidance, purely machine-generated material may not be copyrightable at all.",
    ],
  },
  {
    heading: "9. Voices, faces, and likeness",
    // Deep-linked from the voice-clone consent attestation in
    // components/vater/youtube-voice-clone-panel.tsx (/animate/terms#voice).
    id: "voice",
    emphasis: true,
    paragraphs: [
      "Voice cloning is the single easiest way to get yourself sued using this product, so read this section.",
      "Every time you create or use a cloned voice, you attest that either (a) it is your own voice, or (b) you have the documented, informed consent of the person whose voice it is, covering the specific use you are making of it. We may ask you to produce that consent. Keep it.",
    ],
    bullets: [
      "You may not clone or imitate the voice or likeness of any identifiable person — living or dead — without that consent, including public figures, celebrities, politicians, and voice actors.",
      "Do not use the Studio to create a voice that is designed to be mistaken for a specific known performer or public figure, or to circumvent a voice provider's own likeness rules.",
      "State law is not theoretical here. Tennessee's ELVIS Act, California's right-of-publicity and digital-replica statutes, and New York's post-mortem digital replica law all create liability for unauthorized voice and likeness clones. Those claims land on you, not on us.",
      "Do not use the Studio to create a synthetic likeness of a real person to endorse, say, or do something they did not endorse, say, or do.",
      "We remove cloned voices and generated likenesses on a credible report from the person depicted, and we may do so before we finish investigating.",
    ],
  },
  {
    heading: "10. Prohibited uses",
    emphasis: true,
    paragraphs: [
      "You may not use the Studio to produce, publish, or distribute any of the following. This list is not exhaustive; it is the list of things that will get your account terminated immediately.",
    ],
    bullets: [
      `Non-consensual intimate imagery, including synthetic or "deepfake" sexual imagery of a real person. We comply with the TAKE IT DOWN Act: on a valid report from an identifiable person depicted, we remove the material and any known copies within ${ANIMATE_NCII_REMOVAL_HOURS} hours. Report to ${ANIMATE_LEGAL_EMAIL}.`,
      "Any sexual content involving minors, or any content that sexualizes a person who appears to be a minor. We report child sexual abuse material to NCMEC and to law enforcement.",
      "Deepfakes or synthetic media depicting a real, identifiable person without their consent — including fabricated statements by public officials, fake news footage, and synthetic evidence.",
      "Fake reviews, fake testimonials, invented customer experiences, or endorsements by people or personas who do not exist, presented as real. The FTC's rule on consumer reviews and testimonials carries civil penalties per violation, and its Endorsement Guides require material connections and AI involvement to be disclosed.",
      "Election-related content that misrepresents a candidate, official, or voting process, where prohibited by federal or state law.",
      "Fraud, phishing, impersonation of a business or brand, or content designed to deceive someone into parting with money or credentials.",
      "Harassment, threats, incitement to violence, or content promoting self-harm; content that degrades a person on the basis of a protected characteristic.",
      "Medical, legal, or financial advice presented as coming from a licensed professional when it does not.",
      "Reselling or brokering our compute, credits, or model access; scraping, reverse-engineering, or attempting to extract model weights; probing our security or bypassing our safety filters and rate limits.",
      "Anything that violates the terms of a platform you publish to, or any applicable law.",
    ],
  },
  {
    heading: "11. Disclosing that content is AI-generated",
    paragraphs: [
      "You are the publisher of what you make here, and the duty to disclose AI generation is yours, not ours.",
      "Where a platform requires it, disclose. YouTube requires creators to flag realistic altered or synthetic content in the upload flow. Where the FTC requires it — advertising, endorsements, testimonials — disclose clearly and conspicuously, not in a hashtag at the end of a caption. Where a state statute requires a disclaimer on synthetic political or commercial content, apply it.",
      "We may add or preserve provenance metadata on Outputs. Removing or falsifying that metadata to conceal AI generation is a breach of these Terms.",
    ],
  },
  {
    heading: "12. Publishing to third-party platforms",
    paragraphs: [
      "The Studio can publish on your behalf to accounts you connect, including YouTube, and can post to social platforms you authorize. Those platforms have their own terms, and their rules govern what happens on them. We are not responsible for a platform suspending, demonetizing, or removing your content or account.",
      "You authorize us to act on your connected accounts only to carry out actions you request. You can disconnect an account at any time in the Studio.",
    ],
  },
  {
    heading: "13. YouTube API Services",
    children: (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={LEGAL_BODY_STYLE}>
          {ANIMATE_LEGAL_BRAND} uses YouTube API Services. By using the features of the
          Studio that connect to YouTube, you agree to be bound by the{" "}
          <a
            href={ANIMATE_LINKS.youtubeTerms}
            target="_blank"
            rel="noopener noreferrer"
            className="jc-link"
            style={LEGAL_LINK_STYLE}
          >
            YouTube Terms of Service
          </a>
          .
        </p>
        <p style={LEGAL_BODY_STYLE}>
          Google&apos;s Privacy Policy, which describes how Google handles information
          obtained through YouTube API Services, is available at{" "}
          <a
            href={ANIMATE_LINKS.googlePrivacy}
            target="_blank"
            rel="noopener noreferrer"
            className="jc-link"
            style={{ ...LEGAL_LINK_STYLE, wordBreak: "break-word" }}
          >
            {ANIMATE_LINKS.googlePrivacy}
          </a>
          .
        </p>
        <p style={LEGAL_BODY_STYLE}>
          You can revoke this application&apos;s access to your data through the Google
          security settings page at{" "}
          <a
            href={ANIMATE_LINKS.googleSecuritySettings}
            target="_blank"
            rel="noopener noreferrer"
            className="jc-link"
            style={{ ...LEGAL_LINK_STYLE, wordBreak: "break-word" }}
          >
            {ANIMATE_LINKS.googleSecuritySettings}
          </a>
          . You can also disconnect the channel inside the Studio, which deletes the
          stored tokens on our side.
        </p>
        <p style={LEGAL_BODY_STYLE}>
          What we access, what we store, and how long we keep it is described in our{" "}
          <Link
            href={ANIMATE_LINKS.privacy}
            className="jc-link"
            style={LEGAL_LINK_STYLE}
          >
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    ),
  },
  {
    heading: "14. Copyright complaints and repeat infringers",
    paragraphs: [
      `If you believe material in the Studio or published by us infringes your copyright, send a DMCA notice to ${ANIMATE_LEGAL_EMAIL}. Our designated agent for copyright notices is reachable at that address, care of ${ANIMATE_LEGAL_ENTITY_SHORT}, ${ANIMATE_LEGAL_ADDRESS}.`,
      "A valid notice must include: your physical or electronic signature; identification of the copyrighted work; identification of the material you say infringes and where to find it; your contact information; a statement that you have a good-faith belief the use is not authorized; and a statement, under penalty of perjury, that the information is accurate and you are authorized to act for the owner.",
      "You may send a counter-notice if your material was removed in error, and we will pass it along and may restore the material as the DMCA provides.",
      "We terminate the accounts of repeat infringers. Two or more substantiated infringement notices against an account, or a single flagrant case, is grounds for permanent termination without refund of promotional credits.",
    ],
  },
  {
    heading: "15. Feedback",
    paragraphs: [
      "If you send us ideas, bug reports, feature requests, or suggestions, we may use them freely and without obligation to you — no compensation, no attribution, no confidentiality. That is the trade for a beta you are helping shape. Do not send us anything you want to keep or license.",
    ],
  },
  {
    heading: "16. Storage of your finished videos",
    paragraphs: [
      `Finished renders are delivered from our content delivery network at unlisted URLs. Unlisted means the link is long and not indexed — it does not mean the file is private. Anyone who has the URL can open it. Treat a delivery link like a password, and download anything sensitive rather than relying on the link to stay quiet.`,
      `We keep delivered renders for ${ANIMATE_RENDER_RETENTION_DAYS} days unless you download or pin them. After that they are deleted, and we cannot get them back. The Studio is not your archive.`,
    ],
  },
  {
    heading: "17. Suspension and termination",
    bullets: [
      "You can stop using the Studio at any time and ask us to close your account by emailing support.",
      "We may suspend or terminate your access immediately if you breach these Terms, if we are required to by law, if your use threatens the security or stability of the service, or if we shut the Studio down.",
      "On termination, Sections 7 through 9 and 14 through 21 survive, along with any payment obligations you have already incurred.",
      "If we terminate you for breach, unused prepaid credits are forfeited. If we terminate you for any other reason — including shutting down — we refund the unused balance of purchased credits.",
    ],
  },
  {
    heading: "18. Disclaimers",
    paragraphs: [
      "THE STUDIO AND ALL OUTPUTS ARE PROVIDED \"AS IS\" AND \"AS AVAILABLE\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.",
      "We do not warrant that the Studio will be uninterrupted, secure, or error-free, that any render will succeed, that Outputs will be accurate, original, non-infringing, or suitable for your purpose, or that your files will not be lost. Generative models produce wrong, odd, and occasionally offensive results. Review every Output before you publish it.",
      "Some states do not allow the exclusion of implied warranties, so parts of this section may not apply to you.",
    ],
  },
  {
    heading: "19. Limitation of liability",
    emphasis: true,
    paragraphs: [
      "TO THE FULLEST EXTENT PERMITTED BY LAW, NEITHER PARTY IS LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, LOST REVENUE, LOST DATA, OR BUSINESS INTERRUPTION, ARISING OUT OF OR RELATING TO THE STUDIO, EVEN IF ADVISED OF THE POSSIBILITY.",
      `OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THE STUDIO IS LIMITED TO THE GREATER OF $${ANIMATE_LIABILITY_CAP_FLOOR_USD} OR THE TOTAL FEES YOU PAID US IN THE THREE MONTHS IMMEDIATELY BEFORE THE EVENT GIVING RISE TO THE CLAIM.`,
      "These limits apply regardless of the theory of liability, and they are a fundamental part of the bargain between us — the price reflects them. They do not limit liability that cannot be limited by law.",
    ],
  },
  {
    heading: "20. Indemnity",
    paragraphs: [
      "You will defend, indemnify, and hold us harmless from any claim, demand, loss, or expense (including reasonable attorneys' fees) arising from your Inputs, your Outputs, your use of the Studio, your publication of content, your breach of these Terms, or your violation of anyone's rights — including any claim that a voice or likeness you generated was used without consent.",
    ],
  },
  {
    heading: "21. Disputes: arbitration, and how to opt out",
    emphasis: true,
    paragraphs: [
      "Please email us first. Most problems are a billing line or a failed render, and we would rather fix it than argue about it. If we cannot resolve a dispute informally within 30 days of your written notice, this section governs.",
      "You and we agree that any dispute arising out of or relating to these Terms or the Studio will be resolved by binding individual arbitration administered by the American Arbitration Association under its Consumer Arbitration Rules, before a single arbitrator, in Jackson County, Missouri, or by telephone or video at your election. Judgment on the award may be entered in any court of competent jurisdiction.",
      "Disputes are resolved individually. There is no class, collective, consolidated, or representative arbitration, and the arbitrator may not award relief to anyone who is not a party. If this individual-basis requirement is held unenforceable as to a particular claim, that claim proceeds in court and the rest of this section still applies.",
      "Either of us may bring a qualifying claim in small claims court instead of arbitration, and either of us may seek injunctive relief in court to stop infringement or misuse of intellectual property.",
      `You can opt out of arbitration. Email ${ANIMATE_LEGAL_EMAIL} with the subject "Arbitration Opt-Out", your name, and the email on your account, within ${ANIMATE_ARBITRATION_OPT_OUT_DAYS} days of first accepting these Terms. Opting out costs you nothing and does not affect anything else in this agreement.`,
      "These Terms are governed by the laws of the State of Missouri, without regard to conflict-of-law rules. For any dispute not subject to arbitration, you and we consent to the exclusive jurisdiction and venue of the state and federal courts serving Jackson County, Missouri.",
    ],
  },
  {
    heading: "22. Everything else",
    bullets: [
      "If a provision of these Terms is unenforceable, the rest stays in force.",
      "Our not enforcing a provision is not a waiver of it.",
      "You may not assign these Terms without our consent. We may assign them to an affiliate or in connection with a sale of the business.",
      "Nothing here creates a partnership, employment, or agency relationship, and there are no third-party beneficiaries.",
      "Neither party is liable for delays caused by events beyond its reasonable control.",
      "We may update these Terms. Material changes will be posted here with a new version number and, where we have a working email for you, sent to it. Continuing to use the Studio after an update means you accept the revised Terms; if you do not accept them, stop using the Studio and ask us to close your account.",
    ],
  },
  {
    heading: "23. Contact",
    paragraphs: [
      `${ANIMATE_LEGAL_ENTITY}, ${ANIMATE_LEGAL_ADDRESS}. Email ${ANIMATE_LEGAL_EMAIL} — for support, billing questions, privacy requests, DMCA notices, arbitration opt-outs, and abuse reports. It is a small company; you will reach a person.`,
    ],
  },
  {
    heading: "24. SMS (optional account texts)",
    paragraphs: [
      "Jelly Studio (Your KC Homes LLC) may send recurring informational texts to a mobile number you provide if you opt in — when a film is ready, and about your studio account. Up to 8 messages per month. Message and data rates may apply.",
      "Consent is not required to request a seat or use the Studio. Reply STOP to cancel. Reply HELP for help, or contact jared@yourkchomes.com / 913-283-3826. You may also opt in by texting START or YES to 913-914-9429.",
      "Mobile numbers are not sold, rented, or shared for marketing. Full privacy terms are at https://www.tolley.io/animate/privacy. This SMS program is not Wash & Dry rental texting.",
    ],
  },
];

export default function AnimateTermsPage() {
  return (
    <CinemaLegalShell
      kicker="Jelly Studio — Terms"
      title="Terms of Service"
      subtitle="These Terms govern your use of Jelly Studio — the beta, the credits, what you own, what we may show off, and what you may not make here. Read Sections 5 through 10 even if you skim the rest."
    >
      <CinemaLegalMeta
        rows={[
          { label: "Service", value: ANIMATE_LEGAL_BRAND },
          { label: "Operator", value: ANIMATE_LEGAL_ENTITY },
          { label: "Effective", value: ANIMATE_LEGAL_EFFECTIVE_DATE },
          {
            label: "Last updated",
            value: `${ANIMATE_LEGAL_LAST_UPDATED} (version ${TOS_VERSION})`,
          },
          { label: "Address", value: ANIMATE_LEGAL_ADDRESS },
          {
            label: "Contact",
            value: (
              <a
                href={`mailto:${ANIMATE_LEGAL_EMAIL}`}
                className="jc-link"
                style={LEGAL_LINK_STYLE}
              >
                {ANIMATE_LEGAL_EMAIL}
              </a>
            ),
          },
        ]}
      />

      {SECTIONS.map((section) => (
        <CinemaLegalSection key={section.heading} {...section} />
      ))}

      <section
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px 20px",
          borderTop: `1px solid ${JELLY_TOKENS.dark.border}`,
          paddingTop: 22,
        }}
      >
        <Link href={ANIMATE_LINKS.privacy} className="jc-link" style={LEGAL_LINK_STYLE}>
          Privacy Policy
        </Link>
        <Link href={ANIMATE_LINKS.beta} className="jc-link" style={LEGAL_LINK_STYLE}>
          Beta Addendum
        </Link>
        <Link href="/animate" className="jc-link" style={LEGAL_LINK_STYLE}>
          Back to the Studio
        </Link>
      </section>
    </CinemaLegalShell>
  );
}
