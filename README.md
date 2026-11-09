# Scatec Spare Parts Catalogue

Static website (no server code). Everything you edit lives in `data/` and `images/`.

## Everyday tasks
| Task | What to do |
|---|---|
| Add a product | Add a row in `data/inventory.xlsx` (QR ID must be unique, e.g. `SB1-0200`) |
| Add / change photos | Put `<QR ID>-1.jpg`, `<QR ID>-2.jpg`… in `images/products/` (same name = replaces) |
| Change stock quantities | Edit `data/inventory.xlsx` |
| Set a storage location | Edit `data/locations.csv` → `qrid,zone,rack,position` |
| Change the look | Edit `css/style.css` |

After any change to the Excel or photos run:

    pip install openpyxl pillow      # first time only
    python tools/build.py

It validates the data (duplicates, missing fields, orphan photos), creates thumbnails and writes `data/products.json`.
Status is automatic (also shown in column O of the Excel, coloured red/amber/green): Actual = 0 → Out of stock; Actual < Contractual → Below contractual; else In stock.
Changing only `locations.csv` needs no build step.

## 5S labels (QR)
Open **`<your-site>/labels.html`** (link "Print labels" in the catalogue header).
- **Item labels** – QR + part code + name + spec + manufacturer/supplier + location, colour band per zone. Sizes 100x60 / 70x40 / 50x30 mm, A4 sheet or label-printer (1 per page).
- **Location / rack labels** – one label per Zone-Rack-Position (+ big zone signs). Scanning one opens `#loc=A-01-02`: the list of items that belong there (use it for 5S audits).
- Fill `data/locations.csv` (`qrid,zone,rack,position` – every QR ID is already listed) so the location prints on the item labels.
- Open labels.html from the **deployed** https address before printing (the QR contains that address). Print with Scale 100%, headers/footers off.

## Test locally
    python -m http.server 8000      # then open http://localhost:8000

## Deploy on Render (Static Site – free, no cold starts)
1. Push this folder to a GitHub repository.
2. Render → New → **Static Site** → pick the repo. Build command: *(empty)*. Publish directory: `.`
   (or use New → Blueprint, which reads `render.yaml`).
3. Every `git push` redeploys automatically.
4. The QR labels use the site's own address, so if the URL changes, reprint the labels.

## Folder layout
    index.html        page shell
    css/style.css     styling
    js/app.js         catalogue logic      js/scanner.js  camera scan (iOS fallback via jsQR)
    js/qrcode.js      QR generator         js/jsQR.js     QR reader fallback (loaded only when needed)
    data/             inventory.xlsx (edit) · locations.csv (edit) · products.json (generated)
    images/           logo.png · products/ (full photos) · thumbs/ (generated)
    tools/build.py    data builder
