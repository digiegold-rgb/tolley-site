/**
 * Turn the verified ASIN list into Amazon Idea Lists ("shelves") plus a
 * click-through add sheet.
 *
 * Amazon has no bulk-add API — products go onto a storefront only through the
 * Creator Hub UI, one at a time. The fastest legitimate path is therefore to
 * open each product page and use its "Add to List" dropdown, so this emits an
 * ordered worklist of /dp/ links grouped by the shelf they belong on.
 *
 * Usage: node scripts/storefront-shelves.mjs [--in DIR] [--min-price 12]
 */
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const argVal = (f, d) => (args.indexOf(f) === -1 ? d : args[args.indexOf(f) + 1]);
const DIR = argVal("--in", "/home/jelly/Shared/amazon-push/storefront");
const MIN_PRICE = Number(argVal("--min-price", 12));

/**
 * Read the checkpoint rather than the final export so shelves can be built
 * mid-sweep — Amazon throttles hard enough that a full pass takes hours, and
 * there is no reason to sit on verified inventory while it finishes.
 */
const rows = readFileSync(`${DIR}/verified.jsonl`, "utf8")
  .split("\n")
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l))
  .filter((r) => r.ok);

/**
 * Shelves are keyword-derived: `Product.category` is null on most of the
 * Marketplace-mirrored rows, so the title is the only reliable signal.
 * Order matters — the first match wins, so put narrow buckets first.
 */
const SHELVES = [
  ["Kitchen & Coffee", /kettle|coffee|espresso|blender|mixer|air fryer|cookware|pan\b|knife|kitchen|slushie|ice cream|frother|mug|utensil|cutting board|toaster|instant pot/i],
  ["Cleaning & Laundry", /scrubber|steamer|vacuum|mop|cleaner|laundry|detergent|spin brush|washer|sanitiz|lint/i],
  ["Home & Lighting", /light|lamp|ceiling|recessed|fixture|pillow|blanket|curtain|rug|shelf|storage|organizer|decor|furniture|bed frame|mattress|sofa|chair|fan\b|ventilat/i],
  ["Baby & Kids", /baby|toddler|kids|infant|stroller|bassinet|crib|nursery|lego|toy|playset|flash cards|diaper/i],
  ["Beauty & Personal Care", /hair dryer|facial|skin|beauty|makeup|razor|toothbrush|massag|serum|nail|shampoo/i],
  ["Fitness & Outdoors", /yoga|pilates|fitness|exercise|dumbbell|resistance|bike|camping|tent|crossbow|hiking|workout|treadmill/i],
  ["Tools & Garage", /tool|drill|saw|wrench|tile cutter|ladder|ramp|garage|automotive|car radio|battery|jack\b|compressor|welder/i],
  ["Tech & Gadgets", /ring light|speaker|headphone|charger|camera|monitor|keyboard|tablet|audio|bluetooth|usb|projector|radio/i],
];

const shelfFor = (r) => {
  const hay = `${r.title_amazon ?? ""} ${r.title ?? ""}`;
  return SHELVES.find(([, re]) => re.test(hay))?.[0] ?? "Treasure Haul Finds";
};

// Sub-$12 items rarely clear a meaningful commission and clutter the shelves.
const kept = rows
  .filter((r) => (r.price ?? 0) >= MIN_PRICE)
  .map((r) => ({ ...r, shelf: shelfFor(r) }))
  .sort((a, b) => b.soldCount - a.soldCount || (b.price ?? 0) - (a.price ?? 0));

const grouped = kept.reduce((m, r) => {
  (m[r.shelf] ??= []).push(r);
  return m;
}, {});

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const shelfOrder = Object.entries(grouped).sort((a, b) => b[1].length - a[1].length);

let md = `# Amazon Storefront — add sheet\n\n${kept.length} verified-live products across ${shelfOrder.length} Idea Lists.\n\n`;
for (const [shelf, items] of shelfOrder) {
  md += `## ${shelf} (${items.length})\n\n`;
  for (const r of items) {
    const demand = r.soldCount > 0 ? ` — **sold ${r.soldCount}× on FB**` : "";
    md += `- [\`${r.asin}\`](https://www.amazon.com/dp/${r.asin}) ${esc((r.title_amazon ?? r.title ?? "").slice(0, 90))}${r.price ? ` — $${r.price}` : ""}${demand}\n`;
  }
  md += "\n";
}
writeFileSync(`${DIR}/ADD-SHEET.md`, md);

const totalValue = kept.reduce((a, r) => a + (r.price ?? 0), 0);

/**
 * A stocking worklist, not a document: the operator scans for what is left to
 * do, so progress and per-shelf counts come before any product detail. Shelf
 * headers are set as physical shelf tags because each one maps 1:1 to an
 * Idea List that has to be created by hand in Creator Hub.
 */
const html = `<title>Storefront Stocking Run — digitaljared</title>
<style>
:root{
  --bg:#fbf9f6; --panel:#ffffff; --fg:#1c1a17; --mut:#6d665d; --faint:#98918a;
  --line:#e6e0d7; --line-2:#d3cabd; --acc:#c8531a; --acc-soft:#f6e6dc;
  --proof:#1f6b4a; --proof-soft:#e2efe8;
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --bg:#181613; --panel:#201d19; --fg:#ece7df; --mut:#a29a8f; --faint:#7b736a;
    --line:#302c26; --line-2:#413b33; --acc:#e8763c; --acc-soft:#3a2418;
    --proof:#4bab7e; --proof-soft:#17301f;
  }
}
:root[data-theme="dark"]{
  --bg:#181613; --panel:#201d19; --fg:#ece7df; --mut:#a29a8f; --faint:#7b736a;
  --line:#302c26; --line-2:#413b33; --acc:#e8763c; --acc-soft:#3a2418;
  --proof:#4bab7e; --proof-soft:#17301f;
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0; background:var(--bg); color:var(--fg);
  font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  padding:0 1.1rem 5rem;
}
.wrap{max-width:940px;margin-inline:auto}
header{padding:2.4rem 0 1.2rem}
.eyebrow{
  font:600 .7rem/1 ui-monospace,SFMono-Regular,Menlo,monospace;
  letter-spacing:.16em; text-transform:uppercase; color:var(--acc); margin:0 0 .7rem;
}
h1{
  font-size:clamp(1.75rem,4.4vw,2.5rem); line-height:1.05; margin:0 0 .55rem;
  letter-spacing:-.028em; font-weight:750; text-wrap:balance;
}
.lede{margin:0;color:var(--mut);max-width:60ch}
.lede b{color:var(--fg);font-weight:650}

.rail{
  position:sticky; top:0; z-index:20; background:var(--bg);
  border-bottom:1px solid var(--line); padding:.7rem 0 .6rem; margin-bottom:1.6rem;
}
.rail-top{display:flex;align-items:baseline;gap:.55rem;flex-wrap:wrap}
.count{font:700 1.35rem/1 ui-sans-serif,system-ui,sans-serif;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.count b{color:var(--acc)}
.rail-note{color:var(--mut);font-size:.83rem;margin-left:auto}
.track{height:4px;background:var(--line);border-radius:99px;overflow:hidden;margin-top:.6rem}
.fill{height:100%;width:0;background:var(--acc);border-radius:99px;transition:width .22s ease}
@media (prefers-reduced-motion:reduce){.fill{transition:none}}

.tools{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1.8rem}
input[type=search]{
  flex:1 1 15rem; min-width:0; font:inherit; color:var(--fg);
  background:var(--panel); border:1px solid var(--line-2); border-radius:7px; padding:.5rem .7rem;
}
input[type=search]:focus-visible,button:focus-visible,a:focus-visible,input[type=checkbox]:focus-visible{
  outline:2px solid var(--acc); outline-offset:2px;
}
button{
  font:600 .84rem/1 inherit; color:var(--fg); background:var(--panel);
  border:1px solid var(--line-2); border-radius:7px; padding:.5rem .8rem; cursor:pointer;
}
button:hover{border-color:var(--acc);color:var(--acc)}

section{margin-bottom:2.4rem}
.tag{
  display:flex; align-items:center; gap:.7rem; flex-wrap:wrap;
  border-top:2px solid var(--fg); padding-top:.5rem; margin-bottom:.8rem;
}
.tag h2{
  margin:0; font:650 .78rem/1 ui-monospace,SFMono-Regular,Menlo,monospace;
  letter-spacing:.13em; text-transform:uppercase;
}
.tag .n{
  font:600 .72rem/1 ui-monospace,monospace; color:var(--mut);
  background:var(--panel); border:1px solid var(--line); border-radius:99px; padding:.24rem .5rem;
  font-variant-numeric:tabular-nums;
}
.tag button{margin-left:auto;padding:.32rem .6rem;font-size:.76rem}

ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:3px}
li{
  display:flex; gap:.75rem; align-items:flex-start; background:var(--panel);
  border:1px solid var(--line); border-radius:8px; padding:.6rem .75rem;
}
li:hover{border-color:var(--line-2)}
li.done{opacity:.42}
li.done .name{text-decoration:line-through}
li.hide{display:none}
input[type=checkbox]{
  flex:none; margin:.22rem 0 0; width:1.05rem; height:1.05rem; accent-color:var(--acc); cursor:pointer;
}
.meta{min-width:0;flex:1}
.name{display:block;font-weight:550;overflow-wrap:anywhere}
.name a{color:inherit;text-decoration:none}
.name a:hover{color:var(--acc);text-decoration:underline}
.sub{
  display:flex; align-items:center; gap:.45rem; flex-wrap:wrap;
  margin-top:.28rem; font-size:.79rem; color:var(--mut); font-variant-numeric:tabular-nums;
}
.asin{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--faint)}
.price{font-weight:650;color:var(--fg)}
.chip{
  background:var(--proof-soft); color:var(--proof); border-radius:99px;
  padding:.14rem .48rem; font-size:.73rem; font-weight:650;
}
.empty{color:var(--mut);padding:2rem 0;display:none}
footer{border-top:1px solid var(--line);margin-top:2.5rem;padding-top:1.2rem;color:var(--mut);font-size:.85rem}
footer code{font-family:ui-monospace,monospace;color:var(--acc);overflow-wrap:anywhere}
</style>

<div class="wrap">
<header>
  <p class="eyebrow">Stocking run · amazon.com/shop/digitaljared</p>
  <h1>${kept.length} products to shelve</h1>
  <p class="lede">Every item here is <b>live on Amazon right now</b> and is the new equivalent of something that <b>already sold on your Marketplace</b>. Open a row, then use <b>Add to List</b> on the Amazon page. Ticks save on this device.</p>
</header>

<div class="rail">
  <div class="rail-top">
    <span class="count"><b id="n">0</b> / ${kept.length} shelved</span>
    <span class="rail-note">${shelfOrder.length} Idea Lists · $${Math.round(totalValue).toLocaleString("en-US")} catalog value</span>
  </div>
  <div class="track"><div class="fill" id="fill"></div></div>
</div>

<div class="tools">
  <input type="search" id="q" placeholder="Filter by product or ASIN…" aria-label="Filter products">
  <button id="toggle">Hide shelved</button>
  <button id="reset">Reset ticks</button>
</div>

${shelfOrder
  .map(
    ([shelf, items]) => `<section data-shelf="${esc(shelf)}">
  <div class="tag">
    <h2>${esc(shelf)}</h2>
    <span class="n">${items.length}</span>
    <button class="copy" data-asins="${items.map((r) => r.asin).join(" ")}">Copy ASINs</button>
  </div>
  <ul>${items
    .map(
      (r) => `<li data-a="${r.asin}" data-s="${esc((r.title_amazon ?? r.title ?? "").toLowerCase())} ${r.asin.toLowerCase()}">
      <input type="checkbox" aria-label="Mark ${r.asin} shelved">
      <div class="meta">
        <span class="name"><a href="https://www.amazon.com/dp/${r.asin}" target="_blank" rel="noopener">${esc((r.title_amazon ?? r.title ?? r.asin).slice(0, 118))}</a></span>
        <div class="sub">
          <span class="asin">${r.asin}</span>${r.price ? `<span class="price">$${r.price.toFixed(2)}</span>` : ""}${r.rating ? `<span>★ ${r.rating}</span>` : ""}
          <span class="chip">sold ${r.soldCount}× on FB</span>
        </div>
      </div>
    </li>`
    )
    .join("")}</ul>
</section>`
  )
  .join("\n")}

<p class="empty" id="empty">Nothing matches that filter.</p>

<footer>
  Share the storefront as <code>https://www.amazon.com/shop/digitaljared?tag=tolley-shop-20</code>.
  Dead and delisted ASINs were filtered out before this list was built.
</footer>
</div>

<script>
(function () {
  var KEY = "storefront-shelved-v1";
  var done = new Set(JSON.parse(localStorage.getItem(KEY) || "[]"));
  var rows = Array.prototype.slice.call(document.querySelectorAll("li[data-a]"));
  var nEl = document.getElementById("n");
  var fill = document.getElementById("fill");
  var hiding = false;

  function save() { localStorage.setItem(KEY, JSON.stringify(Array.from(done))); }
  function paint() {
    nEl.textContent = done.size;
    fill.style.width = (rows.length ? (done.size / rows.length) * 100 : 0) + "%";
  }
  function applyFilter() {
    var q = document.getElementById("q").value.trim().toLowerCase();
    var shown = 0;
    rows.forEach(function (li) {
      var hit = !q || li.dataset.s.indexOf(q) !== -1;
      if (hiding && done.has(li.dataset.a)) hit = false;
      li.classList.toggle("hide", !hit);
      if (hit) shown++;
    });
    document.getElementById("empty").style.display = shown ? "none" : "block";
    document.querySelectorAll("section").forEach(function (sec) {
      var any = sec.querySelector("li:not(.hide)");
      sec.style.display = any ? "" : "none";
    });
  }

  rows.forEach(function (li) {
    var box = li.querySelector("input[type=checkbox]");
    if (done.has(li.dataset.a)) { box.checked = true; li.classList.add("done"); }
    box.addEventListener("change", function () {
      if (box.checked) done.add(li.dataset.a); else done.delete(li.dataset.a);
      li.classList.toggle("done", box.checked);
      save(); paint(); if (hiding) applyFilter();
    });
  });

  document.getElementById("q").addEventListener("input", applyFilter);

  document.getElementById("toggle").addEventListener("click", function () {
    hiding = !hiding;
    this.textContent = hiding ? "Show all" : "Hide shelved";
    applyFilter();
  });

  document.getElementById("reset").addEventListener("click", function () {
    done.clear(); save();
    rows.forEach(function (li) {
      li.querySelector("input[type=checkbox]").checked = false;
      li.classList.remove("done");
    });
    paint(); applyFilter();
  });

  document.querySelectorAll("button.copy").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var text = btn.dataset.asins.split(" ").join("\n");
      navigator.clipboard.writeText(text).then(function () {
        var old = btn.textContent;
        btn.textContent = "Copied " + btn.dataset.asins.split(" ").length;
        setTimeout(function () { btn.textContent = old; }, 1400);
      });
    });
  });

  paint();
})();
</script>`;

writeFileSync(`${DIR}/add-sheet.html`, html);

console.log(`kept ${kept.length} (>= $${MIN_PRICE}) of ${rows.length} verified`);
for (const [s, i] of shelfOrder) console.log(`  ${s}: ${i.length}`);
console.log(`proven demand: ${kept.filter((r) => r.soldCount > 0).length}`);
console.log(`wrote ${DIR}/ADD-SHEET.md + add-sheet.html`);
