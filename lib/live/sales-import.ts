/** RFC 4180-style parsing; no buyer fields leave the browser. */
export function parseSalesCsv(text: string) {
  const rows: string[][] = []; let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (c === "," && !quoted) { row.push(field); field = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) { if (c === "\r" && text[i + 1] === "\n") i++; row.push(field); if (row.some(Boolean)) rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (quoted) throw new Error("CSV has an unfinished quoted field");
  row.push(field); if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) throw new Error("CSV requires a header and sale rows");
  const headers = rows.shift()!.map(h => h.replace(/^\uFEFF/, "").trim());
  return { headers, rows };
}
export function saleAmount(value: string) {
  const clean = value.trim().replace(/^\$/, "").replaceAll(",", "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) throw new Error("Use a USD sale price, e.g. 12.50");
  return Number(clean);
}
