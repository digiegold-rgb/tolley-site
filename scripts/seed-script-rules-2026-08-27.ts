/**
 * scripts/seed-script-rules-2026-08-27.ts
 *
 * Seeds VATER SCRIPT RULES 2.0 — the 28-rule rewriting pack from Jared's
 * 2026-08-27 Trey brief ("paste verbatim into the studio script-rules pack").
 *
 * Bucket: scope=house, kind=script, codes S1..S28, numbering 1..28 preserved
 * EXACTLY as the doc numbers them — the brief and Trey both refer to rules by
 * number ("run flag 27 and 28", "his rule 4"), so renumbering them into the
 * 160s of the video rulebook would break the only shared vocabulary here.
 *
 * `body` is the doc's text verbatim. `gate`:
 *   planner — injected into the script-writer prompt (24 of them)
 *   hard    — the two dedup flags, which run BEFORE a full rewrite is paid for
 *   info    — S2 only: "deliver as a markdown file in the outputs folder" is
 *             Trey's Claude-desktop habit. The brief itself says "in studio, a
 *             review pane is enough", so it is kept verbatim for the record but
 *             NOT fed to a writer that has no outputs folder to write to.
 *
 * Idempotent: upsert by code. Re-running updates text in place and never
 * renumbers. Dry by default; pass --apply to write.
 *
 *   npx tsx scripts/seed-script-rules-2026-08-27.ts            # preview
 *   npx tsx scripts/seed-script-rules-2026-08-27.ts --apply
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const BY = "jared@yourkchomes.com";
const SOURCE = "Trey brief 2026-08-27 — VATER SCRIPT RULES 2.0";

type Seed = {
  n: number;
  section: number;
  sectionTitle: string;
  title: string;
  body: string;
  gate: "planner" | "hard" | "info";
};

const S = (
  n: number,
  section: number,
  sectionTitle: string,
  title: string,
  body: string,
  gate: Seed["gate"] = "planner",
): Seed => ({ n, section, sectionTitle, title, body, gate });

const LEN = "Length and Format";
const VOICE = "Voice, Characters, and Branding";
const NUM = "Numbers and Accuracy";
const PUNC = "Punctuation";
const CUT = "Content to Cut";
const ORIG = "Originality";
const FLAG = "Flagging";

const RULES: Seed[] = [
  S(1, 1, LEN, "Match the target length",
    "Match the target length. Use the original's word count by default, or a specific runtime target when given (see rule 4), within roughly 5%."),
  S(2, 1, LEN, "Deliver as a markdown file",
    "Deliver as a markdown file in the outputs folder.", "info"),
  S(3, 1, LEN, "No added disclaimers, headers, or formatting",
    "No added disclaimers, headers, or extra formatting. Plain script text, ready to read or record as-is."),
  S(4, 1, LEN, "Ask for target video length on every upload",
    "Ask for target video length on every new script upload. Convert to a word count using approximately 130 to 150 words per minute.\n\nQuick reference:\n4 minutes = ~520 to 600 words\n9 to 10 minutes = ~1,200 to 1,500 words\n12 minutes = ~1,560 to 1,800 words\n15 minutes = ~1,950 to 2,250 words\n18 minutes = ~2,340 to 2,700 words"),

  S(5, 2, VOICE, "Main character is always Jeff Whitfield",
    "Main character is always Jeff Whitfield. Written in male first person. Family surname is always Whitfield."),
  S(6, 2, VOICE, "Jeff's wife/partner defaults to Linda",
    "Jeff's wife/partner defaults to Linda."),
  S(7, 2, VOICE, "Extra male characters are David and Cooper",
    "Extra male characters (non-elderly) are David and Cooper."),
  S(8, 2, VOICE, "Extra women in their twenties are Julie and Lynette",
    "Extra female characters in their twenties (not Jeff's partner) are Julie and Lynette."),
  S(9, 2, VOICE, "Extra older male characters are Rob",
    "Extra older male characters are Rob."),
  S(10, 2, VOICE, "Extra older female characters are Pamela",
    "Extra older female characters are Pamela."),
  S(11, 2, VOICE, "Delete the original host's greeting",
    "Delete the original host's own greeting or intro entirely."),
  S(12, 2, VOICE, "Insert Jeff's standing greeting 75-150 words in",
    "Insert Jeff's standing greeting at a natural break, roughly 75 to 150 words in:\n\n\"My name is Jeff Whitfield, and welcome to My Money Mindset. I'm not a financial advisor and this isn't advice, but my goal here is to help you improve your mindset around money.\"\n\nChannel name is always My Money Mindset."),
  S(13, 2, VOICE, "Keep the same tone and voice",
    "Keep the same tone and voice. First person, conversational, plainspoken. No corporate jargon, no hype."),

  S(14, 3, NUM, "Change illustrative dollar figures",
    "Change illustrative and narrative dollar figures from the original, keeping them realistic and internally consistent."),
  S(15, 3, NUM, "Keep the headline number unchanged",
    "Keep the headline number unchanged unless told otherwise. This is the central figure the whole video is built around."),
  S(16, 3, NUM, "Never change regulatory, legal, or factual numbers",
    "Never change real regulatory, legal, or factual reference numbers. Tax rules, account limits, statutory ages, official rates, cited statistics, and named source data all stay exactly as given. Only figurative and illustrative numbers get changed."),
  S(17, 3, NUM, "Double-check the math",
    "Double-check the math. All totals, running balances, growth calculations, and sums must actually check out."),
  S(18, 3, NUM, "Spell out all numbers and times",
    "Spell out all numbers and all times.\n\"four thousand seventy five dollars\"\n\"seven a.m.\"\n\"twenty percent\"\n\"eighteen months\""),

  S(19, 4, PUNC, "No hyphens anywhere",
    "No hyphens anywhere. No em dashes for pauses, no hyphens inside compound words. Use commas and periods to carry pacing. Write compound words as separate words or restructure the phrase."),
  S(20, 4, PUNC, "Punctuate for read-aloud cadence",
    "Punctuate for natural read-aloud cadence, so an AI voice reads with human tempo and correct pauses."),

  S(21, 5, CUT, "Cut outside courses, communities, resources",
    "Cut any mention of an outside course, community, or resource entirely. Don't adapt it, remove it."),
  S(22, 5, CUT, "Cut advertising and sponsored content",
    "Cut any advertising or sponsored content entirely. Product placements, sponsor reads, demo walkthroughs, affiliate plugs."),

  S(23, 6, ORIG, "Original wording throughout",
    "Original wording throughout. No close paraphrasing of the source."),
  S(24, 6, ORIG, "Genuine rewrite, not a rephrase",
    "Genuine rewrite required, not a rephrasing or a trim of the original."),
  S(25, 6, ORIG, "Hit the David and Cooper originality benchmark",
    "Hit the originality benchmark set by the David and Cooper \"buying vs. renting\" script. Full sentence restructuring, new transitions, fresh examples."),
  S(26, 6, ORIG, "Structural rewrite checklist",
    "Structural rewrite checklist. Before finalizing, actively change:\nThe opening scene, setting, and specific details\nAny named side-by-side comparison structure (restructure it, don't just swap names)\nAny illustrative example or metaphor (swap for a different one that makes the same point)\nNumbered lists and step sequences (convert to prose or resequence)\nThe closing line and any coined punchlines (highest risk for verbatim carryover)\nThen self-check the draft for any three to eight word phrase that could drop into the original unchanged, and fully rewrite those sentences."),

  S(27, 7, FLAG, "Flag verbatim repeats",
    "Flag verbatim repeats. If a script has already been submitted in this conversation, say so before rewriting it.", "hard"),
  S(28, 7, FLAG, "Flag thematically similar scripts",
    "Flag thematically similar scripts. If a new script covers similar ground to one already done, even if it isn't identical, name the earlier script, note what overlaps, and let the user decide whether to proceed, request a more differentiated angle, or hold off.", "hard"),
];

async function main() {
  if (RULES.length !== 28) throw new Error(`expected 28 rules, got ${RULES.length}`);
  const nums = new Set(RULES.map((r) => r.n));
  if (nums.size !== 28) throw new Error("duplicate rule numbers");

  let created = 0;
  let updated = 0;
  for (const r of RULES) {
    const code = `S${r.n}`;
    const existing = await prisma.vaterRule.findUnique({ where: { code } });
    const data = {
      number: r.n,
      suffix: "",
      scope: "house",
      kind: "script",
      section: r.section,
      sectionTitle: r.sectionTitle,
      title: r.title,
      body: r.body,
      source: SOURCE,
      gate: r.gate,
      updatedBy: BY,
    };
    if (!APPLY) {
      console.log(`${existing ? "UPDATE" : "CREATE"} ${code.padEnd(4)} [${r.gate.padEnd(7)}] §${r.section} ${r.title}`);
      existing ? updated++ : created++;
      continue;
    }
    if (existing && existing.kind !== "script") {
      throw new Error(`${code} already exists as kind=${existing.kind} — refusing to convert a video rule`);
    }
    const after = await prisma.vaterRule.upsert({
      where: { code },
      create: { code, ...data },
      update: data,
    });
    await prisma.vaterRuleRevision.create({
      data: {
        code,
        before: existing ? JSON.parse(JSON.stringify(existing)) : undefined,
        after: JSON.parse(JSON.stringify(after)),
        by: BY,
        note: existing ? "script rules 2.0 re-seed" : "script rules 2.0 seed",
      },
    });
    existing ? updated++ : created++;
  }
  console.log(`\n${APPLY ? "APPLIED" : "DRY RUN"} — ${created} created, ${updated} updated, ${RULES.length} total`);
  if (!APPLY) console.log("re-run with --apply to write");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
