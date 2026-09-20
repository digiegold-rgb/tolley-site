"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent,
} from "react";
import { HEROES, FRIENDS, FRIEND_BY_ID } from "../worlds/friends";
import { LEVELS } from "../worlds/levels";
import {
  PortalGame,
  newSave,
  readSave,
  type Save,
  type Difficulty,
} from "./model";
import { PortalInput } from "./input";
import { PortalAudio } from "./audio";
import type { HeroKind } from "../engine/types";
import "./portal.css";
const Scene = dynamic(() => import("./Scene"), {
  ssr: false,
  loading: () => null,
});
class Boundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.error("Portal Hoppers scene failed", error);
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
type Mode = "title" | "play" | "pause";
function TouchControls({ input }: { input: PortalInput }) {
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
    <div className="ph-touch">
      <div
        className="ph-stick"
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
      <div className="ph-touch-actions">
        {[
          ["KeyE", "Cubo / portal"],
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
export default function PortalShell() {
  const [game, setGame] = useState<PortalGame | null>(null);
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
  const [snap, setSnap] = useState<ReturnType<PortalGame["snapshot"]> | null>(
    null,
  );
  const [settings, setSettings] = useState(newSave().settings);
  const [input] = useState(() => new PortalInput());
  const stage = useRef<HTMLDivElement>(null);
  const audio = useRef<PortalAudio | null>(null);
  const gameRef = useRef<PortalGame | null>(null);
  const modeRef = useRef<Mode>("title");
  const pause = useCallback(() => {
    const g = gameRef.current;
    if (!g || modeRef.current !== "play" || g.rescue) return;
    g.pause();
    modeRef.current = "pause";
    setMode("pause");
    input.clear();
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
    const g = new PortalGame(newSave());
    const a = new PortalAudio();
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
      setSettings(
        save?.settings ?? {
          ...newSave().settings,
          quality: coarse ? "low" : "high",
        },
      );
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
    let lastWorld = game.world.id;
    const timer = setInterval(() => {
      const snapshot = game.snapshot();
      setSnap((old) =>
        JSON.stringify(old) === JSON.stringify(snapshot) ? old : snapshot,
      );
      if (game.world.id !== lastWorld) {
        lastWorld = game.world.id;
        audio.current?.play(game.world.music);
        input.clear();
      }
      if (game.saveData.finished && modeRef.current === "play")
        audio.current?.play("finale");
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
  }, [settings, game]);
  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" ||
      !game ||
      !new URLSearchParams(location.search).has("test")
    )
      return;
    const w = window as unknown as {
      __portal3d?: {
        game: PortalGame;
        input: PortalInput;
        audio: PortalAudio | null;
      };
    };
    w.__portal3d = { game, input, audio: audio.current };
    return () => {
      delete w.__portal3d;
    };
  }, [game, input]);
  const gesture = () => {
    audio.current?.unlock();
    audio.current?.configure(settings);
    if (mode === "title") audio.current?.play("title");
  };
  const start = useCallback(
    (continuing: boolean, world?: number) => {
      if (!ready || failed) return;
      if (!continuing && saved && !replacing) {
        setReplacing(true);
        return;
      }
      const p =
        continuing && saved
          ? structuredClone(saved)
          : newSave(hero, difficulty);
      p.settings = { ...settings };
      if (world) {
        p.world = world;
        p.checkpoint = false;
        p.finished = false;
      }
      const next = new PortalGame(p);
      next.sound = (s) => audio.current?.effect(s);
      next.start();
      gameRef.current = next;
      setGame(next);
      setSnap(next.snapshot());
      setMode("play");
      modeRef.current = "play";
      setReplacing(false);
      input.clear();
      audio.current?.unlock();
      audio.current?.configure(settings);
      audio.current?.play(next.world.music);
      stage.current?.focus();
    },
    [ready, failed, saved, replacing, hero, difficulty, settings, input],
  );
  const resume = useCallback(() => {
    gameRef.current?.resume();
    input.clear();
    setMode("play");
    modeRef.current = "play";
    audio.current?.unlock();
    audio.current?.play(gameRef.current?.world.music ?? "title");
    stage.current?.focus();
  }, [input]);
  const quit = () => {
    game?.pause();
    setSaved(readSave());
    modeRef.current = "title";
    setMode("title");
    input.clear();
    audio.current?.play("title");
  };
  useEffect(() => {
    if (mode === "play") return;
    let old: boolean[] = [];
    const timer = setInterval(() => {
      const p = Array.from(navigator.getGamepads?.() ?? []).find(
        (p) => p?.connected && p.mapping === "standard",
      );
      if (!p) return;
      const pressed = (i: number) => p.buttons[i]?.pressed && !old[i];
      if (pressed(0) || pressed(9)) {
        if (mode === "pause") resume();
        else start(!!saved);
      }
      if (mode === "title" && (pressed(14) || pressed(15))) {
        setHero(
          (h) =>
            HEROES[
              (HEROES.findIndex((x) => x.kind === h) + (pressed(14) ? 2 : 1)) %
                3
            ].kind,
        );
      }
      old = p.buttons.map((b) => b.pressed);
    }, 100);
    return () => clearInterval(timer);
  }, [mode, saved, start, resume]);
  const rescue = snap?.rescue ? FRIEND_BY_ID[snap.rescue] : null;
  const modal =
    mode === "pause" ||
    !!rescue ||
    (!!snap?.finished && mode === "play") ||
    help ||
    replacing;
  useEffect(() => {
    if (!modal) return;
    const timer = setTimeout(
      () =>
        stage.current
          ?.querySelector<HTMLElement>('[role="dialog"] button')
          ?.focus(),
      0,
    );
    return () => clearTimeout(timer);
  }, [modal]);
  const trap = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const els = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>(
        "button,a,input,select,summary",
      ),
    ).filter((x) => x.getClientRects().length);
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
  return (
    <div
      className="ph-stage"
      ref={stage}
      tabIndex={-1}
      data-testid="portal-3d"
      data-ready={ready}
      data-mode={mode}
      data-world={snap?.world}
      data-rendered-world={renderedWorld}
      aria-label="Portal Hoppers 3D"
    >
      <div className="ph-canvas" aria-hidden="true">
        {game && !failed && (
          <Boundary onFailure={failure}>
            <Scene
              game={game}
              input={input}
              title={mode === "title"}
              hero={hero}
              quality={settings.quality}
              onReady={onReady}
              onFailure={failure}
              onPause={pause}
            />
          </Boundary>
        )}
      </div>
      {mode === "title" && !failed && (
        <div className="ph-title">
          <header className="ph-header">
            <Link href="/" className="ph-brand">
              TOLLEY <span>/ PLAY</span>
            </Link>
            <a href="/game/classic">Play the original 2D game ↗</a>
          </header>
          <div className="ph-title-copy">
            <div className="ph-kicker">
              <span>✦</span> YOUR FAVORITE ADVENTURE. A WHOLE NEW DIMENSION.
            </div>
            <h1>
              Portal
              <br />
              <em>Hoppers</em>
              <b>3D</b>
            </h1>
            <p className="ph-tagline">
              Big worlds.
              <br /> Little heroes. <span>Let’s hop.</span>
            </p>
            <p className="ph-story">
              Captain Clank has caged your friends! Pick your hero, find Cubo,
              and hop through ten magical worlds to bring everybody home.
            </p>
            <fieldset className="ph-heroes">
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
                  <span className={`ph-hero-dot ${h.kind}`}>
                    {h.kind === "frog" ? "✿" : h.kind === "fox" ? "◆" : "✦"}
                  </span>
                  <span>
                    {h.name}
                    <small>
                      {h.kind === "frog"
                        ? "Springy & brave"
                        : h.kind === "fox"
                          ? "Clever & quick"
                          : "Cool & curious"}
                    </small>
                  </span>
                </button>
              ))}
            </fieldset>
            <div className="ph-difficulty">
              <label>
                Challenge{" "}
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                >
                  <option value="challenge">Super Hopper</option>
                  <option value="adventure">Adventure</option>
                </select>
              </label>
              <small>
                {difficulty === "challenge"
                  ? "4 hearts · quicker hazards · tighter timing"
                  : "6 hearts · more time to learn"}
              </small>
            </div>
            <div className="ph-play-buttons">
              {saved && (
                <button
                  className="ph-primary"
                  disabled={!ready}
                  onClick={() => start(true)}
                >
                  Continue adventure <span>➜</span>
                </button>
              )}
              <button
                className={saved ? "ph-secondary" : "ph-primary"}
                disabled={!ready}
                onClick={() => start(false)}
              >
                {ready
                  ? saved
                    ? "New adventure"
                    : "Let’s play!"
                  : "Opening the portals…"}{" "}
                <span>➜</span>
              </button>
            </div>
            <div className="ph-title-links">
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
                  setSettings((s) => ({ ...s, muted: !s.muted }));
                }}
                aria-pressed={!settings.muted}
              >
                {settings.muted ? "♫ Sound off" : "♫ Music & sound on"}
              </button>
            </div>
            {saved && saved.unlocked > 1 && (
              <details className="ph-world-picker">
                <summary>Revisit a world</summary>
                <div>
                  {LEVELS.slice(0, saved.unlocked).map((w) => (
                    <button key={w.id} onClick={() => start(true, w.id)}>
                      {w.id}. {w.name}
                    </button>
                  ))}
                </div>
              </details>
            )}
          </div>
          <div className="ph-title-badge">
            <span>★</span>
            <div>
              Same friends.
              <br />
              <strong>Bigger jumps.</strong>
            </div>
          </div>
          <footer className="ph-title-footer">
            <span>
              RESCUE FRIENDS <b>✦</b> EARN POWERS <b>✦</b> HOP WORLDS
            </span>
            <span>Free to play · Saves on this device</span>
          </footer>
        </div>
      )}
      {mode !== "title" && snap && game && !failed && (
        <>
          <div className="ph-hud">
            <div className="ph-status">
              <div
                className="ph-hearts"
                aria-label={`${snap.hearts} of ${game.maxHearts} hearts`}
              >
                {Array.from({ length: game.maxHearts }, (_, i) => (
                  <span key={i} className={i >= snap.hearts ? "empty" : ""}>
                    ♥
                  </span>
                ))}
              </div>
              <div className="ph-score">
                <span>● {snap.coins}</span>
                <span>★ {snap.stars}/20</span>
                <span>Friends {snap.rescued.length}/15</span>
              </div>
            </div>
            <div className="ph-world-heading">
              <span>WORLD {snap.world} / 10</span>
              <strong>{game.world.name}</strong>
            </div>
            <button
              className="ph-pause"
              aria-label="Pause game"
              onClick={pause}
            >
              Ⅱ
            </button>
          </div>
          <div className="ph-objective">
            <span>LET’S DO THIS</span>
            <strong>{snap.objective}</strong>
            <small>
              {snap.portalOpen
                ? "E by the portal to travel"
                : game.hasCubo
                  ? "Shift / E: Cubo boost · Q: switch power"
                  : "WASD: move · Space: jump · X: bash"}
            </small>
          </div>
          {snap.message && !rescue && (
            <div className="ph-message" role="status">
              <b>{game.hasCubo ? "CUBO" : "PORTAL HOPPERS"}</b>
              {snap.message}
            </div>
          )}
          <div className="ph-power">
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
                <strong>
                  {snap.active
                    ? FRIENDS.find((f) => f.power === snap.active)?.powerName
                    : "Rescue a friend!"}
                </strong>
              </div>
            </button>
            {snap.active && (
              <span className="ph-power-key">
                {snap.powerCooldown > 0 ? `${snap.powerCooldown}s` : "C"}
              </span>
            )}
          </div>
          {snap.bossHP > 0 && game.position.z < -66 && (
            <div className="ph-boss-meter">
              <span>
                {game.world.boss === "clank"
                  ? "Captain Clank"
                  : game.world.boss === "sultan"
                    ? "Sugar Sultan"
                    : "The Whistler"}{" "}
                · Jump the ring, then bash!
              </span>
              <meter
                min={0}
                max={game.world.id === 10 ? 12 : 9}
                value={snap.bossHP}
              />
            </div>
          )}
          {!touch && (
            <div className="ph-controls-hint">
              WASD move · Space jump · X bash · E interact · Drag to look · F
              center
            </div>
          )}
          {touch && mode === "play" && !modal && (
            <TouchControls input={input} />
          )}
          {snap.saveFailed && (
            <p className="ph-save-warning">
              This browser couldn’t save progress. Keep this tab open to
              continue.
            </p>
          )}
        </>
      )}
      {modal && !failed && (
        <div className="ph-modal-backdrop">
          <section
            className="ph-modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              rescue
                ? "Friend rescued"
                : help
                  ? "How to play"
                  : replacing
                    ? "Start a new adventure"
                    : snap?.finished
                      ? "Everybody is home"
                      : "Game paused"
            }
            onKeyDown={trap}
          >
            {rescue ? (
              <>
                <span className="ph-modal-icon">★</span>
                <p className="ph-kicker">A FRIEND FREE. A NEW POSSIBILITY.</p>
                <h2>{rescue.name} is free!</h2>
                <p>{rescue.thanks}</p>
                <div className="ph-earned">
                  <small>POWER UNLOCKED</small>
                  <strong>{rescue.powerName}</strong>
                  <p>
                    {rescue.passive
                      ? "Your new power is ready automatically."
                      : "Press C to use it. Press Q to choose another power."}
                    {rescue.power === "doubleJump"
                      ? " Press jump again in midair."
                      : rescue.power === "glide"
                        ? " Hold jump to glide."
                        : ""}
                  </p>
                </div>
                <button className="ph-primary" onClick={resume}>
                  Let’s keep hopping! ➜
                </button>
              </>
            ) : replacing ? (
              <>
                <h2>A fresh adventure?</h2>
                <p>
                  This replaces your saved 3D journey. Your original 2D game
                  save stays safe.
                </p>
                <button className="ph-primary" onClick={() => start(false)}>
                  Start new adventure
                </button>
                <button
                  className="ph-secondary"
                  onClick={() => setReplacing(false)}
                >
                  Keep my adventure
                </button>
              </>
            ) : help ? (
              <>
                <p className="ph-kicker">SMALL HERO. BIG POSSIBILITIES.</p>
                <h2>Let’s learn to hop.</h2>
                <p>
                  Rescue friends by bashing their cages three times. Each friend
                  gives you a power. Bash the glowing orb three times, then hop
                  through the portal!
                </p>
                <div className="ph-instructions">
                  <p>
                    <kbd>WASD / arrows</kbd> Move in any direction
                  </p>
                  <p>
                    <kbd>Space / A</kbd> Jump · stand still, hold, then release
                    for Ultra Jump
                  </p>
                  <p>
                    <kbd>X / controller X</kbd> Bash cages, orbs, and baddies
                  </p>
                  <p>
                    <kbd>E / Y</kbd> Enter portals · ask Cubo for a boost
                  </p>
                  <p>
                    <kbd>C / B</kbd> Use your power · Q / LB changes it
                  </p>
                  <p>
                    <kbd>Drag / right stick</kbd> Look around · F centers the
                    camera
                  </p>
                </div>
                <p>
                  Jump on baddies to bounce off them. Amber rings warn you
                  before an attack. Checkpoint stars save your spot and refill
                  your hearts.
                </p>
                <button className="ph-primary" onClick={() => setHelp(false)}>
                  Got it! ➜
                </button>
              </>
            ) : snap?.finished ? (
              <>
                <span className="ph-modal-icon">✦</span>
                <p className="ph-kicker">EVERYBODY COMES HOME</p>
                <h2>You did it, Hopper!</h2>
                <p>
                  Captain Clank’s machine is off. You rescued{" "}
                  {snap.rescued.length} friends, found {snap.stars} secret
                  stars, and hopped through all ten worlds.
                </p>
                <button className="ph-primary" onClick={quit}>
                  Back to the portals ➜
                </button>
              </>
            ) : (
              <>
                <p className="ph-kicker">THE NEXT HOP CAN WAIT</p>
                <h2>Taking a breather?</h2>
                <p>Your friends will be right here.</p>
                <button className="ph-primary" onClick={resume}>
                  Keep hopping ➜
                </button>
                <div className="ph-settings">
                  <label>
                    <span>Music</span>
                    <input
                      aria-label="Music volume"
                      type="range"
                      min="0"
                      max="1"
                      step=".05"
                      value={settings.music}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          music: Number(e.target.value),
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span>Sound effects</span>
                    <input
                      aria-label="Sound effects volume"
                      type="range"
                      min="0"
                      max="1"
                      step=".05"
                      value={settings.effects}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          effects: Number(e.target.value),
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span>Mute everything</span>
                    <input
                      type="checkbox"
                      checked={settings.muted}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, muted: e.target.checked }))
                      }
                    />
                  </label>
                  <label>
                    <span>Graphics</span>
                    <select
                      value={settings.quality}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          quality: e.target.value as "high" | "low",
                        }))
                      }
                    >
                      <option value="high">High</option>
                      <option value="low">Low</option>
                    </select>
                  </label>
                </div>
                <div className="ph-modal-links">
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
                  <button
                    onClick={() =>
                      void stage.current?.requestFullscreen?.().catch(() => {})
                    }
                  >
                    Full screen
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
      {failed && (
        <div className="ph-modal-backdrop">
          <section className="ph-modal" role="alert">
            <h2>This portal needs a little help.</h2>
            <p>
              The 3D world couldn’t load. Try reloading with hardware
              acceleration enabled, or hop into the original game.
            </p>
            <button className="ph-primary" onClick={() => location.reload()}>
              Try again
            </button>
            <a className="ph-secondary" href="/game/classic">
              Play original Portal Hoppers
            </a>
          </section>
        </div>
      )}
      {!ready && !failed && (
        <div className="ph-loading" role="status">
          <span>✦</span> Painting the worlds. Waking the heroes…
        </div>
      )}
    </div>
  );
}
