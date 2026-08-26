"use client";

import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Game, type GameOptions } from "./engine/game";
import type { HeroKind, UiSnapshot } from "./engine/types";
import { heroSprite } from "./engine/sprites";
import { HEROES, FRIENDS } from "./worlds/friends";
import { LEVELS } from "./worlds/levels";
import { TouchPad } from "./ui/TouchPad";

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function parseOptions(): GameOptions {
  if (typeof window === "undefined") return {};
  const q = new URLSearchParams(window.location.search);
  const o: GameOptions = {};
  const lv = Number(q.get("level"));
  if (lv >= 1 && lv <= 10) o.level = lv;
  const hero = q.get("hero");
  if (hero === "frog" || hero === "fox" || hero === "cat") o.hero = hero;
  if (q.get("god") === "1") o.god = true;
  if (q.get("mute") === "1") o.mute = true;
  const seed = Number(q.get("seed"));
  if (Number.isFinite(seed) && seed > 0) o.seed = seed;
  return o;
}

export function GameShell() {
  return (
    <Boundary>
      <Shell />
    </Boundary>
  );
}

function Shell() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [snap, setSnap] = useState<UiSnapshot | null>(null);
  const [rect, setRect] = useState({ x: 0, y: 0, w: 960, h: 540 });
  const [touch] = useState(() => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);
  const [world, setWorld] = useState(1);
  const [sprites, setSprites] = useState<Record<HeroKind, string> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const opts = { ...parseOptions(), touch: coarse };
    const game = new Game(canvas, opts);
    gameRef.current = game;
    const unsub = game.subscribe((s) => {
      setSnap(s);
      setWorld(game.selectedWorld);
    });
    const ro = new ResizeObserver(() => {
      const r = stage.getBoundingClientRect();
      game.resize(r.width, r.height);
      const sr = game.renderer.stageRect();
      setRect({ x: sr.x, y: sr.y, w: sr.w, h: sr.h });
    });
    ro.observe(stage);
    const font = getComputedStyle(stage).getPropertyValue("--font-fredoka").trim();
    const applyFont = () => game.setFont(font ? `${font}, "Fredoka", system-ui, sans-serif` : "system-ui, sans-serif");
    applyFont();
    if (document.fonts?.ready) void document.fonts.ready.then(applyFont);
    game.start();
    const onGesture = () => game.gesture();
    stage.addEventListener("pointerdown", onGesture);
    stage.addEventListener("touchend", onGesture);
    const onVisible = () => {
      if (!document.hidden) game.gesture();
    };
    document.addEventListener("visibilitychange", onVisible);
    stage.focus({ preventScroll: true });
    if (opts.god) (window as unknown as { __portalGame?: unknown }).__portalGame = game.debugApi();
    // hero portraits for the select screen
    const urls = {} as Record<HeroKind, string>;
    for (const h of HEROES) {
      const c = heroSprite(h.kind, "idle");
      urls[h.kind] = c ? c.toDataURL() : "";
    }
    // state hand-off happens off the synchronous effect body
    const handoff = window.setTimeout(() => {
      if (gameRef.current === game) {
        setGame(game);
        setSprites(urls);
      }
    }, 0);
    return () => {
      window.clearTimeout(handoff);
      unsub();
      ro.disconnect();
      stage.removeEventListener("pointerdown", onGesture);
      stage.removeEventListener("touchend", onGesture);
      document.removeEventListener("visibilitychange", onVisible);
      game.dispose();
      gameRef.current = null;
      setGame(null);
      delete (window as unknown as { __portalGame?: unknown }).__portalGame;
    };
  }, []);

  const scale = rect.w / 960;
  const overlayStyle = useMemo(
    () => ({ left: rect.x, top: rect.y, width: rect.w, height: rect.h, "--gs": String(scale) }) as React.CSSProperties,
    [rect, scale],
  );
  const ui = (a: Parameters<Game["ui"]>[0]) => () => game?.ui(a);

  return (
    <div ref={stageRef} className="gp-stage" tabIndex={0} aria-label="Portal Hoppers game">
      <canvas ref={canvasRef} className="gp-canvas" data-testid="game-canvas" data-screen={snap?.screen ?? "title"} data-level={snap?.level ?? 1} />
      <div className="gp-overlay" style={overlayStyle}>
        {snap && snap.screen === "title" ? (
          <div className="gp-panel gp-title">
            <div className="gp-logo">
              <span className="gp-logo-a">PORTAL</span>
              <span className="gp-logo-b">HOPPERS</span>
            </div>
            <p className="gp-tag">Hop through 10 wild worlds. Free 15 friends. Get home.</p>
            <div className="gp-row">
              <button type="button" className="gp-btn gp-btn-primary" onClick={ui("start")}>
                {snap.hasSave ? "New adventure" : "Start"}
              </button>
              {snap.hasSave ? (
                <button type="button" className="gp-btn" onClick={ui("continue")}>
                  Continue · World {snap.unlocked}
                </button>
              ) : null}
            </div>
            <p className="gp-hint">Arrows move · SPACE jumps (hold for ULTRA) · X bash · C power · Cubo helps on his own — or a friend takes WASD + Shift</p>
            {!snap.audioUnlocked ? <p className="gp-hint gp-blink">Tap or press a key for sound</p> : null}
          </div>
        ) : null}

        {snap && snap.screen === "select" ? (
          <div className="gp-panel gp-select">
            <h2>Pick your hero</h2>
            <div className="gp-heroes">
              {HEROES.map((h, i) => (
                <button
                  type="button"
                  key={h.kind}
                  className={`gp-hero ${i === snap.selectIndex ? "gp-hero-on" : ""}`}
                  style={{ "--hc": h.color } as React.CSSProperties}
                  onClick={() => {
                    const g = game;
                    if (!g) return;
                    const cur = snap.selectIndex;
                    const steps = (i - cur + 3) % 3;
                    for (let k = 0; k < steps; k++) g.ui("select-right");
                  }}
                >
                  {sprites?.[h.kind] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sprites[h.kind]} alt="" className="gp-hero-img" />
                  ) : null}
                  <strong>{h.name}</strong>
                  <span>{h.blurb}</span>
                </button>
              ))}
            </div>
            <div className="gp-row gp-world">
              <button type="button" className="gp-btn gp-btn-sm" onClick={ui("world-left")} disabled={world <= 1} aria-label="Previous world">
                ◀
              </button>
              <span>
                World {world} · {LEVELS[world - 1]?.name}
              </span>
              <button type="button" className="gp-btn gp-btn-sm" onClick={ui("world-right")} disabled={world >= snap.unlocked} aria-label="Next world">
                ▶
              </button>
            </div>
            <div className="gp-row">
              <label className="gp-check">
                <input type="checkbox" checked={snap.twoPlayer} onChange={() => game?.toggleTwoPlayer()} /> 2 players (friend drives Cubo with WASD + Shift)
              </label>
            </div>
            <button type="button" className="gp-btn gp-btn-primary" onClick={ui("confirm")}>
              Go!
            </button>
          </div>
        ) : null}

        {snap && snap.screen === "intro" ? (
          <button type="button" className="gp-panel gp-intro" onClick={ui("confirm")}>
            <span className="gp-sub">{snap.levelSubtitle}</span>
            <h2>{snap.levelName}</h2>
            <p>{snap.introLine}</p>
            <span className="gp-hint gp-blink">{touch ? "Tap to start" : "Press ENTER or SPACE"}</span>
          </button>
        ) : null}

        {snap && snap.screen === "pause" ? (
          <div className="gp-panel gp-pause">
            <h2>Paused</h2>
            <div className="gp-controls">
              <div>← → move · ↑ swim / ask Cubo for a lift · ↓ drop through / pound</div>
              <div>SPACE jump · hold SPACE still, release = ULTRA JUMP</div>
              <div>X bash blocks, cages, orbs · C use power · Q / E or 1–9 pick power</div>
              <div>Player 2: WASD + Shift (Shift near hero = boost, on ground = pillar, near candy = bat)</div>
            </div>
            <div className="gp-row">
              <button type="button" className="gp-btn gp-btn-primary" onClick={ui("resume")}>
                Resume
              </button>
              <button type="button" className="gp-btn" onClick={ui("quit")}>
                Quit to title
              </button>
            </div>
          </div>
        ) : null}

        {snap && snap.screen === "clear" ? (
          <div className="gp-panel gp-clear">
            <span className="gp-sub">World {snap.level} cleared!</span>
            <h2>{snap.levelName}</h2>
            <p>
              Friends freed: {snap.rescued.length} / 15 · Coins: {snap.coins}
            </p>
            <button type="button" className="gp-btn gp-btn-primary" onClick={ui("next")}>
              {snap.level >= 10 ? "Go home →" : `Next: ${LEVELS[snap.level]?.name} →`}
            </button>
          </div>
        ) : null}

        {snap && snap.screen === "ending" ? (
          <div className="gp-panel gp-ending">
            <span className="gp-sub">You made it</span>
            <h2>HOME!</h2>
            <p>Every cage is open. Every friend is free. Cubo has never seen so many animals in one room.</p>
            <div className="gp-friends">
              {FRIENDS.map((f) => (
                <span key={f.id} className={`gp-friend ${snap.rescued.includes(f.id) ? "gp-friend-on" : ""}`} style={{ "--fc": f.color } as React.CSSProperties}>
                  {f.name}
                </span>
              ))}
            </div>
            <p className="gp-epilogue">
              Captain Clank has been sentenced to 1,000 hours of cage-cleaning duty. The Sugar Sultan opened a candy shop. It&apos;s actually pretty good.
              {snap.rescued.length < 15 ? ` (${15 - snap.rescued.length} friends are still out there — replay any world to find them.)` : ""}
            </p>
            <div className="gp-row">
              <button type="button" className="gp-btn gp-btn-primary" onClick={ui("confirm")}>
                Back to title
              </button>
              <button type="button" className="gp-btn" onClick={ui("restart")}>
                Start over from World 1
              </button>
            </div>
          </div>
        ) : null}

        {snap?.card ? (
          <button type="button" className="gp-card" style={{ "--cc": snap.card.color ?? "#fde047" } as React.CSSProperties} onClick={ui("dismiss")}>
            <strong>{snap.card.title}</strong>
            <span>{snap.card.body}</span>
          </button>
        ) : null}

        {snap && (snap.screen === "play" || snap.screen === "pause") ? (
          <div className="gp-hudbtns">
            <button type="button" className="gp-ibtn" onClick={() => game?.toggleMute()} aria-label={snap.muted ? "Unmute" : "Mute"} title={snap.muted ? "Unmute" : "Mute"}>
              {snap.muted ? "🔇" : "🔊"}
            </button>
            <button type="button" className={`gp-ibtn ${snap.twoPlayer ? "gp-ibtn-on" : ""}`} onClick={() => game?.toggleTwoPlayer()} aria-label="Toggle 2 players" title="2 players (WASD + Shift)">
              2P
            </button>
            <button type="button" className="gp-ibtn" onClick={ui(snap.screen === "pause" ? "resume" : "pause")} aria-label="Pause" title="Pause">
              {snap.screen === "pause" ? "▶" : "❚❚"}
            </button>
          </div>
        ) : null}
      </div>
      {touch && game && snap && snap.screen === "play" ? <TouchPad input={game.input} twoPlayer={snap.twoPlayer} /> : null}
    </div>
  );
}
