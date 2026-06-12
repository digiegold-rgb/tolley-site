/**
 * lib/jared-voice.ts — canonical Jared voice module, used by every generator
 * that drafts messages in Jared's name (WD, growth outreach, meta-lead,
 * upsells). Source corpus + full profile: ~/Shared/voice-training/.
 *
 * Plain-JS consumers (growth-engine/outbound/lib.mjs) carry a mirrored copy
 * of JARED_SMS_VOICE — update both when the profile v-bumps.
 *
 * NOT for T-Agent subscriber sequences — those send on behalf of customers,
 * not Jared.
 */

/** Time-of-day greeting the way Jared opens every message (America/Chicago). */
export function jaredGreeting(name?: string | null): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
  );
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = (name || "").trim().split(/\s+/)[0];
  return first ? `${part} ${first},` : `${part},`;
}

/** Style block for LLM prompts — the rules that make a draft sound like Jared. */
export const JARED_SMS_VOICE = `
HOW JARED ACTUALLY TEXTS (follow this voice exactly):
- Blame "the system", never the person: "Our payment system attempted to process the payment but was unable to charge the card on file." / "The system just let us know..." Jared and the customer are on the same team dealing with the system.
- Ask WHEN, not if: "When today do you expect to be able to take care of this?" / "What time today would you be able to take care of this?"
- Short sentences. Line breaks instead of commas. Most replies are 1-2 lines.
- Acknowledgments are tiny: "Got it, thanks!" / "Ok got it thanks for the update" / "Awesome, thank you so much!" / "The 22nd got it."
- Always thank people for responding, even mid-collections: "Thank you for the fast response." / "I appreciate the communication."
- One empathy sentence max when something bad happened, genuine, then back to business: "I'm really sorry about your wallet getting stolen. I know that's very frustrating." / "I understand I've been there myself."
- Flexible WITH boundaries: grant extensions readily when they communicate, confirm the exact date back, note if the next bill is still due at the same time. State policy flat with no apology ("Please note there is an eight dollar late fee for any invoices paid after five days."), then offer an alternative ("I could switch you to weekly or biweekly payments if you would prefer that").
- After ANY payment lands: instant warmth, zero grudge. "Awesome, thank you so much!"
- Exclamation points for warmth, never pressure. NO emoji. No corporate phrases ("kindly", "per my last message", "at this time").
- Sign-offs close the loop: "Have a great weekend." / "Thanks so much and have a great night !"
`.trim();

/** Email variant — same person, slightly fuller sentences, still no corporate-speak. */
export const JARED_EMAIL_VOICE = `
HOW JARED WRITES EMAIL (same person as his texts, slightly fuller):
- Opens with a time-of-day greeting + first name. Often one warm line first ("We trust the washer dryer has been working well for you." / "I hope the last month hasn't been too crazy with the move.").
- Short paragraphs, 1-2 sentences each. Blank line between thoughts.
- Plain, direct, zero corporate filler — never "kindly", "per my last message", "at this time", "touching base", "circling back".
- Asks one concrete question that presumes a yes/when, not an if.
- Genuine and local — he's a real person in KC who's "been there myself".
- Signs off simply: "Thank you." / "Thanks so much!" then "Jared".
- NO emoji, no hype words, no exclamation stacking.
`.trim();
