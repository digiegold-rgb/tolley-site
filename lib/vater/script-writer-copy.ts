/**
 * Shared writer / Talk prompt copy. Isomorphic — the Review UI quotes with
 * the same fidelity lines the server sends.
 */
import type { ScriptFidelity } from "./script-writer-models";

export const FIDELITY_INSTRUCTIONS: Record<ScriptFidelity, string> = {
  faithful:
    "Stay close to the source. Keep the same claims, order, examples and names. Tighten and structure for spoken narration. Do not invent new stories, facts, or examples.",
  balanced:
    "Restructure in the speaker's voice. Keep every material fact and claim. You may reorder, tighten, and cut repetition. Do not invent new facts.",
  rewrite:
    "Write a genuinely new script from the same facts. Different hook, different examples and a different order. Facts, claims and numbers stay true to the source. Never a copy.",
};

export const SCRIPT_WRITER_FALLBACK_RULES = `Genuine rewrite, not a rephrase. Before finalizing, change the opening, any named comparison structure, illustrative examples, numbered lists, and the closing line. Self-check for any three-to-eight-word phrase that could drop into the source unchanged, and fully rewrite those sentences.
The script says what the source said, in the speaker's voice, ready to read aloud.`;
