import sharp from "sharp";
const xml = (s: string) => s.replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]!));
export function wrap(s: string, width: number) {
  const lines: string[] = []; let line = "";
  for (const word of s.split(/\s+/)) { if (line && line.length + word.length + 1 > width) { lines.push(line); line = word; } else line += (line ? " " : "") + word; }
  if (line) lines.push(line);
  return lines;
}
export async function renderTip(headline: string, points: string[]) {
  const title = wrap(headline, 24);
  const text = (lines: string[], x: number, y: number, size: number, color: string, weight = 400) => lines.map((line, i) => `<text x="${x}" y="${y + i * size * 1.22}" font-family="DejaVu Sans,Arial,sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}">${xml(line)}</text>`).join("");
  const rows = points.map((p, i) => `<circle cx="108" cy="${615 + i * 155}" r="25" fill="#ffb13a"/>${text([String(i + 1)], 96, 627 + i * 155, 30, "#26103e", 700)}${text(wrap(p, 36), 162, 607 + i * 155, 35, "#f1eaf7")}`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#35165b"/><stop offset="1" stop-color="#160e24"/></linearGradient></defs><rect width="1080" height="1350" fill="url(#bg)"/><circle cx="1065" cy="80" r="210" fill="#7c3aed" opacity=".16"/><rect x="80" y="105" width="80" height="8" rx="4" fill="#ffb13a"/>${text(["THE SECOND LOOK"], 80, 171, 27, "#ffcb75", 700)}${text(title, 80, 290, 66, "#ffffff", 700)}${rows}<line x1="80" x2="1000" y1="1190" y2="1190" stroke="#ffffff" stroke-opacity=".18"/>${text(["TREASURE HAULS"], 80, 1254, 30, "#ffffff", 700)}${text(["Find well. Buy thoughtfully."], 80, 1300, 24, "#c7b6da")}</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}
