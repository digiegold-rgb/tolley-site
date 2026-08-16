/**
 * scripts/demo-clips.ts — Jelly Studio demo-clip queue.
 *
 * Cuts ~30s highlight clips out of finished Vater library videos (Trey's +
 * Jared's — consent on file in ~/vater-studio/demo-clips/CONSENT.md), renders
 * the 16:9 + vertical (reels-frame) versions for $0 with ffmpeg, stages them
 * with review links, and publishes staged clips to the Jelly Studio Facebook
 * Page as Reels. Read-only against the prod DB.
 *
 *   npx tsx scripts/demo-clips.ts list                 # finished videos + clip state
 *   npx tsx scripts/demo-clips.ts cut <#N|projectId> [--scenes A-B | --start S --end E] [--target 30] [--no-notify]
 *   npx tsx scripts/demo-clips.ts auto [--max 2]       # stage every un-clipped video, newest first
 *   npx tsx scripts/demo-clips.ts queue                # what is staged / posted
 *   npx tsx scripts/demo-clips.ts post <clipId|--next> # publish to the Jelly Studio Page as a Reel
 *   npx tsx scripts/demo-clips.ts reject <clipId> [reason]
 *   npx tsx scripts/demo-clips.ts recut <clipId> --scenes A-B   # new window, same project
 *
 * Wrapper: ~/bin/demo-clip.sh <args>
 */
import { prisma } from "../lib/prisma";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const HOME = os.homedir();
const DATA = path.join(HOME, "vater-studio/demo-clips");
const CACHE = path.join(DATA, "cache");
const OUT = path.join(DATA, "out");
const QUEUE = path.join(DATA, "queue.jsonl");
const REVIEW_DIR = path.join(HOME, "growth-engine/shorts/review/jelly/demo-clips");
const REVIEW_BASE = "https://gx10-adc6.taile5cde9.ts.net:8444/jelly/demo-clips/";
const FRAME = path.join(HOME, "tolley-site/public/animate/brand/reels-frame-1080x1920.png");
const FB_PAGE = "1250965801434969";
const TG_CHAT = "1680894605";
const OWNERS: Record<string, string> = {
  cmnzgxvoy0000l4r6fyuatyku: "Trey",
  cmmhct5mx0000kw04xpmf84ss: "Jared",
};
const EXCLUDE = /internal|smoke test|do-not-ship|wealth-in-30s/i;

type Scene = { idx?: number; beatText?: string; startS?: number; endS?: number };
type Win = { i: number; j: number; start: number; end: number; dur: number; score: number; hook: string; reasons: string[] };
type Clip = {
  clipId: string; projectId: string; libNo: number | null; title: string; owner: string;
  window: { start: number; end: number; scenes: [number, number]; dur: number };
  candidates: Win[]; caption: string;
  files: { wide: string; vertical: string; poster: string };
  review: { wide: string; vertical: string; poster: string };
  status: "staged" | "posted" | "rejected"; createdAt: string;
  postedAt?: string; fbVideoId?: string; fbUrl?: string; note?: string;
};

for (const d of [DATA, CACHE, OUT, REVIEW_DIR]) fs.mkdirSync(d, { recursive: true });

const readQueue = (): Clip[] => fs.existsSync(QUEUE) ? fs.readFileSync(QUEUE, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)) : [];
const writeQueue = (q: Clip[]) => fs.writeFileSync(QUEUE, q.map(c => JSON.stringify(c)).join("\n") + (q.length ? "\n" : ""));
const envVal = (file: string, key: string) => {
  const m = fs.readFileSync(file, "utf8").split("\n").find(l => l.startsWith(key + "="));
  return m ? m.slice(key.length + 1).trim().replace(/^["']|["']$/g, "") : "";
};
const libNoOf = (t: string | null) => { const m = (t || "").match(/^#(\d+)\s+—/); return m ? Number(m[1]) : null; };
const cleanTitle = (t: string | null) => (t || "").replace(/^#\d+\s+—\s+/, "").replace(/^#L\d+\s+—\s+/, "").replace(/\s*\((v\d+[^)]*|internal[^)]*)\)\s*$/i, "").trim();
const sh = (cmd: string, args: string[], opts: any = {}) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"], ...opts }).toString();
const probeDur = (f: string) => Number(sh("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).trim());

async function finished() {
  const rows = await prisma.youTubeProject.findMany({
    where: { status: "ready", finalVideoUrl: { not: null }, projectType: "youtube", userId: { in: Object.keys(OWNERS) } },
    select: { id: true, userId: true, sourceTitle: true, publishTitle: true, audioDuration: true, completedAt: true, finalVideoUrl: true, scenesJson: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.filter(r => !EXCLUDE.test((r.publishTitle || r.sourceTitle || "")));
}

function scoreWindows(scenes: Scene[], target: number, minLen: number, maxLen: number, total: number): Win[] {
  const S = scenes.filter(s => typeof s.startS === "number" && typeof s.endS === "number");
  if (!S.length) return [];
  const wins: Win[] = [];
  const isHooky = (t: string) => {
    const r: string[] = []; let s = 0;
    if (/\?/.test(t)) { s += 3; r.push("question"); }
    if (/\$|\d|%|percent|thousand|million/i.test(t)) { s += 2; r.push("number"); }
    if (/\b(you|your|you're|you've)\b/i.test(t)) { s += 2; r.push("you"); }
    if (/(most people|nobody|no one|never|secret|truth|mistake|trap|quiet|hardest|wrong|actually|really|problem|why )/i.test(t)) { s += 2; r.push("tension"); }
    if (t.split(/\s+/).length <= 14) { s += 1; r.push("short"); }
    return { s, r };
  };
  for (let i = 0; i < S.length; i++) {
    for (let j = i; j < S.length; j++) {
      const start = S[i].startS!, end = S[j].endS!, dur = end - start;
      if (dur < minLen) continue;
      if (dur > maxLen) break;
      const h = isHooky(S[i].beatText || "");
      const reasons = [...h.r];
      let score = h.s - Math.abs(dur - target) / 6;
      const prev = i > 0 ? (S[i - 1].beatText || "").trim() : "";
      const startsClean = /^["“$(]?[A-Z0-9]/.test((S[i].beatText || "").trim()) && (i === 0 || /[.!?]["”']?\s*$/.test(prev));
      if (!startsClean) { score -= 6; reasons.push("mid-sentence"); }
      if (/^(but|and|so|because|which|or|then)\b/i.test((S[i].beatText || "").trim())) { score -= 2.5; reasons.push("conjunction-open"); }
      if (/[.!?]["']?\s*$/.test((S[j].beatText || "").trim())) { score += 2; reasons.push("clean-out"); }
      if (j === S.length - 1) { score -= 1.5; reasons.push("hits-outro"); }
      if (i === 0) { score += 0.5; reasons.push("cold-open"); }
      wins.push({ i, j, start: +start.toFixed(2), end: +end.toFixed(2), dur: +dur.toFixed(2), score: +score.toFixed(2), hook: (S[i].beatText || "").slice(0, 110), reasons });
    }
  }
  if (!wins.length && total <= maxLen + 4) wins.push({ i: 0, j: S.length - 1, start: 0, end: +total.toFixed(2), dur: +total.toFixed(2), score: 0, hook: (S[0].beatText || "").slice(0, 110), reasons: ["whole-video"] });
  return wins.sort((a, b) => b.score - a.score).slice(0, 5);
}

function caption(title: string, secs: number) {
  const n = Math.round(secs);
  const openers = [
    `${n} seconds of a real render from the studio — "${title}".`,
    `"${title}" — ${n} seconds straight out of the studio, no stock footage.`,
    `From "${title}": ${n} seconds of a finished render.`,
  ];
  const o = openers[title.length % openers.length];
  return `${o}\nScript in, cloned voice, every scene generated for the words, cut hard to the narration.\n#facelessvideo #aivideo #videoproduction`;
}

async function fetchFinal(id: string, url: string) {
  const f = path.join(CACHE, `${id}.mp4`);
  if (!fs.existsSync(f) || fs.statSync(f).size < 1000) { console.log(`  ↓ ${url.split("?")[0].split("/").pop()}`); sh("curl", ["-fsSL", "-o", f, url]); }
  return f;
}

function render(src: string, clipId: string, start: number, dur: number) {
  const wide = path.join(OUT, `${clipId}-16x9.mp4`), vert = path.join(OUT, `${clipId}-9x16.mp4`), poster = path.join(OUT, `${clipId}-poster.jpg`);
  const fo = Math.max(0.5, dur - 0.6).toFixed(3);
  sh("ffmpeg", ["-loglevel", "error", "-y", "-ss", String(start), "-t", String(dur), "-i", src,
    "-vf", `scale=1280:720:flags=lanczos,fps=30,fade=t=in:st=0:d=0.3,fade=t=out:st=${fo}:d=0.6`,
    "-af", `afade=t=in:st=0:d=0.2,afade=t=out:st=${fo}:d=0.6`,
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", wide]);
  sh("ffmpeg", ["-loglevel", "error", "-y", "-i", wide, "-i", FRAME, "-filter_complex",
    "[0:v]split[a][b];[a]scale=135:240:force_original_aspect_ratio=increase,crop=135:240,boxblur=6:2,scale=1080:1920:flags=bicubic,eq=brightness=-0.08[bg];[b]scale=1080:612:flags=lanczos[fg];[bg][fg]overlay=0:654[m];[m][1:v]overlay=0:0:format=auto[v]",
    "-map", "[v]", "-map", "0:a", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", vert]);
  sh("ffmpeg", ["-loglevel", "error", "-y", "-ss", (dur * 0.4).toFixed(2), "-i", wide, "-frames:v", "1", "-q:v", "2", poster]);
  for (const f of [wide, vert, poster]) fs.copyFileSync(f, path.join(REVIEW_DIR, path.basename(f)));
  return { files: { wide, vertical: vert, poster }, review: { wide: REVIEW_BASE + path.basename(wide), vertical: REVIEW_BASE + path.basename(vert), poster: REVIEW_BASE + path.basename(poster) } };
}

async function telegram(text: string) {
  const tok = envVal(path.join(HOME, "xero-ledger/.env"), "TELEGRAM_BOT_TOKEN");
  if (!tok) return;
  await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: TG_CHAT, text, disable_web_page_preview: false }) }).catch(() => {});
}

async function pageToken() {
  const ut = envVal(path.join(HOME, "tolley-site/.env.local"), "FACEBOOK_USER_TOKEN");
  const r: any = await (await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${ut}`)).json();
  const p = (r.data || []).find((x: any) => x.id === FB_PAGE);
  if (!p) throw new Error("Jelly Studio page not in /me/accounts: " + JSON.stringify(r.error || r));
  return p.access_token as string;
}

async function postReel(file: string, text: string) {
  const tok = await pageToken();
  const form = (o: Record<string, string>) => new URLSearchParams(o);
  const start: any = await (await fetch(`https://graph.facebook.com/v21.0/${FB_PAGE}/video_reels`, { method: "POST", body: form({ upload_phase: "start", access_token: tok }) })).json();
  if (!start.video_id) throw new Error("reel start: " + JSON.stringify(start));
  const size = fs.statSync(file).size;
  const up: any = await (await fetch(start.upload_url, { method: "POST", headers: { Authorization: `OAuth ${tok}`, offset: "0", file_size: String(size) }, body: fs.readFileSync(file) })).json();
  if (!up.success) throw new Error("reel upload: " + JSON.stringify(up));
  const fin: any = await (await fetch(`https://graph.facebook.com/v21.0/${FB_PAGE}/video_reels`, { method: "POST", body: form({ access_token: tok, video_id: start.video_id, upload_phase: "finish", video_state: "PUBLISHED", description: text }) })).json();
  if (fin.error) throw new Error("reel finish: " + JSON.stringify(fin));
  return { id: start.video_id as string, url: `https://www.facebook.com/reel/${start.video_id}` };
}

function arg(name: string, def?: string) { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : def; }
const has = (name: string) => process.argv.includes(name);

async function resolveProject(key: string) {
  const rows = await finished();
  const n = key.startsWith("#") ? Number(key.slice(1)) : NaN;
  const owner = (arg("--owner", "trey") || "trey").toLowerCase();
  const p = rows.find(r => r.id === key) || rows.find(r => Number.isFinite(n) && libNoOf(r.sourceTitle) === n && (OWNERS[r.userId!] || "").toLowerCase() === owner);
  if (!p) throw new Error(`no finished video matches ${key} (run 'list')`);
  return p;
}

async function cut(key: string, opts: { scenes?: string; start?: string; end?: string; target?: number; notify: boolean; note?: string }) {
  const p = await resolveProject(key);
  const scenes = (Array.isArray(p.scenesJson) ? p.scenesJson : []) as Scene[];
  const target = opts.target ?? 30, minLen = Math.max(15, target - 8), maxLen = target + 8;
  const total = p.audioDuration ?? 0;
  const cands = scoreWindows(scenes, target, minLen, maxLen, total);
  let win: Win | undefined;
  if (opts.scenes) {
    const [a, b] = opts.scenes.split("-").map(Number);
    const S = scenes.filter(s => typeof s.startS === "number");
    const sa = S[a], sb = S[b ?? a];
    if (!sa || !sb) throw new Error("scene range out of bounds");
    win = { i: a, j: b ?? a, start: sa.startS!, end: sb.endS!, dur: sb.endS! - sa.startS!, score: 0, hook: sa.beatText || "", reasons: ["manual"] };
  } else if (opts.start && opts.end) {
    win = { i: -1, j: -1, start: Number(opts.start), end: Number(opts.end), dur: Number(opts.end) - Number(opts.start), score: 0, hook: "", reasons: ["manual-time"] };
  } else win = cands[0];
  if (!win) throw new Error("no viable window (no scene timings?) — pass --start/--end");
  const src = await fetchFinal(p.id, p.finalVideoUrl!);
  const libNo = libNoOf(p.sourceTitle);
  const title = cleanTitle(p.publishTitle || p.sourceTitle);
  const clipId = `${libNo != null ? "n" + libNo : p.id.slice(-6)}-${Date.now().toString(36)}`;
  console.log(`✂ ${title} — scenes ${win.i}-${win.j} ${win.start}s→${win.end}s (${win.dur.toFixed(1)}s) [${win.reasons.join(",")}]`);
  const r = render(src, clipId, win.start, win.dur);
  const dur = probeDur(r.files.wide);
  const clip: Clip = { clipId, projectId: p.id, libNo, title, owner: OWNERS[p.userId!] || "?", window: { start: win.start, end: win.end, scenes: [win.i, win.j], dur: +dur.toFixed(2) }, candidates: cands, caption: caption(title, dur), files: r.files, review: r.review, status: "staged", createdAt: new Date().toISOString(), note: opts.note };
  const q = readQueue(); q.push(clip); writeQueue(q);
  console.log(`staged ${clipId}\n  vertical: ${r.review.vertical}\n  16:9:     ${r.review.wide}`);
  if (opts.notify) await telegram(`🎬 Demo clip staged — ${title} (${dur.toFixed(0)}s, ${clip.owner})\n${r.review.vertical}\n16:9: ${r.review.wide}\nPost: demo-clip.sh post ${clipId}`);
  return clip;
}

async function main() {
  const [cmd, a1] = process.argv.slice(2);
  if (cmd === "list") {
    const q = readQueue(); const rows = await finished();
    for (const r of rows) {
      const clips = q.filter(c => c.projectId === r.id);
      const st = clips.length ? clips.map(c => `${c.status}:${c.clipId}`).join(",") : "—";
      console.log([`#${libNoOf(r.sourceTitle) ?? "?"}`.padEnd(5), OWNERS[r.userId!]?.padEnd(5), `${Math.round(r.audioDuration ?? 0)}s`.padStart(5), `${(r.scenesJson as any[])?.length ?? 0}sc`.padStart(6), cleanTitle(r.publishTitle || r.sourceTitle).slice(0, 55).padEnd(56), r.id, st].join("  "));
    }
  } else if (cmd === "cut" || cmd === "recut") {
    let key = a1;
    if (cmd === "recut") { const c = readQueue().find(c => c.clipId === a1); if (!c) throw new Error("no such clip"); key = c.projectId; }
    await cut(key, { scenes: arg("--scenes"), start: arg("--start"), end: arg("--end"), target: arg("--target") ? Number(arg("--target")) : undefined, notify: !has("--no-notify"), note: arg("--note") });
  } else if (cmd === "auto") {
    const max = Number(arg("--max", "2")); const q = readQueue(); const rows = (await finished()).reverse();
    let n = 0;
    for (const r of rows) {
      if (n >= max) break;
      if (q.some(c => c.projectId === r.id)) continue;
      if ((r.audioDuration ?? 0) < 20) continue;
      try { await cut(r.id, { notify: !has("--no-notify") }); n++; } catch (e: any) { console.error(`skip ${r.id}: ${e.message}`); }
    }
    console.log(`auto: staged ${n}`);
  } else if (cmd === "queue") {
    for (const c of readQueue()) console.log([c.status.padEnd(8), c.clipId.padEnd(16), `#${c.libNo ?? "?"}`.padEnd(5), `${c.window.dur}s`.padStart(6), c.title.slice(0, 50).padEnd(51), c.fbUrl || c.review.vertical].join("  "));
  } else if (cmd === "post") {
    const q = readQueue();
    const c = a1 === "--next" ? q.find(c => c.status === "staged") : q.find(c => c.clipId === a1);
    if (!c) throw new Error("nothing to post"); if (c.status !== "staged") throw new Error(`clip is ${c.status}`);
    const text = arg("--caption") || c.caption;
    const r = await postReel(c.files.vertical, text);
    c.status = "posted"; c.postedAt = new Date().toISOString(); c.fbVideoId = r.id; c.fbUrl = r.url; c.caption = text; writeQueue(q);
    console.log(`posted ${c.clipId} → ${r.url}`);
    if (!has("--no-notify")) await telegram(`✅ Jelly reel posted — ${c.title} (${c.window.dur}s): ${r.url}`);
  } else if (cmd === "reject") {
    const q = readQueue(); const c = q.find(c => c.clipId === a1); if (!c) throw new Error("no such clip");
    c.status = "rejected"; c.note = process.argv.slice(4).join(" ") || c.note; writeQueue(q); console.log(`rejected ${a1}`);
  } else if (cmd === "candidates") {
    const p = await resolveProject(a1); const scenes = (p.scenesJson as Scene[]) || [];
    for (const w of scoreWindows(scenes, Number(arg("--target", "30")), 22, 38, p.audioDuration ?? 0)) console.log(`${w.score}  sc ${w.i}-${w.j}  ${w.start}→${w.end} (${w.dur}s)  [${w.reasons}]  ${w.hook}`);
  } else {
    console.log("usage: list | cut <#N|id> [--scenes A-B|--start S --end E] [--target N] | auto [--max N] | queue | post <clipId|--next> [--caption ...] | reject <clipId> [why] | recut <clipId> --scenes A-B | candidates <#N>");
  }
}
main().catch(e => { console.error("✗", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
