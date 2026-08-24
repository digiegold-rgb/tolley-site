/**
 * One-shot hint so a "Voices → ElevenLabs" CTA lands on the connect tab
 * instead of the default "Your voices" tab. Billing is never opened.
 */
export const VOICES_TAB_HINT_KEY = 'jelly-voices-tab';

export function hintVoicesElevenLabsTab(): void {
  try {
    sessionStorage.setItem(VOICES_TAB_HINT_KEY, 'elevenlabs');
  } catch {
    /* private mode — they still land on Voices */
  }
}

export function consumeVoicesTabHint(): 'elevenlabs' | null {
  try {
    const value = sessionStorage.getItem(VOICES_TAB_HINT_KEY);
    if (value === 'elevenlabs') {
      sessionStorage.removeItem(VOICES_TAB_HINT_KEY);
      return 'elevenlabs';
    }
  } catch {
    /* private mode */
  }
  return null;
}
