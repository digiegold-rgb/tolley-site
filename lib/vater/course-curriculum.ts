/**
 * lib/vater/course-curriculum.ts
 *
 * The "Money, Mastered" financial-literacy course curriculum — the seed
 * source for Course/CourseLesson rows (POST /api/vater/course) and the
 * single place lesson titles/descriptions live in code. 25 lessons across
 * 5 modules following the baby-steps arc: foundations → debt → stability →
 * investing → wealth & life.
 *
 * Production policy constants for the segmented render pipeline live here
 * too so the API routes and lib/vater/course-pipeline.ts agree on them.
 */

export const COURSE_SLUG = "financial-literacy";
export const COURSE_TITLE = "Money, Mastered: The Complete Financial Literacy Course";

/** Chapters (= render segments) per lesson. Six ~4:10 segments ≈ 25 min. */
export const SEGMENTS_PER_LESSON = 6;
/** Monroe reads long-form at ~185 wpm; ~770 words ≈ 4:10 per chapter. */
export const CHAPTER_TARGET_WORDS = 770;
/** Acceptable band before the editor flags a chapter (±15%). */
export const CHAPTER_WORDS_TOLERANCE = 0.15;
/** Animate the opener longer than the body chapters (all-in ≈ $15-25/lesson). */
export const SEGMENT_ANIM_UNTIL_S = { first: 60, rest: 45 } as const;
/** Per-segment render target, minutes (drives targetDuration on the row). */
export const SEGMENT_TARGET_MINUTES = 4;

/**
 * The locked "Course — Financial Literacy" style row id. Set after Phase 0
 * seeding via env so the pipeline never guesses; startRunCreation loads the
 * style (characters, art style, anim knobs) from this row for every segment.
 */
export function getCourseStyleId(): string | null {
  return process.env.COURSE_FINLIT_STYLE_ID || null;
}

export interface CurriculumLesson {
  order: number;
  module: string;
  title: string;
  description: string;
}

export const CURRICULUM: CurriculumLesson[] = [
  // ── Module 1 — Foundations ──────────────────────────────────────────
  {
    order: 1,
    module: "Foundations",
    title: "Why No One Taught You This: How Money Actually Works",
    description:
      "What money is, why school skipped it, the vocabulary you'll hear everywhere (income, expenses, assets, liabilities, net worth), and how to read your own financial life like a scoreboard.",
  },
  {
    order: 2,
    module: "Foundations",
    title: "Your Financial Snapshot: Net Worth, Cash Flow, and Facing the Numbers",
    description:
      "How to pull every account, list every debt, and calculate net worth and monthly cash flow without shame. You can't fix what you won't look at.",
  },
  {
    order: 3,
    module: "Foundations",
    title: "Budgeting That Doesn't Feel Like Punishment",
    description:
      "Zero-based budgets, the 50/30/20 rule, and pay-yourself-first — pick the one that matches your personality, and build a budget you'll actually keep for 90 days.",
  },
  {
    order: 4,
    module: "Foundations",
    title: "Banking 101: Checking, Savings, and Why Your Bank Fees Are a Choice",
    description:
      "Checking vs. savings vs. high-yield savings, credit unions vs. big banks, overdraft traps, and how interest on savings actually gets calculated — APY explained in plain English.",
  },
  {
    order: 5,
    module: "Foundations",
    title: "The Starter Emergency Fund: Your First One Thousand Dollars",
    description:
      "Baby-step one: why a small cash buffer beats extra debt payments at the start, where to keep it, and fast ways to fund it in thirty to sixty days.",
  },
  // ── Module 2 — Debt ─────────────────────────────────────────────────
  {
    order: 6,
    module: "Debt",
    title: "How Debt Really Works: Interest, Minimum Payments, and the Trap",
    description:
      "APR vs. APY, compounding working against you, why minimum payments are designed to keep you in debt for decades, and amortization in plain English.",
  },
  {
    order: 7,
    module: "Debt",
    title: "Credit Cards Decoded: Grace Periods, Utilization, and the Rules of the Game",
    description:
      "How credit cards actually make money, how to use one without carrying a balance, and when to stop using them entirely while paying them off.",
  },
  {
    order: 8,
    module: "Debt",
    title: "Your Credit Score: What Moves It, What Doesn't, and What Actually Matters",
    description:
      "The five factors, checking your report free, disputing errors, and why score-chasing matters less than debt-freedom — but is still worth understanding.",
  },
  {
    order: 9,
    module: "Debt",
    title: "The Debt Payoff Plan: Snowball vs. Avalanche",
    description:
      "Baby-step two: list every debt, pick a method (momentum vs. math), negotiate rates, consolidate carefully, and the behaviors that make payoff stick.",
  },
  {
    order: 10,
    module: "Debt",
    title: "Student Loans: Federal vs. Private, Repayment Plans, and Getting Free",
    description:
      "Income-driven repayment, refinancing (when it helps and when it destroys your options), forgiveness realities, and how student debt fits into your payoff order.",
  },
  // ── Module 3 — Stability ────────────────────────────────────────────
  {
    order: 11,
    module: "Stability",
    title: "The Full Emergency Fund: Three to Six Months and Real Security",
    description:
      "Baby-step three: sizing it to your actual life, where to park it (high-yield savings vs. money market), and what counts as an emergency.",
  },
  {
    order: 12,
    module: "Stability",
    title: "Insurance Without the Sales Pitch: What You Need and What You Don't",
    description:
      "Health, auto, renters and home, term life vs. whole life (and why whole life is usually a bad deal), and disability — the coverage that protects your plan.",
  },
  {
    order: 13,
    module: "Stability",
    title: "Taxes Explained: Brackets, Withholding, Refunds, and Legal Ways to Pay Less",
    description:
      "How marginal brackets actually work (no, a raise can't cost you money), W-4s, standard vs. itemized deductions, and tax-advantaged accounts as a preview.",
  },
  {
    order: 14,
    module: "Stability",
    title: "Big Purchases: Cars, Rent, and Not Wrecking Your Plan",
    description:
      "Why cars are the middle-class wealth killer, buying used with cash vs. financing, honest rent-vs-buy math, and how to size any big purchase to your income.",
  },
  // ── Module 4 — Investing ────────────────────────────────────────────
  {
    order: 15,
    module: "Investing",
    title: "Investing Demystified: Stocks, Bonds, and Funds in Plain English",
    description:
      "What you actually own when you buy a stock or bond, what mutual funds and ETFs are, index funds vs. picking stocks, and why boring wins.",
  },
  {
    order: 16,
    module: "Investing",
    title: "Compound Growth: The Eighth Wonder and Why Time Beats Timing",
    description:
      "The math that builds wealth, real dollar examples across decades, the cost of waiting five years, and dollar-cost averaging.",
  },
  {
    order: 17,
    module: "Investing",
    title: "Retirement Accounts: 401(k)s, IRAs, and Roth vs. Traditional",
    description:
      "The tax-advantaged toolbox: employer match first (free money), contribution order, Roth vs. traditional decisions, and what to actually pick inside the account.",
  },
  {
    order: 18,
    module: "Investing",
    title: "Building Your Portfolio: Asset Allocation, Risk, and Rebalancing",
    description:
      "Stocks-vs-bonds mix by age and temperament, three-fund portfolios, target-date funds, expense ratios, and leaving it alone through crashes.",
  },
  {
    order: 19,
    module: "Investing",
    title: "Investing Beyond Retirement: Brokerage Accounts, Real Estate, and Side Assets",
    description:
      "Taxable accounts and when they come alongside retirement accounts, real estate as an investment (REITs vs. rentals), and a sober look at crypto and speculation.",
  },
  {
    order: 20,
    module: "Investing",
    title: "The Wealth-Building Order of Operations",
    description:
      "Baby-steps four through six unified: fifteen percent to retirement, kids' college if applicable, paying off the house early, and the exact priority order for every extra dollar.",
  },
  // ── Module 5 — Wealth & Life ────────────────────────────────────────
  {
    order: 21,
    module: "Wealth & Life",
    title: "Earning More: Raises, Job Hops, and Side Income",
    description:
      "The income side of the equation: negotiating pay, switching jobs strategically, turning skills into side income, and avoiding hustle-culture traps.",
  },
  {
    order: 22,
    module: "Wealth & Life",
    title: "Money and Relationships: Partners, Kids, and Family Pressure",
    description:
      "Combining finances (or not), money conversations before marriage, teaching kids about money, and boundaries with family who ask for help.",
  },
  {
    order: 23,
    module: "Wealth & Life",
    title: "Protecting Wealth: Scams, Lifestyle Creep, and Behavioral Traps",
    description:
      "The psychology that undoes progress — lifestyle inflation, FOMO investing, day-trading, MLMs, and the common scams aimed at people exactly like you.",
  },
  {
    order: 24,
    module: "Wealth & Life",
    title: "Retirement Math: How Much You Need and the Four Percent Rule",
    description:
      "Calculating your number, safe withdrawal rates, Social Security in plain terms, and what retiring with significant wealth actually looks like in dollars.",
  },
  {
    order: 25,
    module: "Wealth & Life",
    title: "Your Complete Financial Plan: Putting It All Together",
    description:
      "Baby-step seven and beyond: live and give like no one else. A full walk-through of the system front to back, your one-page plan, and the habits that keep you wealthy for life.",
  },
];
