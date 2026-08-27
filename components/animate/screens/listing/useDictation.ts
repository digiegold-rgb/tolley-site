'use client';

/**
 * useDictation — Web Speech API wrapper for the Details step.
 *
 * "Tap the microphone and describe the home" is the friendliest input for an
 * agent standing in a driveway with a phone. Chrome / Safari / Edge expose
 * window.SpeechRecognition (or the webkit-prefixed one); Firefox does not, so
 * `supported` is false there and the step falls back to typing — the same
 * text box, no separate path.
 *
 * Interim results stream into `interim`; each final chunk is appended to
 * `transcript`. parseListingFacts() pulls beds / baths / sqft out of free
 * speech ("three bed two bath about eighteen hundred square feet").
 */
import * as React from 'react';

type SpeechRecognitionResultLike = { isFinal: boolean; 0: { transcript: string } };
type SpeechRecognitionEventLike = { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> };
type SpeechRecognitionErrorLike = { error?: string; message?: string };

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface DictationState {
  supported: boolean;
  listening: boolean;
  /** Words still being recognised (grey, live). */
  interim: string;
  /** Final text accumulated this session. */
  transcript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useDictation(opts: { lang?: string; onFinal?: (chunk: string, full: string) => void } = {}): DictationState {
  const { lang = 'en-US', onFinal } = opts;
  const [supported, setSupported] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const [interim, setInterim] = React.useState('');
  const [transcript, setTranscript] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const recRef = React.useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = React.useRef('');
  const onFinalRef = React.useRef(onFinal);
  onFinalRef.current = onFinal;

  React.useEffect(() => {
    setSupported(getCtor() !== null);
    return () => {
      try {
        recRef.current?.abort();
      } catch {
        /* already stopped */
      }
      recRef.current = null;
    };
  }, []);

  const stop = React.useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* already stopped */
    }
    setListening(false);
    setInterim('');
  }, []);

  const start = React.useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) {
      setError('Voice typing is not available in this browser. You can type instead.');
      return;
    }
    setError(null);
    try {
      recRef.current?.abort();
    } catch {
      /* ignore */
    }
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let interimText = '';
      let finalText = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const r = e.results[i];
        const text = r[0]?.transcript ?? '';
        if (r.isFinal) finalText += text;
        else interimText += text;
      }
      if (finalText.trim()) {
        const chunk = finalText.trim();
        const full = `${transcriptRef.current} ${chunk}`.trim();
        transcriptRef.current = full;
        setTranscript(full);
        onFinalRef.current?.(chunk, full);
      }
      setInterim(interimText);
    };
    rec.onerror = (e) => {
      const code = e.error ?? '';
      if (code === 'no-speech') return; // keep listening quietly
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setError('Microphone is blocked. Allow the microphone in your browser, or type instead.');
      } else if (code === 'network') {
        setError('Voice typing needs an internet connection right now. You can type instead.');
      } else if (code) {
        setError('Voice typing stopped. Tap the microphone to try again, or type instead.');
      }
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      setInterim('');
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError('Could not start the microphone. You can type instead.');
      setListening(false);
    }
  }, [lang]);

  const reset = React.useCallback(() => {
    transcriptRef.current = '';
    setTranscript('');
    setInterim('');
    setError(null);
  }, []);

  return { supported, listening, interim, transcript, error, start, stop, reset };
}

/* ─── fact parsing ─── */

const SMALL_NUMBERS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  half: 0.5,
};

/** "eighteen hundred" → 1800, "two thousand two hundred" → 2200, "1,850" → 1850. */
function wordsToNumber(raw: string): number | null {
  const s = raw.toLowerCase().replace(/,/g, ' ').replace(/-/g, ' ').trim();
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s.replace(/\s+/g, ''))) return Number(s.replace(/\s+/g, ''));
  const tokens = s.split(/\s+/).filter((t) => t !== 'and' && t !== 'a');
  let total = 0;
  let current = 0;
  let seen = false;
  for (const tok of tokens) {
    if (tok in SMALL_NUMBERS) {
      current += SMALL_NUMBERS[tok];
      seen = true;
    } else if (tok === 'hundred') {
      current = (current || 1) * 100;
      seen = true;
    } else if (tok === 'thousand') {
      total += (current || 1) * 1000;
      current = 0;
      seen = true;
    } else if (/^\d+(\.\d+)?$/.test(tok)) {
      current += Number(tok);
      seen = true;
    } else {
      return seen ? total + current : null;
    }
  }
  return seen ? total + current : null;
}

const NUM_WORDS = '(?:\\d+(?:[.,]\\d+)?|(?:(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|and|a|half)[\\s-]*)+)';

export interface ListingFacts {
  beds: number | null;
  baths: number | null;
  sqft: number | null;
}

/** Regex-parse beds / baths / sqft from dictation or typed notes. */
export function parseListingFacts(text: string): ListingFacts {
  const src = ` ${text.toLowerCase().replace(/[’']/g, '')} `;
  const facts: ListingFacts = { beds: null, baths: null, sqft: null };

  const bed = src.match(new RegExp(`(${NUM_WORDS})\\s*(?:-|\\s)?(?:bed(?:room)?s?|br\\b)`));
  if (bed) {
    const n = wordsToNumber(bed[1]);
    if (n !== null && n >= 0 && n <= 20) facts.beds = n;
  }

  const bath = src.match(new RegExp(`(${NUM_WORDS})\\s*(?:-|\\s)?(?:bath(?:room)?s?|ba\\b)`));
  if (bath) {
    let n = wordsToNumber(bath[1]);
    if (n !== null) {
      if (/\band a half\b/.test(bath[0]) || /half\s*bath/.test(bath[0])) n += 0.5;
      if (n >= 0 && n <= 20) facts.baths = n;
    }
  }

  const sq = src.match(new RegExp(`(${NUM_WORDS})\\s*(?:sq\\.?\\s*ft\\.?|square\\s*f(?:ee|oo)t|sqft|sf\\b)`));
  if (sq) {
    const n = wordsToNumber(sq[1]);
    if (n !== null && n >= 100 && n <= 100000) facts.sqft = Math.round(n);
  }

  // "3/2" shorthand, "3 bd 2 ba"
  if (facts.beds === null || facts.baths === null) {
    const short = src.match(/\b(\d{1,2})\s*\/\s*(\d{1,2}(?:\.5)?)\b/);
    if (short) {
      if (facts.beds === null) facts.beds = Number(short[1]);
      if (facts.baths === null) facts.baths = Number(short[2]);
    }
  }
  return facts;
}
