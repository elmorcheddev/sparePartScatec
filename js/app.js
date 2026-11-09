// Scatec Spare Parts Catalogue – data comes from data/products.json (built by tools/build.py)
const app = document.getElementById("app");
const BASE = location.origin + location.pathname;               // used for QR labels
const esc = s => (s == null ? "" : String(s)).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nz = s => (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const pad = s => /^\d$/.test(s) ? "0" + s : s;
const STC = { "In stock": "s0", "Below contractual": "s1", "Out of stock": "s2", "Not recorded": "s3" };
let D = [], LOC = {}, filt = { sp: "", st: "", zn: "", q: "" };

const lz = x => { const l = LOC[x.qr]; return l && l.z ? l : null };
const lcode = x => { const l = LOC[x.qr]; return l && l.z && l.r && l.p ? [l.z, pad(l.r), pad(l.p)].join("-") : "" };
function find(t) { t = nz(t); if (!t) return null; return D.find(x => nz(x.code) === t) || D.find(x => x.oem && nz(x.oem) === t) || D.find(x => nz(x.qr) === t) }
function byKey(h) { return D.find(x => x.qr.toLowerCase() === h.toLowerCase()) || find(h) }
function hashKey() { try { return decodeURIComponent(location.hash.slice(1)) } catch (e) { return "" } }   // malformed hash must not crash
const photo = f => "images/products/" + encodeURIComponent(f);
const thumbUrl = x => "images/thumbs/" + encodeURIComponent(x.photos[0].replace(/\.\w+$/, "") + ".jpg");
const thumb = x => x.photos.length ? '<img src="' + thumbUrl(x) + '" alt="" loading="lazy" decoding="async">' : "No photo";
const hay = x => x._h || (x._h = [x.code, x.oem, x.title, x.spec, x.manufacturer, x.supplier, x.qr, lcode(x), (LOC[x.qr] || {}).z].join(" ").toLowerCase());

// ---- CSV (handles quotes, commas/semicolons) ----
function parseCSV(t) {
  t = t.replace(/^\uFEFF/, ""); const d = (t.split(/\r?\n/)[0] || "").includes(";") ? ";" : ",";
  const rows = []; let r = [], f = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c == '"') { if (t[i + 1] == '"') { f += '"'; i++ } else q = false } else f += c }
    else if (c == '"') q = true; else if (c == d) { r.push(f); f = "" }
    else if (c == "\n" || c == "\r") { if (c == "\r" && t[i + 1] == "\n") i++; r.push(f); f = ""; if (r.some(x => x.trim())) rows.push(r); r = [] }
    else f += c
  }
  r.push(f); if (r.some(x => x.trim())) rows.push(r); return rows
}
async function loadLoc() {
  try {
    const res = await fetch("data/locations.csv", { cache: "no-cache" }); if (!res.ok) return;
    const rows = parseCSV(await res.text()); if (rows.length < 2) return;
    const hd = rows[0].map(s => s.trim().toLowerCase().replace(/[^a-z]/g, "")), ix = n => hd.indexOf(n);
    const a = ix("qrid"), z = ix("zone"), r2 = ix("rack"), p = ix("position"); if (a < 0) return;
    rows.slice(1).forEach(c => { const k = (c[a] || "").trim(); if (k) LOC[k] = { z: (c[z] || "").trim(), r: (c[r2] || "").trim(), p: (c[p] || "").trim() } });
    D.forEach(x => delete x._h);
    if (!hashKey()) refreshList();        // update the list only – never wipe what the user is typing
    else render()                        // item page: show the location
  } catch (e) { }
}

function kv(k, v, featured) { return '<div class="k' + (featured ? ' featured' : '') + '">' + k + '</div><p>' + (v ? esc(v) : "\u2014") + '</p>' }
function qrsvg(u) { const q = qrcode(0, "M"); q.addData(u); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }) }

function bind(onlist) {
  const q = document.getElementById("q"); q.value = filt.q;
  if (window.matchMedia("(pointer:fine)").matches) q.focus();
  q.oninput = () => { filt.q = q.value; if (onlist) onlist() };
  q.onkeydown = e => {
    if (e.key === "Enter") {
      const m = find(q.value);
      if (m) { filt.q = ""; location.hash = m.qr }
      else if (q.value) { const n = document.getElementById("nf"); if (n) n.textContent = "Not found: " + q.value; q.select() }
    }
  }
}

function openItem(raw) {          // called by the scanner; true = accepted
  const k = raw.includes("#") ? raw.split("#").pop() : raw;
  if (/^loc=/i.test(k)) { location.hash = k; return true }
  let it; try { it = byKey(decodeURIComponent(k)) } catch (e) { it = byKey(k) }
  if (it) { location.hash = it.qr; return true } return false
}

function detail(it) {
  const q = it.qty, n = v => v == null ? "\u2014" : v, l = LOC[it.qr], lc = lcode(it), url = BASE + "#" + it.qr;
  const ph = it.photos.length ? it.photos.map(f => '<div><img src="' + photo(f) + '" alt="' + esc(it.title) + '" loading="lazy"></div>').join("") : "<div>No photo</div>";
  app.innerHTML = '<label class="sr" for="q">Scan or search</label><input id="q" placeholder="Scan next barcode here" autocomplete="off"><div id="nf" class="nf"></div><a class="b" href="#">\u2190 All items</a><div class="det"><div class="ph">' + ph + '</div><h2>' + esc(it.title) + '</h2><div class="bar">' + esc(it.code) + '</div><span class="stt ' + STC[it.status] + '">' + it.status + '</span>'
    + (it.source === "catalogue" ? '<div class="mu">Catalogue code \u2013 no unique product code in the Excel inventory</div>' : "")
    + '<div class="k featured">Specification</div><p>' + esc(it.spec) + "</p>" + kv("Manufacturer", it.manufacturer, true) + (it.oem && it.oem !== it.code ? kv("OEM code", it.oem) : "") + kv("Supplier", it.supplier, true) + kv("Unit", it.unit)
    + '<div class="k">Storage location</div><p>' + (lc ? '<b class="bar" style="margin:0">' + esc(lc) + "</b> Zone " + esc(l.z) + " \u00b7 Rack " + esc(pad(l.r)) + " \u00b7 Position " + esc(pad(l.p)) : (l && l.z ? "Partially assigned: " + esc([l.z, l.r, l.p].filter(Boolean).join("-")) : "Not assigned yet")) + "</p>"
    + '<div class="k">QR identification</div><div class="qr">' + qrsvg(url) +   "</div>";
  bind(null); window.scrollTo(0, 0)
}

function refreshList() {
  const l = document.getElementById("l"); if (!l) return;
  const ct = document.getElementById("ct"), tk = filt.q.toLowerCase().split(/\s+/).filter(Boolean);
  const r = D.filter(x => (!filt.sp || x.supplier === filt.sp) && (!filt.st || x.status === filt.st) && (!filt.zn || (filt.zn === "-" ? !lz(x) : (LOC[x.qr] || {}).z === filt.zn)) && tk.every(t => hay(x).includes(t)));
  ct.textContent = r.length + " items";
  l.innerHTML = r.map(x => { const lc = lcode(x); return '<a class="row" href="#' + encodeURIComponent(x.qr) + '"><div class="th">' + thumb(x) + '</div><div><div class="c">' + esc(x.code) + '</div><div class="n">' + esc(x.title) + '</div><div class="mu">' + esc(x.manufacturer) + '</div><div class="mu">' + esc(x.supplier) + (lc ? " \u00b7 \ud83d\udccd " + esc(lc) : "") + "</div></div></a>" }).join("")
}

function list() {
  const sps = [...new Set(D.map(x => x.supplier).filter(Boolean))].sort(), zs = [...new Set(Object.values(LOC).map(l => l.z).filter(Boolean))].sort();
  const sel = (v, c) => v === c ? " selected" : "";
  app.innerHTML = '<label class="sr" for="q">Search</label><input id="q" placeholder="Scan barcode here or search by code / name / manufacturer / location" autocomplete="off"><div id="nf" class="nf"></div>'
    + '<div class="flt"><select id="fs" aria-label="Supplier"><option value="">All suppliers</option>' + sps.map(s => "<option" + sel(filt.sp, s) + ">" + esc(s) + "</option>").join("") + "</select>"
    + '<select id="ft" aria-label="Stock status"><option value="">All stock status</option>' + Object.keys(STC).map(s => "<option" + sel(filt.st, s) + ">" + s + "</option>").join("") + "</select>"
    + '<select id="fz" aria-label="Location"><option value="">All locations</option><option value="-"' + sel(filt.zn, "-") + '>Unassigned</option>' + zs.map(z => '<option value="' + esc(z) + '"' + sel(filt.zn, z) + ">Zone " + esc(z) + "</option>").join("") + "</select>"
    + '<button id="sc">Scan QR</button></div><div class="cnt" id="ct"></div><div id="l"></div>';
  document.getElementById("fs").onchange = e => { filt.sp = e.target.value; refreshList() };
  document.getElementById("ft").onchange = e => { filt.st = e.target.value; refreshList() };
  document.getElementById("fz").onchange = e => { filt.zn = e.target.value; refreshList() };
  document.getElementById("sc").onclick = () => startScanner(openItem);
  refreshList(); bind(refreshList)
}

function locPage(code) {            // opened by scanning a rack / zone label: #loc=A-01-02 (or A-01, or A)
  const c = code.toUpperCase(), r = D.filter(x => { const l = lcode(x).toUpperCase(); return l && (l === c || l.startsWith(c + "-")) });
  app.innerHTML = '<a class="b" href="#">\u2190 All items</a><div class="det"><div class="k" style="margin-top:0">Storage location</div><h2>' + esc(code) + '</h2><p class="mu">' + r.length + ' item' + (r.length == 1 ? "" : "s") + ' belong here' + (r.length ? "" : " \u2013 nothing assigned yet (set it in data/locations.csv)") + '</p></div><div style="margin-top:12px">'
    + r.map(x => '<a class="row" href="#' + encodeURIComponent(x.qr) + '"><div class="th">' + thumb(x) + '</div><div><div class="c">' + esc(x.code) + '</div><div class="n">' + esc(x.title) + '</div><div class="mu">' + esc(x.manufacturer) + '</div><div class="mu">' + esc(x.supplier) + " \u00b7 " + esc(lcode(x)) + " \u00b7 " + x.status + "</div></div></a>").join("") + "</div>";
  window.scrollTo(0, 0)
}
function render() { const h = hashKey(); if (/^loc=/i.test(h)) return locPage(h.slice(4)); const it = byKey(h); it ? detail(it) : list() }

async function init() {
  try { const r = await fetch("data/products.json", { cache: "no-cache" }); if (!r.ok) throw 0; D = (await r.json()).items }
  catch (e) { app.innerHTML = '<div class="nf">Could not load the catalogue data. Please check your connection and reload.</div>'; return }
  window.addEventListener("hashchange", render); render(); loadLoc()
}
init();
