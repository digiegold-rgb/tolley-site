/**
 * Creator Models — channel-level DNA templates for the VATER pipeline.
 *
 * A creator model captures the principles, visual style, title formulas,
 * goal templates, and script structure of a specific YouTube channel so the
 * pipeline can generate new videos that are stylistically consistent with
 * that channel's proven format.
 *
 * When a user selects a creator model in the context form:
 *   - The recommended style preset is pre-selected
 *   - The goal picker shows channel-specific goal templates first
 *   - The script writer receives the model's `scriptGuidelines` as a system
 *     prompt prefix alongside the standard goal text
 *   - The recommended duration is pre-filled (user can still override)
 *
 * CRITICAL: Goal templates in creator models follow the same rule as
 * GOAL_TEMPLATES — they describe angle/tone ONLY, never duration or word
 * count (see feedback_goal_vs_duration_separation.md).
 */

import type { GoalTemplate } from "./goal-templates";
import type { StylePresetId } from "./style-presets";

export interface TitleFormula {
  /** Slug id */
  id: string;
  /** Human-readable name */
  name: string;
  /** Template pattern with [PLACEHOLDER] markers */
  pattern: string;
  /** Concrete examples from the channel */
  examples: string[];
}

export interface CreatorModel {
  /** Unique slug */
  id: string;
  /** Display name */
  name: string;
  /** Channel URL */
  channelUrl: string;
  /** One-line pitch */
  tagline: string;
  /** 2-3 sentence description of the channel's format */
  description: string;
  /** Channel subscriber count (approximate) */
  subscribers: string;
  /** Recommended SDXL style preset */
  recommendedStylePreset: StylePresetId;
  /** Recommended video duration in minutes */
  recommendedDuration: number;
  /** Content pillars — top-level topic categories */
  contentPillars: string[];
  /**
   * Extracted principles that make this channel consistent.
   * Fed to the script writer as a system prompt prefix so the LLM
   * produces content in the same voice and structure.
   */
  principles: string[];
  /** Proven title formulas extracted from the channel's top videos */
  titleFormulas: TitleFormula[];
  /** Channel-specific goal templates for the picker */
  goalTemplates: GoalTemplate[];
  /**
   * Script writing guidelines — injected into the DGX _generate_script
   * prompt as additional context when this model is active.
   */
  scriptGuidelines: string;
  /** Thumbnail design guidelines */
  thumbnailGuidelines: string;
  /** Description template for generated videos */
  descriptionTemplate: string;
  /** Hashtags to append to descriptions */
  hashtags: string[];
}

// ---------------------------------------------------------------------------
// Nick Invests (@nickinvestsUS) — 167K subs, 224 videos
// Whiteboard animation personal finance, near-daily uploads, 20-min format
// Research date: 2026-04-12
// ---------------------------------------------------------------------------

const NICK_INVESTS_GOALS: GoalTemplate[] = [
  {
    id: "ni_milestone_shift",
    title: "Milestone Shift",
    emoji: "📈",
    subtitle: "Why everything changes after a financial milestone",
    goalText:
      "Milestone-shift format. Walk the viewer through what genuinely changes — psychologically, financially, and practically — once they cross a specific money milestone. Open by naming the number so the viewer immediately self-selects. Cover the mindset shift, the new options that unlock, the traps that appear at that level, and the compounding effect that accelerates from there. Close with the next milestone on the horizon and why the gap shrinks each time.",
    preview:
      "Names the milestone number up front so viewers self-select. Walks through the mindset shift, new options, and new traps at that level. Closes with why the next milestone is closer than the last.",
    source: "template",
  },
  {
    id: "ni_unsexy_habits",
    title: "Unsexy Habits List",
    emoji: "📋",
    subtitle: "Boring things that quietly build serious wealth",
    goalText:
      "Numbered list of unsexy, boring, overlooked habits that build real wealth. Anti-hype positioning — frame each habit as something nobody brags about but the quietly wealthy all do. Each item should be one concrete action, not a vague principle. Use specific dollar amounts and percentages wherever possible. Alternate between savings habits, income habits, and mindset habits to keep variety across the list.",
    preview:
      "Rapid-fire numbered list of boring-but-effective wealth habits. Each item is a concrete action with specific numbers. Anti-hype tone — nobody brags about these, but the quietly wealthy all do them.",
    source: "template",
  },
  {
    id: "ni_trap_reveal",
    title: "Financial Trap Reveal",
    emoji: "🪤",
    subtitle: "Exposing a money trap nobody talks about",
    goalText:
      "Financial trap reveal format. Name the trap in the first sentence — car payments, lifestyle inflation, premium subscriptions, whatever it is. Show why it feels rational in the moment (acknowledge the viewer's perspective fairly). Then walk through the math of what it actually costs over 5, 10, 20 years with compound opportunity cost. End with the specific alternative that builds wealth instead.",
    preview:
      "Names the trap immediately and acknowledges why it feels rational. Shows the compound opportunity cost over 5-20 years with real math. Closes with the specific wealth-building alternative.",
    source: "template",
  },
  {
    id: "ni_every_level",
    title: "Every Level Progression",
    emoji: "🪜",
    subtitle: "POV walkthrough of every level of a financial metric",
    goalText:
      "POV progression format — walk through every level of a financial metric (income, net worth, debt, career) from lowest to highest. At each level, describe what daily life actually looks like — not just the number, but the stress level, the options available, the social dynamics, and the next barrier. Make each level feel vivid and specific so the viewer can locate themselves. Close with what it takes to jump from one level to the next.",
    preview:
      "Walks through every tier of a financial metric from bottom to top. Each level paints a vivid picture of daily life, stress, and options. Closes with the concrete leap required between levels.",
    source: "template",
  },
  {
    id: "ni_market_alarm",
    title: "Market Alarm",
    emoji: "🚨",
    subtitle: "Breaking down what just happened in the market",
    goalText:
      "Market alarm / current-events breakdown. Open with the headline event that just happened — housing crash, rate change, policy shift, whatever is timely. Explain what actually happened in plain language (no jargon). Walk through who wins, who loses, and what the average person should do right now. End with whether this is a buying opportunity or a warning sign, and the specific action to take this week.",
    preview:
      "Opens with the headline event in plain language. Breaks down winners, losers, and what the average person should do. Closes with a specific this-week action item.",
    source: "template",
  },
  {
    id: "ni_age_milestones",
    title: "Age-Based Milestones",
    emoji: "🎂",
    subtitle: "Money milestones you should hit by each decade",
    goalText:
      "Age-based milestone guide. Walk through the major financial checkpoints for a specific decade of life — what you should have saved, invested, earned, and accomplished by that age. Be specific with dollar amounts and percentages, not vague ('you should have some savings'). Acknowledge that most people are behind and frame it as a roadmap, not a judgment. End with the single most impactful move to make if you're behind at that age.",
    preview:
      "Lays out specific dollar-amount milestones for each decade of life. Acknowledges most people are behind without judgment. Closes with the #1 move to make if you're catching up.",
    source: "template",
  },
  {
    id: "ni_authority_wisdom",
    title: "Authority Wisdom",
    emoji: "🏛️",
    subtitle: "Timeless principles from a legendary investor",
    goalText:
      "Authority-anchored wisdom format. Frame the entire piece around timeless principles from a legendary investor or financial figure (Buffett, Munger, Bogle, etc). Open by naming the authority and why their perspective matters right now. Walk through their key rules or warnings with modern context and current examples. Show how these old principles apply to today's specific market conditions. End with the single rule the viewer should tattoo on their brain.",
    preview:
      "Anchors on a legendary investor's timeless principles. Updates each rule with modern context and current market examples. Closes with the one rule that matters most right now.",
    source: "template",
  },
  {
    id: "ni_shocking_stats",
    title: "Shocking Stats Compilation",
    emoji: "📊",
    subtitle: "Mind-blowing money statistics about the average person",
    goalText:
      "Shocking statistics compilation. Rapid-fire parade of surprising, specific financial statistics about the average person — savings rate, debt levels, spending habits, retirement readiness, credit scores, net worth by age. Each stat should land like a punch: cite the number, give one sentence of context, then move to the next. Alternate between alarming stats and surprisingly positive ones to keep the viewer off-balance. End with the single stat that should change how the viewer behaves tomorrow.",
    preview:
      "Rapid-fire parade of jaw-dropping financial statistics about the average person. Each stat lands with one sentence of context before moving on. Closes with the one stat that should change your behavior tomorrow.",
    source: "template",
  },
];

const NICK_INVESTS_TITLE_FORMULAS: TitleFormula[] = [
  {
    id: "everything_changes",
    name: "Everything Changes",
    pattern: "Why Everything Changes After [MILESTONE]",
    examples: [
      "Why Everything Changes EVEN MORE After $20,000",
      "Why Everything Changes After You Hit $250,000 Invested",
      "Why Everything Changes After Paying Off Your House",
      "Why Everything Changes After You Get 832 Credit Score",
      "Why Everything Changes After You Stop Trying to Look Rich",
    ],
  },
  {
    id: "numbered_unsexy",
    name: "Numbered Unsexy List",
    pattern: "[NUMBER] [ADJECTIVE] [THINGS] That [PROMISE]",
    examples: [
      "15 Low Effort Boring Tasks That Make More Than Your Job",
      "20 Unsexy Habits That Save Your First $100,000",
      "30 Unsexy Habits That Make Serious Money ($100,000+)",
      "50 Shocking Money Stats Of The Average Person",
      "7 Smart Things to Buy in Your 20s (If You Want Wealth Later)",
    ],
  },
  {
    id: "trap_nobody_talks",
    name: "The Trap Nobody Talks About",
    pattern: "The [SUBJECT] Trap Nobody Talks About",
    examples: [
      "The Car Payment Trap Nobody Talks About",
      "The One Financial Trap Every Generation Falls For",
      "The 'Pavement Princess' Trap (And Why You're Broke)",
    ],
  },
  {
    id: "pov_every_level",
    name: "POV Every Level",
    pattern: "POV: Your Life [WITH/AS] Every Level of [METRIC]",
    examples: [
      "POV: Your Life With Every Level of Debt (& What To Do)",
      "POV: Your Life As Every Level Of Career",
      "Your Life With Every Level of Paycheck",
      "Your Life As Every Level Of Net Worth",
    ],
  },
  {
    id: "authority_warns",
    name: "Authority Warns",
    pattern: "[AUTHORITY]: [URGENT STATEMENT]",
    examples: [
      "Warren Buffett WARNS: STOP Buying These Things Immediately",
      "Warren Buffett: Why EVERYTHING Changes After $20,000",
      "Warren Buffett: 5 Financial Secrets You Must Keep in Silence",
      "ACCOUNTANT EXPLAINS: Why Everything Changes After $20K",
    ],
  },
  {
    id: "age_milestones",
    name: "Age Milestones",
    pattern: "Major MONEY Milestones To Accomplish In Your [AGE]s",
    examples: [
      "Major MONEY Milestones To Accomplish In Your 30S",
      "Major MONEY Milestones To Accomplish in Your 40s!",
      "At What Age Do Most People Hit $100K, $500K, & $1M?",
    ],
  },
];

export const NICK_INVESTS: CreatorModel = {
  id: "nick_invests",
  name: "Nick Invests",
  channelUrl: "https://www.youtube.com/@nickinvestsUS",
  tagline: "A DOLA IS A DOLA",
  description:
    "Whiteboard-animation personal finance channel. No face on camera — entirely cartoon-driven with a recurring character avatar. Near-daily 20-minute uploads covering wealth milestones, financial traps, and money psychology with specific dollar amounts and compound math.",
  subscribers: "167K",
  recommendedStylePreset: "whiteboard_cartoon",
  recommendedDuration: 20,
  contentPillars: [
    "Wealth milestones ($10K → $1M progression)",
    "Financial traps and lifestyle inflation",
    "Money psychology and behavioral finance",
    "Age-based money goals and milestones",
    "Investment education (ETFs, compound interest)",
    "Current market events and housing",
    "Debt management and credit scores",
    "Shocking statistics about the average person",
  ],
  principles: [
    "Every video opens with a hook that names a specific dollar amount or financial milestone in the first 5 seconds — the viewer self-selects immediately.",
    "Use specific numbers, never vague language. Say '$47,000 in credit card debt' not 'a lot of debt'. Say '73% of Americans' not 'most people'.",
    "Anti-hype positioning: the best financial moves are boring, unsexy, and nobody brags about them. Lean into that framing — it builds trust.",
    "Compound math is the recurring proof engine. Show the 5-year, 10-year, and 20-year cost of every decision using real compound interest calculations.",
    "Acknowledge the viewer's current pain fairly before offering the solution. Never talk down. Frame everything as a roadmap, not a lecture.",
    "Every video follows the same arc: hook → 'here's what most people do wrong' → the math → 'here's the move' → next milestone tease.",
    "Warren Buffett and other legendary investors are used as authority anchors — their rules lend instant credibility to standard advice.",
    "Each beat in the video is illustrated with one character + one prop + one key number on screen. Keep visual scenes simple and scannable.",
    "Burned-in subtitle text at the bottom of every frame. The viewer should be able to follow with sound off.",
    "Thumbnail = exaggerated character expression + 2-5 word bold text + white background + money prop. Every single thumbnail follows this formula.",
    "End every video by teasing the next milestone or challenge — 'now that you've hit $20K, here's why $50K is closer than you think' — creating a natural binge loop.",
    "The recurring cartoon character makes every video immediately recognizable in a feed. Consistency of the avatar IS the brand.",
  ],
  titleFormulas: NICK_INVESTS_TITLE_FORMULAS,
  goalTemplates: NICK_INVESTS_GOALS,
  scriptGuidelines: `You are writing a script in the style of Nick Invests — a whiteboard-animation personal finance channel with 167K subscribers.

VOICE & TONE:
- Calm, educational, data-heavy — never hype or lifestyle-flex
- Second person throughout ("here's what happens when YOU hit $20K...")
- Empathetic to the viewer's financial struggle — no talking down
- Anti-hype: the best moves are boring, unsexy, and nobody brags about them
- Confident authority without arrogance

STRUCTURE (every script follows this arc):
1. HOOK (first 2 sentences): Name the specific dollar amount, milestone, or shocking stat. The viewer self-selects in the first 5 seconds.
2. THE PROBLEM: "Here's what most people do wrong at this stage..." — acknowledge the common mistake fairly.
3. THE MATH: Show compound calculations with specific numbers. 5-year, 10-year, 20-year projections. Never round vaguely.
4. THE MOVE: The concrete, actionable step. One verb-led instruction per beat.
5. THE NEXT LEVEL: Tease the next milestone. "Now that you've done X, here's why Y is closer than you think."

RULES:
- ALWAYS use specific dollar amounts and percentages, never "a lot" or "most people" without a number
- Reference Warren Buffett, Charlie Munger, or other legendary investors when relevant
- Each beat should be 2-3 sentences max — one idea per beat, then move on
- No filler sentences. Every sentence must either teach, prove, or motivate.
- Write for burned-in subtitles: keep sentences short enough to display on screen
- Alternate between alarming stats and empowering solutions to maintain tension`,
  thumbnailGuidelines:
    "White background. Cartoon character with exaggerated expression (shocked, pointing, angry, smug). 2-5 words in huge bold black block letters. Optional money props (stacks, piggy bank, arrows). Red for urgency, green for money/positive. No complex scenes — one character, one text block, one prop maximum.",
  descriptionTemplate: `[SEO-optimized summary paragraph, 50-80 words, keyword-rich]

Disclaimer: This video is for educational and entertainment purposes only. Not financial advice. Please consult a professional before making major financial decisions.`,
  hashtags: ["#savemoney", "#personalfinance", "#investing"],
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const CREATOR_MODELS: readonly CreatorModel[] = [
  NICK_INVESTS,
] as const;

export type CreatorModelId = (typeof CREATOR_MODELS)[number]["id"];

export function getCreatorModel(id: string): CreatorModel | undefined {
  return CREATOR_MODELS.find((m) => m.id === id);
}

export function isCreatorModelId(value: unknown): value is CreatorModelId {
  return (
    typeof value === "string" && CREATOR_MODELS.some((m) => m.id === value)
  );
}
