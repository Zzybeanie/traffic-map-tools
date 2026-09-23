# Jakarta FlowGIS — Traffic Flow & Hotspot Explorer (MVP)

Glassmorphic traffic map for DKI Jakarta. Real OSM road geometry + simulated speeds (BPR model) served by FastAPI;
Next.js + MapLibre renders it. MVP scope: keep it lean — no DB, no auth, no real traffic feed yet. See README for the model.

## Layout
- `backend/` — FastAPI (Python 3.13, `.venv`).
  - `data/network.py` road inventory (28 corridors, 18 spots) · `data/roads.geojson` OSM geometry (generated)
  - `data/traffic_model.py` demand-by-hour → V/C → BPR speed ratio · `test_traffic_model.py` self-check
  - `scripts/fetch_osm_roads.py` regenerates roads.geojson from Overpass (only when corridors change)
  - All endpoints take optional `hour=0-23` (omit = current WIB hour):
    `/api/v1/traffic/corridors?min_ratio=` (MultiLineString), `/spots?spot_type=`, `/summary`
- `frontend/` — Next.js **16** (Turbopack), React 19, Tailwind v4, maplibre-gl **v6**, framer-motion, lucide-react.
  Read `frontend/AGENTS.md` first: this Next.js differs from training data.
  - `src/app/page.tsx` owns state; `components/` = Map, Header, ControlPanel, Legend, TrafficPopup.
  - No offline fallback data: if the API is down the header says so.
  - `src/lib/basemap.ts`: style URL per theme (Positron light / Dark Matter dark) + runtime recolor of basemap layers.
  - `/api/v1/*` is proxied to `127.0.0.1:8000` via `next.config.ts` rewrites.

## Run
```bash
cd backend && .venv/bin/uvicorn main:app --port 8000   # pip install -r requirements.txt first
cd frontend && npm install && npm run dev              # http://localhost:3000
```

## Design
- Taste skills live in `.agents/skills/` (Leonxlnx/taste-skill: `design-taste-frontend`, etc.). Dials: VARIANCE 6, MOTION 5, DENSITY 5.
- **Light/dark toggle** (header sun/moon). `.dark` on `<html>`, set before paint by the inline script in `layout.tsx`,
  saved in `localStorage.theme` (defaults to the OS setting). Dark mode works by **remapping Tailwind's slate/white
  color variables** in `globals.css`, so components use plain `text-slate-900`/`bg-white/35` and flip automatically.
  Don't add `dark:` variants unless a remapped color reads wrong. `text-white` on emerald becomes dark in dark mode (intended).
- Basemaps: tinted Positron (blue water, cool land) in light, CARTO Dark Matter in dark. Traffic lines get a blurred
  glow layer + casing (white on light, near-black on dark) so colors pop on either. Ratio colors: ≥0.85 `#10b981`,
  0.50–0.84 `#f59e0b`, <0.50 `#f43f5e`.
- Glass surfaces use the `.glass` class (has a `.dark .glass` variant) — reuse it, don't re-inline `backdrop-blur` stacks.
- Map popups (`TrafficPopup.ts`) are HTML strings but use Tailwind classes + `.glass`, so they theme with the page.
  Keep classes as literal strings there so Tailwind's scanner picks them up; dynamic colors go in inline `style`.
- Sliders use the `.range` class (styled track + thumb). Pass `--range-track` inline for a colored track;
  the speed-ratio slider draws the legend scale and greys the hidden part.

## Gotchas
- **MapLibre v6 worker under Turbopack**: v6 loads its worker relative to `import.meta.url`, which breaks when bundled
  ("Worker failed to load"). `postinstall` copies `maplibre-gl-{worker,shared}.mjs` to `public/maplibre/` (gitignored)
  and `Map.tsx` calls `setWorkerUrl("/maplibre/maplibre-gl-worker.mjs")`. Re-run `npm install` after upgrading maplibre.
- **Write `backdrop-filter` unprefixed only.** Lightning CSS (Turbopack) drops the standard property when a
  `-webkit-backdrop-filter` line is also present, leaving Chrome with no blur at all.
- Theme switch calls `map.setStyle(..., { transformStyle })` and copies our sources/layers into the new style;
  add any new layer id to `CORRIDOR_LAYERS`/`SPOT_LAYERS` in `Map.tsx` or it vanishes on toggle.
- **Green/amber/red has one source per side**: backend `FREE_FLOW`/`CONGESTED` in `traffic_model.py`, frontend
  `src/lib/levels.ts` (`levelOf()` + `RATIO_COLOR` map expression). Map, popups and browse lists all use it; never
  hand-write thresholds. The backend rounds the ratio *before* deriving level/spot_type so text matches color
  (`test_level_text_matches_published_ratio`). Legend copy is the only hand-written copy of the numbers.
- Map hover uses `mousemove`, not `mouseenter`: sliding between adjacent/overlapping roads never leaves the layer,
  so enter-only handlers showed the previous road's card.
- `~/Documents` is iCloud-synced: it spawns "file 2.ext" duplicates (seen in `.next/` and `.git/`). If tsc reports
  duplicate identifiers from `.next/types/* 2.ts`, delete them: `find .next -name "* 2.*" -delete`.
- Overpass from python.org Python on macOS needs `SSL_CERT_FILE=/etc/ssl/cert.pem`; send a User-Agent or it 406s.
- Headless screenshots: gstack `browse` gets killed here; Playwright with the cached `chromium_headless_shell` +
  `--use-angle=swiftshader` renders WebGL fine.
