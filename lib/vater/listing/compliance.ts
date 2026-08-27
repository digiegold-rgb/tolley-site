/**
 * lib/vater/listing/compliance.ts — Listing Studio compliance, in one place.
 *
 * ⚠️ ISOMORPHIC, ZERO IMPORTS. Runs live in the wizard (Step 3 chips), in
 * /preflight, /stage and /approve-still (server 422), and before publish.
 * Both sides import this file so the chip the agent sees and the 422 the
 * server returns can never disagree.
 *
 * Three concerns:
 *   1. Fair Housing linter — a verbatim port of growth-engine/lib/fh_lint.py
 *      (BLOCK_RULES / TESTIMONIAL_RULES / WARN_RULES). Same regexes, same
 *      severities, same rewrites. If you change a rule, change it there too.
 *   2. Prompt blocklist — Heartland MLS §11.2.1–11.2.2: no views/lakes/
 *      skylines that are not physically there, no removed power lines /
 *      highways / structures, no moved windows or changed layouts. Twilight
 *      skies are allowed in the social lane only and force the on-frame label.
 *   3. End card + frame label — the state advertising rules (MO 20 CSR
 *      2250-8.070, KS K.A.R. 86-3-7, PA 49 Pa. Code §35.305) generated from
 *      the agent profile, with hard blockers when the profile cannot satisfy
 *      the state. Equal Housing Opportunity is always on.
 *
 * The governing test this file can only partly automate:
 *     Describe the PROPERTY, not the PERSON who should live in it.
 */

// ---------------------------------------------------------------------------
// 1. Fair Housing linter (port of fh_lint.py)
// ---------------------------------------------------------------------------

export type LintSeverity = "BLOCK" | "WARN";

export interface LintViolation {
  severity: LintSeverity;
  /** Protected class / proxy, or "style" for WARN rules. */
  class: string;
  match: string;
  offset: number;
  why: string;
  /** WARN only — what applyRewrites would put in place of `match`. */
  rewrite?: string;
}

export interface LintResult {
  ok: boolean;
  violations: LintViolation[];
  blocks: number;
  warns: number;
}

type BlockRule = readonly [pattern: RegExp, protectedClass: string, why: string];
type WarnRule = readonly [pattern: RegExp, replacement: string, why: string];

/**
 * BLOCK rules -- protected classes under the Fair Housing Act, plus the
 * recognized steering proxies. Matched case-insensitively.
 */
export const BLOCK_RULES: readonly BlockRule[] = [
  // --- Familial status -------------------------------------------------
  [
    /\b(?:perfect|great|ideal|good|suited?)\s+(?:for|home for)\s+(?:a\s+)?(?:famil(?:y|ies)|kids?|children|couples?|singles?|bachelors?|retirees?)\b/gi,
    "familial status",
    "States who the property is for. Describe the space, not the occupant.",
  ],
  [/\b(?:family|families)[- ]friendly\b/gi, "familial status", "'Family-friendly' excludes non-family households."],
  [/\b(?:no|not?\s+suitable\s+for)\s+(?:kids?|children|pets)\b/gi, "familial status", "Explicit exclusion of children."],
  [
    /\b(?:empty[- ]nester|starter\s+family|growing\s+famil(?:y|ies))\b/gi,
    "familial status",
    "Targets a household composition.",
  ],
  [/\bbachelor\s+pad\b/gi, "familial status / sex", "Targets household composition and gender."],

  // --- Race, color, national origin ------------------------------------
  [
    /\b(?:ethnic|integrated|traditional)\s+(?:neighborhood|area|community|block)\b/gi,
    "race / national origin",
    "Racially coded description of an area.",
  ],
  [
    /\b(?:exclusive|private|restricted)\s+(?:community|neighborhood)\b/gi,
    "race / national origin",
    "'Exclusive/restricted' carries a covenant history. Say what the amenity is.",
  ],
  [/\bgood\s+(?:people|families|element)\b/gi, "race / national origin", "Describes residents, not property."],

  // --- Religion ---------------------------------------------------------
  [
    /\b(?:walking\s+distance|close|near|steps?|minutes?)\s+(?:to|from)\s+(?:the\s+)?(?:church|synagogue|mosque|temple|parish)\b/gi,
    "religion",
    "Proximity to a house of worship signals religious preference.",
  ],
  [
    /\b(?:christian|catholic|jewish|muslim|kosher)\s+(?:community|neighborhood|home|building)\b/gi,
    "religion",
    "Religious targeting.",
  ],

  // --- Disability -------------------------------------------------------
  [/\bhandicapped?\b/gi, "disability", "Use 'accessible' and describe the feature (e.g. 'zero-step entry')."],
  [
    /\b(?:able[- ]bodied|must\s+be\s+able\s+to\s+(?:walk|climb))\b/gi,
    "disability",
    "Imposes a physical-ability requirement.",
  ],
  [
    /\bnot\s+(?:suitable|appropriate)\s+for\s+(?:the\s+)?(?:disabled|handicapped|elderly)\b/gi,
    "disability",
    "Explicit exclusion.",
  ],
  [
    /\bno\s+(?:wheelchairs?|service\s+animals?)\b/gi,
    "disability",
    "Explicit exclusion. Service animals are not pets under the FHA.",
  ],

  // --- Sex / gender -----------------------------------------------------
  [
    /\b(?:perfect|ideal|great)\s+for\s+(?:a\s+)?(?:man|woman|men|women|guys?|gals?)\b/gi,
    "sex",
    "Targets a gender.",
  ],
  [
    /\b(?:mother|master)[- ]in[- ]law\s+(?:suite|apartment)\b/gi,
    "sex / familial status",
    "Use 'secondary suite' or 'accessory dwelling unit'.",
  ],

  // --- Age --------------------------------------------------------------
  [
    /\b(?:perfect|ideal|great)\s+for\s+(?:young|older|elderly|senior)\s+(?:professionals?|couples?|buyers?|people)\b/gi,
    "age",
    "Targets an age group. (55+ communities are a narrow statutory exemption -- do not rely on it in generated copy.)",
  ],
  [/\b(?:adults?\s+only|no\s+seniors?)\b/gi, "age", "Age exclusion."],

  // --- Neighborhood-quality proxies (steering) --------------------------
  [
    /\b(?:safe|safer|unsafe|dangerous|sketchy)\s+(?:neighborhood|area|part\s+of\s+town|street|block)\b/gi,
    "steering proxy",
    "Safety claims are a recognized racial proxy AND a factual claim you cannot substantiate. Cite crime data by source or say nothing.",
  ],
  [
    /\b(?:good|bad|nice|desirable|undesirable|up[- ]and[- ]coming|transitional)\s+(?:neighborhood|area|part\s+of\s+town|side\s+of\s+town)\b/gi,
    "steering proxy",
    "Quality judgment about an area steers buyers. State facts instead.",
  ],
  [/\b(?:low|high)[- ]crime\b/gi, "steering proxy", "Crime characterization is a steering proxy."],

  // --- School-quality claims (steering proxy) ---------------------------
  // School NAMES and districts are fine. Quality adjectives are not.
  [
    /\b(?:great|good|excellent|top|best|top[- ]rated|highly[- ]rated|award[- ]winning|blue[- ]ribbon|strong|desirable)\s+(?:schools?|school\s+district|elementary|middle\s+school|high\s+school)\b/gi,
    "steering proxy (schools)",
    "School-quality claims are a well-documented racial proxy. Name the district/school factually and link the state report card.",
  ],
  [
    /\bschool\s+(?:ratings?|scores?)\s+(?:are|is)\s+(?:great|good|high|excellent)\b/gi,
    "steering proxy (schools)",
    "Same as above -- name the school, cite the source, make no claim.",
  ],
];

/**
 * WARN rules -- style / best-practice, with a deterministic auto-rewrite.
 * These do not block. Replacement uses JS `$1` syntax.
 */
export const WARN_RULES: readonly WarnRule[] = [
  [/\bmaster\s+(bedroom|bath(?:room)?|suite|closet)\b/gi, "primary $1", "Industry standard is 'primary'."],
  [
    /\bwalking\s+distance\s+(?:to|from)\b/gi,
    "{{DISTANCE_MI}} miles from",
    "Replace with measured distance -- 'walking distance' is both vague and an accessibility-coded phrase.",
  ],
  [/\bwithin\s+walking\s+distance\b/gi, "{{DISTANCE_MI}} miles away", "Same as above."],
  [/\bhandy\s*man\s+special\b/gi, "needs renovation", "Gendered and euphemistic."],
  [/\bhis\s+and\s+hers\b/gi, "dual", "Gendered."],
];

/**
 * Words that read as an endorsement by a persona. The FTC's Consumer Reviews
 * and Testimonials Rule (eff. 2024-10-21) carries CIVIL PENALTIES for
 * testimonials that misrepresent the existence of the testimonialist -- and a
 * synthetic persona (Agent Character Tour) has no experience to endorse from.
 */
export const TESTIMONIAL_RULES: readonly BlockRule[] = [
  [
    /\bI\s+(?:love|loved|adore|recommend|endorse|swear\s+by|personally\s+use)\b/gi,
    "persona testimonial",
    "The persona cannot endorse -- FTC testimonial rule, civil penalties.",
  ],
  [
    /\bmy\s+(?:clients?|customers?|favorite)\b/gi,
    "persona testimonial",
    "Implies the persona has a client relationship or lived experience.",
  ],
  [
    /\b(?:in\s+my\s+experience|I've\s+(?:seen|sold|worked|helped)|when\s+I\s+(?:sold|showed|listed))\b/gi,
    "persona testimonial",
    "Claims lived professional experience the persona does not have.",
  ],
  [
    /\bI\s+(?:can|will)\s+(?:get\s+you|save\s+you|find\s+you)\b/gi,
    "persona testimonial",
    "The persona is not the licensee and cannot promise a service outcome.",
  ],
];

function scan(text: string, rules: readonly BlockRule[], severity: LintSeverity): LintViolation[] {
  const out: LintViolation[] = [];
  for (const [pattern, label, why] of rules) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      out.push({ severity, class: label, match: m[0], offset: m.index, why });
      if (m[0].length === 0) pattern.lastIndex++;
    }
    pattern.lastIndex = 0;
  }
  return out;
}

export interface LintOptions {
  /**
   * Include the persona-testimonial rules. Default true (fh_lint.py parity).
   * The wizard passes false for an agent's own dictated description — a
   * licensed human may say "my clients"; a synthetic character may not.
   */
  testimonials?: boolean;
}

/** Lint a string. `ok` is false if any BLOCK-severity rule fired. */
export function lintFairHousing(text: string, opts: LintOptions = {}): LintResult {
  const src = text ?? "";
  const violations: LintViolation[] = [];
  violations.push(...scan(src, BLOCK_RULES, "BLOCK"));
  if (opts.testimonials !== false) violations.push(...scan(src, TESTIMONIAL_RULES, "BLOCK"));

  for (const [pattern, repl, why] of WARN_RULES) {
    // ⚠️ A non-global clone for the preview: String.replace with a /g regex
    // resets lastIndex and would restart the exec loop forever.
    const single = new RegExp(pattern.source, "i");
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(src)) !== null) {
      violations.push({
        severity: "WARN",
        class: "style",
        match: m[0],
        offset: m.index,
        why,
        rewrite: m[0].replace(single, repl),
      });
      if (m[0].length === 0) pattern.lastIndex++;
    }
    pattern.lastIndex = 0;
  }

  violations.sort((a, b) => a.offset - b.offset);
  const blocks = violations.filter((v) => v.severity === "BLOCK").length;
  return { ok: blocks === 0, violations, blocks, warns: violations.length - blocks };
}

/**
 * Apply every WARN auto-rewrite. Does not touch BLOCK matches -- those need
 * a human or a regenerated description, not a find-and-replace.
 */
export function applyRewrites(text: string): string {
  let out = text ?? "";
  for (const [pattern, repl] of WARN_RULES) {
    pattern.lastIndex = 0;
    out = out.replace(pattern, repl);
  }
  return out;
}

export class FairHousingError extends Error {
  readonly violations: LintViolation[];
  constructor(message: string, violations: LintViolation[]) {
    super(message);
    this.name = "FairHousingError";
    this.violations = violations;
  }
}

/** Throw on any BLOCK; return the WARN-rewritten text otherwise. Fail closed. */
export function assertClean(text: string, context = "", opts: LintOptions = {}): string {
  const res = lintFairHousing(text, opts);
  if (!res.ok) {
    const blocks = res.violations.filter((v) => v.severity === "BLOCK");
    const detail = blocks.map((v) => `${v.class}: '${v.match}' (${v.why})`).join("; ");
    throw new FairHousingError(`Fair Housing lint FAILED${context ? " for " + context : ""}: ${detail}`, blocks);
  }
  return applyRewrites(text);
}

/** The free-text fields of a listing draft that a human typed. */
export interface LintableDraft {
  dictationRaw?: string | null;
  features?: string[] | null;
  roomType?: string | null;
  style?: string | null;
  address?: string | null;
}

export type LintField = "dictationRaw" | "features" | "roomType" | "style";

export interface FieldViolation extends LintViolation {
  field: LintField;
}

export interface FieldsLintResult {
  ok: boolean;
  violations: FieldViolation[];
  blocks: number;
  warns: number;
}

/**
 * Lint every user-typed field of a draft. Address is deliberately NOT linted
 * (street names like "Church St" are facts, not steering). Testimonial rules
 * are off — the agent is a real licensee describing their own listing.
 */
export function lintFields(draft: LintableDraft): FieldsLintResult {
  const violations: FieldViolation[] = [];
  const push = (field: LintField, text: string | null | undefined) => {
    if (!text) return;
    for (const v of lintFairHousing(text, { testimonials: false }).violations) {
      violations.push({ ...v, field });
    }
  };
  push("dictationRaw", draft.dictationRaw);
  push("roomType", draft.roomType);
  push("style", draft.style);
  for (const f of draft.features ?? []) push("features", f);
  const blocks = violations.filter((v) => v.severity === "BLOCK").length;
  return { ok: blocks === 0, violations, blocks, warns: violations.length - blocks };
}

// ---------------------------------------------------------------------------
// 2. Prompt blocklist (Heartland MLS §11.2.1–11.2.2)
// ---------------------------------------------------------------------------

export type ComplianceLane = "social" | "mls";

export interface PromptBlockRule {
  pattern: RegExp;
  why: string;
  /** When set, the phrase is allowed in this lane but forces the frame label. */
  allowIn?: ComplianceLane;
}

/**
 * Edits the prompt-builder must never carry to the renderer. Virtual staging
 * is PERSONAL property (furniture, art, plants, paint). Anything that changes
 * what a buyer would physically find — views, structures, windows, layout —
 * is a misrepresentation, and Heartland's penalty is every photo except the
 * front pulled plus a fine.
 */
export const PROMPT_BLOCKLIST: readonly PromptBlockRule[] = [
  {
    pattern: /\b(?:add|insert|create|include|give\s+it|with)\s+(?:an?\s+)?(?:(?:ocean|lake|mountain|city|skyline|water|golf|park)\s+)?(?:view|views|vista|lake|ocean|skyline|sunset|pool|waterfront|beach)\b/gi,
    why: "Adds a view, water feature or pool that is not physically there (Heartland MLS §11.2.2).",
  },
  {
    pattern: /\b(?:remove|erase|delete|hide|get\s+rid\s+of|take\s+out|without)\s+(?:the\s+)?(?:power\s*lines?|utility\s*(?:lines?|poles?)|poles?|highway|freeway|road\s+noise|neighbou?rs?(?:'s)?\s+(?:house|home|fence|yard)|neighbou?ring\s+(?:house|home|building|structure)|structure|building|cell\s+tower|water\s+tower|train\s+tracks?)\b/gi,
    why: "Removes a power line, highway, pole or neighbouring structure a buyer would actually see.",
  },
  {
    pattern: /\b(?:add|move|enlarge|widen|remove|relocate|extra|additional|new|bigger|larger)\s+(?:a\s+|the\s+)?(?:windows?|skylights?|doors?|french\s+doors)\b/gi,
    why: "Changes windows/doors — affixed property, not staging.",
  },
  {
    pattern: /\b(?:open|change|alter|modify|reconfigure|knock\s+(?:out|down)|remove|move)\s+(?:up\s+)?(?:the\s+)?(?:floor\s*plan|layout|walls?|load[- ]bearing|kitchen\s+island\s+location|ceilings?)\b/gi,
    why: "Changes the layout, walls or ceilings — a material change that must be labeled and paired with the as-listed photo.",
  },
  {
    pattern: /\b(?:vaulted|raise|raised|higher|taller|cathedral)\s+(?:the\s+)?ceilings?\b/gi,
    why: "Changes the ceiling height.",
  },
  {
    pattern: /\b(?:expand|extend|enlarge|make\s+(?:the\s+room\s+)?(?:bigger|larger|wider|longer))\b/gi,
    why: "Changes the room's size.",
  },
  {
    pattern: /\b(?:twilight|dusk|golden\s+hour|sunset\s+sky|night\s+sky|dramatic\s+sky|blue\s+hour)\b/gi,
    why: "Sky replacement is allowed for social/marketing only and must carry the AI-generated label.",
    allowIn: "social",
  },
];

export interface PromptLintViolation {
  match: string;
  offset: number;
  why: string;
}

export interface PromptLintResult {
  ok: boolean;
  violations: PromptLintViolation[];
  /** True when a lane-allowed phrase (twilight in social) was used → label mandatory. */
  forcesLabel: boolean;
}

/** Lint any user-influenced prompt text (style, room type, custom notes). */
export function lintPrompt(text: string, lane: ComplianceLane): PromptLintResult {
  const src = text ?? "";
  const violations: PromptLintViolation[] = [];
  let forcesLabel = false;
  for (const rule of PROMPT_BLOCKLIST) {
    rule.pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.pattern.exec(src)) !== null) {
      if (rule.allowIn && rule.allowIn === lane) {
        forcesLabel = true;
      } else {
        violations.push({ match: m[0], offset: m.index, why: rule.why });
      }
      if (m[0].length === 0) rule.pattern.lastIndex++;
    }
    rule.pattern.lastIndex = 0;
  }
  violations.sort((a, b) => a.offset - b.offset);
  return { ok: violations.length === 0, violations, forcesLabel };
}

// ---------------------------------------------------------------------------
// 3. End card + frame label (state advertising rules)
// ---------------------------------------------------------------------------

/** SKU ids mirrored from lib/vater/listing-pricing.ts (zero-import rule). A
 *  node:test asserts these sets agree with LISTING_SKUS. */
export type ComplianceSku =
  | "virtual_staging"
  | "before_after"
  | "beauty_shot"
  | "walkthrough"
  | "exterior_reveal"
  | "agent_tour";

/** SKUs whose output depicts a change to AFFIXED property (Heartland §11.2.2). */
export const MATERIAL_CHANGE_SKUS: ReadonlySet<ComplianceSku> = new Set<ComplianceSku>(["before_after"]);
/** SKUs whose primary deliverable is a still photo. */
export const STILL_SKUS: ReadonlySet<ComplianceSku> = new Set<ComplianceSku>(["virtual_staging"]);

/** The subset of the agent profile the end card is generated from. */
export interface EndCardProfile {
  agentDisplayName?: string | null;
  agentPhone?: string | null;
  brokerName?: string | null;
  brokerPhone?: string | null;
  licenseNumber?: string | null;
  licenseState?: string | null;
  licenseStatus?: string | null;
  narMember?: boolean | null;
}

export type EndCardBlockerCode = "no_broker_info" | "no_broker_phone" | "no_license";

export interface EndCardBlocker {
  code: EndCardBlockerCode;
  message: string;
}

export interface EndCardLine {
  /** agent | broker | eho */
  role: "agent" | "broker" | "eho";
  text: string;
  /** Pixel size at the reference height (EndCardSpec.refHeightPx). */
  fontPx: number;
}

export interface EndCardSpec {
  state: string;
  /** Which state rule pack drove the sizes: MO | KS | PA | default(PA-strict). */
  rulePack: "MO" | "KS" | "PA" | "default";
  /** Reference frame height the px sizes are computed at (DGX scales). */
  refHeightPx: number;
  lines: EndCardLine[];
  fontPx: { agent: number; broker: number; eho: number };
  /** Broker line must sit immediately under/next to the agent line (KS). */
  adjacent: true;
  /** Equal Housing Opportunity slogan + logo — always. */
  eho: true;
  /** Max agent/broker font ratio the state tolerates (KS 2, PA 1, MO 2). */
  maxAgentToBrokerRatio: number;
  /** Plain-English rule the UI can show. */
  ruleText: string;
  blockers: EndCardBlocker[];
  ok: boolean;
}

export const EHO_SLOGAN = "Equal Housing Opportunity";

const STATE_RULE_TEXT: Record<EndCardSpec["rulePack"], string> = {
  MO: "Missouri 20 CSR 2250-8.070: every ad shows the broker's licensed business name; if the agent's name or phone appears, the broker's name and phone must too.",
  KS: "Kansas K.A.R. 86-3-7: the broker's trade name sits adjacent to the agent/team name and the agent's font is no more than 2x the broker's.",
  PA: "Pennsylvania 49 Pa. Code §35.305: the employing broker's name and phone appear in the ad itself, in equal size to the agent's.",
  default:
    "Strictest applicable rule: broker name and phone adjacent to the agent's, in equal size, plus Equal Housing Opportunity.",
};

function clean(v: string | null | undefined): string {
  return (v ?? "").replace(/\s+/g, " ").trim();
}

export interface EndCardOptions {
  lane?: ComplianceLane;
  /** Reference frame height. Default 720 (Seedance native). */
  refHeightPx?: number;
}

/**
 * Generate the end-card lines + font sizes for a state, and the blockers
 * that make the export impossible. Missing broker phone = cannot export —
 * a hard gate, like MoneyConfirmModal.
 *
 * Sizes (PIL, at H): agent = H*0.06, broker = max(agent/2, H*0.04);
 * PA → broker = agent; KS → agent ≤ 2×broker (asserted).
 */
export function endCardSpec(profile: EndCardProfile, state: string | null | undefined, sku: ComplianceSku, opts: EndCardOptions = {}): EndCardSpec {
  const st = clean(state).toUpperCase().slice(0, 2);
  const rulePack: EndCardSpec["rulePack"] = st === "MO" || st === "KS" || st === "PA" ? st : "default";
  const H = opts.refHeightPx ?? 720;

  const agentName = clean(profile.agentDisplayName);
  const agentPhone = clean(profile.agentPhone);
  const brokerName = clean(profile.brokerName);
  const brokerPhone = clean(profile.brokerPhone);
  const licenseNumber = clean(profile.licenseNumber);
  const licenseState = clean(profile.licenseState).toUpperCase();
  const verified = profile.licenseStatus === "verified";
  const realtor = Boolean(profile.narMember) && verified;

  const blockers: EndCardBlocker[] = [];
  if (!brokerName) {
    blockers.push({
      code: "no_broker_info",
      message: "Add your broker's licensed business name — every state requires it on the ad.",
    });
  }
  // MO: agent name/phone shown ⇒ broker phone required. PA/KS/default: always.
  // The agent's name is always on the card, so in practice this is always required.
  if (!brokerPhone) {
    blockers.push({
      code: "no_broker_phone",
      message: "Add your broker's phone number — required next to your name (MO 20 CSR 2250-8.070 / PA §35.305).",
    });
  }
  if (opts.lane === "mls" && !verified) {
    blockers.push({
      code: "no_license",
      message: "MLS-safe export needs a verified real-estate license.",
    });
  }

  const agentPx = Math.round(H * 0.06);
  let brokerPx = Math.max(Math.round(agentPx / 2), Math.round(H * 0.04));
  if (rulePack === "PA" || rulePack === "default") brokerPx = agentPx; // equal size
  const maxRatio = rulePack === "KS" ? 2 : rulePack === "MO" ? 2 : 1;
  if (agentPx / brokerPx > maxRatio) brokerPx = Math.ceil(agentPx / maxRatio);
  const ehoPx = Math.round(H * 0.035);

  const agentBits: string[] = [];
  if (agentName) agentBits.push(realtor ? `${agentName}, REALTOR®` : agentName);
  if (licenseNumber) agentBits.push(`${licenseState ? licenseState + " " : ""}Lic #${licenseNumber}`);
  if (agentPhone) agentBits.push(agentPhone);

  const brokerBits: string[] = [];
  if (brokerName) brokerBits.push(brokerName);
  if (brokerPhone) brokerBits.push(brokerPhone);

  const lines: EndCardLine[] = [];
  if (agentBits.length) lines.push({ role: "agent", text: agentBits.join(" · "), fontPx: agentPx });
  if (brokerBits.length) lines.push({ role: "broker", text: brokerBits.join(" · "), fontPx: brokerPx });
  lines.push({ role: "eho", text: EHO_SLOGAN, fontPx: ehoPx });

  void sku; // reserved: material-change SKUs add nothing to the card; the frame label carries it.

  return {
    state: st || "",
    rulePack,
    refHeightPx: H,
    lines,
    fontPx: { agent: agentPx, broker: brokerPx, eho: ehoPx },
    adjacent: true,
    eho: true,
    maxAgentToBrokerRatio: maxRatio,
    ruleText: STATE_RULE_TEXT[rulePack],
    blockers,
    ok: blockers.length === 0,
  };
}

export interface FrameLabelSpec {
  /** ASCII only — ffmpeg drawtext drops trailing glyphs on multi-byte strings. */
  text: string;
  position: "bottom-left";
  /** Font size as a fraction of frame height. */
  fontRatio: number;
  box: "black@0.55";
  /** True when the label must be burned on every delivered frame. */
  required: boolean;
  /** Text for the MLS photo-description field / caption line. */
  captionLine: string;
  /** Material change: the label says WHAT changed and the as-listed photo must follow. */
  materialChange: boolean;
}

/** NAR SOP 12-5 "true picture" label. Same string the DGX burns. */
export function frameLabelSpec(sku: ComplianceSku, lane: ComplianceLane, sourceKind: "upload" | "streetview" = "upload"): FrameLabelSpec {
  const materialChange = MATERIAL_CHANGE_SKUS.has(sku);
  let text: string;
  let captionLine: string;
  if (sku === "virtual_staging") {
    text = "AI-generated - virtually staged";
    captionLine = "Virtually staged";
  } else if (materialChange) {
    text = "AI-generated - virtual rendering. Walls/floors/finishes shown are not as listed";
    captionLine = "Virtually rendered - shows changes to finishes; see the as-listed photo";
  } else if (sku === "exterior_reveal" && sourceKind === "streetview") {
    text = "AI-generated - rendering";
    captionLine = "AI-generated rendering";
  } else if (sku === "agent_tour") {
    text = "AI-generated - virtual host";
    captionLine = "AI-generated video with a virtual host";
  } else {
    text = "AI-generated - animated from listing photo";
    captionLine = "AI-generated video from the listing photo";
  }
  return {
    text,
    position: "bottom-left",
    fontRatio: 0.045,
    box: "black@0.55",
    // The MLS-safe still is the ONE artefact delivered without the burn — the
    // .txt photo-description line carries the disclosure there (Heartland
    // forbids text/logos on listing photos). Everything else is labeled.
    required: lane !== "mls" || !STILL_SKUS.has(sku),
    captionLine,
    materialChange,
  };
}

export interface MlsSafeJobLike {
  sku?: ComplianceSku | string | null;
  lane?: ComplianceLane | string | null;
  sourceKind?: "upload" | "streetview" | string | null;
  licenseStatus?: string | null;
}

export interface MlsSafePlan {
  /** Can this SKU's output go into an MLS photo slot at all? */
  allowed: boolean;
  /** Why not (shown on the SKU card). */
  reason: string | null;
  /** Artefacts the export produces. */
  outputs: Array<"still" | "txt">;
  /** Exact photo-description line for the MLS field. */
  photoDescription: string;
  /** What's stripped from the MLS artefact. */
  strips: string[];
  /** Export needs a verified license. */
  licenseGated: true;
  licenseOk: boolean;
  materialChange: boolean;
}

/**
 * Heartland MLS §11.2.1–11.2.2 plan for a job: listing photos carry no names,
 * contact info, URLs, logos, signs, people or characters; virtual staging of
 * PERSONAL property is fine with a "Virtually staged" description; material
 * change to affixed property may not go in a photo slot as a standalone image.
 */
export function mlsSafePlan(job: MlsSafeJobLike): MlsSafePlan {
  const sku = (job.sku ?? "") as ComplianceSku;
  const materialChange = MATERIAL_CHANGE_SKUS.has(sku);
  const label = frameLabelSpec(sku || "virtual_staging", "mls", job.sourceKind === "streetview" ? "streetview" : "upload");
  const licenseOk = job.licenseStatus === "verified";
  let allowed = true;
  let reason: string | null = null;
  if (!sku) {
    allowed = false;
    reason = "Pick a video type first.";
  } else if (materialChange) {
    allowed = false;
    reason = "Social / marketing use — not for MLS photo slots. Shows changes to walls, floors or finishes; must be labeled and paired with the as-listed photo.";
  } else if (sku === "agent_tour") {
    allowed = false;
    reason = "Listing photos may not contain people or characters (Heartland MLS §11.2.1).";
  } else if (sku === "exterior_reveal" && job.sourceKind === "streetview") {
    allowed = false;
    reason = "A Street View rendering is not a photo of the listing. Upload your own exterior photo for MLS use.";
  } else if (!STILL_SKUS.has(sku)) {
    // Video SKUs: the MLS artefact is the unaltered still they were made from.
    allowed = true;
    reason = null;
  }
  return {
    allowed,
    reason,
    outputs: allowed ? ["still", "txt"] : [],
    photoDescription: label.captionLine,
    strips: ["frame label", "end card", "agent/broker names", "phone numbers", "URLs", "logos", "characters"],
    licenseGated: true,
    licenseOk,
    materialChange,
  };
}
