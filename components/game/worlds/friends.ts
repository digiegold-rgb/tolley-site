/**
 * The 15 caged friends, the three playable heroes, and Cubo's chatter banks.
 * Every name here is original to Portal Hoppers.
 */
import type { FriendDef, FriendId, HeroKind, PowerId } from "../engine/types";

export const FRIENDS: FriendDef[] = [
  { id: "zippy", name: "Zippy", animal: "hummingbird", color: "#34d399", power: "doubleJump", powerName: "DOUBLE JUMP", powerHint: "Press JUMP again in the air.", passive: true, thanks: "Zippy: Two jumps are better than one!" },
  { id: "flutter", name: "Flutter", animal: "moth", color: "#c4b5fd", power: "glide", powerName: "GLIDE", powerHint: "Hold JUMP while falling to float.", passive: true, thanks: "Flutter: Float like a moth, land like a feather." },
  { id: "magnus", name: "Magnus", animal: "magpie", color: "#60a5fa", power: "magnet", powerName: "COIN MAGNET", powerHint: "Shiny things fly to you now.", passive: true, thanks: "Magnus: Ooh, shiny! All of it, mine— I mean, yours." },
  { id: "thump", name: "Thump", animal: "hippo", color: "#94a3b8", power: "pound", powerName: "GROUND POUND", powerHint: "Press DOWN in the air to smash.", passive: false, thanks: "Thump: Nothing stands when Thump comes down!" },
  { id: "bubbles", name: "Bubbles", animal: "pufferfish", color: "#fbbf24", power: "bubble", powerName: "BUBBLE", powerHint: "Press C to float safe in a bubble.", passive: false, thanks: "Bubbles: Puff puff! Nothing pops my bubble." },
  { id: "shelly", name: "Shelly", animal: "turtle", color: "#4ade80", power: "shield", powerName: "SHIELD", powerHint: "One free hit. Recharges on its own.", passive: true, thanks: "Shelly: Slow, steady, and very hard to hurt." },
  { id: "pixel", name: "Pixel", animal: "mouse", color: "#f9a8d4", power: "shrink", powerName: "SHRINK", powerHint: "Press C to squeeze through tiny gaps.", passive: false, thanks: "Pixel: Small is mighty! Squeak!" },
  { id: "gecko", name: "Gecko", animal: "gecko", color: "#a3e635", power: "wallCling", powerName: "WALL CLING", powerHint: "Hold toward a wall, then JUMP off it.", passive: true, thanks: "Gecko: Walls are just sideways floors." },
  { id: "skye", name: "Skye", animal: "flying squirrel", color: "#fb7185", power: "rocket", powerName: "ROCKET", powerHint: "Press C for a big boost up.", passive: false, thanks: "Skye: Up, up, and WAY up!" },
  { id: "dash", name: "Dash", animal: "cheetah cub", color: "#fdba74", power: "dash", powerName: "DASH", powerHint: "Press C to zoom forward, untouchable.", passive: false, thanks: "Dash: Blink and you'll miss me." },
  { id: "lumen", name: "Lumen", animal: "firefly", color: "#fde047", power: "glow", powerName: "GLOW", powerHint: "You light up the dark now.", passive: true, thanks: "Lumen: Dark places don't scare me. I AM the light." },
  { id: "frosty", name: "Frosty", animal: "penguin", color: "#7dd3fc", power: "freeze", powerName: "FREEZE RAY", powerHint: "Press C to freeze enemies and water.", passive: false, thanks: "Frosty: Chill out, everybody." },
  { id: "tock", name: "Tock", animal: "sloth", color: "#d6d3d1", power: "slowTime", powerName: "SLOW TIME", powerHint: "Press C and the world crawls.", passive: false, thanks: "Tock: ...take... your... time..." },
  { id: "bolt", name: "Bolt", animal: "hare", color: "#fca5a5", power: "speed", powerName: "SUPER SPEED", powerHint: "Press C to go super fast.", passive: false, thanks: "Bolt: Try to keep up!" },
  { id: "bam", name: "Bam", animal: "kangaroo", color: "#f97316", power: "megaPunch", powerName: "MEGA PUNCH", powerHint: "Press C for a wall-cracking, boss-bonking punch.", passive: false, thanks: "Bam: One punch. That's all I need." },
];

export const FRIEND_BY_ID: Record<FriendId, FriendDef> = Object.fromEntries(FRIENDS.map((f) => [f.id, f])) as Record<FriendId, FriendDef>;
export const FRIEND_BY_POWER: Record<PowerId, FriendDef> = Object.fromEntries(FRIENDS.map((f) => [f.power, f])) as Record<PowerId, FriendDef>;

export const HEROES: { kind: HeroKind; name: string; blurb: string; color: string }[] = [
  { kind: "frog", name: "Zip", blurb: "the frog — springy and brave", color: "#4ade80" },
  { kind: "fox", name: "Ember", blurb: "the fox — clever and quick", color: "#fb923c" },
  { kind: "cat", name: "Moxie", blurb: "the cat — cool under pressure", color: "#a78bfa" },
];

export function heroName(k: HeroKind): string {
  return HEROES.find((h) => h.kind === k)?.name ?? "Zip";
}

/* ── Cubo chatter ─────────────────────────────────────────────────────── */
export const CUBO_LINES = {
  friendFreed: ["Another friend! The Power Wheel grows!", "Yes! That's one more for the team!", "Cages are no match for us.", "Free! Did you see their face?"],
  heroRespawn: ["No worries — everybody wobbles.", "Back at it! I saved your spot.", "That one was tricky. Try again!", "Almost! I believe in you."],
  orbSeen: ["There's the orb! Bash it three times!", "Orb spotted! Hit it with X.", "That glowing thing opens the portal."],
  idle: ["Need a lift? Hold UP next to me.", "Press X near me and I'll boost you!", "I'm right behind you. Literally.", "Cubes make excellent friends.", "What's your favorite world so far?"],
  shortcut: ["Shortcut!", "Cube teleport!", "Zip! Right here."],
  caged: ["Hang on! I'll crack that cage!", "Nobody cages my friend!"],
  bat: ["Batter up!", "Back at ya!", "Nope!"],
};

export const WORLD_START_LINES: Record<number, string[]> = {
  1: ["Somebody freed a friend? Clank won't like that."],
  2: ["Hi! I'm Cubo. Nobody visits Star World. Can I come with you?", "Hold UP by me and I'll grow into a pillar!"],
  3: ["Whoa, no floor! Just keep falling and steer!", "The orb is above us — bounce up to it!"],
  4: ["I float. I can't dive. Tunnels are all yours!"],
  5: ["Pipes! Press DOWN on a pipe top to ride it."],
  6: ["Bouncy! Hold JUMP when you land for extra bounce!"],
  7: ["Careful. Things bite here. Jump on their heads!"],
  8: ["Everything smells like sugar. Don't eat the walls.", "If something throws hard candy, I'll bat it back."],
  9: ["It's dark. Stay close to my glow."],
  10: ["These portals keep looping. We need to jump in TOGETHER."],
};
