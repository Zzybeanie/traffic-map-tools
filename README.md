# Jakarta FlowGIS

A map of Jakarta's main roads, colored by how congested they are, with a time-of-day scrubber to see the morning and evening rush roll across the city.

**MVP status:** road geometry is real (OpenStreetMap), but traffic speeds are **simulated** by a transport-planning model. There is no live feed yet.

**Full technical docs** (formulas with sources, all dummy data, API reference, and how to plug in real traffic data): [docs/TECHNICAL.md](docs/TECHNICAL.md)

## How it works

```
OpenStreetMap ──(one-off script)──► roads.geojson ─┐
                                                   ├─► traffic_model.py ──► FastAPI /api/v1/traffic/* ──► Next.js + MapLibre
network.py (road inventory) ───────────────────────┘        ▲
                                                     hour of day (WIB)
```

1. **Road geometry.** `backend/scripts/fetch_osm_roads.py` asks OpenStreetMap's Overpass API for 28 named arterials and toll roads and saves them to `backend/data/roads.geojson`. OSM stores each road as many small segments (and divided roads once per direction), so every corridor becomes a `MultiLineString`. Run it again only when you add roads.
2. **Road inventory** (`backend/data/network.py`). This is what a traffic agency knows about each road: free-flow speed (how fast you go when it's empty), lane count, and a *sensitivity* score for how badly it chokes at peak time. The same data exists for 18 junction hotspots.
3. **Traffic model** (`backend/data/traffic_model.py`), recomputed on every request:
   - **Demand by hour.** A 24-value curve of how busy the city is at each hour: two peaks at 07–08 and 17–18.
   - **V/C ratio** (volume ÷ capacity) = demand × the road's sensitivity, plus a little per-road noise. A V/C above 1 means more cars want the road than it can carry.
   - **BPR curve.** This is the textbook formula from the US Bureau of Public Roads. It turns V/C into travel time: `time = free_flow_time × (1 + α·(V/C)^β)`. From that we get the **speed ratio R = current / free-flow speed**, which drives the colors: green R ≥ 0.85, amber 0.50–0.84, red < 0.50.
   - The model also derives delay minutes, junction queue volume (PCU = passenger-car units, where a truck counts as more than one car), and length-weighted network KPIs.
4. **API.** `GET /api/v1/traffic/{corridors,spots,summary}?hour=0-23` returns GeoJSON. Leave out `hour` to get the current hour in Jakarta time (WIB).
5. **Frontend.** Next.js polls the API every 60 s through a dev proxy. MapLibre GL draws glowing lines and dots over a CARTO basemap. There's a light/dark toggle (Positron / Dark Matter) in the header. Frosted-glass panels hold the filters, the time scrubber, KPIs and the legend.

### Making it real later

Replace the model's `_vc_ratio` with measured speeds from a probe-data provider (TomTom Traffic Flow, HERE, Google Roads, or Jakarta's own ATCS/TransJakarta feeds). The GeoJSON sent to the frontend stays the same. Once you're storing readings over time, add Postgres + PostGIS (for geometry) + TimescaleDB (for time series). The MVP doesn't need a database.

## Run

```bash
# backend (Python 3.11+)
cd backend && python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --port 8000
.venv/bin/python test_traffic_model.py   # model self-check

# frontend (Node 20+)
cd frontend && npm install && npm run dev   # http://localhost:3000
```

Road data © OpenStreetMap contributors (ODbL). Basemap © CARTO.
