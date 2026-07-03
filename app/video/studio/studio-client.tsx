"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { VideoSpeedChips } from "@/components/ui/VideoSpeedChips";

const API = "https://studio-api.tolley.io";
const KEY = "creator-studio-2026";

type DgxMode = "inference" | "creator" | "draft" | "unknown";
type Step = "category" | "describe" | "style" | "review" | "generating" | "done";
type GenStatus = "queued" | "generating" | "done" | "error" | "unknown";
type Tab = "create" | "queue" | "library" | "tools";

interface ModeStatus { mode: DgxMode; memoryFree: string; memoryTotal: string; comfyui: boolean; vllm: boolean; trading: number; switching?: boolean; switchTarget?: string; }

const CAMERAS = [
  { id: "none", label: "Auto" }, { id: "static", label: "Static" }, { id: "pan_left", label: "Pan Left" },
  { id: "pan_right", label: "Pan Right" }, { id: "zoom_in", label: "Zoom In" }, { id: "zoom_out", label: "Zoom Out" },
  { id: "orbit", label: "Orbit" }, { id: "tracking", label: "Tracking" }, { id: "aerial", label: "Aerial / Drone" },
] as const;

const LIGHTINGS = [
  { id: "none", label: "Auto" }, { id: "golden_hour", label: "Golden Hour" }, { id: "neon", label: "Neon / Cyberpunk" },
  { id: "studio", label: "Studio" }, { id: "natural", label: "Natural" }, { id: "dramatic", label: "Dramatic" }, { id: "moonlight", label: "Moonlight" },
] as const;

const MOODS = [
  { id: "none", label: "Auto" }, { id: "dramatic", label: "Dramatic" }, { id: "upbeat", label: "Upbeat" },
  { id: "calm", label: "Calm" }, { id: "intense", label: "Intense" }, { id: "elegant", label: "Elegant" }, { id: "mysterious", label: "Mysterious" },
] as const;

const ASPECTS = [
  { id: "landscape", label: "Landscape", size: "832×480", icon: "▬" },
  { id: "portrait", label: "Portrait", size: "480×832", icon: "▮" },
  { id: "square", label: "Square", size: "640×640", icon: "■" },
  { id: "wide", label: "Ultrawide", size: "960×416", icon: "━" },
] as const;

const DURATIONS = [
  { id: "short", label: "Short", desc: "~1.5s / 25 frames" },
  { id: "medium", label: "Medium", desc: "~2.5s / 41 frames" },
  { id: "long", label: "Long", desc: "~5s / 81 frames" },
  { id: "xlong", label: "Extended", desc: "~10s / 161 frames" },
  { id: "xxlong", label: "15s", desc: "~15s / 241 frames" },
  { id: "ultra30", label: "30s", desc: "~30s / FramePack" },
  { id: "ultra60", label: "60s", desc: "~60s / FramePack" },
] as const;

const FRAMEPACK_IDS = new Set(["ultra30", "ultra60", "xlong", "xxlong"]);

const QUALITY_PRESETS = [
  { id: "fast", label: "Fast", steps: 15, desc: "Quick preview" },
  { id: "balanced", label: "Balanced", steps: 20, desc: "Good quality" },
  { id: "quality", label: "Quality", steps: 30, desc: "Best results" },
  { id: "max", label: "Max", steps: 40, desc: "Slow but sharp" },
] as const;

const EXAMPLES: Record<string, string[]> = {
  broll: [
    "Ocean waves crashing on rocky cliffs at sunset, mist rising from the impact, seagulls in the distance",
    "Steam rising from a fresh cup of coffee on a wooden table, morning sunlight streaming through a window",
    "Cars driving on a rain-soaked city street at night, reflections of neon signs on wet asphalt",
    "Wheat field swaying in the wind at golden hour, with a distant farmhouse silhouette",
  ],
  realestate: [
    "A modern kitchen with white marble countertops, stainless steel appliances, and pendant lights over an island",
    "Aerial view of a ranch-style home with a large backyard, in-ground pool, and mature oak trees",
    "A cozy living room with a stone fireplace, hardwood floors, and floor-to-ceiling windows overlooking a forest",
  ],
  product: [
    "A matte-black wireless speaker rotating slowly on a white pedestal, soft studio lighting with subtle reflections",
    "A pair of running shoes on a concrete surface with dramatic side lighting and shallow depth of field",
    "A glass perfume bottle catching prismatic light refractions on a dark reflective surface",
  ],
  social: [
    "A hand placing a vibrant acai bowl on a marble countertop, overhead shot, colorful toppings being sprinkled",
    "Someone unboxing a product from a premium matte-black package, close-up hands revealing the item inside",
    "A smoothie being poured into a glass in slow motion, berries and ice splashing, bright kitchen background",
  ],
  nature: [
    "A misty mountain valley at dawn, fog rolling between pine-covered ridges, golden light breaking through clouds",
    "A crystal-clear mountain stream flowing over smooth rocks, autumn leaves floating on the surface",
    "Northern lights dancing across an Arctic sky above a frozen lake, green and purple aurora reflections",
  ],
  custom: [
    "A cyberpunk cityscape at night with flying cars, holographic billboards, rain falling through neon light",
    "An astronaut floating in space with Earth reflected in the visor, stars slowly rotating in background",
  ],
};

const DEFAULT_NEGATIVE = "blurry, low quality, distorted, watermark, text overlay, ugly, deformed, amateur, shaky camera, oversaturated, underexposed";

// ── Prompt Builder templates ──
const PB_SUBJECTS = [
  { id: "", label: "Custom..." },
  { id: "real_estate_ext", label: "Home exterior", template: "A beautiful {style} home with {details}, photographed from the street" },
  { id: "real_estate_int", label: "Home interior", template: "A spacious {room} with {details}, {flooring} floors" },
  { id: "real_estate_aerial", label: "Aerial property", template: "Aerial drone shot of a {style} property with {details}, neighborhood visible" },
  { id: "real_estate_walk", label: "Walkthrough", template: "Cinematic walkthrough of a {style} home, moving through {room} into {room2}" },
  { id: "product_hero", label: "Product showcase", template: "A {product} on a {surface}, {lighting_detail}" },
  { id: "product_rotate", label: "Product rotation", template: "A {product} slowly rotating on a white pedestal, studio lighting" },
  { id: "cityscape", label: "City / urban", template: "A {time} cityscape with {details}, {atmosphere}" },
  { id: "nature_landscape", label: "Nature landscape", template: "A breathtaking {scene} at {time}, {atmosphere}, {details}" },
  { id: "social_hook", label: "Social media hook", template: "Eye-catching shot of {subject}, {action}, vibrant and engaging" },
  { id: "food_bev", label: "Food / beverage", template: "A {item} on a {surface}, {lighting_detail}, {atmosphere}" },
] as const;

const PB_STYLES = ["Modern", "Craftsman", "Colonial", "Ranch", "Contemporary", "Luxury", "Farmhouse", "Mid-century", "Victorian", "Minimalist"];
const PB_ROOMS = ["living room", "kitchen", "master bedroom", "bathroom", "dining room", "office", "backyard", "patio", "garage", "foyer"];
const PB_DETAILS_HOME = ["large windows", "hardwood floors", "granite countertops", "stainless appliances", "vaulted ceilings", "crown molding", "open floor plan", "stone fireplace", "built-in shelving", "natural light"];
const PB_SURFACES = ["white marble", "dark wood table", "concrete", "brushed metal", "glass pedestal", "natural stone", "linen fabric"];
const PB_TIMES = ["golden hour", "dawn", "dusk", "midday", "blue hour", "night", "overcast afternoon", "stormy"];
const PB_ATMOSPHERES = ["fog rolling through", "warm sunlight", "dramatic clouds", "rain-soaked streets", "snow falling gently", "lens flare", "volumetric light", "neon reflections"];
const PB_CAMERA_TERMS = ["shot on ARRI Alexa", "anamorphic lens", "35mm film grain", "shallow depth of field", "rack focus", "steadicam", "crane shot", "drone perspective", "handheld documentary style"];
const PB_QUALITY = ["4K cinematic quality", "professional cinematography", "commercial quality", "documentary quality", "editorial quality"];

const IMAGE_MODELS_LIST = [
  { id: "flux_schnell", label: "FLUX.1 Schnell", desc: "Fast preview, ~5s", steps: 4, quality: "6-7/10", bestFor: "Quick previews, social media drafts, testing compositions before committing time", tier: "draft" },
  { id: "wan13_still", label: "Wan 2.1 1.3B Still", desc: "Wan style draft, ~1 min", steps: 20, quality: "6-7/10", bestFor: "Quick Wan-style stills, matching video thumbnails, testing Wan aesthetic", tier: "draft" },
  // flux2_klein disabled: needs Qwen3-4B text encoder (not yet downloaded)
  { id: "flux2_dev", label: "FLUX.2 Dev 32B", desc: "Best photorealism, ~2 min", steps: 28, quality: "9-10/10", bestFor: "Magazine-quality photorealism, 4MP output, Mistral 3 encoder — the best open image model", tier: "best" },
  { id: "wan22_still", label: "Wan 2.2 14B Still", desc: "Cinema-grade still, ~4 min", steps: 25, quality: "9-10/10", bestFor: "Cinema-grade stills with Wan texture quality, matching thumbnails to Wan videos", tier: "best" },
] as const;

const IMAGE_MODEL_IDS: Set<string> = new Set(IMAGE_MODELS_LIST.map(m => m.id));
const VIDEO_TO_IMAGE_MODEL: Record<string, string> = {
  wan22: "wan22_still", wan14b: "wan22_still", "wan1.3b": "wan13_still",
  flux_dev: "flux2_dev", flux_schnell: "flux_schnell",
};
function resolveImageModel(id?: string): string | undefined {
  if (!id) return undefined;
  if (IMAGE_MODEL_IDS.has(id)) return id;
  return VIDEO_TO_IMAGE_MODEL[id] || id;
}

const IMAGE_ASPECTS = [
  { id: "square", label: "Square", size: "1024×1024", icon: "■" },
  { id: "landscape", label: "Landscape", size: "1344×768", icon: "▬" },
  { id: "portrait", label: "Portrait", size: "768×1344", icon: "▮" },
  { id: "wide", label: "Ultrawide", size: "1536×640", icon: "━" },
] as const;

const IMAGE_EXAMPLES = [
  "A majestic snow-capped mountain at golden hour, dramatic clouds, alpine meadow in foreground, shot on Hasselblad",
  "Professional product photo of a matte-black wireless headphone on white marble, soft studio lighting, shallow depth of field",
  "Cozy coffee shop interior, warm morning light through large windows, steam rising from latte, bokeh background",
  "Modern minimalist living room, floor-to-ceiling windows overlooking city skyline at dusk, warm ambient lighting",
  "Close-up of dew drops on a red rose petal, macro photography, soft natural light, blurred garden background",
  "Cyberpunk cityscape at night, neon reflections on wet streets, flying cars, holographic billboards, cinematic",
];

const h = (opts: RequestInit = {}) => ({
  ...opts,
  headers: { "Content-Type": "application/json", "X-Studio-Key": KEY, ...((opts.headers as Record<string, string>) || {}) },
});

interface QueueJob { id: string; status: string; model: string; prompt: string; elapsed: number; width: number; height: number; frames: number; steps: number; }
interface HistoryItem { id: string; status: string; video: string | null; videoUrl: string | null; }
interface LibFile { filename: string; size: number; created: number; url: string; thumbUrl: string | null; prompt: string; model: string; settings: Record<string, unknown>; label: string; }

interface StudioProps {
  isAdmin: boolean;
  userId: string;
  creditBalance: number;  // -1 = admin (unlimited)
  subscriptionTier: string | null;
}

const STUDIO_COSTS: Record<string, number> = {
  flux2_klein: 1, flux2_dev: 3, wan13_still: 2, wan22_still: 5,
  "wan1.3b": 3, ltxv23: 5, hunyuan: 6, wan22: 8,
  // Legacy (kept for backward compat)
  flux_schnell: 1, flux_dev: 2, sdxl_base: 2, sdxl_refiner: 3, sdxl_turbo: 1, wan14b: 8, ltxv2: 4,
};

export function StudioClient({ isAdmin, userId, creditBalance: initialBalance, subscriptionTier }: StudioProps) {
  const [mode, setMode] = useState<ModeStatus | null>(null);
  const [switching, setSwitching] = useState(false);
  const [comfyOk, setComfyOk] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("create");
  const [queueJobs, setQueueJobs] = useState<QueueJob[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [library, setLibrary] = useState<LibFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [combining, setCombining] = useState(false);
  const [previewFile, setPreviewFile] = useState<LibFile | null>(null);
  const [credits, setCredits] = useState(initialBalance);

  const [step, setStep] = useState<Step>("describe");
  const [creationMode, setCreationMode] = useState<"video" | "image">("video");
  const [genMode, setGenMode] = useState<"t2v" | "i2v">("t2v");
  const [imageModel, setImageModel] = useState("flux_schnell");
  const [imageAspect, setImageAspect] = useState("square");
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");
  const [camera, setCamera] = useState("none");
  const [lighting, setLighting] = useState("none");
  const [mood, setMood] = useState("none");
  const [model, setModel] = useState("wan1.3b");
  const [aspect, setAspect] = useState("landscape");
  const [duration, setDuration] = useState("medium");
  const [quality, setQuality] = useState("balanced");
  const [negative, setNegative] = useState(DEFAULT_NEGATIVE);
  const [showNeg, setShowNeg] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState("");
  const [lastSeed, setLastSeed] = useState<number | null>(null);
  const [upscale, setUpscale] = useState("none");
  const [enhancing, setEnhancing] = useState(false);
  const [promptMode, setPromptMode] = useState<"basic" | "enhanced">("basic");
  const [basicPrompt, setBasicPrompt] = useState("");
  const [startImage, setStartImage] = useState<File | null>(null);
  const [startImagePreview, setStartImagePreview] = useState("");
  const [startImageFilename, setStartImageFilename] = useState("");
  const [endImage, setEndImage] = useState<File | null>(null);
  const [endImagePreview, setEndImagePreview] = useState("");
  const [endImageFilename, setEndImageFilename] = useState("");
  const [uploading, setUploading] = useState(false);

  const [promptId, setPromptId] = useState("");
  const [assembledPrompt, setAssembledPrompt] = useState("");
  const [genStatus, setGenStatus] = useState<GenStatus>("queued");
  const [genError, setGenError] = useState("");
  const [genProgress, setGenProgress] = useState<{ step: number; totalSteps: number; node?: string } | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const finalVideoRef = useRef<HTMLVideoElement | null>(null);

  // ── Chat / Builder state ──
  const [chatOpen, setChatOpen] = useState(false);
  const [chatTab, setChatTab] = useState<"builder" | "ai">("builder");
  const [chatMessages, setChatMessages] = useState<Array<{role: "user" | "assistant", content: string}>>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Builder state
  const [pbSubject, setPbSubject] = useState("");
  const [pbCustomSubject, setPbCustomSubject] = useState("");
  const [pbStyle, setPbStyle] = useState("");
  const [pbRoom, setPbRoom] = useState("");
  const [pbDetails, setPbDetails] = useState<string[]>([]);
  const [pbSurface, setPbSurface] = useState("");
  const [pbTime, setPbTime] = useState("");
  const [pbAtmosphere, setPbAtmosphere] = useState("");
  const [pbCameraTerm, setPbCameraTerm] = useState("");
  const [pbQuality, setPbQuality] = useState("4K cinematic quality");

  function buildPromptFromBuilder(): string {
    const parts: string[] = [];
    const subjectDef = PB_SUBJECTS.find(s => s.id === pbSubject);
    if (pbSubject && subjectDef && "template" in subjectDef) {
      let t = subjectDef.template as string;
      t = t.replace("{style}", pbStyle || "modern");
      t = t.replace("{room}", pbRoom || "living room");
      t = t.replace("{room2}", "kitchen");
      t = t.replace("{details}", pbDetails.length > 0 ? pbDetails.join(", ") : "beautiful details");
      t = t.replace("{flooring}", "hardwood");
      t = t.replace("{product}", pbCustomSubject || "product");
      t = t.replace("{surface}", pbSurface || "white marble");
      t = t.replace("{lighting_detail}", "soft studio lighting with subtle reflections");
      t = t.replace("{time}", pbTime || "golden hour");
      t = t.replace("{scene}", pbCustomSubject || "mountain valley");
      t = t.replace("{atmosphere}", pbAtmosphere || "dramatic clouds");
      t = t.replace("{subject}", pbCustomSubject || "subject");
      t = t.replace("{action}", "in motion");
      t = t.replace("{item}", pbCustomSubject || "latte");
      parts.push(t);
    } else if (pbCustomSubject) {
      parts.push(pbCustomSubject);
    }
    if (pbTime && !parts[0]?.includes(pbTime)) parts.push(pbTime);
    if (pbAtmosphere && !parts[0]?.includes(pbAtmosphere)) parts.push(pbAtmosphere);
    if (camera !== "none") {
      const camMap: Record<string,string> = { static: "Static locked-off camera", pan_left: "Smooth pan left", pan_right: "Smooth pan right", zoom_in: "Slow cinematic zoom in", zoom_out: "Slow zoom out revealing the scene", orbit: "Camera orbits around the subject", tracking: "Steadicam tracking shot", aerial: "Aerial drone sweep" };
      if (camMap[camera]) parts.push(camMap[camera]);
    }
    if (pbCameraTerm) parts.push(pbCameraTerm);
    if (pbQuality) parts.push(pbQuality);
    return parts.filter(Boolean).join(". ").replace(/\.\./g, ".").trim();
  }

  // ── DGX polling ──
  const pingFailCount = useRef(0);
  const OFFLINE_THRESHOLD = 3; // require 3 consecutive failures before showing offline

  const fetchStatus = useCallback(async () => {
    try {
      const [modeRes, pingRes, queueRes, histRes, libRes] = await Promise.all([
        fetch(`${API}/status`, h()), fetch(`${API}/ping`),
        fetch(`${API}/queue`, h()), fetch(`${API}/history`, h()),
        fetch(`${API}/library`, h()),
      ]);
      if (modeRes.ok) setMode(await modeRes.json());
      if (pingRes.ok) {
        const p = await pingRes.json();
        if (p.comfyui === true) { pingFailCount.current = 0; setComfyOk(true); }
        else {
          pingFailCount.current++;
          if (pingFailCount.current >= OFFLINE_THRESHOLD) setComfyOk(false);
        }
      } else {
        pingFailCount.current++;
        if (pingFailCount.current >= OFFLINE_THRESHOLD) setComfyOk(false);
      }
      if (queueRes.ok) { const q = await queueRes.json(); setQueueJobs(q.jobs || []); }
      if (histRes.ok) { const hi = await histRes.json(); setHistory(hi.history || []); }
      if (libRes.ok) { const lb = await libRes.json(); setLibrary(lb.files || []); }
    } catch {
      pingFailCount.current++;
      if (pingFailCount.current >= OFFLINE_THRESHOLD) setComfyOk(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = tab === "queue" ? 5000 : 20000;
    const iv = setInterval(fetchStatus, interval);
    return () => clearInterval(iv);
  }, [fetchStatus, tab]);

  async function switchMode(target: DgxMode) {
    setSwitching(true);
    try {
      const res = await fetch(`${API}/switch`, h({ method: "POST", body: JSON.stringify({ mode: target }) }));
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        console.error("Switch failed:", err.error);
        setSwitching(false);
        return;
      }
      // Switch is async on server — poll /status every 3s until mode matches or switching=false
      const pollSwitch = async () => {
        for (let i = 0; i < 120; i++) {
          await new Promise(r => setTimeout(r, 3000));
          try {
            const sr = await fetch(`${API}/status`, h());
            if (sr.ok) {
              const s = await sr.json() as ModeStatus;
              setMode(s);
              if (!s.switching) { setSwitching(false); return; }
            }
          } catch { /* keep polling */ }
        }
        setSwitching(false); // 6 min timeout
      };
      pollSwitch();
    } catch (e) {
      console.error("switchMode error:", e);
      setSwitching(false);
    }
  }

  // ── Build preview prompt (client-side mirror of server logic) ──
  function buildPreview(): string {
    const camMap: Record<string, string> = { none: "", static: "Static locked-off camera.", pan_left: "Smooth slow pan from right to left.", pan_right: "Smooth slow pan from left to right.", zoom_in: "Slow cinematic zoom in.", zoom_out: "Slow cinematic zoom out, revealing the scene.", orbit: "Camera slowly orbits around the subject.", tracking: "Camera smoothly tracks the subject movement.", aerial: "Aerial drone shot, sweeping over the scene." };
    const litMap: Record<string, string> = { none: "", golden_hour: "Warm golden hour sunlight with long shadows.", neon: "Vibrant neon lights, cyberpunk atmosphere.", studio: "Professional studio lighting, soft and even.", natural: "Natural daylight, soft and organic.", dramatic: "Dramatic high-contrast lighting with deep shadows.", moonlight: "Soft cool moonlight, nighttime atmosphere." };
    const moodMap: Record<string, string> = { none: "", dramatic: "Dramatic and cinematic feel.", upbeat: "Energetic and upbeat vibe.", calm: "Calm, peaceful, serene atmosphere.", intense: "Intense, powerful, high-energy.", elegant: "Elegant, refined, sophisticated.", mysterious: "Mysterious, moody, atmospheric." };
    return `${description.trim()} ${camMap[camera] || ""} ${litMap[lighting] || ""} ${moodMap[mood] || ""}`.replace(/\s+/g, " ").trim();
  }

  // ── Image Upload ──
  async function uploadImage(file: File): Promise<string> {
    const res = await fetch(`${API}/upload`, {
      method: "POST",
      headers: { "X-Studio-Key": KEY, "Content-Type": file.type },
      body: file,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");
    return data.filename;
  }

  async function handleStartImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStartImage(file);
    setStartImagePreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const filename = await uploadImage(file);
      setStartImageFilename(filename);
    } catch (err) {
      setStartImage(null);
      setStartImagePreview("");
    } finally {
      setUploading(false);
    }
  }

  async function handleEndImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEndImage(file);
    setEndImagePreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const filename = await uploadImage(file);
      setEndImageFilename(filename);
    } catch (err) {
      setEndImage(null);
      setEndImagePreview("");
    } finally {
      setUploading(false);
    }
  }

  // ── AI Enhance ──
  async function enhancePrompt() {
    setEnhancing(true);
    const basic = buildPreview();
    setBasicPrompt(basic);
    try {
      const res = await fetch(`${API}/enhance`, h({
        method: "POST",
        body: JSON.stringify({ description, category: "custom", camera, lighting, mood }),
      }));
      const data = await res.json();
      if (res.ok && data.enhanced) {
        setEditedPrompt(data.enhanced);
        setPromptMode("enhanced");
      } else {
        setEditedPrompt(basic);
        setPromptMode("basic");
      }
    } catch {
      setEditedPrompt(basic);
      setPromptMode("basic");
    } finally {
      setEnhancing(false);
    }
  }

  // ── Generate ──
  async function generate(rerollSeed?: boolean, modelOverride?: string, promptOverride?: string) {
    const m = modelOverride || model;
    const p = promptOverride || editedPrompt || description;
    setStep("generating"); setGenStatus("queued"); setGenError(""); setGenProgress(null); setVideoUrl(""); setElapsed(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);

    const stepsVal = QUALITY_PRESETS.find(q => q.id === quality)?.steps || 20;
    const seed = rerollSeed ? undefined : lastSeed ?? undefined;

    try {
      // Credit check for non-admin users
      if (!isAdmin) {
        const costCheck = STUDIO_COSTS[m] ?? 3;
        if (credits < costCheck) { setGenError(`Insufficient credits. Need ${costCheck}, have ${credits}. Purchase credits to continue.`); setGenStatus("error"); return; }
        const creditRes = await fetch("/api/video/studio-generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: m, type: "video", prompt: p }) });
        const creditData = await creditRes.json();
        if (!creditRes.ok) { setGenError(creditData.error || "Credit check failed"); setGenStatus("error"); return; }
        setCredits(creditData.creditsRemaining);
      }

      const res = await fetch(`${API}/generate`, h({
        method: "POST",
        body: JSON.stringify({
          model: m, category: "custom", description: p, camera, lighting, mood,
          negative, aspect, duration, steps: stepsVal, seed, upscale,
          promptOverride: p || undefined,
          startImage: startImageFilename || undefined,
          endImage: endImageFilename || undefined,
        }),
      }));
      const data = await res.json();
      if (!res.ok) { setGenError(data.error || "Generation failed"); setGenStatus("error"); return; }
      setPromptId(data.promptId);
      setAssembledPrompt(data.assembledPrompt);
      startPolling(data.promptId);
    } catch { setGenError("Network error"); setGenStatus("error"); }
  }

  function startPolling(pid: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/progress`, h({ method: "POST", body: JSON.stringify({ promptId: pid }) }));
        const data = await res.json();
        setGenStatus(data.status);
        setGenProgress(data.progress || null);
        if (data.status === "done" && data.videoUrl) {
          setVideoUrl(`${API}${data.videoUrl}`); setStep("done"); setGenProgress(null);
          if (pollRef.current) clearInterval(pollRef.current);
          if (timerRef.current) clearInterval(timerRef.current);
        } else if (data.status === "error") {
          setGenError(data.error || "Generation failed"); setGenProgress(null);
          if (pollRef.current) clearInterval(pollRef.current);
          if (timerRef.current) clearInterval(timerRef.current);
        }
      } catch { /* retry */ }
    }, 3000);
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); if (timerRef.current) clearInterval(timerRef.current); }, []);

  // ── Image Generation ──
  async function generateImage(modelOverride?: string, promptOverride?: string) {
    const m = resolveImageModel(modelOverride) || imageModel;
    const p = promptOverride || editedPrompt || description;
    setStep("generating"); setGenStatus("queued"); setGenError(""); setGenProgress(null); setImageUrl(""); setElapsed(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);

    try {
      // Credit check for non-admin users
      if (!isAdmin) {
        const costCheck = STUDIO_COSTS[m] ?? 1;
        if (credits < costCheck) { setGenError(`Insufficient credits. Need ${costCheck}, have ${credits}. Purchase credits to continue.`); setGenStatus("error"); return; }
        const creditRes = await fetch("/api/video/studio-generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: m, type: "image", prompt: p }) });
        const creditData = await creditRes.json();
        if (!creditRes.ok) { setGenError(creditData.error || "Credit check failed"); setGenStatus("error"); return; }
        setCredits(creditData.creditsRemaining);
      }

      const res = await fetch(`${API}/generate-image`, h({
        method: "POST",
        body: JSON.stringify({
          model: m,
          prompt: p,
          negative,
          aspect: imageAspect,
        }),
      }));
      const data = await res.json();
      if (!res.ok) { setGenError(data.error || "Generation failed"); setGenStatus("error"); return; }
      setPromptId(data.promptId);
      startImagePolling(data.promptId);
    } catch { setGenError("Network error"); setGenStatus("error"); }
  }

  function startImagePolling(pid: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/progress`, h({ method: "POST", body: JSON.stringify({ promptId: pid }) }));
        const data = await res.json();
        setGenStatus(data.status);
        setGenProgress(data.progress || null);
        if (data.status === "done" && data.imageUrl) {
          setImageUrl(`${API}${data.imageUrl}`); setStep("done"); setGenProgress(null);
          if (pollRef.current) clearInterval(pollRef.current);
          if (timerRef.current) clearInterval(timerRef.current);
        } else if (data.status === "done" && data.videoUrl) {
          setImageUrl(`${API}${data.videoUrl}`); setStep("done"); setGenProgress(null);
          if (pollRef.current) clearInterval(pollRef.current);
          if (timerRef.current) clearInterval(timerRef.current);
        } else if (data.status === "error") {
          setGenError(data.error || "Generation failed"); setGenProgress(null);
          if (pollRef.current) clearInterval(pollRef.current);
          if (timerRef.current) clearInterval(timerRef.current);
        }
      } catch { /* retry */ }
    }, 3000);
  }

  function reset() {
    setStep("describe"); setGenMode("t2v"); setCreationMode("video"); setDescription(""); setCamera("none"); setLighting("none"); setMood("none"); setImageUrl("");
    setPromptId(""); setVideoUrl(""); setGenStatus("queued"); setGenError(""); setElapsed(0);
    setEditedPrompt(""); setLastSeed(null); setShowNeg(false);
    setStartImage(null); setStartImagePreview(""); setStartImageFilename("");
    setEndImage(null); setEndImagePreview(""); setEndImageFilename("");
    setCritique(null); setReviewError(""); setReviewing(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function goToTweak() { setStep("review"); }

  async function deleteJob(pid: string) {
    const res = await fetch(`${API}/delete`, h({ method: "POST", body: JSON.stringify({ promptId: pid, deleteFiles: true }) }));
    const data = await res.json().catch(() => ({}));
    // If we interrupted a running job, reset the UI from "generating" back to "review"
    if (data?.deleted?.includes("interrupted") && step === "generating") {
      setStep("review");
    }
    fetchStatus();
  }

  async function deleteAll() {
    await fetch(`${API}/delete-all`, h({ method: "POST", body: JSON.stringify({ deleteFiles: true }) }));
    fetchStatus();
  }

  // ── Library actions ──
  function toggleSelect(filename: string) {
    setSelected(prev => { const s = new Set(prev); if (s.has(filename)) s.delete(filename); else s.add(filename); return s; });
  }

  function selectAll() {
    if (selected.size === library.length) setSelected(new Set());
    else setSelected(new Set(library.map(f => f.filename)));
  }

  async function libRename(filename: string, label: string) {
    await fetch(`${API}/library/rename`, h({ method: "POST", body: JSON.stringify({ filename, label }) }));
    setRenaming(null); fetchStatus();
  }

  async function libDelete(filenames: string[]) {
    await fetch(`${API}/library/delete`, h({ method: "POST", body: JSON.stringify({ filenames }) }));
    setSelected(new Set()); fetchStatus();
  }

  async function libCombine() {
    if (selected.size < 2) return;
    setCombining(true);
    const filenames = library.filter(f => selected.has(f.filename)).map(f => f.filename);
    try {
      const res = await fetch(`${API}/library/combine`, h({ method: "POST", body: JSON.stringify({ filenames }) }));
      const data = await res.json();
      if (res.ok) { setSelected(new Set()); fetchStatus(); }
      else alert(data.error || "Combine failed");
    } finally { setCombining(false); }
  }

  function fmtSize(bytes: number) { return bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)}MB` : `${(bytes / 1024).toFixed(0)}KB`; }
  function fmtDate(ts: number) { const d = new Date(ts * 1000); return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  // ── Frame Interpolation ──
  const [interpFile, setInterpFile] = useState<string | null>(null);
  const [interpAlgo, setInterpAlgo] = useState("rife");
  const [interpMult, setInterpMult] = useState(2);
  const [interpolating, setInterpolating] = useState(false);

  async function interpolateVideo() {
    if (!interpFile) return;
    setInterpolating(true);
    try {
      const res = await fetch(`${API}/interpolate`, h({
        method: "POST",
        body: JSON.stringify({ filename: interpFile, algorithm: interpAlgo, multiplier: interpMult }),
      }));
      const data = await res.json();
      if (res.ok) {
        setInterpFile(null);
        setTab("queue");
        fetchStatus();
      } else {
        alert(data.error || "Interpolation failed");
      }
    } finally {
      setInterpolating(false);
    }
  }

  function copyShare(filename: string) { navigator.clipboard.writeText(`${API}/output/${filename}`); }

  // ── AI Review / Critique ──
  interface CritiqueIssue { type: string; severity: "minor" | "moderate" | "major"; description: string; }
  interface RecommendedSettings { model?: string | null; quality?: string | null; upscale?: string | null; reason?: string; }
  interface CritiqueResult { score: number; issues: CritiqueIssue[]; strengths: string[]; improvedPrompt: string; shouldRegenerate: boolean; summary: string; maxPotential?: number; limitingFactors?: string[]; recommendedSettings?: RecommendedSettings | null; }
  const [reviewing, setReviewing] = useState(false);
  const [critique, setCritique] = useState<CritiqueResult | null>(null);
  const [reviewError, setReviewError] = useState("");
  const [reviewPhase, setReviewPhase] = useState(0);
  const reviewPhaseRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const REVIEW_PHASES = ["Reading image...", "Checking anatomy & faces...", "Analyzing lighting & shadows...", "Inspecting textures & realism...", "Looking for artifacts...", "Evaluating composition...", "Writing improved prompt..."];

  async function runCritique(url: string, prompt: string, mediaType: "image" | "video" = "image") {
    setReviewing(true); setCritique(null); setReviewError(""); setReviewPhase(0);
    if (reviewPhaseRef.current) clearInterval(reviewPhaseRef.current);
    reviewPhaseRef.current = setInterval(() => setReviewPhase(p => Math.min(p + 1, REVIEW_PHASES.length - 1)), 3000);
    try {
      const filename = url.replace(`${API}/output/`, "").replace(`${API}`, "").replace(/^\/output\//, "");
      const res = await fetch(`${API}/critique`, h({
        method: "POST",
        body: JSON.stringify({ filename, originalPrompt: prompt, type: mediaType, model, steps: stepsVal, upscale }),
      }));
      const data = await res.json();
      if (!res.ok) { setReviewError(data.error || "Review failed"); return; }
      setCritique(data);
    } catch { setReviewError("Network error — could not reach review service"); }
    finally { setReviewing(false); if (reviewPhaseRef.current) clearInterval(reviewPhaseRef.current); }
  }

  function applySettings(rec: RecommendedSettings) {
    if (rec.model) { setModel(rec.model); setImageModel(rec.model); }
    if (rec.quality) setQuality(rec.quality);
    if (rec.upscale) setUpscale(rec.upscale);
  }

  // ── Narration (F5-TTS via studio-api) ──
  const NARRATION_VOICES = [
    { id: "Sophie_Anderson",    label: "Sophie Anderson — female, narrative" },
    { id: "Morgan_Freeman",     label: "Morgan Freeman — male, narrator" },
    { id: "David_Attenborough", label: "David Attenborough — male, documentary" },
    { id: "Clint_Eastwood",     label: "Clint Eastwood — male, character" },
    { id: "female_01",          label: "Female 01 — generic" },
    { id: "female_02",          label: "Female 02 — generic" },
    { id: "en_woman",           label: "English Woman — neutral" },
    { id: "en_man",             label: "English Man — neutral" },
  ] as const;
  const [narrationOpen, setNarrationOpen] = useState(false);
  const [narrationText, setNarrationText] = useState("");
  const [narrationVoice, setNarrationVoice] = useState<string>("Sophie_Anderson");
  const [narrationLoading, setNarrationLoading] = useState(false);
  const [narrationError, setNarrationError] = useState("");
  const [narrationUrl, setNarrationUrl] = useState<string | null>(null);

  async function generateNarration() {
    const text = narrationText.trim();
    if (!text) { setNarrationError("Enter narration text"); return; }
    setNarrationLoading(true); setNarrationError(""); setNarrationUrl(null);
    try {
      const res = await fetch("/api/video/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: narrationVoice }),
      });
      const data = await res.json();
      if (!res.ok) { setNarrationError(data.error || "Narration failed"); return; }
      setNarrationUrl(data.audioUrl);
    } catch (e) {
      setNarrationError(e instanceof Error ? e.message : "Network error");
    } finally {
      setNarrationLoading(false);
    }
  }

  function applyFixAndRegenerate(keepSeed?: boolean) {
    if (!critique?.improvedPrompt) return;
    setDescription(critique.improvedPrompt);
    setEditedPrompt(critique.improvedPrompt);
    setPromptMode("enhanced");
    setBasicPrompt(critique.improvedPrompt);
    if (critique.recommendedSettings) applySettings(critique.recommendedSettings);
    if (!keepSeed) setLastSeed(null);
    setCritique(null);
    setStep("review");
  }

  function renderCritiquePanel(rescanFn: () => void, applyFn?: (keepSeed: boolean) => void, upgradeFn?: (newModel?: string) => void) {
    if (!critique) return null;
    const apply = applyFn || applyFixAndRegenerate;
    const modelLabels: Record<string, string> = { wan22: "Wan 2.2 14B", wan14b: "Wan 2.1 14B", "wan1.3b": "Wan 2.1 1.3B Draft", hunyuan: "HunyuanVideo 13B", ltxv23: "LTX-2.3 22B", ltxv2: "LTX Video 2.0", flux2_klein: "FLUX.2 Klein 4B", flux2_dev: "FLUX.2 Dev 32B", flux_schnell: "FLUX.1 Schnell", flux_dev: "FLUX.1 Dev", sdxl_base: "SDXL 1.0", sdxl_refiner: "SDXL + Refiner", sdxl_turbo: "SDXL Turbo" };
    const qualityLabels: Record<string, string> = { fast: "Fast (15)", balanced: "Balanced (20)", quality: "Quality (30)", max: "Max (40)" };
    return (
      <div className="s-critique">
        <div className="s-critique-header">
          <span className={`s-critique-score ${critique.score >= 7 ? "good" : critique.score >= 4 ? "ok" : "bad"}`}>{critique.score}/10</span>
          <span className="s-critique-summary">{critique.summary}</span>
        </div>
        {critique.maxPotential != null && critique.maxPotential < 10 && (
          <div className="s-critique-potential">
            <span className="s-critique-label">Max Potential with Current Settings</span>
            <div className="s-potential-bar">
              <div className="s-potential-fill" style={{ width: `${critique.score * 10}%` }} />
              <div className="s-potential-cap" style={{ left: `${critique.maxPotential * 10}%` }}>{critique.maxPotential}/10</div>
            </div>
            {critique.limitingFactors && critique.limitingFactors.length > 0 && (
              <p className="s-potential-limits">Bottleneck: {critique.limitingFactors.join(", ")}</p>
            )}
          </div>
        )}
        {critique.recommendedSettings && critique.recommendedSettings.reason && (
          <div className="s-critique-section s-critique-rec">
            <span className="s-critique-label">Recommended Settings</span>
            <div className="s-rec-chips">
              {critique.recommendedSettings.model && <span className="s-rec-chip s-rec-model">{modelLabels[critique.recommendedSettings.model] || critique.recommendedSettings.model}</span>}
              {critique.recommendedSettings.quality && <span className="s-rec-chip">{qualityLabels[critique.recommendedSettings.quality] || critique.recommendedSettings.quality} steps</span>}
              {critique.recommendedSettings.upscale && critique.recommendedSettings.upscale !== "none" && <span className="s-rec-chip">{critique.recommendedSettings.upscale} upscale</span>}
            </div>
            <p className="s-rec-reason">{critique.recommendedSettings.reason}</p>
            <button className="s-btn s-btn-upgrade" onClick={() => {
              const newModel = critique.recommendedSettings?.model ?? undefined;
              if (critique.recommendedSettings) applySettings(critique.recommendedSettings);
              setCritique(null);
              if (upgradeFn) { upgradeFn(newModel); }
              else if (creationMode === "image") { generateImage(newModel); }
              else { generate(false, newModel); }
            }}>
              Upgrade & Regenerate
            </button>
          </div>
        )}
        {critique.issues.length > 0 && (
          <div className="s-critique-section">
            <span className="s-critique-label">Issues Found</span>
            {critique.issues.map((issue, i) => (
              <div key={i} className={`s-critique-issue ${issue.severity}`}>
                <span className="s-critique-badge">{issue.severity}</span>
                <span className="s-critique-type">{issue.type}</span>
                <span>{issue.description}</span>
              </div>
            ))}
          </div>
        )}
        {critique.strengths.length > 0 && (
          <div className="s-critique-section">
            <span className="s-critique-label">What Looks Good</span>
            {critique.strengths.map((s, i) => <p key={i} className="s-critique-strength">{s}</p>)}
          </div>
        )}
        {critique.improvedPrompt && (
          <div className="s-critique-actions">
            <button className="s-btn s-btn-generate" onClick={() => apply(true)} title="Same composition, improved prompt + settings">
              Refine This (Same Seed)
            </button>
            <button className="s-btn s-btn-purple" onClick={() => apply(false)} title="Fresh generation with improved prompt + settings">
              New Creation
            </button>
            <button className="s-btn s-btn-review s-btn-rescan" onClick={rescanFn}>Rescan</button>
          </div>
        )}
      </div>
    );
  }

  // ── Chat ──
  async function sendChat() {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = { role: "user" as const, content: chatInput.trim() };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await fetch(`${API}/chat`, h({
        method: "POST",
        body: JSON.stringify({ messages: newMessages }),
      }));
      const data = await res.json();
      if (res.ok && data.reply) {
        setChatMessages([...newMessages, { role: "assistant", content: data.reply }]);
      } else {
        setChatMessages([...newMessages, { role: "assistant", content: data.error || "Failed to get response." }]);
      }
    } catch {
      setChatMessages([...newMessages, { role: "assistant", content: "AI assistant unavailable. Try switching to Inference mode." }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }

  function usePromptFromChat(text: string) {
    setEditedPrompt(text);
    setPromptMode("enhanced");
    setBasicPrompt(text);
    setStep("review");
    setChatOpen(false);
  }

  function extractPrompt(text: string): string | null {
    const match = text.match(/\[PROMPT\]([\s\S]*?)\[\/PROMPT\]/);
    return match ? match[1].trim() : null;
  }

  function renderChatMessage(content: string) {
    const prompt = extractPrompt(content);
    const cleanContent = content.replace(/\[PROMPT\][\s\S]*?\[\/PROMPT\]/, "").trim();
    return { cleanContent, prompt };
  }

  const modeColor = mode?.mode === "creator" ? "#a855f7" : mode?.mode === "draft" ? "#3b82f6" : mode?.mode === "inference" ? "#22c55e" : "#6b7280";
  const canGenerate = comfyOk && (genMode === "i2v" ? !!startImageFilename : description.trim().length > 5);
  const needsCreator = (model === "wan14b" || model === "wan22" || model === "hunyuan") && mode?.mode !== "creator";
  const stepsVal = QUALITY_PRESETS.find(q => q.id === quality)?.steps || 20;

  // ── Time estimator ──
  // Benchmarked on DGX Spark GB10 128GB (from /tmp/comfy.log, 2026-03-28):
  // Wan 1.3B @ 480x832, 41f, 20 steps = ~12s/step, total ~4 min
  // Wan 1.3B @ 832x480, 25f, 15 steps = ~3.5s/step, total ~53s
  // Wan 14B  @ 832x480, 25f, 25 steps = ~28s/step, total ~12 min
  // Wan 14B  @ 640x640, 81f, 30 steps = ~67s/step, total ~33 min
  // Wan 14B  @ 832x480, 241f, 40 steps = ~45s/step (FreeNoise), total ~30 min
  function estimateTime(opts: { model: string; w: number; h: number; frames: number; steps: number; upscale: string; duration: string }): { min: number; max: number; label: string } {
    // Per-step seconds at default frames and reference resolution, from real GB10 benchmarks
    const benchmarks: Record<string, { perStep: number; defaultFrames: number; overhead: number; refPixels: number }> = {
      "wan1.3b": { perStep: 7, defaultFrames: 41, overhead: 30, refPixels: 832 * 480 },
      wan22:     { perStep: 100, defaultFrames: 81, overhead: 60, refPixels: 832 * 480 },
      wan14b:    { perStep: 100, defaultFrames: 81, overhead: 60, refPixels: 832 * 480 },
      hunyuan:   { perStep: 30, defaultFrames: 49, overhead: 120, refPixels: 832 * 480 },
      ltxv23:    { perStep: 35, defaultFrames: 97, overhead: 120, refPixels: 832 * 480 },
      ltxv2:     { perStep: 8,  defaultFrames: 97, overhead: 30, refPixels: 832 * 480 },
    };
    const bm = benchmarks[opts.model] || { perStep: 12, defaultFrames: 41, overhead: 60, refPixels: 832 * 480 };

    // Scale per-step by resolution (pixel count relative to benchmark reference)
    const pixels = opts.w * opts.h;
    const pixelRatio = pixels / bm.refPixels;

    // Scale per-step by frame count relative to default
    const frameRatio = opts.frames / bm.defaultFrames;
    let perStep = bm.perStep * pixelRatio;
    if (opts.frames > 100) {
      // FreeNoise context windowing: per-step plateaus, sub-linear scaling
      perStep = perStep * Math.pow(frameRatio, 0.7);
    } else if (frameRatio !== 1) {
      perStep = perStep * Math.pow(frameRatio, 1.3);
    }

    const samplingSec = perStep * opts.steps;
    const upscaleSec = opts.upscale === "none" ? 0 : opts.upscale === "1080p" ? 20 : 40;

    // Min = warm (model already loaded), Max = cold (includes model load)
    const totalMin = Math.round(samplingSec + upscaleSec);
    const totalMax = Math.round(samplingSec + bm.overhead + upscaleSec);

    const fmtTime = (s: number) => {
      if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
      if (s >= 60) return `${Math.floor(s / 60)}m ${s % 60}s`;
      return `${s}s`;
    };
    return { min: totalMin, max: totalMax, label: `${fmtTime(totalMin)} – ${fmtTime(totalMax)}` };
  }

  const frameLookup: Record<string, number> = { short: 25, medium: 41, long: 81, xlong: 161, xxlong: 241, ultra30: 481, ultra60: 961 };
  const currentEstimate = estimateTime({
    model,
    w: ASPECTS.find(a => a.id === aspect)?.size.split("×").map(Number)[0] || 832,
    h: ASPECTS.find(a => a.id === aspect)?.size.split("×").map(Number)[1] || 480,
    frames: frameLookup[duration] || 41,
    steps: stepsVal,
    upscale,
    duration,
  });

  // ── Image time estimator ──
  // GB10 benchmarks (from /tmp/comfy.log, 2026-03-28):
  // FLUX.1 Schnell: 4 steps @ 0.26s/step = ~4s (1024x1024)
  // FLUX.1/2 Dev: 28 steps @ 3.7s/step = ~105s at 1344x768, ~16.8s/step at 1024x1024 (offload penalty)
  // FLUX.2 Klein: 4 steps @ 1.7s/step = ~15s
  // SDXL: 30 steps @ 0.5s/step = ~20s
  // FLUX.2 Klein: 4 steps @ 1.7s/step = ~15s
  // Key: larger resolutions cause offloading on big models → quadratic scaling
  function estimateImageTime(opts: { model: string; w: number; h: number; upscale: string }): string {
    const imgBenchmarks: Record<string, { perStep: number; steps: number; overhead: number; refPixels: number }> = {
      flux_schnell: { perStep: 0.26, steps: 4, overhead: 3, refPixels: 1024 * 1024 },
      flux2_klein:  { perStep: 1.7,  steps: 4, overhead: 8, refPixels: 1024 * 1024 },
      flux2_dev:    { perStep: 3.7,  steps: 28, overhead: 12, refPixels: 1344 * 768 },
      flux_dev:     { perStep: 3.7,  steps: 28, overhead: 12, refPixels: 1344 * 768 },
      sdxl_base:    { perStep: 0.5,  steps: 30, overhead: 5, refPixels: 1024 * 1024 },
      sdxl_refiner: { perStep: 0.5,  steps: 35, overhead: 15, refPixels: 1024 * 1024 },
      sdxl_turbo:   { perStep: 0.5,  steps: 4, overhead: 3, refPixels: 1024 * 1024 },
      wan22_still:  { perStep: 5,    steps: 25, overhead: 60, refPixels: 832 * 480 },
      wan13_still:  { perStep: 1.5,  steps: 20, overhead: 30, refPixels: 832 * 480 },
    };
    const bm = imgBenchmarks[opts.model] || { perStep: 2, steps: 20, overhead: 10, refPixels: 1024 * 1024 };
    const pixels = opts.w * opts.h;
    // Big models (FLUX Dev/2) offload at high res → super-linear scaling
    const pixelRatio = pixels / bm.refPixels;
    const isLargeModel = opts.model.includes("flux2_dev") || opts.model.includes("flux_dev");
    const scaledPerStep = isLargeModel ? bm.perStep * Math.pow(pixelRatio, 1.8) : bm.perStep * pixelRatio;
    const upscaleSec = opts.upscale === "none" ? 0 : opts.upscale === "1080p" ? 30 : 60;
    const total = Math.round(scaledPerStep * bm.steps + bm.overhead + upscaleSec);
    if (total >= 3600) return `~${Math.floor(total / 3600)}h ${Math.floor((total % 3600) / 60)}m`;
    if (total >= 60) return `~${Math.floor(total / 60)}m ${total % 60}s`;
    return `~${total}s`;
  }

  const imgAspectSize = IMAGE_ASPECTS.find(a => a.id === imageAspect)?.size.split("×").map(Number) || [1024, 1024];
  const imageUpscale = upscale; // shares the same upscale state
  const currentImageEstimate = estimateImageTime({ model: imageModel, w: imgAspectSize[0], h: imgAspectSize[1], upscale: imageUpscale });

  function estimateQueueJob(job: QueueJob): string {
    const dur = job.frames >= 481 ? "ultra30" : job.frames >= 241 ? "xxlong" : job.frames >= 161 ? "xlong" : "long";
    const est = estimateTime({ model: job.model.includes("14b") || job.model.includes("14B") ? "wan14b" : "wan1.3b", w: job.width, h: job.height, frames: job.frames, steps: job.steps, upscale: "none", duration: dur });
    const remaining = Math.max(0, est.max - job.elapsed);
    if (remaining <= 0) return "finishing...";
    return remaining >= 60 ? `~${Math.floor(remaining / 60)}m ${remaining % 60}s left` : `~${remaining}s left`;
  }

  return (
    <div className="s-root">
      {/* ── Top Bar ── */}
      <div className="s-bar">
        <a href="/video" className="s-back">← Back</a>
        <span className="s-title">Creator Studio</span>
        <div className="s-bar-right">
          {!isAdmin && (
            <span className="s-credit-badge">
              {credits} credits
              {subscriptionTier && <span className="s-credit-tier">{subscriptionTier}</span>}
            </span>
          )}
          {isAdmin && <span className="s-badge" style={{ borderColor: "#22c55e", color: "#22c55e" }}>ADMIN</span>}
          <span className="s-badge" style={{ borderColor: modeColor, color: modeColor }}>
            {switching ? `→ ${(mode?.switchTarget ?? "switching")?.toUpperCase()}` : (mode?.mode?.toUpperCase() ?? "...")}
          </span>
          {isAdmin && <span className="s-mem">{mode?.memoryFree ?? "?"}GB free</span>}
          <span className="s-dot" style={{ background: comfyOk ? "#22c55e" : "#ef4444" }} />
          {isAdmin && mode?.mode !== "creator" && <button className="s-btn s-btn-sm s-btn-purple" disabled={switching} onClick={() => switchMode("creator")}>{switching ? "Switching..." : "Creator Mode"}</button>}
          {isAdmin && mode?.mode === "creator" && <button className="s-btn s-btn-sm s-btn-green" disabled={switching} onClick={() => switchMode("inference")}>{switching ? "Switching..." : "Back to Inference"}</button>}
        </div>
      </div>

      {comfyOk === false && step !== "generating" && (
        <div className="s-center">
          <div style={{ fontSize: 48 }}>⚡</div>
          <h2>ComfyUI is not responding</h2>
          <p>It may be loading a model or busy generating. If this persists, try switching modes.</p>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button className="s-btn s-btn-ghost" onClick={fetchStatus}>Retry Connection</button>
            <button className="s-btn s-btn-purple" disabled={switching} onClick={() => switchMode("creator")}>{switching ? "Switching..." : "Switch to Creator Mode"}</button>
          </div>
        </div>
      )}

      {(comfyOk || step === "generating") && (
        <div className="s-main">
          {/* ── Tab Bar ── */}
          <div className="s-tabs">
            <button className={`s-tab ${tab === "create" ? "active" : ""}`} onClick={() => setTab("create")}>
              Create
            </button>
            <button className={`s-tab ${tab === "queue" ? "active" : ""}`} onClick={() => setTab("queue")}>
              Queue {queueJobs.length > 0 && <span className="s-tab-badge">{queueJobs.length}</span>}
            </button>
            <button className={`s-tab ${tab === "library" ? "active" : ""}`} onClick={() => setTab("library")}>
              Library {library.length > 0 && <span className="s-tab-badge s-tab-badge-dim">{library.length}</span>}
            </button>
            <button className={`s-tab ${tab === "tools" ? "active" : ""}`} onClick={() => setTab("tools")}>
              Tools
            </button>
          </div>

          {/* ── Queue Tab ── */}
          {tab === "queue" && (
            <div className="s-card s-fade" style={{ maxWidth: 720 }}>
              <h2>Queue & History</h2>

              {queueJobs.length > 0 && (
                <div className="s-queue-section">
                  <span className="s-queue-heading">Active</span>
                  {queueJobs.map((job) => (
                    <div key={job.id} className={`s-queue-job ${job.status === "running" ? "s-queue-running" : ""}`}>
                      <div className="s-queue-job-top">
                        <span className={`s-queue-status ${job.status}`}>{job.status === "running" ? "Generating" : "Queued"}</span>
                        <span className="s-queue-model">{job.model.replace("Wan2.1-T2V-", "Wan ").replace(".gguf", "").replace("wan2.1-t2v-", "Wan ")}</span>
                        <span className="s-queue-meta">{job.width}x{job.height} / {job.frames}f / {job.steps} steps</span>
                        {job.status === "running" && (
                          <span className="s-queue-timer">
                            {Math.floor(job.elapsed / 60)}:{String(job.elapsed % 60).padStart(2, "0")}
                            <span className="s-queue-eta">{estimateQueueJob(job)}</span>
                          </span>
                        )}
                        <button className="s-queue-delete" onClick={() => deleteJob(job.id)} title="Cancel & delete">✕</button>
                      </div>
                      <p className="s-queue-prompt">{job.prompt}</p>
                    </div>
                  ))}
                </div>
              )}

              {queueJobs.length === 0 && <p className="s-sub" style={{ marginTop: 8 }}>No jobs running or queued.</p>}

              {history.length > 0 && (
                <div className="s-queue-section">
                  <div className="s-queue-heading-row">
                    <span className="s-queue-heading">Recent</span>
                    <button className="s-btn s-btn-sm s-btn-danger" onClick={deleteAll}>Clear All</button>
                  </div>
                  {history.slice(0, 10).map((item) => (
                    <div key={item.id} className="s-queue-job s-queue-done">
                      <div className="s-queue-job-top">
                        <span className={`s-queue-status ${item.status}`}>{item.status === "success" ? "Done" : item.status}</span>
                        {item.video && <span className="s-queue-file">{item.video}</span>}
                        <button className="s-queue-delete" onClick={() => deleteJob(item.id)} title="Delete video & history">✕</button>
                      </div>
                      {item.videoUrl && (
                        <div className="s-queue-actions">
                          <a href={`${API}${item.videoUrl}`} target="_blank" rel="noreferrer" className="s-btn s-btn-sm s-btn-ghost">Play</a>
                          <a href={`${API}${item.videoUrl}`} download className="s-btn s-btn-sm s-btn-ghost">Download</a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Library Tab ── */}
          {tab === "library" && (
            <div className="s-card s-fade" style={{ maxWidth: 900 }}>
              <div className="s-lib-header">
                <h2>Library</h2>
                <div className="s-lib-actions">
                  <button className="s-btn s-btn-sm s-btn-ghost" onClick={selectAll}>
                    {selected.size === library.length && library.length > 0 ? "Deselect All" : "Select All"}
                  </button>
                  {selected.size >= 2 && (
                    <button className="s-btn s-btn-sm s-btn-purple" disabled={combining} onClick={libCombine}>
                      {combining ? "Combining..." : `Combine ${selected.size} Clips`}
                    </button>
                  )}
                  {selected.size > 0 && (
                    <button className="s-btn s-btn-sm s-btn-danger" onClick={() => libDelete(Array.from(selected))}>
                      Delete {selected.size}
                    </button>
                  )}
                </div>
              </div>

              {library.length === 0 && <p className="s-sub">No videos yet. Create one in the Create tab.</p>}

              {/* Preview modal */}
              {previewFile && (
                <div className="s-preview-overlay" onClick={() => { setPreviewFile(null); setCritique(null); setReviewError(""); }}>
                  <div className="s-preview-modal" onClick={(e) => e.stopPropagation()}>
                    {previewFile.filename.match(/\.(mp4|webm|mov)$/i)
                      ? <>
                          <video ref={previewVideoRef} src={`${API}${previewFile.url}`} controls autoPlay loop muted playsInline className="s-preview-video" />
                          <VideoSpeedChips videoRef={previewVideoRef} className="mt-2 justify-end" />
                        </>
                      : <img src={`${API}${previewFile.url}`} alt={previewFile.label} className="s-preview-video" style={{ objectFit: "contain" }} />
                    }
                    <div className="s-preview-info">
                      <h3>{previewFile.label}</h3>
                      {previewFile.prompt && <p className="s-preview-prompt">{previewFile.prompt}</p>}
                      <div className="s-preview-meta">
                        {previewFile.model && <span>{previewFile.model}</span>}
                        <span>{fmtSize(previewFile.size)}</span>
                        <span>{fmtDate(previewFile.created)}</span>
                      </div>
                    </div>
                    <div className="s-preview-actions">
                      <a href={`${API}${previewFile.url}`} download className="s-btn s-btn-sm s-btn-purple">Download</a>
                      <button className="s-btn s-btn-sm s-btn-ghost" onClick={() => { copyShare(previewFile.filename); }}>Copy Link</button>
                      <button className="s-btn s-btn-sm s-btn-ghost" onClick={() => { setRenaming(previewFile.filename); setRenameVal(previewFile.label); }}>Rename</button>
                      <button className="s-btn s-btn-sm s-btn-danger" onClick={() => { libDelete([previewFile.filename]); setPreviewFile(null); }}>Delete</button>
                    </div>
                    {/* Narration — videos only */}
                    {previewFile.filename.match(/\.(mp4|webm|mov)$/i) && (
                      <div style={{ padding: "0 16px 16px" }}>
                        <button className="s-btn s-btn-sm s-btn-ghost" style={{ width: "100%" }}
                          onClick={() => setNarrationOpen((o) => !o)}>
                          {narrationOpen ? "Hide narration" : "🎙 Add narration (F5-TTS)"}
                        </button>
                        {narrationOpen && (
                          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                            <textarea
                              className="s-textarea"
                              placeholder="Type what the narrator should say..."
                              value={narrationText}
                              onChange={(e) => setNarrationText(e.target.value)}
                              rows={3}
                              maxLength={4000}
                            />
                            <div style={{ fontSize: 12, opacity: 0.7 }}>
                              {narrationText.trim().split(/\s+/).filter(Boolean).length} words · ~{Math.max(1, Math.ceil(narrationText.trim().split(/\s+/).filter(Boolean).length / 2.5))}s @ 150 wpm
                            </div>
                            <select
                              className="s-textarea"
                              value={narrationVoice}
                              onChange={(e) => setNarrationVoice(e.target.value)}
                            >
                              {NARRATION_VOICES.map((v) => (
                                <option key={v.id} value={v.id}>{v.label}</option>
                              ))}
                            </select>
                            <button
                              className="s-btn s-btn-purple"
                              disabled={narrationLoading || !narrationText.trim()}
                              onClick={generateNarration}
                            >
                              {narrationLoading ? "Generating narration..." : "Generate narration"}
                            </button>
                            {narrationError && <p className="s-error-msg">{narrationError}</p>}
                            {narrationUrl && (
                              <audio controls src={narrationUrl} style={{ width: "100%" }} />
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {/* AI Review in Library — admin only */}
                    {isAdmin && <div style={{ padding: "0 16px 16px" }}>
                      {!critique && (
                        <button className="s-btn s-btn-review" style={{ width: "100%", maxWidth: "none", marginTop: 0 }} disabled={reviewing}
                          onClick={() => runCritique(previewFile.filename, previewFile.prompt || previewFile.label, previewFile.filename.match(/\.(mp4|webm|mov)$/i) ? "video" : "image")}>
                          {reviewing ? REVIEW_PHASES[reviewPhase] : isAdmin ? "AI Review — Find Issues" : "AI Review (Admin)"}
                        </button>
                      )}
                      {reviewing && <div className="s-review-bar" style={{ maxWidth: "none" }}><div className="s-review-bar-fill" style={{ width: `${((reviewPhase + 1) / REVIEW_PHASES.length) * 100}%` }} /></div>}
                      {reviewError && <p className="s-error-msg" style={{ marginTop: 8 }}>{reviewError}</p>}
                      {renderCritiquePanel(
                        () => runCritique(previewFile.filename, previewFile.prompt || previewFile.label, previewFile.filename.match(/\.(mp4|webm|mov)$/i) ? "video" : "image"),
                        (keepSeed) => {
                          if (!critique?.improvedPrompt) return;
                          setDescription(critique.improvedPrompt);
                          setEditedPrompt(critique.improvedPrompt);
                          setPromptMode("enhanced");
                          setBasicPrompt(critique.improvedPrompt);
                          if (critique.recommendedSettings) applySettings(critique.recommendedSettings);
                          if (!keepSeed) setLastSeed(null);
                          setCritique(null);
                          setPreviewFile(null);
                          setCreationMode(previewFile.filename.match(/\.(mp4|webm|mov)$/i) ? "video" : "image");
                          setTab("create");
                          setStep("review");
                        },
                        (newModel) => {
                          const isVideo = !!previewFile.filename.match(/\.(mp4|webm|mov)$/i);
                          const prompt = critique?.improvedPrompt || previewFile.prompt || previewFile.label;
                          setDescription(prompt);
                          setEditedPrompt(prompt);
                          setBasicPrompt(prompt);
                          setPromptMode("enhanced");
                          setPreviewFile(null);
                          setCreationMode(isVideo ? "video" : "image");
                          setTab("create");
                          if (isVideo) { generate(false, newModel, prompt); }
                          else { generateImage(newModel, prompt); }
                        },
                      )}
                    </div>}
                    <button className="s-preview-close" onClick={() => { setPreviewFile(null); setCritique(null); setReviewError(""); }}>✕</button>
                  </div>
                </div>
              )}

              {/* Rename modal */}
              {renaming && (
                <div className="s-preview-overlay" onClick={() => setRenaming(null)}>
                  <div className="s-rename-modal" onClick={(e) => e.stopPropagation()}>
                    <h3>Rename</h3>
                    <input className="s-textarea" value={renameVal} onChange={(e) => setRenameVal(e.target.value)} autoFocus
                      onKeyDown={(e) => { if (e.key === "Enter") libRename(renaming, renameVal); }} />
                    <div className="s-nav" style={{ marginTop: 12 }}>
                      <button className="s-btn s-btn-ghost" onClick={() => setRenaming(null)}>Cancel</button>
                      <button className="s-btn s-btn-purple" onClick={() => libRename(renaming, renameVal)}>Save</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Interpolation modal */}
              {interpFile && (
                <div className="s-preview-overlay" onClick={() => setInterpFile(null)}>
                  <div className="s-rename-modal" onClick={(e) => e.stopPropagation()}>
                    <h3>Frame Interpolation</h3>
                    <p className="s-sub" style={{ marginBottom: 12 }}>Smooth {interpFile} with AI frame generation.</p>
                    <div className="s-style-group">
                      <label>Algorithm</label>
                      <div className="s-pills">
                        <button className={`s-pill ${interpAlgo === "rife" ? "active" : ""}`} onClick={() => setInterpAlgo("rife")}>RIFE <span className="s-pill-dim">fast, great quality</span></button>
                        <button className={`s-pill ${interpAlgo === "film" ? "active" : ""}`} onClick={() => setInterpAlgo("film")}>FILM <span className="s-pill-dim">smooth motion</span></button>
                        <button className={`s-pill ${interpAlgo === "gmfss" ? "active" : ""}`} onClick={() => setInterpAlgo("gmfss")}>GMFSS <span className="s-pill-dim">highest quality</span></button>
                      </div>
                    </div>
                    <div className="s-style-group">
                      <label>Frame Rate Boost</label>
                      <div className="s-pills">
                        <button className={`s-pill ${interpMult === 2 ? "active" : ""}`} onClick={() => setInterpMult(2)}>2x <span className="s-pill-dim">16→32fps</span></button>
                        <button className={`s-pill ${interpMult === 4 ? "active" : ""}`} onClick={() => setInterpMult(4)}>4x <span className="s-pill-dim">16→64fps</span></button>
                      </div>
                    </div>
                    <div className="s-nav" style={{ marginTop: 12 }}>
                      <button className="s-btn s-btn-ghost" onClick={() => setInterpFile(null)}>Cancel</button>
                      <button className="s-btn s-btn-purple" disabled={interpolating} onClick={interpolateVideo}>{interpolating ? "Processing..." : "Smooth Video"}</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="s-lib-grid">
                {library.map((f) => (
                  <div key={f.filename} className={`s-lib-card ${selected.has(f.filename) ? "s-lib-selected" : ""}`}>
                    <div className="s-lib-thumb" onClick={() => setPreviewFile(f)}>
                      {f.thumbUrl ? (
                        <img src={`${API}${f.thumbUrl}`} alt={f.label} loading="lazy" />
                      ) : (
                        <div className="s-lib-no-thumb">🎬</div>
                      )}
                      <div className="s-lib-play">▶</div>
                    </div>
                    <div className="s-lib-info">
                      <span className="s-lib-name" title={f.label}>{f.label}</span>
                      <span className="s-lib-meta">{fmtSize(f.size)} · {fmtDate(f.created)}</span>
                    </div>
                    <div className="s-lib-row">
                      <label className="s-lib-check">
                        <input type="checkbox" checked={selected.has(f.filename)} onChange={() => toggleSelect(f.filename)} />
                      </label>
                      <button className="s-lib-action" onClick={() => copyShare(f.filename)} title="Copy share link">🔗</button>
                      <a href={`${API}${f.url}`} download className="s-lib-action" title="Download">⬇</a>
                      <button className="s-lib-action" onClick={() => { setRenaming(f.filename); setRenameVal(f.label); }} title="Rename">✏️</button>
                      {f.filename.endsWith(".mp4") && <button className="s-lib-action" onClick={() => { setInterpFile(f.filename); setInterpAlgo("rife"); setInterpMult(2); }} title="Smooth (frame interpolation)">🎞️</button>}
                      <button className="s-lib-action s-lib-action-del" onClick={() => libDelete([f.filename])} title="Delete">🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Tools Tab ── */}
          {tab === "tools" && (
            <div className="s-card s-fade" style={{ maxWidth: 900 }}>
              <h2>Advanced Tools</h2>
              <p className="s-sub">ComfyUI-powered capabilities running locally on DGX Spark.</p>

              <div className="s-tools-grid">
                <div className="s-tool-card s-tool-live" onClick={() => { setGenMode("t2v"); setTab("create"); setStep("describe"); }}>
                  <div className="s-tool-icon">🎬</div>
                  <div className="s-tool-info">
                    <span className="s-tool-name">Text to Video</span>
                    <span className="s-tool-desc">Describe a scene, get cinematic footage. Wan 2.1 14B & 1.3B.</span>
                  </div>
                  <span className="s-tool-badge s-badge-live">Live</span>
                </div>

                <div className="s-tool-card s-tool-live" onClick={() => { setGenMode("i2v"); setTab("create"); setStep("describe"); }}>
                  <div className="s-tool-icon">📸</div>
                  <div className="s-tool-info">
                    <span className="s-tool-name">Image to Video</span>
                    <span className="s-tool-desc">Upload a photo, animate it with AI. Start & end frame support.</span>
                  </div>
                  <span className="s-tool-badge s-badge-live">Live</span>
                </div>

                <div className="s-tool-card s-tool-live" onClick={() => { setTab("create"); setStep("style"); }}>
                  <div className="s-tool-icon">⬆️</div>
                  <div className="s-tool-info">
                    <span className="s-tool-name">AI Upscaling</span>
                    <span className="s-tool-desc">Real-ESRGAN 4x. Native 720p → 1080p or 4K output.</span>
                  </div>
                  <span className="s-tool-badge s-badge-live">Live</span>
                </div>

                <div className="s-tool-card s-tool-live" onClick={() => setTab("library")}>
                  <div className="s-tool-icon">🔗</div>
                  <div className="s-tool-info">
                    <span className="s-tool-name">Clip Combine</span>
                    <span className="s-tool-desc">Select multiple clips in Library, stitch into one video.</span>
                  </div>
                  <span className="s-tool-badge s-badge-live">Live</span>
                </div>

                <div className="s-tool-card s-tool-live" onClick={() => { setCreationMode("image"); setTab("create"); setStep("describe"); }}>
                  <div className="s-tool-icon">🖼️</div>
                  <div className="s-tool-info">
                    <span className="s-tool-name">Image Generation</span>
                    <span className="s-tool-desc">FLUX Schnell still image generation. Product shots, concept art, marketing assets.</span>
                  </div>
                  <span className="s-tool-badge s-badge-live">Live</span>
                </div>

                <div className="s-tool-card s-tool-live" onClick={() => { setGenMode("i2v"); setTab("create"); setStep("describe"); }}>
                  <div className="s-tool-icon">🎨</div>
                  <div className="s-tool-info">
                    <span className="s-tool-name">Style Transfer</span>
                    <span className="s-tool-desc">Upload a style reference image + describe what to generate. CLIP Vision powered.</span>
                  </div>
                  <span className="s-tool-badge s-badge-live">Live</span>
                </div>

                <div className="s-tool-card s-tool-live" onClick={() => { setTab("create"); setStep("describe"); }}>
                  <div className="s-tool-icon">🔀</div>
                  <div className="s-tool-info">
                    <span className="s-tool-name">Batch Variations</span>
                    <span className="s-tool-desc">Generate up to 8 variations with different seeds. Pick the best one.</span>
                  </div>
                  <span className="s-tool-badge s-badge-live">Live</span>
                </div>

                <div className="s-tool-card s-tool-live" onClick={() => setTab("library")}>
                  <div className="s-tool-icon">🎞️</div>
                  <div className="s-tool-info">
                    <span className="s-tool-name">Frame Interpolation</span>
                    <span className="s-tool-desc">RIFE / FILM / GMFSS frame smoothing. Turn choppy clips into buttery 60fps.</span>
                  </div>
                  <span className="s-tool-badge s-badge-live">Live</span>
                </div>

                <div className="s-tool-card s-tool-live" onClick={() => { setChatOpen(true); setChatTab("builder"); }}>
                  <div className="s-tool-icon">🤖</div>
                  <div className="s-tool-info">
                    <span className="s-tool-name">Prompt Builder</span>
                    <span className="s-tool-desc">Structured prompt builder with dropdowns. No AI needed, always works.</span>
                  </div>
                  <span className="s-tool-badge s-badge-live">Live</span>
                </div>

                <div className="s-tool-card s-tool-live" onClick={() => { setChatOpen(true); setChatTab("ai"); }}>
                  <div className="s-tool-icon">💬</div>
                  <div className="s-tool-info">
                    <span className="s-tool-name">AI Prompt Chat</span>
                    <span className="s-tool-desc">Chat with Qwen 3.5 35B to collaboratively craft prompts. Requires Inference mode.</span>
                  </div>
                  <span className="s-tool-badge s-badge-live">Live</span>
                </div>

                <div className="s-tool-card">
                  <div className="s-tool-icon">🎭</div>
                  <div className="s-tool-info">
                    <span className="s-tool-name">ControlNet</span>
                    <span className="s-tool-desc">Pose, depth, and edge guided generation. Model downloading now.</span>
                  </div>
                  <span className="s-tool-badge s-badge-soon">Downloading</span>
                </div>

                <div className="s-tool-card">
                  <div className="s-tool-icon">🗣️</div>
                  <div className="s-tool-info">
                    <span className="s-tool-name">Talking Portrait</span>
                    <span className="s-tool-desc">FantasyTalking / FantasyPortrait — animate faces, lip sync. Needs wav2vec model.</span>
                  </div>
                  <span className="s-tool-badge s-badge-soon">Needs Model</span>
                </div>

                <div className="s-tool-card">
                  <div className="s-tool-icon">📐</div>
                  <div className="s-tool-info">
                    <span className="s-tool-name">Inpainting / VACE</span>
                    <span className="s-tool-desc">Mask regions, remove objects, enhance video aesthetics. Needs VACE model.</span>
                  </div>
                  <span className="s-tool-badge s-badge-soon">Needs Model</span>
                </div>

                <div className="s-tool-card">
                  <div className="s-tool-icon">🎵</div>
                  <div className="s-tool-info">
                    <span className="s-tool-name">Audio / Ovi</span>
                    <span className="s-tool-desc">MMAudio integration — add audio to generated video. Ovi nodes installed, needs MMAudio model.</span>
                  </div>
                  <span className="s-tool-badge s-badge-soon">Needs Model</span>
                </div>

                <div className="s-tool-card">
                  <div className="s-tool-icon">🕺</div>
                  <div className="s-tool-info">
                    <span className="s-tool-name">Motion Control</span>
                    <span className="s-tool-desc">ReCamMaster camera re-animation, WanMove motion tracking, SteadyDancer. Nodes installed.</span>
                  </div>
                  <span className="s-tool-badge s-badge-soon">Needs Model</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Create Tab ── */}
          {tab === "create" && <>

          {/* Creation mode: Video or Image */}
          <div className="s-mode-toggle" style={{ maxWidth: 300, marginBottom: 16 }}>
            <button className={`s-mode-btn ${creationMode === "video" ? "active" : ""}`} onClick={() => { setCreationMode("video"); setStep("describe"); }}>Video</button>
            <button className={`s-mode-btn ${creationMode === "image" ? "active" : ""}`} onClick={() => { setCreationMode("image"); setStep("describe"); }}>Image</button>
          </div>

          {/* ── IMAGE CREATION FLOW ── */}
          {creationMode === "image" && step === "describe" && (
            <div className="s-card s-fade">
              <h2>Describe your image</h2>
              <p className="s-sub">Be specific — subject, setting, lighting, camera angle, style.</p>
              <textarea className="s-textarea" rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Professional product photo of a matte-black headphone on white marble, soft studio lighting..." autoFocus />
              <div className="s-char-count">{description.length} chars</div>

              <div className="s-examples">
                <span className="s-examples-label">Examples — click to use:</span>
                {IMAGE_EXAMPLES.map((ex, i) => (
                  <button key={i} className="s-example-btn" onClick={() => setDescription(ex)}>
                    {ex.length > 90 ? ex.slice(0, 90) + "..." : ex}
                  </button>
                ))}
              </div>

              <div className="s-nav">
                <span />
                <button className="s-btn s-btn-purple" disabled={description.trim().length < 5} onClick={() => { setEditedPrompt(description); setStep("style"); }}>Next: Style →</button>
              </div>
            </div>
          )}

          {creationMode === "image" && step === "style" && (
            <div className="s-card s-fade s-card-wide">
              <h2>Image Settings</h2>
              <div className="s-style-group">
                <label>Model — pick your quality vs speed</label>
                <div className="s-model-cards">
                  {IMAGE_MODELS_LIST.map((m) => (
                    <button key={m.id} className={`s-model-card ${imageModel === m.id ? "active" : ""} s-model-${m.tier}`} onClick={() => setImageModel(m.id)}>
                      <div className="s-model-top">
                        <span className="s-model-name">{m.label}</span>
                        <span className={`s-model-quality s-q-${m.tier}`}>{m.quality}</span>
                      </div>
                      <span className="s-model-speed">{m.desc}</span>
                      <p className="s-model-best">{m.bestFor}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="s-style-group">
                <label>Aspect Ratio</label>
                <div className="s-pills">{IMAGE_ASPECTS.map((a) => (
                  <button key={a.id} className={`s-pill ${imageAspect === a.id ? "active" : ""}`} onClick={() => setImageAspect(a.id)}>
                    <span className="s-pill-icon">{a.icon}</span> {a.label} <span className="s-pill-dim">{a.size}</span>
                  </button>
                ))}</div>
              </div>

              <button className="s-neg-toggle" onClick={() => setShowNeg(!showNeg)}>{showNeg ? "▾" : "▸"} Negative prompt</button>
              {showNeg && <textarea className="s-textarea s-textarea-sm" rows={2} value={negative} onChange={(e) => setNegative(e.target.value)} />}

              <div className="s-nav">
                <button className="s-btn s-btn-ghost" onClick={() => setStep("describe")}>← Back</button>
                <button className="s-btn s-btn-purple" onClick={() => { setEditedPrompt(description); setStep("review"); }}>Review →</button>
              </div>
            </div>
          )}

          {creationMode === "image" && step === "review" && (
            <div className="s-card s-fade">
              <h2>Review & Generate</h2>
              <textarea className="s-textarea" rows={5} value={editedPrompt} onChange={(e) => setEditedPrompt(e.target.value)} />
              <div className="s-review-grid">
                <div className="s-review-item"><span className="s-review-label">Model</span><span>{IMAGE_MODELS_LIST.find(m => m.id === imageModel)?.label}</span></div>
                <div className="s-review-item"><span className="s-review-label">Aspect</span><span>{IMAGE_ASPECTS.find(a => a.id === imageAspect)?.label}</span></div>
              </div>
              <div className="s-estimate">Estimated time: <strong>{currentImageEstimate}</strong></div>
              <div className="s-nav">
                <button className="s-btn s-btn-ghost" onClick={() => setStep("style")}>← Back</button>
                <button className="s-btn s-btn-generate" disabled={!comfyOk || editedPrompt.trim().length < 5} onClick={() => generateImage()}>
                  Generate Image{!isAdmin && ` (${STUDIO_COSTS[imageModel] ?? 1} cr)`}
                </button>
              </div>
            </div>
          )}

          {creationMode === "image" && step === "generating" && (
            <div className="s-card s-fade s-center-card">
              {genStatus === "error" ? (
                <>
                  <div style={{ fontSize: 48 }}>❌</div>
                  <h2>Generation Failed</h2>
                  <p className="s-error-msg">{genError}</p>
                  <button className="s-btn s-btn-purple" onClick={() => setStep("review")}>Try Again</button>
                </>
              ) : (
                <>
                  <div className="s-spinner" />
                  <div className="s-timer">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</div>
                  <h2>{genStatus === "queued" ? "Loading model..." : "Generating image..."}</h2>
                  {genProgress && genProgress.totalSteps > 0 && (
                    <div className="s-step-progress">
                      <div className="s-step-bar"><div className="s-step-fill" style={{ width: `${(genProgress.step / genProgress.totalSteps) * 100}%` }} /></div>
                      <span className="s-step-label">Step {genProgress.step} / {genProgress.totalSteps}</span>
                    </div>
                  )}
                  <p className="s-sub">Running locally on DGX Spark</p>
                  {promptId && <button className="s-btn s-btn-cancel" onClick={() => deleteJob(promptId)}>Cancel Generation</button>}
                </>
              )}
            </div>
          )}

          {creationMode === "image" && step === "done" && (
            <div className="s-card s-fade s-center-card">
              <h2>Your image is ready</h2>
              <p className="s-sub">Generated in {elapsed}s on DGX Spark</p>
              {imageUrl && <img src={imageUrl} alt="Generated" className="s-video" style={{ borderRadius: 12 }} />}
              <div className="s-nav-wrap">
                <button className="s-btn s-btn-ghost" onClick={reset}>New Image</button>
                <button className="s-btn s-btn-purple" onClick={() => { setStep("review"); }}>Tweak & Retry</button>
                {imageUrl && <a href={imageUrl} download className="s-btn s-btn-green" target="_blank" rel="noreferrer">Download PNG</a>}
              </div>
              {/* AI Review */}
              {isAdmin && imageUrl && !critique && <>
                <button className="s-btn s-btn-review" disabled={reviewing} onClick={() => runCritique(imageUrl, editedPrompt || description, "image")}>
                  {reviewing ? REVIEW_PHASES[reviewPhase] : isAdmin ? "AI Review — Find Issues" : "AI Review (Admin)"}
                </button>
                {reviewing && <div className="s-review-bar"><div className="s-review-bar-fill" style={{ width: `${((reviewPhase + 1) / REVIEW_PHASES.length) * 100}%` }} /></div>}
              </>}
              {reviewError && <p className="s-error-msg">{reviewError}</p>}
              {renderCritiquePanel(() => { if (imageUrl) runCritique(imageUrl, editedPrompt || description, "image"); })}
            </div>
          )}

          {/* ── VIDEO CREATION FLOW ── */}
          {creationMode === "video" && <>
          <div className="s-steps">
            {(["describe", "style", "review"] as const).map((s, i) => (
              <div key={s} className={`s-step-dot ${step === s ? "active" : ""} ${["describe", "style", "review"].indexOf(step as string) > i ? "done" : ""}`}>{i + 1}</div>
            ))}
          </div>

          {/* ── Step 1: Describe ── */}
          {step === "describe" && (
            <div className="s-card s-fade">
              <div className="s-mode-toggle">
                <button className={`s-mode-btn ${genMode === "t2v" ? "active" : ""}`} onClick={() => setGenMode("t2v")}>Text to Video</button>
                <button className={`s-mode-btn ${genMode === "i2v" ? "active" : ""}`} onClick={() => setGenMode("i2v")}>Animate Image</button>
              </div>

              {genMode === "i2v" ? (
                <>
                  <h2>Upload & Describe</h2>
                  <p className="s-sub">Upload a photo to animate. Optionally add an end frame for interpolation.</p>

                  <div className="s-upload-grid">
                    <div className="s-upload-box">
                      <span className="s-upload-label">Start Frame (required)</span>
                      {startImagePreview ? (
                        <div className="s-upload-preview">
                          <img src={startImagePreview} alt="Start" />
                          <button className="s-upload-remove" onClick={() => { setStartImage(null); setStartImagePreview(""); setStartImageFilename(""); }}>✕</button>
                        </div>
                      ) : (
                        <label className="s-upload-drop">
                          <span>Click to upload</span>
                          <span className="s-upload-hint">JPG, PNG, WebP</span>
                          <input type="file" accept="image/*" onChange={handleStartImage} hidden />
                        </label>
                      )}
                      {uploading && !startImageFilename && <span className="s-upload-status">Uploading...</span>}
                    </div>

                    <div className="s-upload-box">
                      <span className="s-upload-label">End Frame (optional)</span>
                      {endImagePreview ? (
                        <div className="s-upload-preview">
                          <img src={endImagePreview} alt="End" />
                          <button className="s-upload-remove" onClick={() => { setEndImage(null); setEndImagePreview(""); setEndImageFilename(""); }}>✕</button>
                        </div>
                      ) : (
                        <label className="s-upload-drop">
                          <span>Click to upload</span>
                          <span className="s-upload-hint">AI interpolates between frames</span>
                          <input type="file" accept="image/*" onChange={handleEndImage} hidden />
                        </label>
                      )}
                    </div>
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <p className="s-sub" style={{ marginBottom: 8 }}>Describe the motion you want (optional but helps):</p>
                    <textarea className="s-textarea" rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g., Camera slowly pans right, waves crash, clouds drift across the sky..." />
                  </div>

                  <div className="s-nav">
                    <span />
                    <button className="s-btn s-btn-purple" disabled={!startImageFilename || uploading} onClick={() => { if (!description.trim()) setDescription("Animate this image with natural, cinematic motion"); setStep("style"); }}>
                      {uploading ? "Uploading..." : "Next: Style →"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2>Describe your vision</h2>
                  <p className="s-sub">Be specific — colors, materials, setting, time of day, what's happening.</p>
                  <textarea className="s-textarea" rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ocean waves crashing on cliffs at sunset, mist rising, golden light..." autoFocus />
                  <div className="s-char-count">{description.length} chars {description.length < 20 && description.length > 0 ? "— try to write more for better results" : ""}</div>

                  <div className="s-examples">
                    <span className="s-examples-label">Examples — click to use:</span>
                    {Object.entries(EXAMPLES).map(([cat, exs]) => (
                      exs.map((ex, i) => (
                        <button key={`${cat}-${i}`} className="s-example-btn" onClick={() => setDescription(ex)}>
                          <span className="s-example-tag">{cat === "broll" ? "B-Roll" : cat === "realestate" ? "Real Estate" : cat === "social" ? "Social" : cat === "nature" ? "Nature" : cat === "product" ? "Product" : "Creative"}</span>
                          {ex.length > 90 ? ex.slice(0, 90) + "..." : ex}
                        </button>
                      ))
                    ))}
                  </div>

                  <div className="s-nav">
                    <span />
                    <button className="s-btn s-btn-purple" disabled={description.trim().length < 5} onClick={() => setStep("style")}>Next: Style →</button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Step 3: Style + Settings ── */}
          {step === "style" && (
            <div className="s-card s-fade s-card-wide">
              <h2>Style & Settings</h2>
              <p className="s-sub">Fine-tune the look. Leave on Auto/defaults if unsure.</p>

              <div className="s-two-col">
                <div className="s-col">
                  <div className="s-style-group">
                    <label>Camera Movement</label>
                    <div className="s-pills">{CAMERAS.map((c) => (<button key={c.id} className={`s-pill ${camera === c.id ? "active" : ""}`} onClick={() => setCamera(c.id)}>{c.label}</button>))}</div>
                  </div>
                  <div className="s-style-group">
                    <label>Lighting</label>
                    <div className="s-pills">{LIGHTINGS.map((l) => (<button key={l.id} className={`s-pill ${lighting === l.id ? "active" : ""}`} onClick={() => setLighting(l.id)}>{l.label}</button>))}</div>
                  </div>
                  <div className="s-style-group">
                    <label>Mood</label>
                    <div className="s-pills">{MOODS.map((m) => (<button key={m.id} className={`s-pill ${mood === m.id ? "active" : ""}`} onClick={() => setMood(m.id)}>{m.label}</button>))}</div>
                  </div>
                </div>

                <div className="s-col">
                  <div className="s-style-group">
                    <label>Aspect Ratio</label>
                    <div className="s-pills">{ASPECTS.map((a) => (
                      <button key={a.id} className={`s-pill ${aspect === a.id ? "active" : ""}`} onClick={() => setAspect(a.id)}>
                        <span className="s-pill-icon">{a.icon}</span> {a.label} <span className="s-pill-dim">{a.size}</span>
                      </button>
                    ))}</div>
                  </div>
                  <div className="s-style-group">
                    <label>Duration</label>
                    <div className="s-pills">{DURATIONS.map((d) => (
                      <button key={d.id} className={`s-pill ${duration === d.id ? "active" : ""}`} onClick={() => setDuration(d.id)}>
                        {d.label} <span className="s-pill-dim">{d.desc}</span>
                      </button>
                    ))}</div>
                    {FRAMEPACK_IDS.has(duration) && (
                      <p className="s-hint s-hint-fp">FramePack enabled — generates in context windows for consistent long-form video. VRAM stays constant regardless of length. Creator mode recommended for 14B.</p>
                    )}
                  </div>
                  <div className="s-style-group">
                    <label>Quality ({stepsVal} steps)</label>
                    <div className="s-pills">{QUALITY_PRESETS.map((q) => (
                      <button key={q.id} className={`s-pill ${quality === q.id ? "active" : ""}`} onClick={() => setQuality(q.id)}>
                        {q.label} <span className="s-pill-dim">{q.desc}</span>
                      </button>
                    ))}</div>
                  </div>
                  <div className="s-style-group">
                    <label>Output Resolution</label>
                    <div className="s-pills">
                      <button className={`s-pill ${upscale === "none" ? "active" : ""}`} onClick={() => setUpscale("none")}>Native <span className="s-pill-dim">720p</span></button>
                      <button className={`s-pill ${upscale === "1080p" ? "active" : ""}`} onClick={() => setUpscale("1080p")}>1080p <span className="s-pill-dim">upscaled</span></button>
                      <button className={`s-pill ${upscale === "4k" ? "active" : ""}`} onClick={() => setUpscale("4k")}>4K <span className="s-pill-dim">upscaled</span></button>
                    </div>
                    {upscale !== "none" && <p className="s-hint">Adds Real-ESRGAN 4x upscaling after generation. Adds {upscale === "4k" ? "~60s" : "~30s"}.</p>}
                  </div>
                  <div className="s-style-group">
                    <label>Model — pick your quality vs speed</label>
                    <div className="s-model-cards">
                      <button className={`s-model-card s-model-preview ${model === "wan1.3b" ? "active" : ""}`} onClick={() => setModel("wan1.3b")}>
                        <div className="s-model-top"><span className="s-model-name">Wan 2.1 Draft</span><span className="s-model-quality s-q-draft">6-7/10</span></div>
                        <span className="s-model-speed">Fast preview, ~4-5 min</span>
                        <p className="s-model-best">Quick motion tests, social clips, testing ideas before committing time</p>
                      </button>
                      <button className={`s-model-card s-model-quality ${model === "ltxv23" ? "active" : ""}`} onClick={() => setModel("ltxv23")}>
                        <div className="s-model-top"><span className="s-model-name">LTX-2.3 22B</span><span className="s-model-quality s-q-quality">8/10</span></div>
                        <span className="s-model-speed">Video + Audio, ~20 min · 24fps</span>
                        <p className="s-model-best">The only open model with synchronized audio generation. 22B params, Apache 2.0</p>
                      </button>
                      <button className={`s-model-card s-model-quality ${model === "hunyuan" ? "active" : ""}`} onClick={() => setModel("hunyuan")}>
                        <div className="s-model-top"><span className="s-model-name">HunyuanVideo 13B</span><span className="s-model-quality s-q-quality">8-9/10</span></div>
                        <span className="s-model-speed">Cinematic motion, ~17 min · 24fps</span>
                        <p className="s-model-best">Best physics and motion realism, complex multi-object scenes, Tencent</p>
                      </button>
                      <button className={`s-model-card s-model-best ${model === "wan22" ? "active" : ""}`} onClick={() => setModel("wan22")}>
                        <div className="s-model-top"><span className="s-model-name">Wan 2.2 14B</span><span className="s-model-quality s-q-best">9-10/10</span></div>
                        <span className="s-model-speed">Maximum quality, ~12 min · FramePack 60s</span>
                        <p className="s-model-best">Latest Wan, 83% more training data, cinema-grade textures, FramePack for 30-60s long-form</p>
                      </button>
                    </div>
                    {(model === "wan22" || model === "hunyuan") && mode?.mode !== "creator" && <p className="s-warn">This model requires Creator mode.</p>}
                  </div>
                </div>
              </div>

              <button className="s-neg-toggle" onClick={() => setShowNeg(!showNeg)}>{showNeg ? "▾" : "▸"} Negative prompt (what to avoid)</button>
              {showNeg && (
                <textarea className="s-textarea s-textarea-sm" rows={2} value={negative} onChange={(e) => setNegative(e.target.value)} />
              )}

              <div className="s-nav">
                <button className="s-btn s-btn-ghost" onClick={() => setStep("describe")}>← Back</button>
                <button className="s-btn s-btn-purple" onClick={() => { const bp = buildPreview(); setBasicPrompt(bp); setEditedPrompt(bp); setPromptMode("basic"); setStep("review"); }}>Review Prompt →</button>
              </div>
            </div>
          )}

          {/* ── Step 4: Review (editable prompt) ── */}
          {step === "review" && (
            <div className="s-card s-fade">
              <h2>Review & Edit Prompt</h2>
              <p className="s-sub">This is the exact prompt going to the model. Edit it, or use AI to enhance it.</p>

              <div className="s-prompt-toggle">
                <button className={`s-pill ${promptMode === "basic" ? "active" : ""}`}
                  onClick={() => { setPromptMode("basic"); setEditedPrompt(basicPrompt || buildPreview()); }}>
                  Basic Prompt
                </button>
                <button className={`s-pill s-pill-ai ${promptMode === "enhanced" ? "active" : ""}`}
                  disabled={enhancing}
                  onClick={() => { if (promptMode !== "enhanced") enhancePrompt(); }}>
                  {enhancing ? "Enhancing..." : "AI Enhanced"}
                </button>
              </div>

              {promptMode === "enhanced" && <p className="s-enhance-note">AI rewrote your prompt with cinematic detail, camera terminology, and film-quality language.</p>}

              <textarea className="s-textarea" rows={6} value={editedPrompt} onChange={(e) => setEditedPrompt(e.target.value)} />
              <div className="s-char-count">{editedPrompt.length} chars {editedPrompt.length < 50 ? "— longer prompts = better results" : editedPrompt.length > 100 ? "— great detail level" : ""}</div>

              <div className="s-review-grid">
                <div className="s-review-item"><span className="s-review-label">Model</span><span>{{ wan22: "Wan 2.2 14B", wan14b: "Wan 2.1 14B", "wan1.3b": "Wan 1.3B Draft", hunyuan: "HunyuanVideo 13B", ltxv23: "LTX-2.3 22B" }[model] || model}</span></div>
                <div className="s-review-item"><span className="s-review-label">Aspect</span><span>{ASPECTS.find(a => a.id === aspect)?.label} ({ASPECTS.find(a => a.id === aspect)?.size})</span></div>
                <div className="s-review-item"><span className="s-review-label">Duration</span><span>{DURATIONS.find(d => d.id === duration)?.label}</span></div>
                <div className="s-review-item"><span className="s-review-label">Quality</span><span>{QUALITY_PRESETS.find(q => q.id === quality)?.label} ({stepsVal} steps)</span></div>
                <div className="s-review-item"><span className="s-review-label">Output</span><span>{upscale === "none" ? "720p native" : upscale === "1080p" ? "1080p upscaled" : "4K upscaled"}</span></div>
                <div className="s-review-item"><span className="s-review-label">Prompt</span><span>{promptMode === "enhanced" ? "AI Enhanced" : "Basic"}</span></div>
              </div>

              <div className="s-estimate">
                Estimated time: <strong>{currentEstimate.label}</strong>
              </div>

              <div className="s-nav">
                <button className="s-btn s-btn-ghost" onClick={() => setStep("style")}>← Back</button>
                <button className="s-btn s-btn-generate" disabled={!canGenerate || needsCreator} onClick={() => generate(true)}>
                  Generate Video ({currentEstimate.min >= 60 ? `~${Math.ceil(currentEstimate.min / 60)}min` : `~${currentEstimate.min}s`}{!isAdmin ? ` · ${STUDIO_COSTS[model] ?? 3} cr` : ""})
                </button>
              </div>
            </div>
          )}

          {/* ── Generating ── */}
          {step === "generating" && (
            <div className="s-card s-fade s-center-card">
              {genStatus === "error" ? (
                <>
                  <div style={{ fontSize: 48 }}>❌</div>
                  <h2>Generation Failed</h2>
                  <p className="s-error-msg">{genError}</p>
                  <button className="s-btn s-btn-purple" onClick={() => setStep("review")}>Try Again</button>
                </>
              ) : (
                <>
                  <div className="s-spinner" />
                  <div className="s-timer">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</div>
                  <h2>{genStatus === "queued" ? "Loading model..." : "Generating video..."}</h2>
                  <div className="s-gen-info">
                    <div className="s-gen-info-row"><span className="s-gen-label">Running on</span><span>DGX Spark (local)</span></div>
                    <div className="s-gen-info-row"><span className="s-gen-label">Model</span><span>{{ wan22: "Wan 2.2 14B", wan14b: "Wan 2.1 14B", "wan1.3b": "Wan 2.1 1.3B", hunyuan: "HunyuanVideo 13B", ltxv23: "LTX-2.3 22B" }[model] || model}</span></div>
                    <div className="s-gen-info-row"><span className="s-gen-label">Resolution</span><span>{ASPECTS.find(a => a.id === aspect)?.size} {DURATIONS.find(d => d.id === duration)?.desc}</span></div>
                    <div className="s-gen-info-row"><span className="s-gen-label">Steps</span><span>{stepsVal}</span></div>
                    <div className="s-gen-info-row"><span className="s-gen-label">Status</span><span>{genStatus === "queued" ? "Loading model into memory" : genProgress ? `Step ${genProgress.step} / ${genProgress.totalSteps}` : "Denoising frames"}</span></div>
                    {genProgress && genProgress.totalSteps > 0 && (
                      <div className="s-gen-info-row"><span className="s-gen-label">Progress</span><span style={{ flex: 1 }}><div className="s-step-bar"><div className="s-step-fill" style={{ width: `${(genProgress.step / genProgress.totalSteps) * 100}%` }} /></div></span></div>
                    )}
                    <div className="s-gen-info-row">
                      <span className="s-gen-label">ETA</span>
                      <span>{(() => {
                        const remaining = Math.max(0, currentEstimate.max - elapsed);
                        if (remaining <= 0) return "finishing...";
                        return remaining >= 60 ? `~${Math.floor(remaining / 60)}m ${remaining % 60}s remaining` : `~${remaining}s remaining`;
                      })()}</span>
                    </div>
                  </div>
                  {promptId && <button className="s-btn s-btn-cancel" onClick={() => deleteJob(promptId)}>Cancel Generation</button>}
                  {assembledPrompt && (
                    <div className="s-assembled"><span className="s-review-label">Prompt</span><p>{assembledPrompt}</p></div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Done ── */}
          {step === "done" && (
            <div className="s-card s-fade s-center-card">
              <h2>Your video is ready</h2>
              <p className="s-sub">Generated in {Math.floor(elapsed / 60)}m {elapsed % 60}s on DGX Spark</p>
              {videoUrl && (
                <>
                  <video ref={finalVideoRef} src={videoUrl} controls autoPlay loop muted playsInline className="s-video" />
                  <VideoSpeedChips videoRef={finalVideoRef} large className="mt-2 justify-center" />
                </>
              )}
              <div className="s-nav-wrap">
                <button className="s-btn s-btn-ghost" onClick={reset}>New Video</button>
                <button className="s-btn s-btn-ghost" onClick={goToTweak}>Tweak & Retry</button>
                <button className="s-btn s-btn-purple" onClick={() => generate(true)}>Re-roll (new seed)</button>
                {videoUrl && <a href={videoUrl} download className="s-btn s-btn-green" target="_blank" rel="noreferrer">Download MP4</a>}
              </div>
              {/* AI Review */}
              {isAdmin && videoUrl && !critique && <>
                <button className="s-btn s-btn-review" disabled={reviewing} onClick={() => runCritique(videoUrl, assembledPrompt || editedPrompt || description, "video")}>
                  {reviewing ? REVIEW_PHASES[reviewPhase] : isAdmin ? "AI Review — Find Issues" : "AI Review (Admin)"}
                </button>
                {reviewing && <div className="s-review-bar"><div className="s-review-bar-fill" style={{ width: `${((reviewPhase + 1) / REVIEW_PHASES.length) * 100}%` }} /></div>}
              </>}
              {reviewError && <p className="s-error-msg">{reviewError}</p>}
              {renderCritiquePanel(() => { if (videoUrl) runCritique(videoUrl, assembledPrompt || editedPrompt || description, "video"); })}
            </div>
          )}
          </>}
          </>}
        </div>
      )}

      {/* ── Prompt Assistant Panel ── */}
      {tab === "create" && (
        <button className="s-chat-trigger" onClick={() => setChatOpen(!chatOpen)}>
          {chatOpen ? "✕" : "AI"}
        </button>
      )}

      <div className={`s-chat-panel ${chatOpen ? "open" : ""}`}>
        <div className="s-chat-header">
          <div className="s-chat-tabs">
            <button className={`s-chat-tab ${chatTab === "builder" ? "active" : ""}`} onClick={() => setChatTab("builder")}>Builder</button>
            <button className={`s-chat-tab ${chatTab === "ai" ? "active" : ""}`} onClick={() => setChatTab("ai")}>AI Chat</button>
          </div>
          <button className="s-chat-close" onClick={() => setChatOpen(false)}>✕</button>
        </div>

        {/* ── Builder Tab (Lite Mode — always works) ── */}
        {chatTab === "builder" && (
          <div className="s-chat-messages" style={{ gap: 0 }}>
            <div style={{ padding: "0 0 12px" }}>
              <p className="s-sub" style={{ margin: "0 0 12px", fontSize: 11 }}>Build a cinematic prompt with dropdowns. No AI needed.</p>

              <div className="s-pb-group">
                <label className="s-pb-label">Subject</label>
                <select className="s-pb-select" value={pbSubject} onChange={(e) => setPbSubject(e.target.value)}>
                  {PB_SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>

              {(pbSubject === "" || pbSubject === "nature_landscape" || pbSubject === "social_hook" || pbSubject === "food_bev" || pbSubject === "product_hero" || pbSubject === "product_rotate") && (
                <div className="s-pb-group">
                  <label className="s-pb-label">Describe it</label>
                  <input className="s-pb-input" value={pbCustomSubject} onChange={(e) => setPbCustomSubject(e.target.value)} placeholder="e.g., mountain valley, wireless headphone, latte..." />
                </div>
              )}

              {(pbSubject.startsWith("real_estate")) && (
                <>
                  <div className="s-pb-group">
                    <label className="s-pb-label">Home Style</label>
                    <div className="s-pb-chips">{PB_STYLES.map(s => <button key={s} className={`s-pb-chip ${pbStyle === s ? "active" : ""}`} onClick={() => setPbStyle(s)}>{s}</button>)}</div>
                  </div>
                  <div className="s-pb-group">
                    <label className="s-pb-label">Room</label>
                    <div className="s-pb-chips">{PB_ROOMS.map(r => <button key={r} className={`s-pb-chip ${pbRoom === r ? "active" : ""}`} onClick={() => setPbRoom(r)}>{r}</button>)}</div>
                  </div>
                  <div className="s-pb-group">
                    <label className="s-pb-label">Details (pick multiple)</label>
                    <div className="s-pb-chips">{PB_DETAILS_HOME.map(d => <button key={d} className={`s-pb-chip ${pbDetails.includes(d) ? "active" : ""}`} onClick={() => setPbDetails(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}>{d}</button>)}</div>
                  </div>
                </>
              )}

              {(pbSubject === "product_hero") && (
                <div className="s-pb-group">
                  <label className="s-pb-label">Surface</label>
                  <div className="s-pb-chips">{PB_SURFACES.map(s => <button key={s} className={`s-pb-chip ${pbSurface === s ? "active" : ""}`} onClick={() => setPbSurface(s)}>{s}</button>)}</div>
                </div>
              )}

              <div className="s-pb-group">
                <label className="s-pb-label">Time of Day</label>
                <div className="s-pb-chips">{PB_TIMES.map(t => <button key={t} className={`s-pb-chip ${pbTime === t ? "active" : ""}`} onClick={() => setPbTime(t)}>{t}</button>)}</div>
              </div>

              <div className="s-pb-group">
                <label className="s-pb-label">Atmosphere</label>
                <div className="s-pb-chips">{PB_ATMOSPHERES.map(a => <button key={a} className={`s-pb-chip ${pbAtmosphere === a ? "active" : ""}`} onClick={() => setPbAtmosphere(a)}>{a}</button>)}</div>
              </div>

              <div className="s-pb-group">
                <label className="s-pb-label">Camera / Film Style</label>
                <div className="s-pb-chips">{PB_CAMERA_TERMS.map(c => <button key={c} className={`s-pb-chip ${pbCameraTerm === c ? "active" : ""}`} onClick={() => setPbCameraTerm(c)}>{c}</button>)}</div>
              </div>

              <div className="s-pb-group">
                <label className="s-pb-label">Quality Tag</label>
                <div className="s-pb-chips">{PB_QUALITY.map(q => <button key={q} className={`s-pb-chip ${pbQuality === q ? "active" : ""}`} onClick={() => setPbQuality(q)}>{q}</button>)}</div>
              </div>

              {/* Live preview */}
              <div className="s-pb-preview">
                <label className="s-pb-label">Preview</label>
                <p className="s-pb-preview-text">{buildPromptFromBuilder() || "Select options above to build your prompt..."}</p>
              </div>

              <button className="s-btn s-btn-purple" style={{ width: "100%", marginTop: 12 }}
                disabled={!buildPromptFromBuilder()}
                onClick={() => usePromptFromChat(buildPromptFromBuilder())}>
                Use This Prompt →
              </button>
            </div>
          </div>
        )}

        {/* ── AI Chat Tab (needs vLLM) ── */}
        {chatTab === "ai" && (
          <>
            <div className="s-chat-messages">
              {chatMessages.length === 0 && (
                <div className="s-chat-empty">
                  <p>Chat with AI to craft prompts together. Requires vLLM (Inference mode).</p>
                  <div className="s-chat-starters">
                    {["I want a cinematic real estate walkthrough", "Help me create a product demo video", "I need a dramatic nature scene", "Make me a social media hook"].map((s) => (
                      <button key={s} className="s-chat-starter" onClick={() => { setChatInput(s); }}>{s}</button>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map((msg, i) => {
                if (msg.role === "user") {
                  return <div key={i} className="s-chat-msg s-chat-user">{msg.content}</div>;
                }
                const { cleanContent, prompt } = renderChatMessage(msg.content);
                return (
                  <div key={i} className="s-chat-msg s-chat-ai">
                    {cleanContent && <p>{cleanContent}</p>}
                    {prompt && (
                      <div className="s-chat-prompt-block">
                        <p className="s-chat-prompt-text">{prompt}</p>
                        <button className="s-btn s-btn-sm s-btn-purple" onClick={() => usePromptFromChat(prompt)}>
                          Use This Prompt →
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {chatLoading && <div className="s-chat-msg s-chat-ai s-chat-typing">Thinking...</div>}
              <div ref={chatEndRef} />
            </div>

            <div className="s-chat-input-area">
              <textarea
                className="s-chat-input"
                rows={2}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                placeholder="Describe your vision..."
              />
              <button className="s-chat-send" disabled={!chatInput.trim() || chatLoading} onClick={sendChat}>
                {chatLoading ? "..." : "→"}
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        * { box-sizing: border-box; margin: 0; }
        .s-root { height: 100vh; background: #0a0a0f; color: #e0e0e0; font-family: var(--font-space, 'Inter', system-ui); display: flex; flex-direction: column; overflow: hidden; }
        .s-bar { display: flex; align-items: center; gap: 12px; padding: 10px 20px; background: #111118; border-bottom: 1px solid #1e1e2a; flex-shrink: 0; font-size: 13px; flex-wrap: wrap; }
        .s-back { color: #888; text-decoration: none; font-size: 12px; } .s-back:hover { color: #a855f7; }
        .s-title { font-weight: 600; color: #e2e2e2; font-size: 15px; }
        .s-bar-right { margin-left: auto; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .s-badge { border: 1px solid; border-radius: 4px; padding: 2px 8px; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; }
        .s-mem { color: #555; font-size: 11px; font-variant-numeric: tabular-nums; }
        .s-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .s-btn { padding: 8px 18px; border: 1px solid #2a2a3a; border-radius: 8px; background: #16161f; color: #ccc; font-size: 13px; cursor: pointer; transition: all 0.15s; font-family: inherit; white-space: nowrap; }
        .s-btn:hover:not(:disabled) { background: #1e1e2a; border-color: #444; } .s-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .s-btn-sm { padding: 4px 12px; font-size: 11px; }
        .s-btn-purple { background: #a855f7; border-color: #a855f7; color: #fff; } .s-btn-purple:hover:not(:disabled) { background: #9333ea; }
        .s-btn-green { background: #16a34a; border-color: #16a34a; color: #fff; } .s-btn-green:hover:not(:disabled) { background: #15803d; }
        .s-btn-ghost { background: transparent; border-color: #333; }
        .s-btn-generate { background: linear-gradient(135deg, #a855f7, #6366f1); border: none; color: #fff; font-size: 15px; padding: 12px 32px; font-weight: 600; }
        .s-btn-generate:hover:not(:disabled) { filter: brightness(1.1); }
        .s-btn-cancel { background: transparent; border: 1px solid #ef4444; color: #ef4444; font-size: 13px; padding: 8px 24px; font-weight: 500; margin-top: 16px; cursor: pointer; transition: all 0.15s; }
        .s-btn-cancel:hover { background: #ef4444; color: #fff; }
        .s-btn-review { background: linear-gradient(135deg, #f59e0b, #d97706); border: none; color: #fff; font-size: 13px; padding: 10px 24px; font-weight: 600; margin-top: 16px; width: 100%; max-width: 320px; border-radius: 10px; cursor: pointer; transition: all 0.15s; }
        .s-btn-review:hover:not(:disabled) { filter: brightness(1.1); } .s-btn-review:disabled { opacity: 0.5; cursor: not-allowed; }
        .s-critique { width: 100%; max-width: 560px; margin-top: 16px; background: #16161f; border: 1px solid #2a2a3a; border-radius: 12px; padding: 20px; text-align: left; }
        .s-critique-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
        .s-critique-score { font-size: 24px; font-weight: 700; padding: 4px 12px; border-radius: 8px; }
        .s-critique-score.good { color: #22c55e; background: #0a1a10; border: 1px solid #22c55e40; }
        .s-critique-score.ok { color: #f59e0b; background: #1a1508; border: 1px solid #f59e0b40; }
        .s-critique-score.bad { color: #ef4444; background: #1a0a0a; border: 1px solid #ef444440; }
        .s-critique-summary { color: #ccc; font-size: 14px; line-height: 1.4; }
        .s-critique-section { margin-top: 12px; }
        .s-critique-label { display: block; font-size: 11px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
        .s-critique-issue { display: flex; align-items: flex-start; gap: 8px; padding: 8px 0; border-bottom: 1px solid #1e1e2a; font-size: 13px; color: #ccc; line-height: 1.4; }
        .s-critique-issue:last-child { border-bottom: none; }
        .s-critique-badge { font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; flex-shrink: 0; }
        .s-critique-issue.minor .s-critique-badge { color: #f59e0b; background: #1a1508; } .s-critique-issue.moderate .s-critique-badge { color: #f97316; background: #1a1008; } .s-critique-issue.major .s-critique-badge { color: #ef4444; background: #1a0a0a; }
        .s-critique-type { color: #a855f7; font-weight: 600; font-size: 12px; flex-shrink: 0; }
        .s-critique-strength { color: #22c55e; font-size: 13px; margin: 4px 0; }
        .s-critique-actions { display: flex; gap: 10px; margin-top: 14px; }
        .s-critique-actions .s-btn-generate { flex: 1; }
        .s-btn-rescan { max-width: 120px !important; width: auto !important; margin-top: 0 !important; font-size: 12px !important; padding: 10px 16px !important; }
        .s-review-bar { width: 100%; max-width: 320px; height: 4px; background: #2a2a3a; border-radius: 2px; margin-top: 8px; overflow: hidden; }
        .s-review-bar-fill { height: 100%; background: linear-gradient(90deg, #f59e0b, #d97706); border-radius: 2px; transition: width 0.5s ease; }
        .s-critique-potential { margin: 12px 0; padding: 12px; background: #0d0d14; border-radius: 8px; border: 1px solid #2a2a3a; }
        .s-potential-bar { position: relative; height: 8px; background: #2a2a3a; border-radius: 4px; margin: 8px 0 4px; }
        .s-potential-fill { height: 100%; background: linear-gradient(90deg, #ef4444, #f59e0b, #22c55e); border-radius: 4px; transition: width 0.3s; }
        .s-potential-cap { position: absolute; top: -20px; transform: translateX(-50%); font-size: 10px; font-weight: 700; color: #a855f7; background: #1a1028; padding: 1px 6px; border-radius: 4px; border: 1px solid #a855f740; white-space: nowrap; }
        .s-potential-limits { font-size: 11px; color: #f59e0b; margin-top: 4px; }
        .s-critique-rec { background: #0d0d14; border-radius: 8px; padding: 12px; border: 1px solid #a855f730; }
        .s-rec-chips { display: flex; gap: 6px; flex-wrap: wrap; margin: 6px 0; }
        .s-rec-chip { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 6px; background: #1a1028; color: #a855f7; border: 1px solid #a855f740; }
        .s-rec-model { background: #0a1a10; color: #22c55e; border-color: #22c55e40; }
        .s-rec-reason { font-size: 12px; color: #999; line-height: 1.4; margin-top: 4px; }
        .s-btn-upgrade { width: 100%; margin-top: 10px; background: linear-gradient(135deg, #22c55e, #16a34a); border: none; color: #fff; font-size: 14px; font-weight: 700; padding: 10px 20px; border-radius: 8px; cursor: pointer; transition: all 0.15s; }
        .s-btn-upgrade:hover { filter: brightness(1.1); }
        .s-model-cards { display: flex; flex-direction: column; gap: 8px; }
        .s-model-card { text-align: left; padding: 14px 16px; background: #0d0d14; border: 1px solid #2a2a3a; border-radius: 10px; cursor: pointer; transition: all 0.15s; font-family: inherit; color: #ccc; }
        .s-model-card:hover { border-color: #555; background: #12121f; }
        .s-model-card.active { border-color: #a855f7; background: #1a1028; }
        .s-model-card.active.s-model-best { border-color: #22c55e; background: #0a1a10; }
        .s-model-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
        .s-model-name { font-weight: 700; font-size: 14px; color: #f0f0f0; }
        .s-model-quality { font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 6px; }
        .s-q-preview { background: #1a1508; color: #888; }
        .s-q-draft { background: #1a1508; color: #f59e0b; }
        .s-q-quality { background: #1a1028; color: #a855f7; }
        .s-q-best { background: #0a1a10; color: #22c55e; }
        .s-model-speed { font-size: 11px; color: #666; }
        .s-model-best { font-size: 12px; color: #999; margin: 6px 0 0; line-height: 1.4; }
        .s-model-card.s-model-soon { opacity: 0.45; cursor: default; border-style: dashed; }
        .s-credit-badge { display: flex; align-items: center; gap: 6px; background: #1a1028; border: 1px solid #a855f740; border-radius: 6px; padding: 3px 10px; font-size: 12px; font-weight: 700; color: #a855f7; }
        .s-credit-tier { font-size: 9px; text-transform: uppercase; background: #a855f730; padding: 1px 5px; border-radius: 3px; }
        .s-center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; padding: 40px; }
        .s-center h2 { color: #ccc; font-size: 20px; } .s-center p { color: #666; max-width: 400px; line-height: 1.5; font-size: 14px; }
        .s-main { flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; padding: 24px 20px 60px; overflow-y: auto; }
        .s-steps { display: flex; gap: 12px; margin-bottom: 24px; }
        .s-step-dot { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; background: #1a1a24; color: #555; border: 2px solid #2a2a3a; transition: all 0.2s; }
        .s-step-dot.active { border-color: #a855f7; color: #a855f7; background: #1a1028; }
        .s-step-dot.done { border-color: #22c55e; color: #22c55e; background: #0a1a10; }
        .s-card { width: 100%; max-width: 640px; background: #12121a; border: 1px solid #1e1e2a; border-radius: 16px; padding: 28px; }
        .s-card-wide { max-width: 820px; }
        .s-card h2 { font-size: 20px; font-weight: 600; margin-bottom: 4px; color: #f0f0f0; }
        .s-sub { color: #666; font-size: 13px; margin-bottom: 16px; line-height: 1.4; }
        .s-center-card { display: flex; flex-direction: column; align-items: center; text-align: center; }
        .s-fade { animation: s-fade-in 0.3s ease; } @keyframes s-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .s-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; } @media (max-width: 600px) { .s-grid-3 { grid-template-columns: repeat(2, 1fr); } }
        .s-option { background: #16161f; border: 1px solid #2a2a3a; border-radius: 12px; padding: 16px 12px; cursor: pointer; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; transition: all 0.15s; font-family: inherit; color: inherit; }
        .s-option:hover { border-color: #555; background: #1a1a28; } .s-option.selected { border-color: #a855f7; background: #1a1028; }
        .s-option-icon { font-size: 28px; } .s-option-label { font-weight: 600; font-size: 13px; } .s-option-hint { font-size: 11px; color: #666; }
        .s-textarea { width: 100%; padding: 12px; background: #0d0d14; border: 1px solid #2a2a3a; border-radius: 10px; color: #e0e0e0; font-size: 14px; font-family: inherit; resize: vertical; line-height: 1.5; outline: none; transition: border-color 0.15s; }
        .s-textarea:focus { border-color: #a855f7; } .s-textarea::placeholder { color: #444; }
        .s-textarea-sm { font-size: 12px; color: #999; }
        .s-char-count { font-size: 11px; color: #444; margin-top: 4px; }
        .s-examples { margin-top: 14px; }
        .s-examples-label { display: block; font-size: 11px; color: #555; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
        .s-example-btn { display: block; width: 100%; text-align: left; background: #0d0d14; border: 1px solid #1e1e2a; border-radius: 8px; padding: 8px 12px; color: #888; font-size: 12px; cursor: pointer; margin-bottom: 4px; font-family: inherit; transition: all 0.15s; line-height: 1.4; }
        .s-example-btn:hover { border-color: #a855f7; color: #ccc; }
        .s-nav { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; gap: 12px; }
        .s-nav-wrap { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 16px; }
        .s-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; } @media (max-width: 700px) { .s-two-col { grid-template-columns: 1fr; } }
        .s-col { display: flex; flex-direction: column; gap: 0; }
        .s-style-group { margin-bottom: 14px; }
        .s-style-group label { display: block; font-size: 11px; font-weight: 600; color: #777; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.06em; }
        .s-pills { display: flex; flex-wrap: wrap; gap: 5px; }
        .s-pill { padding: 5px 12px; border: 1px solid #2a2a3a; border-radius: 20px; background: #16161f; color: #999; font-size: 11px; cursor: pointer; transition: all 0.15s; font-family: inherit; display: inline-flex; align-items: center; gap: 4px; }
        .s-pill:hover { border-color: #555; color: #ccc; } .s-pill.active { border-color: #a855f7; color: #d8b4fe; background: #1a1028; }
        .s-pill-icon { font-size: 10px; } .s-pill-dim { color: #555; font-size: 10px; }
        .s-neg-toggle { background: none; border: none; color: #555; font-size: 12px; cursor: pointer; font-family: inherit; margin-top: 10px; padding: 4px 0; }
        .s-neg-toggle:hover { color: #888; }
        .s-warn { color: #f59e0b; font-size: 11px; margin-top: 4px; }
        .s-review-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 12px 0; }
        .s-review-item { background: #0d0d14; border-radius: 8px; padding: 8px 12px; font-size: 13px; }
        .s-review-label { display: block; font-size: 10px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 2px; }
        .s-spinner { width: 48px; height: 48px; border: 3px solid #2a2a3a; border-top-color: #a855f7; border-radius: 50%; animation: s-spin 0.8s linear infinite; margin-bottom: 8px; }
        @keyframes s-spin { to { transform: rotate(360deg); } }
        .s-timer { font-size: 36px; font-weight: 700; color: #a855f7; font-variant-numeric: tabular-nums; letter-spacing: 0.04em; margin-bottom: 4px; }
        .s-gen-info { background: #0d0d14; border-radius: 10px; padding: 12px 16px; margin: 14px 0; width: 100%; max-width: 400px; text-align: left; }
        .s-gen-info-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; border-bottom: 1px solid #1a1a24; }
        .s-gen-info-row:last-child { border-bottom: none; }
        .s-gen-label { color: #555; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; font-size: 10px; }
        .s-step-progress { width: 100%; max-width: 320px; margin: 8px 0; }
        .s-step-bar { width: 100%; height: 6px; background: #1a1a24; border-radius: 3px; overflow: hidden; }
        .s-step-fill { height: 100%; background: linear-gradient(90deg, #a855f7, #6366f1); border-radius: 3px; transition: width 0.5s ease; }
        .s-step-label { font-size: 12px; color: #888; margin-top: 4px; display: block; font-variant-numeric: tabular-nums; }
        .s-assembled { background: #0d0d14; border-radius: 8px; padding: 12px; margin-top: 12px; max-width: 500px; text-align: left; }
        .s-assembled p { color: #888; font-size: 12px; line-height: 1.5; margin-top: 4px; }
        .s-prompt-toggle { display: flex; gap: 6px; margin-bottom: 12px; }
        .s-pill-ai { background: linear-gradient(135deg, #1a1028, #16161f); }
        .s-pill-ai.active { background: linear-gradient(135deg, #7c3aed, #6366f1); border-color: #8b5cf6; color: #fff; }
        .s-enhance-note { font-size: 11px; color: #8b5cf6; margin-bottom: 8px; font-style: italic; }
        .s-hint { font-size: 11px; color: #666; margin-top: 4px; }
        .s-hint-fp { color: #8b5cf6; background: #0d0814; padding: 8px 10px; border-radius: 6px; border: 1px solid #1a1028; margin-top: 8px; }
        .s-tabs { display: flex; gap: 4px; margin-bottom: 20px; background: #111118; border-radius: 10px; padding: 3px; }
        .s-tab { padding: 8px 20px; border: none; border-radius: 8px; background: transparent; color: #666; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s; display: flex; align-items: center; gap: 6px; }
        .s-tab:hover { color: #ccc; }
        .s-tab.active { background: #1e1e2a; color: #e0e0e0; }
        .s-tab-badge { background: #a855f7; color: #fff; font-size: 10px; padding: 1px 6px; border-radius: 10px; font-weight: 700; }

        .s-queue-section { margin-top: 16px; }
        .s-queue-heading { display: block; font-size: 10px; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
        .s-queue-job { background: #0d0d14; border: 1px solid #1e1e2a; border-radius: 10px; padding: 12px 14px; margin-bottom: 8px; }
        .s-queue-running { border-color: #a855f7; border-left: 3px solid #a855f7; }
        .s-queue-done { border-color: #1e1e2a; }
        .s-queue-job-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 12px; }
        .s-queue-status { font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 0.06em; padding: 2px 8px; border-radius: 4px; }
        .s-queue-status.running { color: #a855f7; background: #1a1028; }
        .s-queue-status.pending { color: #f59e0b; background: #1a1508; }
        .s-queue-status.success { color: #22c55e; background: #0a1a10; }
        .s-queue-status.error { color: #ef4444; background: #1a0a0a; }
        .s-queue-model { color: #888; font-weight: 600; }
        .s-queue-meta { color: #555; font-size: 11px; }
        .s-queue-timer { color: #a855f7; font-weight: 700; font-variant-numeric: tabular-nums; margin-left: auto; font-size: 14px; }
        .s-queue-eta { display: block; font-size: 10px; color: #666; font-weight: 400; }
        .s-estimate { background: #0d0d14; border: 1px solid #1e1e2a; border-radius: 8px; padding: 10px 14px; margin-top: 12px; font-size: 13px; color: #888; text-align: center; }
        .s-estimate strong { color: #a855f7; }
        .s-queue-prompt { color: #666; font-size: 11px; margin-top: 6px; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .s-queue-file { color: #888; font-size: 11px; }
        .s-queue-actions { display: flex; gap: 6px; margin-top: 6px; }
        .s-queue-delete { background: none; border: none; color: #444; cursor: pointer; font-size: 14px; margin-left: auto; padding: 2px 6px; border-radius: 4px; transition: all 0.15s; }
        .s-queue-delete:hover { color: #ef4444; background: #1a0a0a; }
        .s-queue-heading-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
        .s-btn-danger { color: #ef4444; border-color: #3a1a1a; } .s-btn-danger:hover:not(:disabled) { background: #1a0a0a; border-color: #ef4444; }

        .s-upload-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        @media (max-width: 500px) { .s-upload-grid { grid-template-columns: 1fr; } }
        .s-upload-box { display: flex; flex-direction: column; gap: 6px; }
        .s-upload-label { font-size: 11px; font-weight: 600; color: #777; text-transform: uppercase; letter-spacing: 0.06em; }
        .s-upload-drop {
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
          border: 2px dashed #2a2a3a; border-radius: 12px; padding: 28px 16px;
          cursor: pointer; transition: all 0.15s; color: #555; font-size: 13px; text-align: center;
        }
        .s-upload-drop:hover { border-color: #a855f7; color: #a855f7; background: #0d0d14; }
        .s-upload-hint { font-size: 10px; color: #444; }
        .s-upload-preview { position: relative; border-radius: 10px; overflow: hidden; border: 1px solid #2a2a3a; }
        .s-upload-preview img { width: 100%; height: 160px; object-fit: cover; display: block; }
        .s-upload-remove { position: absolute; top: 6px; right: 6px; background: rgba(0,0,0,0.7); border: none; color: #fff; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center; }
        .s-upload-remove:hover { background: #ef4444; }
        .s-upload-status { font-size: 11px; color: #a855f7; }

        .s-error-msg { color: #f87171; font-size: 13px; max-width: 400px; }
        .s-video { width: 100%; max-width: 560px; border-radius: 12px; margin: 14px 0; background: #000; }

        .s-tab-badge-dim { background: #333; color: #888; }
        .s-lib-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
        .s-lib-actions { display: flex; gap: 6px; flex-wrap: wrap; }
        .s-lib-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
        @media (max-width: 500px) { .s-lib-grid { grid-template-columns: repeat(2, 1fr); } }
        .s-lib-card { background: #0d0d14; border: 1px solid #1e1e2a; border-radius: 10px; overflow: hidden; transition: all 0.15s; }
        .s-lib-card:hover { border-color: #333; }
        .s-lib-selected { border-color: #a855f7 !important; box-shadow: 0 0 0 1px #a855f7; }
        .s-lib-thumb { position: relative; cursor: pointer; aspect-ratio: 16/9; background: #111; overflow: hidden; }
        .s-lib-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .s-lib-no-thumb { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 32px; }
        .s-lib-play { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.3); color: #fff; font-size: 24px; opacity: 0; transition: opacity 0.15s; }
        .s-lib-thumb:hover .s-lib-play { opacity: 1; }
        .s-lib-info { padding: 8px 10px 4px; }
        .s-lib-name { display: block; font-size: 12px; font-weight: 600; color: #ccc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .s-lib-meta { display: block; font-size: 10px; color: #555; margin-top: 2px; }
        .s-lib-row { display: flex; align-items: center; gap: 2px; padding: 4px 8px 8px; }
        .s-lib-check { display: flex; }
        .s-lib-check input { accent-color: #a855f7; cursor: pointer; }
        .s-lib-action { background: none; border: none; cursor: pointer; font-size: 14px; padding: 2px 4px; border-radius: 4px; transition: background 0.1s; text-decoration: none; }
        .s-lib-action:hover { background: #1e1e2a; }
        .s-lib-action-del:hover { background: #1a0a0a; }

        .s-preview-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .s-preview-modal { background: #12121a; border: 1px solid #2a2a3a; border-radius: 16px; max-width: 700px; width: 100%; max-height: 90vh; overflow-y: auto; position: relative; }
        .s-preview-video { width: 100%; display: block; background: #000; }
        .s-preview-info { padding: 16px; }
        .s-preview-info h3 { font-size: 16px; color: #e0e0e0; margin-bottom: 6px; }
        .s-preview-prompt { font-size: 12px; color: #888; line-height: 1.4; margin-bottom: 8px; }
        .s-preview-meta { display: flex; gap: 12px; font-size: 11px; color: #555; }
        .s-preview-actions { display: flex; gap: 6px; padding: 0 16px 16px; flex-wrap: wrap; }
        .s-preview-close { position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.7); border: none; color: #fff; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; z-index: 2; }
        .s-preview-close:hover { background: #ef4444; }

        .s-rename-modal { background: #12121a; border: 1px solid #2a2a3a; border-radius: 12px; padding: 24px; max-width: 400px; width: 100%; }
        .s-rename-modal h3 { font-size: 16px; color: #e0e0e0; margin-bottom: 12px; }

        /* Mode toggle (t2v / i2v) */
        .s-mode-toggle { display: flex; gap: 4px; background: #111118; border-radius: 10px; padding: 3px; margin-bottom: 20px; }
        .s-mode-btn { flex: 1; padding: 10px 16px; border: none; border-radius: 8px; background: transparent; color: #666; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s; }
        .s-mode-btn:hover { color: #ccc; }
        .s-mode-btn.active { background: #1e1e2a; color: #e0e0e0; box-shadow: 0 1px 4px rgba(0,0,0,0.3); }

        /* Example tags */
        .s-example-tag { display: inline-block; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #a855f7; background: #1a1028; padding: 2px 6px; border-radius: 4px; margin-right: 8px; flex-shrink: 0; }

        /* Tools grid */
        .s-tools-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        @media (max-width: 600px) { .s-tools-grid { grid-template-columns: 1fr; } }
        .s-tool-card { display: flex; align-items: flex-start; gap: 12px; background: #0d0d14; border: 1px solid #1e1e2a; border-radius: 12px; padding: 14px 16px; transition: all 0.15s; position: relative; }
        .s-tool-card.s-tool-live { cursor: pointer; }
        .s-tool-card.s-tool-live:hover { border-color: #a855f7; background: #12121f; }
        .s-tool-icon { font-size: 24px; flex-shrink: 0; margin-top: 2px; }
        .s-tool-info { flex: 1; min-width: 0; }
        .s-tool-name { display: block; font-size: 13px; font-weight: 600; color: #e0e0e0; margin-bottom: 3px; }
        .s-tool-desc { display: block; font-size: 11px; color: #666; line-height: 1.4; }
        .s-tool-badge { position: absolute; top: 10px; right: 10px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 2px 8px; border-radius: 4px; }
        .s-badge-live { color: #22c55e; background: #0a1a10; border: 1px solid #16a34a30; }
        .s-badge-soon { color: #555; background: #1a1a24; border: 1px solid #2a2a3a; }

        /* Chat panel */
        .s-chat-trigger { position: fixed; bottom: 24px; right: 24px; z-index: 50; width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #a855f7, #6366f1); border: none; color: #fff; font-size: 16px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 20px rgba(168,85,247,0.4); transition: all 0.2s; display: flex; align-items: center; justify-content: center; font-family: inherit; }
        .s-chat-trigger:hover { transform: scale(1.1); box-shadow: 0 6px 28px rgba(168,85,247,0.5); }
        .s-chat-panel { position: fixed; top: 0; right: 0; bottom: 0; width: 380px; z-index: 60; background: #0d0d14; border-left: 1px solid #1e1e2a; display: flex; flex-direction: column; transform: translateX(100%); transition: transform 0.3s ease; }
        .s-chat-panel.open { transform: translateX(0); }
        @media (max-width: 640px) { .s-chat-panel { width: 100%; } }
        .s-chat-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #1e1e2a; background: #111118; }
        .s-chat-title { font-weight: 600; font-size: 14px; color: #e0e0e0; }
        .s-chat-close { background: none; border: none; color: #666; font-size: 18px; cursor: pointer; padding: 4px; border-radius: 4px; } .s-chat-close:hover { color: #ccc; background: #1e1e2a; }
        .s-chat-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
        .s-chat-empty { text-align: center; padding: 20px 0; }
        .s-chat-empty p { color: #666; font-size: 13px; line-height: 1.5; margin-bottom: 16px; }
        .s-chat-starters { display: flex; flex-direction: column; gap: 6px; }
        .s-chat-starter { background: #16161f; border: 1px solid #2a2a3a; border-radius: 8px; padding: 10px 12px; color: #999; font-size: 12px; cursor: pointer; font-family: inherit; text-align: left; transition: all 0.15s; line-height: 1.3; }
        .s-chat-starter:hover { border-color: #a855f7; color: #ccc; }
        .s-chat-msg { max-width: 90%; padding: 10px 14px; border-radius: 12px; font-size: 13px; line-height: 1.5; word-break: break-word; }
        .s-chat-user { align-self: flex-end; background: #a855f7; color: #fff; border-bottom-right-radius: 4px; }
        .s-chat-ai { align-self: flex-start; background: #1a1a28; color: #ccc; border-bottom-left-radius: 4px; }
        .s-chat-ai p { margin: 0 0 8px; } .s-chat-ai p:last-child { margin-bottom: 0; }
        .s-chat-typing { color: #888; font-style: italic; }
        .s-chat-prompt-block { background: #0d0d14; border: 1px solid #a855f7; border-radius: 8px; padding: 10px 12px; margin-top: 8px; }
        .s-chat-prompt-text { color: #d8b4fe; font-size: 12px; line-height: 1.5; margin-bottom: 8px !important; font-style: italic; }
        .s-chat-input-area { display: flex; gap: 8px; padding: 12px 16px; border-top: 1px solid #1e1e2a; background: #111118; align-items: flex-end; }
        .s-chat-input { flex: 1; padding: 10px 12px; background: #0d0d14; border: 1px solid #2a2a3a; border-radius: 8px; color: #e0e0e0; font-size: 13px; font-family: inherit; resize: none; outline: none; line-height: 1.4; }
        .s-chat-input:focus { border-color: #a855f7; }
        .s-chat-input::placeholder { color: #444; }
        .s-chat-send { width: 40px; height: 40px; border-radius: 8px; background: #a855f7; border: none; color: #fff; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.15s; font-family: inherit; }
        .s-chat-send:hover:not(:disabled) { background: #9333ea; }
        .s-chat-send:disabled { opacity: 0.35; cursor: not-allowed; }

        /* Chat panel tabs */
        .s-chat-tabs { display: flex; gap: 2px; background: #0d0d14; border-radius: 6px; padding: 2px; }
        .s-chat-tab { padding: 6px 14px; border: none; border-radius: 5px; background: transparent; color: #666; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s; }
        .s-chat-tab:hover { color: #ccc; }
        .s-chat-tab.active { background: #1e1e2a; color: #e0e0e0; }

        /* Prompt Builder */
        .s-pb-group { margin-bottom: 12px; }
        .s-pb-label { display: block; font-size: 10px; font-weight: 600; color: #666; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 5px; }
        .s-pb-select { width: 100%; padding: 8px 10px; background: #16161f; border: 1px solid #2a2a3a; border-radius: 6px; color: #ccc; font-size: 12px; font-family: inherit; outline: none; }
        .s-pb-select:focus { border-color: #a855f7; }
        .s-pb-input { width: 100%; padding: 8px 10px; background: #16161f; border: 1px solid #2a2a3a; border-radius: 6px; color: #ccc; font-size: 12px; font-family: inherit; outline: none; }
        .s-pb-input:focus { border-color: #a855f7; }
        .s-pb-input::placeholder { color: #444; }
        .s-pb-chips { display: flex; flex-wrap: wrap; gap: 4px; }
        .s-pb-chip { padding: 4px 10px; border: 1px solid #2a2a3a; border-radius: 14px; background: #16161f; color: #888; font-size: 10px; cursor: pointer; font-family: inherit; transition: all 0.12s; white-space: nowrap; }
        .s-pb-chip:hover { border-color: #555; color: #ccc; }
        .s-pb-chip.active { border-color: #a855f7; color: #d8b4fe; background: #1a1028; }
        .s-pb-preview { background: #0a0a12; border: 1px solid #1e1e2a; border-radius: 8px; padding: 10px 12px; margin-top: 8px; }
        .s-pb-preview-text { color: #a855f7; font-size: 12px; line-height: 1.5; font-style: italic; margin: 4px 0 0; min-height: 36px; }
      `}</style>
    </div>
  );
}
