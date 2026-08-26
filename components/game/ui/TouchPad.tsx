"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import type { Input, Action } from "../engine/input";

/**
 * On-screen controls for phones/tablets. Plain DOM buttons outside the canvas
 * transform, so no coordinate math; multi-touch works because every button is
 * its own pointer target.
 */
export function TouchPad({ input, twoPlayer }: { input: Input; twoPlayer: boolean }) {
  const hold = (a: Action) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      input.set(a, true);
    },
    onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      input.set(a, false);
    },
    onPointerCancel: () => input.set(a, false),
    onLostPointerCapture: () => input.set(a, false),
    onContextMenu: (e: ReactPointerEvent<HTMLButtonElement>) => e.preventDefault(),
  });
  return (
    <div className="gp-touch" aria-hidden="true">
      <div className="gp-touch-left">
        <button type="button" className="gp-tbtn gp-tbtn-up" data-touch="up" {...hold("up")}>
          ▲
        </button>
        <button type="button" className="gp-tbtn gp-tbtn-left" data-touch="left" {...hold("left")}>
          ◀
        </button>
        <button type="button" className="gp-tbtn gp-tbtn-right" data-touch="right" {...hold("right")}>
          ▶
        </button>
        <button type="button" className="gp-tbtn gp-tbtn-down" data-touch="down" {...hold("down")}>
          ▼
        </button>
      </div>
      <div className="gp-touch-right">
        <button type="button" className="gp-tbtn gp-tbtn-small" data-touch="prev" {...hold("prev")}>
          Q
        </button>
        <button type="button" className="gp-tbtn gp-tbtn-small" data-touch="next" {...hold("next")}>
          E
        </button>
        <button type="button" className="gp-tbtn gp-tbtn-c" data-touch="power" {...hold("power")}>
          C
        </button>
        <button type="button" className="gp-tbtn gp-tbtn-x" data-touch="bash" {...hold("bash")}>
          X
        </button>
        <button type="button" className="gp-tbtn gp-tbtn-jump" data-touch="jump" {...hold("jump")}>
          JUMP
        </button>
        {twoPlayer ? (
          <button type="button" className="gp-tbtn gp-tbtn-small" data-touch="p2action" {...hold("p2action")}>
            P2
          </button>
        ) : null}
      </div>
    </div>
  );
}
