/**
 * Static library of goal templates for the VATER YouTube pipeline.
 *
 * CRITICAL RULE (see memory/feedback_goal_vs_duration_separation.md):
 * Goal templates describe ONLY the angle/tone/format. They never specify
 * duration, word count, pacing, or length. The user picks length separately
 * via the Duration slider + word-count override on the context form.
 *
 * When a user picks a template the picker ONLY fills the goal textarea —
 * `targetDuration` and `targetWordCount` remain whatever the user set on the
 * sliders. That way the SAME template can produce a 30-second reel OR a
 * 10-minute deep-dive, based purely on the slider position.
 *
 * AI-suggested goals (generated per-video by _suggest_goals in vater.py)
 * share this exact shape — the Qwen prompt explicitly forbids mentioning
 * durations or word counts in any field. Any stray `duration` or
 * `wordCount` keys returned by the LLM are stripped defensively in the
 * picker component.
 */

export interface GoalTemplate {
  /** Slug — stable identifier, used by the picker for selection state. */
  id: string;
  /** Short display name — NEVER contains duration or length. */
  title: string;
  /** Single emoji shown on the card. */
  emoji: string;
  /** 1-line tagline — angle/tone only, no length references. */
  subtitle: string;
  /**
   * Full prompt sent verbatim to `_generate_script` on the DGX side.
   * 2-4 sentences describing the angle, tone, hook strategy, and close.
   * MUST NOT mention seconds, minutes, word count, or pacing.
   */
  goalText: string;
  /**
   * "What this creates" preview shown in the panel below the card grid.
   * 2-3 sentences describing the story shape so the user knows what they
   * are picking before they hit submit.
   */
  preview: string;
  /** For UI grouping — "template" = static library, "suggested" = AI. */
  source: "template" | "suggested";
}

export const GOAL_TEMPLATES: readonly GoalTemplate[] = [
  {
    id: "hook_reel",
    title: "Hook Reel",
    emoji: "⚡",
    subtitle: "Punchy, rapid-fire social hook energy",
    goalText:
      "Punchy hook-reel style for social media. Open with a question or shocking stat in the very first beat before the viewer can scroll. Cover the key points rapid-fire, one idea per sentence, no filler between them. End with a bold claim or direct call to action. Urgent, confident, zero preamble — every word earns its place.",
    preview:
      "Opens with an attention-grab hook in the first beat. Blasts through the key points one per sentence with no dead space. Lands on a bold claim or CTA that makes the viewer want to share.",
    source: "template",
  },
  {
    id: "urgent_wakeup",
    title: "Urgent Wake-Up",
    emoji: "⚠️",
    subtitle: "Alarming warning that turns panic into agency",
    goalText:
      "Urgent wake-up call tone. Start with the threat or shock so the viewer feels the stakes immediately. Walk through why it matters right now — what's changing, who's at risk, why today is different. End with 'don't panic, position yourself' energy, turning alarm into agency with a clear next step the viewer can take tonight.",
    preview:
      "Opens by naming the threat so the viewer leans in. Unpacks why it matters right now, not someday. Closes by converting the alarm into a concrete move the viewer can make tonight.",
    source: "template",
  },
  {
    id: "investor_pitch",
    title: "Investor Pitch",
    emoji: "💼",
    subtitle: "Confident opportunity framing for serious operators",
    goalText:
      "Investor pitch framing — assume the viewer is a sharp operator who needs the thesis fast. Lead with the market gap or mispricing. Establish credibility with specific numbers and name-brand references. Walk through the asymmetric payoff and what could go wrong. Close with the conviction line: why now, why this, why the downside is capped.",
    preview:
      "Opens with the market gap or mispricing in one tight sentence. Builds the thesis with specific numbers and credible references. Lands on a why-now conviction that feels like a trade, not a pitch.",
    source: "template",
  },
  {
    id: "beginner_explainer",
    title: "Beginner Explainer",
    emoji: "📚",
    subtitle: "Calm teaching for a curious newcomer",
    goalText:
      "Calm beginner explainer tone. Assume the viewer is smart but brand-new to the topic — no jargon without a definition, no insider shorthand. Start with the one-sentence answer, then back up and lay the foundation piece by piece. Use a concrete analogy the viewer already understands. End with a clear 'here's what you now know' recap that makes them feel smarter.",
    preview:
      "Opens with the one-sentence answer so the viewer knows where the journey lands. Builds up the concept with analogies and foundation. Closes with a recap that makes the viewer feel measurably smarter.",
    source: "template",
  },
  {
    id: "hot_take",
    title: "Hot Take",
    emoji: "🔥",
    subtitle: "Provocative opinion that picks a fight",
    goalText:
      "Hot-take commentary style. Pick a side and mean it. Open with the provocative claim up front — no hedging, no 'some people say'. Back it with two or three pointed arguments the other side can't easily dismiss. Name the opposing view fairly, then knock it down. End on a line people will screenshot.",
    preview:
      "Opens with the provocative claim — no hedging. Backs it with pointed arguments that preempt the obvious counter. Closes on a screenshot-worthy line that invites debate.",
    source: "template",
  },
  {
    id: "news_summary",
    title: "News-Style Summary",
    emoji: "📰",
    subtitle: "Crisp factual recap, reporter voice",
    goalText:
      "News-style factual summary. Reporter voice — neutral, crisp, nothing-but-the-facts cadence. Open with the who/what/when in the first sentence. Layer in the why and the context in order of importance, inverted-pyramid style. Close with the 'what to watch next' angle so the viewer knows why the story isn't over.",
    preview:
      "Opens with the who/what/when in the lead sentence. Layers context in descending importance like a wire report. Closes with a 'what to watch next' angle that keeps the viewer following the story.",
    source: "template",
  },
  {
    id: "deep_dive",
    title: "Deep Dive Explainer",
    emoji: "🎓",
    subtitle: "Thorough walkthrough for a curious viewer",
    goalText:
      "Thorough deep-dive explainer. Assume a curious viewer who wants the full picture, not the highlight reel. Cover origins, mechanisms, consequences, and second-order implications. Use concrete examples and specific numbers wherever possible — no vague 'many people' or 'it's been said'. End with a synthesis that ties the threads together into one clear through-line.",
    preview:
      "Walks through origins, mechanisms, and second-order implications in order. Uses concrete examples and specific numbers instead of vague generalities. Closes with a synthesis that ties every thread into one through-line.",
    source: "template",
  },
  {
    id: "contrarian_insight",
    title: "Contrarian Insight",
    emoji: "💡",
    subtitle: "'What they don't tell you' reveal",
    goalText:
      "Contrarian insight reveal. Frame it as 'here's what the mainstream take misses'. Start by fairly stating the consensus view so the viewer nods along. Then pivot to the overlooked angle with evidence the consensus can't easily wave off. End with the practical implication — what changes for the viewer once they see it this way.",
    preview:
      "Opens by stating the consensus fairly so the viewer nods. Pivots to the overlooked angle with evidence that's hard to dismiss. Closes with the practical implication of seeing it the new way.",
    source: "template",
  },
  {
    id: "story_narrative",
    title: "Story-Driven Narrative",
    emoji: "📖",
    subtitle: "Character-led arc with emotional stakes",
    goalText:
      "Story-driven narrative arc. Anchor the whole piece on a single character, moment, or scene — the viewer should be able to picture it. Build tension through specific sensory detail and stakes that matter to a real person. Use the classic setup-conflict-resolution shape. End on the emotional beat that makes the story stick, not a tidy summary.",
    preview:
      "Anchors on one character or moment the viewer can picture. Builds tension through sensory detail and real stakes. Closes on an emotional beat that lingers instead of a tidy recap.",
    source: "template",
  },
  {
    id: "how_to_steps",
    title: "Actionable How-To",
    emoji: "🎯",
    subtitle: "Numbered steps the viewer can do tonight",
    goalText:
      "Actionable how-to style. Open with the outcome — what the viewer will be able to do when the video ends. Lay out the steps in numbered order, each step a single verb-led instruction. Flag the one mistake beginners always make at each critical junction. End with a 'you're done — here's how you know it worked' checkpoint.",
    preview:
      "Opens with the outcome so the viewer knows what success looks like. Walks through numbered steps with one beginner pitfall flagged per critical step. Closes with a 'how you know it worked' checkpoint.",
    source: "template",
  },
  {
    id: "chat_breakdown",
    title: "Conversational Breakdown",
    emoji: "🗣️",
    subtitle: "Casual 'let me walk you through it' chat tone",
    goalText:
      "Conversational breakdown — imagine explaining this to a smart friend over coffee. Relaxed, unscripted rhythm with natural asides. Use second person throughout ('here's the thing, you see...'). Let a little personality leak through. Favor clarity over polish. End like a conversation trails off — not with a hard close but with an honest takeaway the friend would nod at.",
    preview:
      "Explains the topic like you're walking a smart friend through it over coffee. Uses second person and natural asides to keep it casual. Closes with an honest takeaway instead of a hard-sell outro.",
    source: "template",
  },
  {
    id: "devils_advocate",
    title: "Devil's Advocate",
    emoji: "🎭",
    subtitle: "Counter-argument built on the strongest opposing case",
    goalText:
      "Devil's advocate counter-argument. Take the opposite side of the source's thesis and defend it as if you truly believed it. Steel-man the opposing view first — the strongest, fairest version of it. Then lay out the cracks in the original argument one by one. End by inviting the viewer to decide for themselves, not by declaring a winner.",
    preview:
      "Steel-mans the opposing view in its strongest form before attacking. Walks through the cracks in the original argument one by one. Closes by handing the decision back to the viewer.",
    source: "template",
  },
] as const;

/** Look up a template by id. Returns undefined if not found. */
export function getTemplate(id: string): GoalTemplate | undefined {
  return GOAL_TEMPLATES.find((t) => t.id === id);
}

/**
 * Defensively normalize an AI-generated suggestion into a GoalTemplate.
 * The DGX `_suggest_goals` call occasionally leaks stray fields like
 * `duration` or `wordCount` despite the system prompt — strip them here so
 * nothing downstream can accidentally touch the user's length sliders.
 */
export function normalizeSuggestion(raw: unknown): GoalTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : null;
  const title = typeof r.title === "string" ? r.title : null;
  const goalText = typeof r.goalText === "string" ? r.goalText : null;
  if (!id || !title || !goalText) return null;
  return {
    id,
    title,
    emoji: typeof r.emoji === "string" ? r.emoji : "✨",
    subtitle: typeof r.subtitle === "string" ? r.subtitle : "",
    goalText,
    preview: typeof r.preview === "string" ? r.preview : "",
    source: "suggested",
  };
}
