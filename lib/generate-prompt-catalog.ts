import type { PromptChipOption } from "./gen2-prompt-chips";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const locations: Record<string, string[]> = {
  "Studio & sets": ["white infinity studio", "black velvet portrait set", "concrete daylight studio", "warm plaster studio", "industrial photo loft", "vintage theater stage", "minimal product studio", "painted canvas backdrop", "greenhouse photo studio", "rooftop portrait set"],
  "Homes & interiors": ["Parisian apartment", "Japanese tatami room", "Scandinavian living room", "mid-century lounge", "Mediterranean courtyard", "art deco penthouse", "rustic farmhouse kitchen", "mountain cabin", "library with floor-to-ceiling books", "modern glass house"],
  "Hotels & hospitality": ["boutique hotel suite", "grand marble hotel lobby", "tropical resort terrace", "desert luxury camp", "overwater bungalow", "historic palace corridor", "rooftop cocktail lounge", "cozy corner cafe", "fine dining restaurant", "train dining carriage"],
  "Cities & architecture": ["New York brownstone steps", "Tokyo side street", "Paris cobblestone lane", "London mews", "Venice canal bridge", "Barcelona tiled courtyard", "modern museum atrium", "glass skyscraper plaza", "old railway platform", "covered market arcade"],
  "Coast & water": ["white sand beach", "rocky Pacific coastline", "secluded Mediterranean cove", "tropical waterfall pool", "wooden lakeside dock", "sailboat deck", "cliffside ocean terrace", "Venetian waterfront", "infinity pool terrace", "misty riverbank"],
  "Gardens & countryside": ["English rose garden", "lavender field", "sunflower field", "Tuscan vineyard", "apple orchard", "wildflower meadow", "bamboo grove", "mossy forest path", "formal hedge garden", "cherry blossom avenue"],
  "Wilderness & travel": ["alpine mountain overlook", "red rock canyon", "rolling desert dunes", "snow-covered pine forest", "Icelandic black sand shore", "tropical rainforest clearing", "open grassland", "volcanic lava field", "salt flat horizon", "Scottish highland hillside"],
  "Fashion & editorial": ["fashion runway backstage", "empty opera house", "marble sculpture gallery", "vintage dressing room", "classic car interior", "private aircraft cabin", "modern dance studio", "antique mirror room", "ornate spiral staircase", "urban parking roof"],
};
const light = [
  ["soft daylight", "soft diffused daylight, gentle natural shadows"],
  ["golden hour", "warm low-angle golden-hour illumination and subtle rim light"],
  ["blue hour", "cool blue-hour ambient light balanced with warm practical lights"],
  ["cinematic contrast", "directional key light, deep controlled shadows, cinematic contrast"],
  ["overcast softness", "broad soft overcast-style illumination and muted highlights"],
  ["editorial flash", "crisp editorial flash, defined shadows and clean subject separation"],
] as const;
export const LOCATION_CATALOG: PromptChipOption[] = Object.entries(locations).flatMap(([group, scenes]) => scenes.flatMap(scene => light.map(([name, description]) => ({
  id: `loc-${slug(scene)}-${slug(name)}`, label: `${scene[0].toUpperCase()}${scene.slice(1)} · ${name}`, group,
  line: `Location: ${scene}, ${description}, coherent environmental detail and natural perspective.`,
}))));

const hairstyles: Record<string, string[]> = {
  "Loose hair": ["long beach waves", "polished Hollywood waves", "loose natural curls", "defined spiral curls", "straight waist-length hair", "soft shoulder-length layers", "voluminous blowout", "side-swept waves"],
  "Short cuts": ["textured pixie cut", "sleek pixie cut", "chin-length French bob", "blunt shoulder-length bob", "wavy lob", "curly cropped cut", "tapered natural afro", "short shag with curtain fringe"],
  "Updos & ponytails": ["sleek high ponytail", "low relaxed ponytail", "high braided ponytail", "loose low chignon", "polished ballet bun", "messy topknot", "French twist", "half-up soft bun"],
  "Braids & texture": ["single loose braid", "double Dutch braids", "fishtail braid", "crown braid", "long box braids", "shoulder-length twists", "long flowing locs", "rounded natural afro"],
};
const colors = ["reference hair color", "jet black", "espresso brown", "chestnut brown", "warm caramel brown", "copper red", "deep auburn", "dark blonde", "honey blonde", "platinum blonde", "silver grey", "rose gold"];
export const HAIR_CATALOG: PromptChipOption[] = Object.entries(hairstyles).flatMap(([group, styles]) => styles.flatMap(style => colors.map(color => ({
  id: `hair-${slug(style)}-${slug(color)}`, label: `${style[0].toUpperCase()}${style.slice(1)} · ${color}`, group,
  line: `Hair: ${style}, ${color === "reference hair color" ? "preserve the reference subject's hair color" : color}, realistic individual strands and believable hairline.`,
}))));

const framing = ["face close-up", "head and shoulders", "chest-up portrait", "waist-up portrait", "three-quarter body", "full-body portrait", "wide environmental portrait", "seated portrait", "walking portrait", "over-the-shoulder portrait"];
const angles = ["eye level, straight on", "eye level, three-quarter view", "eye level, side profile", "slightly low angle", "slightly high angle", "subtle Dutch angle"];
const lenses = [24, 35, 50, 85, 105, 135];
export const CAMERA_CATALOG: PromptChipOption[] = framing.flatMap(frame => angles.flatMap(angle => lenses.map(lens => ({
  id: `cam-${slug(frame)}-${slug(angle)}-${lens}`, label: `${frame[0].toUpperCase()}${frame.slice(1)} · ${angle} · ${lens}mm`, group: frame[0].toUpperCase() + frame.slice(1),
  line: `Camera: ${frame}, ${angle}, ${lens}mm lens perspective, ${lens >= 85 ? "soft background separation" : "natural environmental depth"}, compose within the selected output aspect ratio.`,
}))));
