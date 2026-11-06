#!/usr/bin/env python3
"""Rebuild data/products.json from data/inventory.xlsx + images/products/.
Usage:  python tools/build.py        (needs: pip install openpyxl pillow)
"""
import json, re, sys
from pathlib import Path
from openpyxl import load_workbook
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
XLSX, PHOTOS, THUMBS = ROOT/"data/inventory.xlsx", ROOT/"images/products", ROOT/"images/thumbs"
COLS = {"qrid":"qr","partcode":"code","oemcode":"oem","name":"title","specification":"spec",
        "manufacturer":"manufacturer","supplier":"supplier","unit":"unit","delivered":"delivered",
        "actualspare":"actual","used":"used","contractual":"contractual","extrastock":"extra","codesource":"source"}
NUM = ("delivered","actual","used","contractual","extra")
warn, err = [], []

def key(h): return re.sub(r"[^a-z]","",str(h or "").lower().replace("o&m","").replace("deliveredto","delivered"))
def txt(v): return "" if v is None else str(v).strip()
def num(v):
    if v is None or str(v).strip()=="": return None
    try: f=float(v); return int(f) if f==int(f) else f
    except ValueError: return "bad"

def status(actual, contractual):
    if actual is None: return "Not recorded"
    if actual <= 0: return "Out of stock"
    if contractual is not None and actual < contractual: return "Below contractual"
    return "In stock"

ws = load_workbook(XLSX, data_only=True)["Inventory"]
rows = list(ws.iter_rows(values_only=True))
idx = {COLS[key(h)]: i for i,h in enumerate(rows[0]) if key(h) in COLS}
for need in ("qr","code","title"):
    if need not in idx: sys.exit(f"ERROR: column for '{need}' not found in the Inventory sheet header")

THUMBS.mkdir(parents=True, exist_ok=True)
items, seen_qr, seen_code = [], set(), {}
for n,r in enumerate(rows[1:], start=2):
    g = lambda k: r[idx[k]] if k in idx and idx[k] < len(r) else None
    if not any(c not in (None,"") for c in r): continue
    qr, code, title = txt(g("qr")), txt(g("code")), txt(g("title"))
    if not (qr and code and title):
        err.append(f"row {n}: QR ID, Part Code and Name are required"); continue
    if not re.fullmatch(r"[A-Za-z0-9_-]+", qr): err.append(f"row {n}: QR ID '{qr}' may only contain letters, digits, - and _"); continue
    if qr.lower() in seen_qr: err.append(f"row {n}: duplicate QR ID {qr}"); continue
    seen_qr.add(qr.lower())
    if code in seen_code: warn.append(f"row {n}: Part Code {code} also used by {seen_code[code]}")
    seen_code.setdefault(code, qr)
    q = {k: num(g(k)) for k in NUM}
    for k,v in q.items():
        if v == "bad": err.append(f"row {n}: '{k}' is not a number"); q[k]=None
    photos = sorted(p.name for p in PHOTOS.glob(f"{qr}-*") if p.suffix.lower() in (".jpg",".jpeg",".png",".webp"))
    for p in photos[:1]:                       # thumbnail from first photo
        t = THUMBS/(Path(p).stem+".jpg"); src = PHOTOS/p
        if not t.exists() or t.stat().st_mtime < src.stat().st_mtime:
            im = Image.open(src).convert("RGB"); im.thumbnail((200,200)); im.save(t,"JPEG",quality=80,optimize=True)
    items.append({"qr":qr,"code":code,"oem":txt(g("oem")),"title":title,"spec":txt(g("spec")),
        "manufacturer":txt(g("manufacturer")),"supplier":txt(g("supplier")),"unit":txt(g("unit")) or "PCS",
        "source":txt(g("source")).lower() or "excel","status":status(q["actual"],q["contractual"]),
        "qty":q,"photos":photos})

known = {i["qr"].lower() for i in items}
for p in PHOTOS.iterdir():
    m = re.match(r"(.+)-\d+\.\w+$", p.name)
    if not m or m.group(1).lower() not in known: warn.append(f"photo '{p.name}' does not match any QR ID")
if err:
    print("\nERRORS (nothing written):"); [print("  -",e) for e in err]; sys.exit(1)
(ROOT/"data/products.json").write_text(json.dumps({"items":items}, ensure_ascii=False, separators=(",",":")), encoding="utf-8")
from collections import Counter
print(f"OK: {len(items)} products, {sum(1 for i in items if i['photos'])} with photos, {sum(len(i['photos']) for i in items)} photos")
print("Status:", dict(Counter(i["status"] for i in items)))
if warn: print("\nWarnings:"); [print("  -",w) for w in warn]
