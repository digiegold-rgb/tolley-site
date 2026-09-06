"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  GENERATE_LIBRARY_VISIBLE_KEY,
  readGenerateLibraryVisible,
  writeGenerateLibraryVisible,
} from "@/lib/generate-library-privacy";

/**
 * Gates Modal stills / prior-job galleries. Default = hidden so NSFW thumbs
 * never flash on first paint. Opt-in is persisted in localStorage
 * (`tolley.generate.libraryVisible`).
 */
export function GenerateLibraryGate({ children }: { children: ReactNode }) {
  // Hidden until localStorage says otherwise — first paint never shows thumbs.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(readGenerateLibraryVisible(window.localStorage));
  }, []);

  function setLibraryVisible(next: boolean) {
    setVisible(next);
    writeGenerateLibraryVisible(window.localStorage, next);
  }

  return (
    <div className="gen-library-gate" data-testid="generate-library-gate">
      <div className="gen-library-bar">
        <p className="gen-library-status">
          {visible ? "Library visible" : "Library hidden"}
          <span className="gen-library-key" hidden>
            {GENERATE_LIBRARY_VISIBLE_KEY}
          </span>
        </p>
        <button
          type="button"
          className="gen-library-toggle"
          data-testid="generate-library-toggle"
          aria-pressed={visible}
          aria-expanded={visible}
          onClick={() => setLibraryVisible(!visible)}
        >
          {visible ? "Hide library" : "Show library"}
        </button>
      </div>
      {visible ? children : (
        <p className="gen-hint gen-library-hint">
          Prior jobs and model stills stay off this page until you show the library.
          Motion / generate forms above keep working.
        </p>
      )}
    </div>
  );
}
