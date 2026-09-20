'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Component, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AdventureGame, freshProgress, readSave, type Difficulty, type Hero, type Progress, type Snapshot } from './model';
import { AdventureAudio, AdventureInput } from './input';
import './adventure.css';

const Scene = dynamic(() => import('./Scene'), { ssr: false, loading: () => <div className="adv-loading">Growing your forest…</div> });
class SceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}
const HEROES: { id: Hero; name: string; detail: string; icon: string }[] = [
  { id: 'fox', name: 'Ember', detail: 'The curious fox', icon: '🦊' },
  { id: 'frog', name: 'Zip', detail: 'The brave frog', icon: '🐸' },
  { id: 'cat', name: 'Moxie', detail: 'The clever cat', icon: '🐱' },
];
export default function AdventureShell() {
  const [game, setGame] = useState<AdventureGame | null>(null);
  const [saved, setSaved] = useState<Progress | null>(null);
  const [mode, setMode] = useState<'title' | 'play' | 'pause'>('title');
  const [hero, setHero] = useState<Hero>('fox');
  const [difficulty, setDifficulty] = useState<Difficulty>('adventure');
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [touch, setTouch] = useState(false);
  const [replace, setReplace] = useState(false);
  const [celebrated, setCelebrated] = useState(false);
  const [sceneId, setSceneId] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const [input] = useState(() => new AdventureInput());
  const audio = useRef<AdventureAudio | null>(null);
  const gameRef = useRef<AdventureGame | null>(null);
  const modeRef = useRef(mode);
  const pause = useCallback(() => {
    const g = gameRef.current; if (!g || modeRef.current !== 'play') return;
    g.paused = true; g.save(); input.clear();
    modeRef.current = 'pause'; setMode('pause');
    if (document.pointerLockElement) document.exitPointerLock();
  }, [input]);
  const failure = useCallback(() => { pause(); setFailed(true); }, [pause]);
  const sceneReady = useCallback(() => setReady(true), []);
  useEffect(() => {
    const p = readSave(); const initial = freshProgress();
    initial.settings.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let graphicsAvailable = false;
    try {
      const probe = document.createElement('canvas').getContext('webgl2');
      graphicsAvailable = !!probe;
      probe?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch { /* The recovery panel links to the 2D game. */ }
    const g = new AdventureGame(initial); gameRef.current = g;
    audio.current = new AdventureAudio();
    const timer = window.setTimeout(() => { setSaved(p); setGame(g); setSnap(g.snapshot()); setTouch(window.matchMedia('(pointer: coarse)').matches); setFailed(!graphicsAvailable); }, 0);
    return () => { clearTimeout(timer); audio.current?.dispose(); };
  }, []);
  useEffect(() => {
    if (!game || !stage.current) return;
    game.setSound(kind => audio.current?.play(kind, game.progress.settings.muted));
    const detach = input.attach(stage.current, game, pause);
    const timer = window.setInterval(() => {
      const next = game.snapshot();
      setSnap(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    }, 100);
    const save = () => { if (modeRef.current !== 'title') game.save(); };
    window.addEventListener('pagehide', save);
    return () => { detach(); clearInterval(timer); game.setSound(null); window.removeEventListener('pagehide', save); };
  }, [game, pause, input]);
  // Test hooks are opt-in and unavailable in production builds.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || !game || !new URLSearchParams(location.search).has('test')) return;
    const win = window as unknown as { __adventure?: { game: AdventureGame; input: AdventureInput } };
    win.__adventure = { game, input: input };
    return () => { delete win.__adventure; };
  }, [game, input]);
  const start = useCallback((continuing: boolean) => {
    if (!ready || failed) return;
    if (!continuing && saved && !replace) { setReplace(true); return; }
    const p = continuing && saved ? structuredClone(saved) : freshProgress(hero, difficulty);
    if (!continuing && game) p.settings = { ...game.progress.settings };
    const next = new AdventureGame(p); next.paused = false; next.save();
    gameRef.current = next; setGame(next); setSnap(next.snapshot()); setSceneId(n => n + 1);
    modeRef.current = 'play'; setMode('play'); setReplace(false); setCelebrated(p.finished);
    audio.current?.unlock(); input.clear(); stage.current?.focus();
  }, [ready, failed, saved, replace, hero, difficulty, game, input]);
  const resume = useCallback(() => {
    if (!game) return;
    input.clear(); game.setPaused(false); modeRef.current = 'play'; setMode('play'); setCelebrated(game.progress.finished);
    audio.current?.unlock(); stage.current?.focus();
  }, [game, input]);
  useEffect(() => {
    if (mode === 'play' || failed) return;
    const getPad = () => Array.from(navigator.getGamepads?.() ?? []).find(p => p?.connected && p.mapping === 'standard');
    let previous = getPad()?.buttons.map(b => b.pressed) ?? [];
    let stickHeld = false;
    const timer = window.setInterval(() => {
      const pad = getPad(); if (!pad) { previous = []; return; }
      const pressed = (n: number) => pad.buttons[n]?.pressed && !previous[n];
      if (pressed(0) || pressed(9)) { if (mode === 'pause') resume(); else start(!!saved); }
      const axis = pad.axes[0] ?? 0;
      if (mode === 'title' && (pressed(14) || pressed(15) || (!stickHeld && Math.abs(axis) > .6))) {
        const direction = pressed(14) || axis < -.6 ? -1 : 1;
        setHero(current => HEROES[(HEROES.findIndex(h => h.id === current) + direction + 3) % 3].id);
      }
      stickHeld = Math.abs(axis) > .6;
      previous = pad.buttons.map(b => b.pressed);
    }, 80);
    return () => clearInterval(timer);
  }, [mode, failed, saved, resume, start]);
  const settings = game?.progress.settings;
  const updateSettings = (patch: Partial<NonNullable<typeof settings>>) => {
    if (!game) return; Object.assign(game.progress.settings, patch); if (mode !== 'title') game.save(); setSnap(game.snapshot());
  };
  const finish = !!snap?.finished && !celebrated && mode === 'play';
  useEffect(() => { if (!finish) return; const timer = window.setTimeout(pause, 0); return () => clearTimeout(timer); }, [finish, pause]);
  return <div ref={stage} className="adv-stage" tabIndex={-1} data-testid="adventure-stage" data-mode={mode} data-ready={ready} aria-label="Portal Hoppers 3D adventure">
    <div className="adv-scene" aria-hidden="true">
      {game && !failed && <SceneBoundary key={sceneId} onFailure={failure}><Suspense fallback={<div className="adv-loading">Opening the woodland…</div>}><Scene game={game} input={input} playing={mode === 'play'} title={mode === 'title'} onPause={pause} onReady={sceneReady} onFailure={failure} /></Suspense></SceneBoundary>}
    </div>
    {mode === 'title' && !failed && <div className="adv-title-screen">
      <header className="adv-topline"><Link href="/">TOLLEY<span> / PLAY</span></Link><span className="adv-edition">A LITTLE COURAGE. A BIG ADVENTURE.</span><a href="/game/classic">Classic game ↗</a></header>
      <div className="adv-title-content">
        <div className="adv-eyebrow"><span /> AN ORIGINAL WOODLAND ADVENTURE</div>
        <h1>Portal<br /><em>Hoppers.</em></h1>
        <p className="adv-tagline">The forest has a secret.<br />Go a little further.</p>
        <p className="adv-description">Ancient doors. Curious creatures. A world waiting to wake up. Find your courage—and bring Cubo along.</p>
        {touch ? <div className="adv-touch-note"><strong>Made for keyboard, mouse, or controller.</strong><p>On a phone or tablet? The classic adventure has touch controls.</p><a className="adv-button" href="/game/classic">Play the touch adventure →</a></div> : <>
          <fieldset className="adv-heroes"><legend>CHOOSE YOUR EXPLORER</legend>{HEROES.map(h => <button key={h.id} aria-pressed={hero === h.id} onClick={() => setHero(h.id)} title={`${h.name} · ${h.detail}`}><span className="adv-hero-icon">{h.icon}</span><span>{h.name}<small>{h.detail}</small></span></button>)}</fieldset>
          <div className="adv-start-options"><label>Difficulty <select value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty)}><option value="adventure">Adventure</option><option value="challenge">Challenge</option></select></label><span>{difficulty === 'challenge' ? 'Tighter timing. Quicker foes.' : 'Explore. Learn. Rise to the challenge.'}</span></div>
          <div className="adv-start-buttons">{saved && <button className="adv-button" disabled={!ready} onClick={() => start(true)}>Continue journey <span>→</span></button>}<button className={saved ? 'adv-button adv-secondary' : 'adv-button'} disabled={!ready} onClick={() => start(false)}>{!ready ? 'Preparing the forest…' : replace ? 'Replace save & begin' : 'Begin your journey'}<span>→</span></button>{replace && <button className="adv-text-button" onClick={() => setReplace(false)}>Cancel</button>}</div>
          {replace && <p className="adv-save-warning">This starts a new 3D adventure and replaces its saved progress. Your classic save is separate.</p>}
          <p className="adv-control-summary">WASD to wander · Mouse to look · Controller: A begins, D-pad chooses</p>
        </>}
      </div>
      <div className="adv-world-label"><span>01 / WHISPERWOOD</span><strong>Follow the light.</strong><p>Three beacons. One forgotten temple.</p></div>
      <footer className="adv-title-footer"><span>EXPLORE · SOLVE · DISCOVER</span><span>Single player · Saves on this browser</span></footer>
    </div>}
    {mode !== 'title' && snap && !failed && <>
      <div className="adv-hud">
        <div className="adv-vitals"><div className="adv-hearts" aria-label={`${snap.health} of 6 hearts`}>{Array.from({ length: 6 }, (_, i) => <span key={i} className={i < snap.health ? '' : 'adv-empty'}>♥</span>)}</div><div className="adv-stamina" role="meter" aria-label="Stamina" aria-valuenow={Math.round(snap.stamina)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${snap.stamina}%` }} /></div><span className="adv-area">{snap.area}</span></div>
        <div className="adv-quest"><span>YOUR JOURNEY</span><strong>{snap.objective}</strong><small>Beacons {snap.seals}/3 <b>✧</b> Star seeds {snap.secrets}/5 {snap.boomerang && <><b>✧</b> Gale Boomerang</>}</small></div>
        <button className="adv-pause" onClick={pause} aria-label="Pause adventure">Ⅱ</button>
      </div>
      {snap.boss !== null && <div className="adv-boss"><span>HEARTWOOD GUARDIAN · {['', 'Dodge & strike', 'Reflect its seeds', 'Stun & strike'][snap.bossPhase]}</span><div><i style={{ width: `${snap.boss * 100}%` }} /></div></div>}
      {snap.timer > 0 && <div className="adv-timer">Wind chimes · {Math.ceil(snap.timer)}s</div>}
      {snap.message && <div className="adv-dialogue" role="status"><span>✦</span><p>{snap.message}</p></div>}
      {snap.prompt && <div className="adv-interact">{snap.prompt}</div>}
      {snap.locked && <div className="adv-lock">Locked · {snap.locked} <span>Tab to cycle</span></div>}
      {!snap.storageOk && <div className="adv-storage" role="status">Saving is unavailable in this browser. You can keep playing, but progress won’t survive a reload.</div>}
      <div className="adv-bottom-bar"><span><kbd>Space</kbd> Jump <kbd>Shift</kbd> Dodge <kbd>Click</kbd> Sword <kbd>Right click</kbd> Shield {snap.boomerang && <><kbd>Q</kbd> Boomerang</>}</span><span><kbd>H</kbd> Cubo’s hint <kbd>Esc</kbd> Pause</span></div>
    </>}
    {mode === 'pause' && game && !failed && <div className="adv-modal-backdrop"><section className="adv-modal" role="dialog" aria-modal="true" aria-label={snap?.finished && !celebrated ? 'Adventure complete' : 'Adventure paused'} onKeyDown={e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); resume(); }
      if (e.key === 'Tab') {
        const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button,a,input,select,summary')).filter(el => el.getClientRects().length);
        const first = items[0]; const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }}>
      <span className="adv-eyebrow">PORTAL HOPPERS / WHISPERWOOD</span>
      <h2>{snap?.finished && !celebrated ? 'The forest is awake.' : 'Take a breath.'}</h2>
      <p>{snap?.finished && !celebrated ? `You freed the guardian and restored the portal. ${snap.secrets} of 5 star seeds discovered. There’s always a little more to explore.` : 'Your journey will be right here.'}</p>
      <button className="adv-button" autoFocus onClick={() => { setCelebrated(true); resume(); }}>{snap?.finished ? 'Keep exploring' : 'Return to the forest'} <span>→</span></button>
      <div className="adv-settings">
        <label><input type="checkbox" checked={!!settings?.muted} onChange={e => updateSettings({ muted: e.target.checked })} /> Mute sound</label>
        <label><input type="checkbox" checked={!!settings?.reducedMotion} onChange={e => updateSettings({ reducedMotion: e.target.checked })} /> Reduced camera motion</label>
        <label>Graphics <select value={settings?.quality} onChange={e => updateSettings({ quality: e.target.value as 'low' | 'high' })}><option value="high">High</option><option value="low">Low</option></select></label>
        <label>Camera sensitivity <input aria-label="Camera sensitivity" type="range" min="0.3" max="2" step="0.1" value={settings?.sensitivity ?? 1} onChange={e => updateSettings({ sensitivity: Number(e.target.value) })} /></label>
      </div>
      <details><summary>Controls & tips</summary><p>WASD: move · Mouse: camera (click the world to capture it) · Space: jump · Shift: dodge · Left click: sword · Right click: shield · E: interact · Q: boomerang · Tab: lock / cycle · F: recenter camera · H: hint · R: reset puzzle stones · Escape: pause.</p><p>Controller: left stick moves, right stick looks, A jumps, B dodges, X attacks, Y interacts, LT shields, LB locks, RB throws, Back asks Cubo, left-stick click recenters, D-pad up resets stones, Start pauses.</p><p>Your shield faces the locked target, or the camera direction when standing still. Stamina powers attacks, dodges, and blocks. Watch for the amber warning ring, then dodge and counter.</p></details>
      <div className="adv-modal-actions"><button onClick={() => { game.restartCheckpoint(); resume(); }}>Return to checkpoint</button><button onClick={() => { game.save(); setSaved(readSave()); modeRef.current = 'title'; setMode('title'); }}>Save & title</button><a href="/game/classic">Classic game ↗</a></div>
    </section></div>}
    {failed && <div className="adv-modal-backdrop"><section className="adv-modal" role="alert"><span className="adv-eyebrow">LET’S FIND ANOTHER PATH</span><h2>The forest couldn’t load.</h2><p>Your saved progress is safe. Try reloading with hardware acceleration enabled, or play the classic adventure.</p><button className="adv-button" onClick={() => location.reload()}>Try again →</button><a className="adv-button adv-secondary" href="/game/classic">Play Classic</a></section></div>}
    {!game && <div className="adv-loading">Opening your adventure…</div>}
  </div>;
}
