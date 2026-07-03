// Short-code generation for review links. 6-char alphanumeric (no
// look-alikes) gives 36^6 ≈ 2 billion unique codes — plenty for any review
// blast volume we'd realistically run. Rejects characters that get confused
// in handwritten / texted form (0/O, 1/l/I).

const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

export function newShortCode(length = 6): string {
  let s = "";
  for (let i = 0; i < length; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return s;
}
