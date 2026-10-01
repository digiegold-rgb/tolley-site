"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Component, useCallback, useEffect, useRef, useState, type ReactNode, type PointerEvent } from "react";
import { HEROES, FRIENDS, FRIEND_BY_ID } from "../worlds/friends";
import { VoxelGame } from "./model";
import { newSave, readSave, defaultSettings, type Save, type Settings } from "./save";
import { VoxelInput } from "./input";
import { VoxelAudio } from "./audio";
import { WORLDS } from "./worlds";
import type { HeroKind } from "../engine/types";
import type { Difficulty, Snapshot } from "./types";
import "./voxel.css";

const Scene = dynamic(() => import("./render/Scene"), { ssr: false, loading: () => null });

class Boundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.error("Blocky Worlds scene failed", error);
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
type Mode = "title" | "play" | "pause";

function TouchControls({ input }: { input: VoxelInput }) {
  const origin = useRef({ x: 0, y: 0 });
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const x = e.clientX - origin.current.x,
      y = e.clientY - origin.current.y;
    const len = Math.max(38, Math.hypot(x, y));
    input.setTouch(x / len, y / len);
    setStick({ x: (x / len) * 33, y: (y / len) * 33 });
  };
  const clear = () => {
    input.setTouch(0, 0);
    setStick({ x: 0, y: 0 });
  };
  return (
    <div className="vx-touch">
      <div
        className="vx-stick"
        role="group"
        aria-label="Movement joystick"
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          const r = e.currentTarget.getBoundingClientRect();
          origin.current = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
          move(e);
        }}
        onPointerMove={move}
        onPointerUp={clear}
        onPointerCancel={clear}
        onLostPointerCapture={clear}
      >
        <span style={{ transform: `translate(${stick.x}px,${stick.y}px)` }} />
      </div>
      <div className="vx-touch-actions">
        {[
          ["KeyE", "Use / Cubo"],
          ["KeyC", "Power"],
          ["KeyX", "Bash"],
          ["Space", "Jump"],
        ].map(([code, label]) => (
          <button
            key={code}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              input.pressed.add(code);
              input.keys.add(code);
            }}
            onPointerUp={() => input.keys.delete(code)}
            onPointerCancel={() => input.keys.delete(code)}
            onLostPointerCapture={() => input.keys.delete(code)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function VoxelShell() {
  const [game, setGame] = useState<VoxelGame | null>(null);
  const [saved, setSaved] = useState<Save | null>(null);
  const [mode, setMode] = useState<Mode>("title");
  const [hero, setHero] = useState<HeroKind>("frog");
  const [difficulty, setDifficulty] = useState<Difficulty>("challenge");
  const [ready, setReady] = useState(false);
  const [renderedWorld, setRenderedWorld] = useState(0);
  const [failed, setFailed] = useState(false);
  const [touch, setTouch] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [help, setHelp] = useState(false);
  const [locked, setLocked] = useState(false);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings());
  const [input] = useState(() => new VoxelInput());
  const stage = useRef<HTMLDivElement>(null);
  const audio = useRef<VoxelAudio | null>(null);
  const gameRef = useRef<VoxelGame | null>(null);
  const modeRef = useRef<Mode>("title");
  const pause = useCallback(() => {
    const g = gameRef.current;
    if (!g || modeRef.current !== "play" || g.rescue) return;
    g.pause();
    modeRef.current = "pause";
    setMode("pause");
    input.clear();
    input.releaseLock();
    audio.current?.pause();
  }, [input]);
  const failure = useCallback(() => {
    gameRef.current?.pause();
    audio.current?.pause();
    setFailed(true);
  }, []);
  const onReady = useCallback((world: number) => {
    setReady(true);
    setRenderedWorld(world);
  }, []);
  useEffect(() => {
    const save = readSave();
    const g = new VoxelGame(newSave());
    const a = new VoxelAudio();
    audio.current = a;
    gameRef.current = g;
    let graphics = false;
    try {
      const probe = document.createElement("canvas").getContext("webgl2");
      graphics = !!probe;
      probe?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {}
    const timer = setTimeout(() => {
      setGame(g);
      setSnap(g.snapshot());
      setSaved(save);
      const coarse = matchMedia("(pointer: coarse)").matches;
      const testMode = process.env.NODE_ENV !== "production" && new URLSearchParams(location.search).has("test");
      setSettings(save?.settings ?? { ...defaultSettings(), quality: coarse || testMode ? "low" : "high", look: coarse ? "drag" : "lock" });
      setTouch(coarse);
      setFailed(!graphics);
    }, 0);
    return () => {
      clearTimeout(timer);
      a.dispose();
    };
  }, []);
  useEffect(() => {
    if (!game || !stage.current) return;
    game.setSound((s) => audio.current?.effect(s));
    const detach = input.attach(stage.current, game, pause);
    let lastWorld = game.def.id;
    const timer = setInterval(() => {
      const snapshot = game.snapshot();
      setSnap((old) => (JSON.stringify(old) === JSON.stringify(snapshot) ? old : snapshot));
      setLocked(input.locked);
      if (game.def.id !== lastWorld) {
        lastWorld = game.def.id;
        audio.current?.play(game.def.music);
        input.clear();
      }
      if (game.saveData.finished && modeRef.current === "play") audio.current?.play("finale");
    }, 100);
    const save = () => {
      if (modeRef.current !== "title") game.save();
    };
    window.addEventListener("pagehide", save);
    return () => {
      detach();
      clearInterval(timer);
      game.setSound(null);
      window.removeEventListener("pagehide", save);
    };
  }, [game, input, pause]);
  useEffect(() => {
    audio.current?.configure(settings);
    game?.configure(settings);
    input.configure({ look: touch ? "drag" : settings.look, sensitivity: settings.sensitivity, invertY: settings.invertY });
  }, [settings, game, input, touch]);
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !game || !new URLSearchParams(location.search).has("test")) return;
    const w = window as unknown as { __voxel?: { game: VoxelGame; input: VoxelInput; audio: VoxelAudio | null } };
    w.__voxel = { game, input, audio: audio.current };
    return () => {
      delete w.__voxel;
    };
  }, [game, input]);
  const gesture = () => {
    audio.current?.unlock();
    audio.current?.configure(settings);
    if (mode === "title") audio.current?.play("title");
  };
  const enterPlay = useCallback(
    (g: VoxelGame) => {
      gameRef.current = g;
      setGame(g);
      setSnap(g.snapshot());
      setMode("play");
      modeRef.current = "play";
      input.clear();
      audio.current?.unlock();
      audio.current?.configure(settings);
      audio.current?.play(g.def.music);
      stage.current?.focus();
      if (!touch && settings.look === "lock") input.requestLock();
    },
    [input, settings, touch],
  );
  const start = useCallback(
    (continuing: boolean, world?: number) => {
      if (!ready || failed) return;
      if (!continuing && saved && !replacing) {
        setReplacing(true);
        return;
      }
      const p = continuing && saved ? structuredClone(saved) : newSave(hero, difficulty);
      p.settings = { ...settings };
      if (world) {
        p.world = world;
        p.checkpoint = 0;
        p.keys = [];
        p.finished = false;
      }
      const next = new VoxelGame(p);
      next.sound = (s) => audio.current?.effect(s);
      next.start();
      setReplacing(false);
      enterPlay(next);
    },
    [ready, failed, saved, replacing, hero, difficulty, settings, enterPlay],
  );
  const resume = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    g.resume();
    setHelp(false);
    enterPlay(g);
  }, [enterPlay]);
  const quit = () => {
    game?.pause();
    setSaved(readSave());
    modeRef.current = "title";
    setMode("title");
    input.clear();
    input.releaseLock();
    audio.current?.play("title");
  };
  useEffect(() => {
    if (mode === "play") return;
    let old: boolean[] = [];
    const timer = setInterval(() => {
      const p = Array.from(navigator.getGamepads?.() ?? []).find((p) => p?.connected && p.mapping === "standard");
      if (!p) return;
      const pressed = (i: number) => p.buttons[i]?.pressed && !old[i];
      if (pressed(0) || pressed(9)) {
        if (mode === "pause") resume();
        else start(!!saved);
      }
      if (mode === "title" && (pressed(14) || pressed(15)))
        setHero((h) => HEROES[(HEROES.findIndex((x) => x.kind === h) + (pressed(14) ? 2 : 1)) % 3].kind);
      old = p.buttons.map((b) => b.pressed);
    }, 100);
    return () => clearInterval(timer);
  }, [mode, saved, start, resume]);
  const rescue = snap?.rescue ? FRIEND_BY_ID[snap.rescue] : null;
  const modal = mode === "pause" || !!rescue || (!!snap?.finished && mode === "play") || help || replacing;
  useEffect(() => {
    if (!modal) return;
    input.releaseLock();
    const timer = setTimeout(() => stage.current?.querySelector<HTMLElement>('[role="dialog"] button')?.focus(), 0);
    return () => clearTimeout(timer);
  }, [modal, input]);
  const trap = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const els = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("button,a,input,select,summary")).filter((x) => x.getClientRects().length);
    const first = els[0],
      last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  };
  const set = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));
  return (
    <div
      className="vx-stage"
      ref={stage}
      tabIndex={-1}
      data-testid="voxel"
      data-ready={ready}
      data-mode={mode}
      data-world={snap?.world}
      data-rendered-world={renderedWorld}
      data-locked={locked}
      aria-label="Portal Hoppers: Blocky Worlds"
    >
      <div className="vx-canvas" aria-hidden="true">
        {game && !failed && (
          <Boundary onFailure={failure}>
            <Scene game={game} input={input} title={mode === "title"} hero={hero} quality={settings.quality} onReady={onReady} onFailure={failure} onPause={pause} />
          </Boundary>
        )}
      </div>
      {mode === "title" && !failed && (
        <div className="vx-title">
          <header className="vx-header">
            <Link href="/" className="vx-brand">
              TOLLEY <span>/ PLAY</span>
            </Link>
            <a href="/game">Back to the current game ↗</a>
          </header>
          <div className="vx-title-copy">
            <div className="vx-kicker">
              <span>✦</span> BIG BLOCKS. BRIGHT WORLDS. <span className="vx-preview">PREVIEW</span>
            </div>
            <h1>
              Portal
              <br />
              <em>Hoppers</em>
              <b>Blocky Worlds</b>
            </h1>
            <p className="vx-tagline">
              Keys. Levers. Cubo.
              <br /> <span>No shortcuts.</span>
            </p>
            <p className="vx-story">
              Captain Clank locked the factory tight. Find three keys, pull the levers, free Zippy, and open the vault portal. Aim with the mouse — it matters now.
            </p>
            <fieldset className="vx-heroes">
              <legend>WHO’S HOPPING IN?</legend>
              {HEROES.map((h) => (
                <button
                  key={h.kind}
                  aria-pressed={hero === h.kind}
                  onClick={() => {
                    setHero(h.kind);
                    gesture();
                    audio.current?.effect("select");
                  }}
                >
                  <span className={`vx-hero-dot ${h.kind}`}>{h.kind === "frog" ? "✿" : h.kind === "fox" ? "◆" : "✦"}</span>
                  <span>
                    {h.name}
                    <small>{h.kind === "frog" ? "Springy & brave" : h.kind === "fox" ? "Clever & quick" : "Cool & curious"}</small>
                  </span>
                </button>
              ))}
            </fieldset>
            <div className="vx-difficulty">
              <label>
                Challenge{" "}
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
                  <option value="challenge">Super Hopper</option>
                  <option value="adventure">Adventure</option>
                </select>
              </label>
              <small>{difficulty === "challenge" ? "3 hearts · 8-hit cages · no checkpoint before bosses" : "5 hearts · 6-hit cages · more checkpoints"}</small>
            </div>
            <div className="vx-play-buttons">
              {saved && (
                <button className="vx-primary" disabled={!ready} onClick={() => start(true)}>
                  Continue adventure <span>➜</span>
                </button>
              )}
              <button className={saved ? "vx-secondary" : "vx-primary"} disabled={!ready} onClick={() => start(false)}>
                {ready ? (saved ? "New adventure" : "Let’s play!") : "Stacking the blocks…"} <span>➜</span>
              </button>
            </div>
            <div className="vx-title-links">
              <button
                onClick={() => {
                  gesture();
                  setHelp(true);
                }}
              >
                How to play
              </button>
              <button
                onClick={() => {
                  gesture();
                  set({ muted: !settings.muted });
                }}
                aria-pressed={!settings.muted}
              >
                {settings.muted ? "♫ Sound off" : "♫ Music & sound on"}
              </button>
            </div>
            {saved && saved.unlocked > 1 && (
              <details className="vx-world-picker">
                <summary>Revisit a world</summary>
                <div>
                  {WORLDS.slice(0, saved.unlocked).map((w) => (
                    <button key={w.id} onClick={() => start(true, w.id)}>
                      {w.id}. {w.name}
                    </button>
                  ))}
                </div>
              </details>
            )}
          </div>
          <div className="vx-title-badge">
            <span>★</span>
            <div>
              Same friends.
              <br />
              <strong>Way harder.</strong>
            </div>
          </div>
          <footer className="vx-title-footer">
            <span>
              FIND KEYS <b>✦</b> FREE FRIENDS <b>✦</b> HOP WORLDS
            </span>
            <span>Preview build · Saves on this device</span>
          </footer>
        </div>
      )}
      {mode !== "title" && snap && game && !failed && (
        <>
          <div className="vx-hud">
            <div className="vx-status">
              <div className="vx-hearts" aria-label={`${snap.hearts} of ${snap.maxHearts} hearts`}>
                {Array.from({ length: snap.maxHearts }, (_, i) => (
                  <span key={i} className={i >= snap.hearts ? "empty" : ""}>
                    ♥
                  </span>
                ))}
                <span className="vx-sparks" aria-label={`${snap.sparks} sparks`}>
                  {[0, 1, 2].map((i) => (
                    <span key={i} className={i >= snap.sparks ? "spent" : ""}>
                      ✦
                    </span>
                  ))}
                </span>
              </div>
              <div className="vx-score">
                <span>● {snap.coins}</span>
                <span>
                  Keys
                  <span className="vx-keys" aria-label={`${snap.keys} of ${snap.keysNeeded} keys`}>
                    {Array.from({ length: snap.keysNeeded }, (_, i) => (
                      <span key={i} className={i < snap.keys ? "got" : ""}>
                        🔑
                      </span>
                    ))}
                  </span>
                </span>
                <span>★ {snap.stars}</span>
                <span>Friends {snap.rescued.length}/15</span>
              </div>
              {game.has("glide") && (
                <div className="vx-stamina" aria-label="Glide stamina">
                  <i style={{ width: `${Math.round(snap.stamina * 100)}%` }} />
                </div>
              )}
            </div>
            <div className="vx-world-heading">
              <span>WORLD {snap.world} / 10</span>
              <strong>{snap.worldName}</strong>
            </div>
            <button className="vx-pause" aria-label="Pause game" onClick={pause}>
              Ⅱ
            </button>
          </div>
          <div className="vx-objective">
            <span>LET’S DO THIS</span>
            <strong>{snap.objective}</strong>
            <small>{snap.portalOpen ? "E by the portal to travel" : snap.hasCubo ? "Shift / E: Cubo lift · Q or wheel: switch power" : "WASD move · Space jump · X / click bash · E levers"}</small>
          </div>
          {snap.message && !rescue && (
            <div className="vx-message" role="status">
              <b>{snap.hasCubo ? "CUBO" : "PORTAL HOPPERS"}</b>
              {snap.message}
            </div>
          )}
          <div className="vx-power">
            <button
              onClick={() => {
                game.cyclePower();
                stage.current?.focus();
              }}
              aria-label="Switch power"
            >
              <span>✦</span>
              <div>
                <small>POWER WHEEL · Q</small>
                <strong>{snap.active ? FRIENDS.find((f) => f.power === snap.active)?.powerName : "Rescue a friend!"}</strong>
              </div>
            </button>
            {snap.active && <span className="vx-power-key">{snap.powerCooldown > 0 ? `${snap.powerCooldown}s` : "C"}</span>}
          </div>
          {snap.bossHP > 0 && (
            <div className="vx-boss-meter">
              <span>{snap.bossName}</span>
              <meter min={0} max={snap.bossMax} value={snap.bossHP} />
            </div>
          )}
          {!touch && mode === "play" && !modal && <div className="vx-reticle" data-aim={snap.aim} aria-hidden="true" />}
          {!touch && mode === "play" && !modal && settings.look === "lock" && !locked && <div className="vx-lockhint">Click the world to capture your mouse</div>}
          {!touch && <div className="vx-controls-hint">WASD move · Space jump (hold still to charge Ultra) · X / click bash · E use · Shift Cubo lift · Esc pause</div>}
          {touch && mode === "play" && !modal && <TouchControls input={input} />}
          {snap.saveFailed && <p className="vx-save-warning">This browser couldn’t save progress. Keep this tab open to continue.</p>}
        </>
      )}
      {modal && !failed && (
        <div className="vx-modal-backdrop">
          <section
            className="vx-modal"
            role="dialog"
            aria-modal="true"
            aria-label={rescue ? "Friend rescued" : help ? "How to play" : replacing ? "Start a new adventure" : snap?.finished ? "Everybody is home" : "Game paused"}
            onKeyDown={trap}
          >
            {rescue ? (
              <>
                <span className="vx-modal-icon">★</span>
                <p className="vx-kicker">A FRIEND FREE. A NEW POSSIBILITY.</p>
                <h2>{rescue.name} is free!</h2>
                <p>{rescue.thanks}</p>
                <div className="vx-earned">
                  <small>POWER UNLOCKED</small>
                  <strong>{rescue.powerName}</strong>
                  <p>
                    {rescue.passive ? "Your new power is ready automatically." : "Press C to use it (costs a spark). Q or the mouse wheel picks another power."}
                    {rescue.power === "doubleJump" ? " Press jump again in midair." : rescue.power === "glide" ? " Hold jump to glide while the stamina bar lasts." : ""}
                  </p>
                </div>
                <button className="vx-primary" onClick={resume}>
                  Let’s keep hopping! ➜
                </button>
              </>
            ) : replacing ? (
              <>
                <h2>A fresh adventure?</h2>
                <p>This replaces your saved Blocky Worlds journey. Your other Portal Hoppers saves stay safe.</p>
                <button className="vx-primary" onClick={() => start(false)}>
                  Start new adventure
                </button>
                <button className="vx-secondary" onClick={() => setReplacing(false)}>
                  Keep my adventure
                </button>
              </>
            ) : help ? (
              <>
                <p className="vx-kicker">SMALL HERO. BIG BLOCKS.</p>
                <h2>Let’s learn to hop.</h2>
                <p>Every world hides three keys behind levers and puzzles. Bash cages open to free friends and earn their powers. With every key and friend, the vault portal opens.</p>
                <div className="vx-instructions">
                  <p>
                    <kbd>WASD / arrows</kbd> Move · one-block ledges are a step, taller ones are a jump
                  </p>
                  <p>
                    <kbd>Space / A</kbd> Jump · stand still, hold, then release for an Ultra Jump (3 blocks)
                  </p>
                  <p>
                    <kbd>Mouse</kbd> Look and aim · the crosshair turns gold on something you can hit
                  </p>
                  <p>
                    <kbd>X / click</kbd> Bash cages, levers and baddies
                  </p>
                  <p>
                    <kbd>E / Y</kbd> Pull levers · enter the portal · ask Cubo for a lift
                  </p>
                  <p>
                    <kbd>Shift / RB</kbd> Cubo lift: he slides under you and grows into a pillar
                  </p>
                  <p>
                    <kbd>C / B</kbd> Use a power (costs a spark ✦) · Q, wheel or LB changes it
                  </p>
                </div>
                <p>Sparks refill at checkpoints and every 15 coins. Crumbling floors fall after a moment. There is a sky ceiling — flying over a puzzle is not a plan.</p>
                <button className="vx-primary" onClick={() => (mode === "pause" ? setHelp(false) : setHelp(false))}>
                  Got it! ➜
                </button>
              </>
            ) : snap?.finished ? (
              <>
                <span className="vx-modal-icon">✦</span>
                <p className="vx-kicker">PREVIEW COMPLETE</p>
                <h2>You cleared the factory, Hopper!</h2>
                <p>
                  That’s every world in this preview build. You rescued {snap.rescued.length} friends and found {snap.stars} secret stars. More worlds are on the way.
                </p>
                <button className="vx-primary" onClick={quit}>
                  Back to the portals ➜
                </button>
              </>
            ) : (
              <>
                <p className="vx-kicker">THE NEXT HOP CAN WAIT</p>
                <h2>Taking a breather?</h2>
                <p>Your friends will be right here.</p>
                <button className="vx-primary" onClick={resume}>
                  Keep hopping ➜
                </button>
                <div className="vx-settings">
                  <label>
                    <span>Music</span>
                    <input aria-label="Music volume" type="range" min="0" max="1" step=".05" value={settings.music} onChange={(e) => set({ music: Number(e.target.value) })} />
                  </label>
                  <label>
                    <span>Sound effects</span>
                    <input aria-label="Sound effects volume" type="range" min="0" max="1" step=".05" value={settings.effects} onChange={(e) => set({ effects: Number(e.target.value) })} />
                  </label>
                  <label>
                    <span>Mute everything</span>
                    <input type="checkbox" checked={settings.muted} onChange={(e) => set({ muted: e.target.checked })} />
                  </label>
                  <label>
                    <span>Graphics</span>
                    <select value={settings.quality} onChange={(e) => set({ quality: e.target.value as Settings["quality"] })}>
                      <option value="high">High</option>
                      <option value="low">Low</option>
                    </select>
                  </label>
                  {!touch && (
                    <>
                      <label>
                        <span>Mouse look</span>
                        <select value={settings.look} onChange={(e) => set({ look: e.target.value as Settings["look"] })}>
                          <option value="lock">Capture the mouse (recommended)</option>
                          <option value="drag">Drag to look</option>
                        </select>
                      </label>
                      <label>
                        <span>Sensitivity</span>
                        <input aria-label="Mouse sensitivity" type="range" min="0.25" max="3" step=".05" value={settings.sensitivity} onChange={(e) => set({ sensitivity: Number(e.target.value) })} />
                      </label>
                      <label>
                        <span>Invert up/down</span>
                        <input type="checkbox" checked={settings.invertY} onChange={(e) => set({ invertY: e.target.checked })} />
                      </label>
                    </>
                  )}
                </div>
                <div className="vx-modal-links">
                  <button
                    onClick={() => {
                      game?.resetCheckpoint();
                      resume();
                    }}
                  >
                    Return to checkpoint
                  </button>
                  <button onClick={() => setHelp(true)}>Controls</button>
                  <button onClick={quit}>Save & title</button>
                  <button onClick={() => void stage.current?.requestFullscreen?.().catch(() => {})}>Full screen</button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
      {failed && (
        <div className="vx-modal-backdrop">
          <section className="vx-modal" role="alert">
            <h2>This portal needs a little help.</h2>
            <p>The 3D world couldn’t load. Try reloading with hardware acceleration enabled, or hop into the current game.</p>
            <button className="vx-primary" onClick={() => location.reload()}>
              Try again
            </button>
            <a className="vx-secondary" href="/game">
              Play Portal Hoppers
            </a>
          </section>
        </div>
      )}
      {!ready && !failed && (
        <div className="vx-loading" role="status">
          <span>✦</span> Stacking the blocks. Waking the heroes…
        </div>
      )}
    </div>
  );
}
