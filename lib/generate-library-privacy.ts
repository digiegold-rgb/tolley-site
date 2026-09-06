/**
 * /generate library (Modal stills / Motion clips / engine results) stays
 * hidden until the visitor opts in. First visit and cleared storage = hidden.
 * Opt-in is per device via localStorage — forms stay usable either way.
 */

export const GENERATE_LIBRARY_VISIBLE_KEY = "tolley.generate.libraryVisible";

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

/** True only when the visitor previously opted in. Missing/invalid = hidden. */
export function readGenerateLibraryVisible(storage: StorageLike | null | undefined): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(GENERATE_LIBRARY_VISIBLE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeGenerateLibraryVisible(
  storage: StorageLike | null | undefined,
  visible: boolean,
): void {
  if (!storage) return;
  try {
    if (visible) storage.setItem(GENERATE_LIBRARY_VISIBLE_KEY, "1");
    else storage.removeItem(GENERATE_LIBRARY_VISIBLE_KEY);
  } catch {
    /* private mode / quota — keep in-memory only */
  }
}
