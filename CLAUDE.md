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
  - No offline fallback data: if the API is down the header says so. `src/lib/basemap.ts` greys the Positron style.
  - `/api/v1/*` is proxied to `127.0.0.1:8000` via `next.config.ts` rewrites.

## Run
```bash
cd backend && .venv/bin/uvicorn main:app --port 8000   # pip install -r requirements.txt first
cd frontend && npm install && npm run dev              # http://localhost:3000
```

## Design
- Taste skills live in `.agents/skills/` (Leonxlnx/taste-skill: `design-taste-frontend`, etc.). Dials: VARIANCE 6, MOTION 5, DENSITY 5.
- Basemap: CartoDB Positron recolored slate-grey at runtime so white glass panels float. Ratio colors: ≥0.85 `#10b981`, 0.50–0.84 `#f59e0b`, <0.50 `#f43f5e`.
- Glass surfaces use the `.glass` class in `globals.css` — reuse it, don't re-inline `bg-white/xx backdrop-blur` stacks.

## Gotchas
- **MapLibre v6 worker under Turbopack**: v6 loads its worker relative to `import.meta.url`, which breaks when bundled
  ("Worker failed to load"). `postinstall` copies `maplibre-gl-{worker,shared}.mjs` to `public/maplibre/` (gitignored)
  and `Map.tsx` calls `setWorkerUrl("/maplibre/maplibre-gl-worker.mjs")`. Re-run `npm install` after upgrading maplibre.
- **Write `backdrop-filter` unprefixed only.** Lightning CSS (Turbopack) drops the standard property when a
  `-webkit-backdrop-filter` line is also present, leaving Chrome with no blur at all.
- Speed-ratio thresholds 0.85 / 0.50 live in three places: `traffic_model.py`, `Map.tsx` RATIO_COLOR, Legend.
- Overpass from python.org Python on macOS needs `SSL_CERT_FILE=/etc/ssl/cert.pem`; send a User-Agent or it 406s.
- Headless screenshots: gstack `browse` gets killed here; Playwright with the cached `chromium_headless_shell` +
  `--use-angle=swiftshader` renders WebGL fine.
