# Jakarta FlowGIS — Technical Documentation

This document covers what the tool computes, the formulas and where they come from, what is real versus dummy data, how the code is laid out, and how to replace the simulation with real traffic data.

> **Status (MVP).** Road *geometry* is real (OpenStreetMap). Traffic *speeds* are **simulated** by a
> transport-planning formula driven by a hand-made daily demand curve. Nothing on the map is a live
> measurement yet. §9 explains how to change that.

## Contents

1. [Real vs. simulated at a glance](#1-real-vs-simulated-at-a-glance)
2. [Glossary](#2-glossary)
3. [Architecture and file map](#3-architecture-and-file-map)
4. [The traffic model, step by step](#4-the-traffic-model-step-by-step)
5. [Worked examples](#5-worked-examples)
6. [Dummy data inventory](#6-dummy-data-inventory)
7. [Road geometry pipeline (OpenStreetMap)](#7-road-geometry-pipeline-openstreetmap)
8. [API reference](#8-api-reference)
9. [Using real traffic data](#9-using-real-traffic-data)
10. [Frontend notes](#10-frontend-notes)
11. [Running, testing, known limits](#11-running-testing-known-limits)
12. [References](#12-references)

---

## 1. Real vs. simulated at a glance

| Piece | Status | Where it comes from |
|---|---|---|
| Road shapes (28 corridors, 266 km) | **Real** | OpenStreetMap via Overpass API, saved in `backend/data/roads.geojson` |
| Junction locations (18) | Real (approximate coordinates) | Hand-placed from known Jakarta landmarks |
| Basemap | Real | CARTO Positron / Dark Matter vector tiles (OpenStreetMap data) |
| Free-flow speeds, lanes | **Estimated** | Typical posted/design speeds for each road class; not measured |
| Sensitivity scores | **Invented** | Relative judgement of how bottleneck-prone each road is |
| Junction capacities (PCU/h) | **Invented** | Plausible magnitudes for major Jakarta junctions |
| Hourly demand curve | **Invented** | Shaped like a typical commuter double peak |
| Volume/capacity, speeds, delays, colors | **Computed** | BPR formula (§4.3) applied to the invented inputs above |

The formula is standard. The inputs are dummy, so the output shows realistic patterns (rush hour is red, 3 a.m. is green, the chronic bottlenecks go red first) but the actual numbers are not measurements.

---

## 2. Glossary

| Term | Meaning |
|---|---|
| **Free-flow speed** (S<sub>ff</sub>) | Speed on the road when it is empty: roughly the posted limit or the road's design speed. |
| **Current speed** (S<sub>c</sub>) | Average speed of traffic right now. |
| **Speed ratio** (R) | S<sub>c</sub> ÷ S<sub>ff</sub>. 1.0 = moving at free-flow speed, 0.3 = crawling at 30% of it. **Every color in the app comes from this one number.** |
| **Volume** (V) | Vehicles that want to use the road per hour. |
| **Capacity** (C) | The most vehicles the road can actually pass per hour. |
| **V/C ratio** | Volume ÷ capacity. Below ~0.8 traffic flows; near 1.0 it saturates; above 1.0 a queue builds. |
| **PCU** (Indonesian: *smp*, satuan mobil penumpang) | Passenger-car unit. Vehicles are converted to car-equivalents: a bus counts as more than one car, a motorcycle as a fraction of one. |
| **BPR function** | The Bureau of Public Roads volume-delay formula, which turns V/C into travel time (§4.3). |
| **Level of Service (LOS)** | Letter grade A–F for traffic quality, defined in the US *Highway Capacity Manual*. |
| **WIB** | Waktu Indonesia Barat, UTC+7. All hours in the app are WIB. |
| **Corridor** | One named road in the model (it may be many OSM segments). |
| **Spot / junction** | A point hotspot: interchange, roundabout, market, or port gate. |

---

## 3. Architecture and file map

```
                        ┌──────────── one-off ────────────┐
OpenStreetMap (Overpass) ──► scripts/fetch_osm_roads.py ──► data/roads.geojson
                                                                    │
data/network.py (road inventory: speeds, lanes, sensitivity) ───────┤
                                                                    ▼
                      hour (0–23 WIB, or "now") ──► data/traffic_model.py
                                                                    │
                                              routers/traffic.py (FastAPI, GeoJSON)
                                                                    │  /api/v1/traffic/*
                                         Next.js rewrite (frontend/next.config.ts)
                                                                    ▼
                         page.tsx ──► Map.tsx (MapLibre) · ControlPanel · Header · Legend
```

| Path | Role |
|---|---|
| `backend/main.py` | FastAPI app, CORS, health route |
| `backend/routers/traffic.py` | The three endpoints and their query validation |
| `backend/data/network.py` | Static road inventory: `CORRIDORS` and `SPOTS` (the dummy parameters) |
| `backend/data/roads.geojson` | Generated OSM geometry (MultiLineString per corridor, plus length and focus point) |
| `backend/data/traffic_model.py` | Demand curve, BPR model, level thresholds, KPI aggregation |
| `backend/scripts/fetch_osm_roads.py` | Regenerates `roads.geojson` from Overpass |
| `backend/test_traffic_model.py` | Model self-checks (plain `python` or `pytest`) |
| `frontend/src/app/page.tsx` | State: data fetch/poll, selected hour, theme, filters |
| `frontend/src/components/Map.tsx` | MapLibre map, layers, hover popups, theme style swap |
| `frontend/src/components/ControlPanel.tsx` | Time scrubber, filters, KPIs, browse list |
| `frontend/src/components/TrafficPopup.ts` | Popup HTML (Tailwind classes, themed) |
| `frontend/src/lib/levels.ts` | **Frontend copy of the color thresholds** (`levelOf`, `RATIO_COLOR`) |
| `frontend/src/lib/basemap.ts` | Basemap style per theme plus runtime recolor |

There is no database. Every request recomputes the state from two small files (see §9.6 for when you'd need one).

---

## 4. The traffic model, step by step

Implemented in `backend/data/traffic_model.py`. For each corridor and each junction, at a given hour *h*:

```
demand(h) ──► V/C = demand(h) · (0.2 + 1.2·sensitivity) · jitter
          ──► R   = 1 / (1 + α·(V/C)^β)          (BPR, α = 0.5, β = 4)
          ──► speed, delay, level, color
```

### 4.1 Hourly demand profile  *(dummy)*

`DEMAND[h]` is the share of peak-hour traffic on the network at hour *h* (1.0 = the busiest hour).

| Hour | 00 | 01 | 02 | 03 | 04 | 05 | 06 | 07 | 08 | 09 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Demand | 0.10 | 0.06 | 0.05 | 0.05 | 0.12 | 0.35 | 0.70 | 0.95 | **1.00** | 0.80 | 0.62 | 0.60 |

| Hour | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Demand | 0.62 | 0.60 | 0.62 | 0.72 | 0.88 | **1.00** | 0.98 | 0.82 | 0.60 | 0.45 | 0.30 | 0.18 |

- **Shape:** the classic commuter "double hump": a morning peak (07–09), a midday plateau, and a longer evening peak (16–19). This shape is widely observed in urban traffic counts; the exact values here are hand-drawn.
- **Periods** (for labels only): 06–09 Morning peak, 10–15 Midday, 16–19 Evening peak, otherwise Night.
- **What's missing:** weekday vs. weekend, Friday prayers, rain, school holidays, Ramadan and mudik, and events. All days are treated as the same weekday.
- **Real replacement:** hourly traffic counts (e.g. Dishub DKI counts) or historical probe speeds (§9).

### 4.2 Volume/capacity ratio  *(our simplification)*

```
V/C = DEMAND[h] × (0.2 + 1.2 × sensitivity) × jitter
```

- `sensitivity` (0–1) stands in for "how close to capacity this road runs at peak". A real model would compute V/C from counted volumes and a capacity worked out from lanes, lane width, side friction and so on. Those formulas are in MKJI 1997 / PKJI for Indonesian roads and the HCM in the US [3, 4, 5].
- `0.2 + 1.2 × s` maps sensitivity 0.5 → 0.8 and 0.95 → 1.34 at the peak hour, so even the worst road only reaches about 1.35 V/C before jitter.
- **Jitter** is a deterministic random factor in [0.85, 1.15], seeded by `road id : hour : 15-min slot`. Roads differ a little from each other, and a road's value stays stable within a 15-minute slot, so the map doesn't flicker on each 60-second refresh. Replaying a fixed hour always uses slot 0, so replays are repeatable.

> This step is **not** a published formula. It is a stand-in so the demo has plausible V/C values. It is
> the first thing that disappears when real data arrives.

### 4.3 BPR volume-delay function  *(standard formula, tuned parameter)*

The Bureau of Public Roads function [1] is the most widely used volume-delay function in transport planning. It is the default in software such as PTV Visum, Aimsun and TransCAD.

```
t = t₀ · (1 + α · (V/C)^β)
```

- `t₀` is the travel time at free flow, `t` the travel time at the current load.
- The original calibration is **α = 0.15, β = 4** [1].
- Speed is distance ÷ time, so the **speed ratio** is:

```
R = S_c / S_ff = t₀ / t = 1 / (1 + α · (V/C)^β)
```

**We use α = 0.5, β = 4.** With the textbook α = 0.15, a road at V/C = 1.0 still moves at 87% of free-flow speed. That is fine for US freeways, but it would never produce the red that Jakarta arterials show daily. Raising α makes delay grow faster once a road saturates:

| V/C | R with α = 0.15 (original) | R with α = 0.50 (this app) | Color (this app) |
|---|---|---|---|
| 0.5 | 0.991 | 0.970 | green |
| 0.8 | 0.942 | 0.830 | amber |
| 1.0 | 0.870 | 0.667 | amber |
| 1.2 | 0.763 | 0.491 | **red** |
| 1.4 | 0.634 | 0.342 | red |
| 1.6 | 0.504 | 0.234 | red |
| 2.0 | 0.294 | 0.111 → 0.12 (floor) | red |

Notes:
- **β = 4** gives the "fine, fine, fine, then collapse" shape of real congestion.
- R is **floored at 0.12** so speeds never hit zero or divide by zero.
- α = 0.5 is **our assumption**, not a Jakarta calibration. §9.7 shows how to fit α and β from real data.
- A known weakness of BPR: past V/C > 1 it keeps producing finite speeds even though, physically, a queue is forming. Spiess's conical delay functions [2] were proposed partly to fix BPR's behavior. That matters for traffic assignment; for coloring a map it's fine.

### 4.4 Speed ratio → level → color  *(aligned with HCM LOS)*

R is rounded to 2 decimals **once**, in `speed_ratio()`. Everything else (level, status text, junction type, map color, popup) is derived from that rounded value, so they can never disagree.

| Level | Condition | Color | Roughly equivalent HCM urban-street LOS [3] |
|---|---|---|---|
| Free flow | R ≥ 0.85 | green `#10b981` | LOS A (> 85% of base free-flow speed) |
| Moderate | 0.50 ≤ R < 0.85 | amber `#f59e0b` | LOS B–C (> 50–85%) |
| Congested | R < 0.50 | red `#f43f5e` | LOS D–F (≤ 50%) |

The HCM 2010 urban street method grades LOS by average travel speed as a percentage of base free-flow speed. Its cut points are >85 (A), >67 (B), >50 (C), >40 (D), >30 (E), ≤30 (F) [3]. Our two thresholds sit on the A/B and C/D boundaries, collapsing six grades into three colors. The same thresholds live in exactly two places: `FREE_FLOW`/`CONGESTED` in `traffic_model.py` and `frontend/src/lib/levels.ts`.

### 4.5 Corridor outputs

For a corridor of length *L* km:

| Field | Formula | Note |
|---|---|---|
| `congestion_ratio` | R (§4.3, rounded) | drives the color |
| `current_speed` | S<sub>ff</sub> × R | km/h |
| `delay_mins` | 60·L/S<sub>c</sub> − 60·L/S<sub>ff</sub> | extra minutes to drive the whole corridor vs. empty road |
| `vc_ratio` | V/C (§4.2) | shown in the popup |
| `traffic_level` | §4.4 | `free_flow` / `moderate` / `congested` |
| `length_km` | from OSM (§7) | one-way ways counted at half length |

### 4.6 Junction (spot) outputs  *(heuristics)*

Junctions use the same V/C → R pipeline with their own sensitivity, then:

| Field | Formula | Note |
|---|---|---|
| `average_speed_kmh` | 40 × R | 40 km/h = assumed approach speed |
| `delay_mins` | 3 × (1/R − 1) | 3 min = assumed clear-junction crossing time; delay grows as R falls |
| `vessel_volume_pcu` | capacity × min(V/C, 1) | throughput can't exceed capacity (the rest queues) |
| `spot_type` | `free_flow_hub` / `moderate` / `traffic_jam_bottleneck` | same thresholds as §4.4 |
| `alert_priority` | `critical` if R < 0.30, `high` if R < 0.50, else `normal` | |

These are simple heuristics, not HCM intersection delay. Proper signalised-junction delay uses Webster's formula or the HCM/PKJI intersection methods [4, 5, 6].

### 4.7 Network KPIs (`/summary`)

| KPI | Formula | Why |
|---|---|---|
| Average speed | Σ(S<sub>c</sub>·L) ÷ ΣL | **Length-weighted**, so the 59 km JORR ring counts more than the 1.5 km Thamrin |
| Open roads % | Σ L where R ≥ 0.85 ÷ Σ L × 100 | share of network *kilometres* that are free-flowing |
| Active jams | count of junctions with R < 0.50 | |
| Average delay | mean of corridor `delay_mins` | simple mean across corridors |

---

## 5. Worked examples

All numbers below are what the API returns (`?hour=8` etc.; replays use jitter slot 0).

**Jl. Gatot Subroto at 08:00** (S<sub>ff</sub> = 55 km/h, sensitivity 0.9, L = 8.1 km)

```
demand(8)        = 1.00
base V/C         = 1.00 × (0.2 + 1.2 × 0.9)        = 1.28
jitter           = 0.852   (seed "gatot-subroto:8:0")
V/C              = 1.28 × 0.852                    = 1.09
R                = 1 / (1 + 0.5 × 1.09⁴)           = 0.59   → amber (moderate)
current speed    = 55 × 0.59                       = 32.4 km/h
delay            = 60·8.1/32.45 − 60·8.1/55        = 15.0 − 8.8 = 6.1 min
```

The same road at **12:00** gets V/C 0.83 and R 0.81 (44.6 km/h, +2.1 min, amber), and at **03:00** V/C 0.06 and R 1.00 (55 km/h, no delay, green).

**Semanggi Interchange at 08:00** (capacity 4,800 PCU/h, sensitivity 0.95)

```
V/C              = 1.00 × (0.2 + 1.2 × 0.95) × 1.006 = 1.35
R                = 1 / (1 + 0.5 × 1.35⁴)             = 0.38  → red, alert "high"
approach speed   = 40 × 0.38                          = 15.2 km/h
queue delay      = 3 × (1/0.38 − 1)                   = 4.9 min
volume           = 4,800 × min(1.35, 1)               = 4,800 PCU/h (saturated)
```

**Network at 08:00:** length-weighted average speed 34.8 km/h, 0% of kilometres free-flowing, 10 of 18 junctions jammed, average corridor delay 9.0 min.

---

## 6. Dummy data inventory

All values live in `backend/data/network.py`. Free-flow speeds are typical for the road class (toll roads 70–80 km/h, arterials 40–55 km/h); lanes are *per direction*. Sensitivity is a relative judgement. Lengths and OSM way counts are real (from §7).

### 6.1 Corridors (28)

| ID | Name | Type | Free-flow km/h | Lanes | Sensitivity | Length km | OSM ways |
|---|---|---|---|---|---|---|---|
| `tol-dalam-kota` | Tol Dalam Kota (Inner Ring) | highway | 70 | 3 | 0.85 | 16.7 | 107 |
| `tol-jorr` | Tol JORR (Outer Ring) | highway | 80 | 3 | 0.7 | 58.9 | 466 |
| `tol-wiyoto` | Tol Wiyoto Wiyono (Cawang–Priok) | highway | 70 | 2 | 0.6 | 10.5 | 53 |
| `tol-sedyatmo` | Tol Sedyatmo (Airport) | highway | 80 | 3 | 0.5 | 20.7 | 107 |
| `tol-jagorawi` | Tol Jagorawi | highway | 80 | 3 | 0.65 | 14.7 | 63 |
| `tol-cikampek` | Tol Jakarta–Cikampek | highway | 80 | 3 | 0.8 | 13.1 | 72 |
| `sudirman` | Jl. Jenderal Sudirman | primary | 50 | 4 | 0.8 | 7.2 | 114 |
| `thamrin` | Jl. M.H. Thamrin | primary | 48 | 4 | 0.7 | 1.5 | 40 |
| `gatot-subroto` | Jl. Gatot Subroto | primary | 55 | 4 | 0.9 | 8.1 | 149 |
| `rasuna-said` | Jl. H.R. Rasuna Said | primary | 45 | 3 | 0.85 | 4.2 | 59 |
| `satrio` | Jl. Prof. Dr. Satrio | primary | 40 | 3 | 0.85 | 3.7 | 44 |
| `mampang-buncit` | Jl. Mampang – Buncit Raya | primary | 40 | 2 | 0.9 | 4.9 | 61 |
| `kapten-tendean` | Jl. Kapten Tendean | secondary | 40 | 2 | 0.75 | 2.2 | 37 |
| `gajah-mada` | Jl. Gajah Mada – Hayam Wuruk | primary | 45 | 3 | 0.7 | 3.9 | 88 |
| `gunung-sahari` | Jl. Gunung Sahari Raya | primary | 45 | 3 | 0.75 | 5.1 | 118 |
| `salemba-kramat` | Jl. Salemba – Kramat Raya | primary | 40 | 3 | 0.8 | 3.4 | 68 |
| `pramuka` | Jl. Pramuka | primary | 45 | 3 | 0.75 | 4.9 | 86 |
| `yos-sudarso` | Jl. Yos Sudarso | primary | 50 | 3 | 0.7 | 7.9 | 138 |
| `mt-haryono` | Jl. M.T. Haryono | primary | 50 | 3 | 0.85 | 4.6 | 87 |
| `ahmad-yani` | Jl. Jenderal Ahmad Yani | primary | 50 | 3 | 0.75 | 7.6 | 95 |
| `di-panjaitan` | Jl. D.I. Panjaitan | primary | 50 | 3 | 0.8 | 4.0 | 72 |
| `raya-bogor` | Jl. Raya Bogor | primary | 45 | 2 | 0.85 | 14.0 | 118 |
| `s-parman` | Jl. Letjen S. Parman | primary | 50 | 3 | 0.85 | 4.7 | 76 |
| `daan-mogot` | Jl. Daan Mogot | primary | 45 | 3 | 0.8 | 14.4 | 104 |
| `panjang` | Jl. Panjang Raya | primary | 45 | 2 | 0.85 | 6.9 | 84 |
| `tb-simatupang` | Jl. T.B. Simatupang | primary | 50 | 3 | 0.95 | 8.2 | 124 |
| `fatmawati` | Jl. RS Fatmawati | primary | 40 | 2 | 0.8 | 5.7 | 64 |
| `pasar-minggu` | Jl. Pasar Minggu Raya | primary | 40 | 2 | 0.8 | 4.4 | 50 |

Lengths are clipped to the DKI Jakarta bounding box (toll roads continue beyond it).

### 6.2 Junctions (18)

| ID | Name | Sub-district | Capacity PCU/h | Sensitivity | Context |
|---|---|---|---|---|---|
| `semanggi` | Semanggi Interchange | Setiabudi | 4800 | 0.95 | Cloverleaf where Gatot Subroto weaves into Sudirman. |
| `pancoran` | Pancoran Flyover | Pancoran | 5100 | 0.95 | Pasar Minggu arterial merges with Gatot Subroto. |
| `tomang` | Tomang Interchange | Grogol Petamburan | 4600 | 0.9 | Jakarta–Merak toll inflow converges onto S. Parman. |
| `senayan` | Bundaran Senayan | Kebayoran Baru | 2400 | 0.55 | Signalised roundabout above the MRT line. |
| `harmoni` | Harmoni Junction | Gambir | 3900 | 0.85 | Gajah Mada / Hayam Wuruk split at the old-town gateway. |
| `bundaran-hi` | Bundaran HI | Menteng | 2900 | 0.55 | Monument roundabout joining Thamrin and Sudirman. |
| `kuningan` | Kuningan Underpass | Mampang Prapatan | 4750 | 0.95 | Two-tier junction of Rasuna Said and Gatot Subroto. |
| `cawang` | Cawang Interchange | Kramat Jati | 5300 | 0.9 | Jagorawi, Cikampek and Inner Ring tolls converge. |
| `dukuh-atas` | Dukuh Atas TOD | Setiabudi | 2100 | 0.5 | MRT, KRL, LRT and airport-rail interchange. |
| `fatmawati` | Fatmawati Flyover | Cilandak | 3100 | 0.6 | South arterial under the elevated MRT guideway. |
| `senen` | Pasar Senen | Senen | 3600 | 0.85 | Market, bus terminal and rail station share one junction. |
| `blok-m` | Blok M | Kebayoran Baru | 3000 | 0.7 | Bus terminal and MRT station at the south CBD edge. |
| `kampung-melayu` | Kampung Melayu | Jatinegara | 3300 | 0.9 | Terminal plus Ciliwung bridge pinch point. |
| `grogol` | Grogol | Grogol Petamburan | 3500 | 0.8 | Kyai Tapa meets the S. Parman toll ramps. |
| `lebak-bulus` | Lebak Bulus | Cilandak | 3400 | 0.75 | MRT terminus next to the JORR on-ramp. |
| `tanjung-priok` | Tanjung Priok Port Gate | Tanjung Priok | 4200 | 0.85 | Container truck queue for Indonesia's busiest port. |
| `kalibata` | Kalibata | Pancoran | 3000 | 0.8 | Level rail crossing on a dense residential arterial. |
| `pasar-minggu` | Pasar Minggu | Pasar Minggu | 2900 | 0.85 | Traditional market spilling into the carriageway. |

### 6.3 Model constants

| Constant | Value | Status |
|---|---|---|
| `ALPHA`, `BETA` | 0.5, 4 | BPR form standard [1]; α raised from 0.15 (assumption) |
| `FREE_FLOW`, `CONGESTED` | 0.85, 0.50 | Aligned with HCM LOS boundaries [3] |
| Ratio floor | 0.12 | Assumption (avoids zero speed) |
| Jitter range | ±15%, per 15 min | Assumption (visual variety) |
| `SPOT_FREE_FLOW_KMH` | 40 | Assumption |
| `SPOT_CLEAR_MINS` | 3 | Assumption |

---

## 7. Road geometry pipeline (OpenStreetMap)

`backend/scripts/fetch_osm_roads.py` (standard library only):

1. Collects every OSM name listed in `CORRIDORS[*].osm_names`.
2. Sends **one** Overpass QL query for ways with `highway` in `motorway|trunk|primary|secondary` whose `name` matches, inside the DKI bbox `-6.37,106.68,-6.08,106.98` [7].
3. Groups ways by corridor into a **MultiLineString**. OSM splits a road wherever a tag changes, and maps divided roads once per direction, so a corridor is 40–470 separate ways.
4. **Length:** haversine sum of each way. Ways tagged `oneway=yes` count half, since each direction of a divided road is mapped separately.
5. **Focus point:** the vertex nearest the corridor's centroid; used to fly the camera to it.
6. Coordinates are rounded to 5 decimals (about 1 m) to keep the file at about 300 KB.

```bash
cd backend && SSL_CERT_FILE=/etc/ssl/cert.pem .venv/bin/python -m scripts.fetch_osm_roads
```

`SSL_CERT_FILE` is only needed for python.org builds on macOS. Overpass returns HTTP 406 without a User-Agent; the script sends one. To add a road: add a `Corridor` in `network.py` using the exact OSM `name` tag (look it up on openstreetmap.org), then re-run the script. It fails loudly if a name matches nothing.

**Licence:** OpenStreetMap data is © OpenStreetMap contributors, ODbL [8]. Keep the attribution (it is in the map footer).

---

## 8. API reference

Base: `http://localhost:8000` (the frontend reaches it through the Next.js rewrite at `/api/v1/*`). Interactive docs: `/docs`.

All endpoints accept `hour` (integer 0–23, WIB). **Omit it for "now"**: the current WIB hour, with jitter that changes every 15 minutes.

### `GET /api/v1/traffic/corridors`

| Param | Type | Default | |
|---|---|---|---|
| `hour` | int 0–23 | now | |
| `min_ratio` | float 0–1 | 0 | only corridors with R ≥ this |

Returns a GeoJSON `FeatureCollection` of `MultiLineString` features. `properties`:

`road_name`, `corridor_code`, `road_category` (`highway|primary|secondary`), `lanes`, `length_km`, `focus` `[lng, lat]`, `free_flow_speed`, `current_speed`, `congestion_ratio`, `vc_ratio`, `traffic_level` (`free_flow|moderate|congested`), `delay_mins`, `status_description`.

### `GET /api/v1/traffic/spots`

| Param | Values |
|---|---|
| `hour` | 0–23 |
| `spot_type` | `all` (default), `free_flow_only`, `bottleneck_only`, `free_flow_hub`, `moderate`, `traffic_jam_bottleneck` |

`Point` features with `spot_name`, `spot_code`, `spot_type`, `sub_district`, `congestion_ratio`, `vc_ratio`, `average_speed_kmh`, `delay_mins`, `vessel_volume_pcu`, `alert_priority` (`normal|high|critical`), `status_description`.

### `GET /api/v1/traffic/summary`

`hour`, `is_live`, `period`, `demand_profile` (24 numbers), `average_speed_kmh`, `open_roads_pct`, `active_bottlenecks_count`, `free_flow_hubs_count`, `average_network_delay_mins`, `monitored_network_length_km`, `total_corridors_tracked`, `total_hotspots_tracked`, `timestamp_wib`.

Both collections also carry `metadata: {hour, is_live, source}`.

**This contract is the stable boundary.** A real data source only has to fill the same fields; the frontend does not change.

---

## 9. Using real traffic data

### 9.1 What you actually need

The map needs one number per road segment: **current speed and free-flow speed**, so R = S<sub>c</sub>/S<sub>ff</sub>. Commercial probe-data providers (GPS traces from phones and fleets) give exactly that. With it you skip §4.1–4.3 entirely: no demand curve, no V/C, no BPR.

### 9.2 Candidate sources

| Source | What it gives | Access | Fit |
|---|---|---|---|
| **TomTom Traffic Flow API** [9] | Per-segment `currentSpeed`, `freeFlowSpeed`, `currentTravelTime`, `freeFlowTravelTime`, `confidence`, `roadClosure`. Also vector/raster flow tiles. | Commercial API key; free tier for development | **Best 1:1 match** for our fields. Segment endpoint is point-based (one call per sample point); use flow tiles for city-wide coverage. |
| **HERE Traffic API v7 (flow)** [10] | Per-segment current `speed`, `freeFlow`, `jamFactor` (0–10), `confidence`. Query by bounding box or corridor. | Commercial API key; free tier | **Best for city-wide polling**: one bbox request returns all segments. |
| **Waze for Cities** [11] | Real-time jams (speed, delay, length, level 0–5) and user alerts as a feed. | Free for government and public-sector partners (agreement required) | Great if you partner with Dishub or Pemprov DKI; jams are reported where they occur, not per fixed road. |
| **Google Maps Routes API** [12] | Traffic-aware `duration` vs. `staticDuration` for a route you define. | Paid per request | Can compute R per corridor as `staticDuration / duration`, but check the Maps Platform terms: they restrict caching results and showing them on non-Google maps. |
| **Jakarta government data** | Dishub DKI traffic counts and ATCS signal/camera systems; Satu Data Jakarta open datasets [13]; TransJakarta schedules (GTFS). | Open portal / by request | Counts give real **volumes** → real V/C, useful to calibrate α/β (§9.7). Availability and freshness vary; check the portal. |
| **OpenStreetMap** | Geometry, `maxspeed`, `lanes` tags | Free (ODbL) | Already used for geometry; `maxspeed`/`lanes` can replace the estimated inventory where tagged. |

**Recommendation:** start with **HERE flow by bounding box** or **TomTom flow tiles** for the live layer. Add Dishub counts later if you want to calibrate a model for forecasting or "what-if" scenarios.

### 9.3 Field mapping into our contract

| Our field | TomTom Flow Segment Data | HERE v7 flow |
|---|---|---|
| `current_speed` | `currentSpeed` | `currentFlow.speed` (m/s → ×3.6 for km/h) |
| `free_flow_speed` | `freeFlowSpeed` | `currentFlow.freeFlow` (m/s → km/h) |
| `congestion_ratio` | `currentSpeed / freeFlowSpeed` | `speed / freeFlow` |
| `delay_mins` | `(currentTravelTime − freeFlowTravelTime) / 60` | from length ÷ speeds |
| confidence (new field) | `confidence` (0–1) | `currentFlow.confidence` |
| closure | `roadClosure` | `currentFlow.traversability` |

Verify units against the current provider docs before coding; both APIs have options for units and versions.

### 9.4 Matching provider segments to our corridors

Providers use their own road network and segment IDs, not OSM way IDs. Options, simplest first:

1. **Sample points (quick start).** Walk each corridor's geometry, take a point every ~300–500 m, and ask the provider for the segment at each point. Aggregate by length: R<sub>corridor</sub> = Σ(R<sub>i</sub>·len<sub>i</sub>) ÷ Σlen<sub>i</sub>. For 266 km at 500 m spacing that's about 530 points per refresh. Use bbox or tile endpoints instead of per-point calls to keep costs sane.
2. **Spatial join.** Pull all provider segments in the bbox (HERE returns shapes), then in PostGIS keep those within ~15 m of a corridor that share its bearing (so parallel service roads and the opposite carriageway don't mix in).
3. **Location referencing (robust).** TomTom and others support **OpenLR** [14], a map-agnostic way to describe a road stretch. Decode it onto the OSM graph so segments survive map updates on either side.
4. For GPS traces you collect yourself (e.g. a fleet), use map matching with **Valhalla (Meili)** [15] or **OSRM `match`** [16].

Keep direction: divided roads have two carriageways that can differ a lot (inbound jammed at 08:00, outbound clear). The OSM data already separates them via `oneway`. A natural next step is splitting each corridor into `inbound`/`outbound` features.

### 9.5 Target pipeline

```
 every 2–5 min                                   on request
┌─────────────┐   ┌────────────┐   ┌───────────────────────┐   ┌──────────────┐
│ poller      │──►│ normalize  │──►│ Postgres + PostGIS +  │──►│ FastAPI      │──► frontend
│ (HERE/TomTom│   │ units, map │   │ TimescaleDB           │   │ same GeoJSON │    (unchanged)
│  bbox/tiles)│   │ to corridor│   │ speed_readings        │   │ contract     │
└─────────────┘   └────────────┘   └───────────────────────┘   └──────────────┘
```

- **Live** (`hour` omitted): latest reading per corridor.
- **Replay** (`hour=8`): a historical average for that hour, ideally by *hour-of-week* (Monday 08:00 ≠ Saturday 08:00) over the last N weeks. That's the real version of the dummy demand curve.
- Cache the latest snapshot in memory; the frontend polls every 60 s, but provider data refreshes every ~1–2 min.
- Respect provider rate limits and terms; store only what the licence allows.

In code, the swap is contained in `traffic_model.py`. Replace the body of `corridors()` / `spots()` with a DB read that fills the same property names. `levels`, the router, the tests' contract checks and the whole frontend stay as they are.

### 9.6 Do you need a database?

**Not for the MVP.** Everything is computed from `network.py` + `roads.geojson` per request.

**Yes, once you ingest real data**, because you'll need history (replay, trends, "how bad was last Tuesday"). Suggested schema:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE corridors (
  id               text PRIMARY KEY,
  name             text NOT NULL,
  category         text NOT NULL,
  free_flow_speed  real NOT NULL,          -- fallback when the provider doesn't send one
  lanes            smallint,
  geom             geometry(MultiLineString, 4326) NOT NULL
);
CREATE INDEX ON corridors USING gist (geom);

CREATE TABLE speed_readings (
  corridor_id     text REFERENCES corridors(id),
  observed_at     timestamptz NOT NULL,
  speed_kmh       real NOT NULL,
  free_flow_kmh   real NOT NULL,
  confidence      real,
  source          text NOT NULL            -- 'here', 'tomtom', 'waze', ...
);
SELECT create_hypertable('speed_readings', 'observed_at');

-- Replay profile: typical speed ratio per corridor by weekday and hour (WIB), last 8 weeks
SELECT corridor_id,
       extract(isodow FROM observed_at AT TIME ZONE 'Asia/Jakarta') AS dow,
       extract(hour   FROM observed_at AT TIME ZONE 'Asia/Jakarta') AS hour,
       avg(speed_kmh / free_flow_kmh)                               AS ratio
FROM speed_readings
WHERE observed_at > now() - interval '8 weeks'
GROUP BY 1, 2, 3;
```

PostGIS handles the spatial join (§9.4 option 2); TimescaleDB handles time-bucketed averages and retention.

### 9.7 Calibrating α and β with real data

If you collect **volumes** (Dishub counts) and **speeds** for the same roads, you can fit the BPR parameters for Jakarta instead of assuming α = 0.5:

```
t/t₀ − 1 = α·(V/C)^β
ln(t/t₀ − 1) = ln α + β·ln(V/C)          ← straight line: fit by least squares
```

Use only observations with t > t₀. Capacity C per road can come from MKJI/PKJI capacity formulas [4, 5]. Once calibrated, the model is useful again for **forecasting** ("what if demand grows 10%?", "what if a lane closes?"), which live data alone can't answer.

---

## 10. Frontend notes

- **Stack:** Next.js 16 (Turbopack), React 19, Tailwind v4, MapLibre GL v6.
- **Colors:** `src/lib/levels.ts` is the only frontend definition of green/amber/red. `levelOf()` for HTML, `RATIO_COLOR` for MapLibre paint. Map lines, junction dots, popups and browse lists all use it.
- **Hover:** popups update on `mousemove` so the card always describes the feature drawn under the cursor, including where roads overlap. Junction dots take precedence over roads.
- **Theme:** the `.dark` class on `<html>` is set before paint by an inline script (`layout.tsx`) and saved in `localStorage.theme`. Dark mode remaps Tailwind's slate/white color variables in `globals.css`, so components don't need `dark:` classes. Basemaps: CARTO Positron (tinted) / Dark Matter [17]. On toggle, `map.setStyle(..., { transformStyle })` carries the traffic sources and layers into the new style.
- **Glass:** the `.glass` class (with a `.dark .glass` variant). Write `backdrop-filter` unprefixed only; Lightning CSS drops it if a `-webkit-` duplicate is present.
- **MapLibre worker:** v6 resolves its web worker relative to its own module URL, which Turbopack breaks. `postinstall` copies the worker to `public/maplibre/` and `Map.tsx` calls `setWorkerUrl`.
- **Polling:** every 60 s, 8 s timeout; on failure the header shows "Backend offline". There is no stale fallback data.

---

## 11. Running, testing, known limits

```bash
# backend
cd backend && python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --port 8000
.venv/bin/python test_traffic_model.py      # or: pytest test_traffic_model.py

# frontend
cd frontend && npm install && npm run dev   # http://localhost:3000
npm run lint && npm run build
```

`test_traffic_model.py` checks that rush hour is slower than night, that the BPR curve is monotonic and bounded, that every corridor has geometry and a valid ratio, that filters work, and that every published label (`traffic_level`, `spot_type`) agrees with the published `congestion_ratio`.

**Known limits of the MVP**

- Speeds are simulated (§1). Don't use them for decisions.
- One demand curve for every road and every day; no weekday/weekend, weather or events.
- Corridors are single features: no per-direction or per-segment variation along a road.
- Junction delay is a heuristic, not an intersection capacity model.
- α = 0.5 is uncalibrated.
- Toll-road lengths are clipped at the DKI bounding box.

---

## 12. References

1. Bureau of Public Roads (1964). *Traffic Assignment Manual.* U.S. Department of Commerce, Urban Planning Division, Washington, D.C. (origin of the BPR volume-delay function, α = 0.15, β = 4).
2. Spiess, H. (1990). "Conical Volume-Delay Functions." *Transportation Science* 24(2), 153–158. (discusses BPR's limitations and an alternative family).
3. Transportation Research Board (2010). *Highway Capacity Manual 2010*, Chapter 16 "Urban Street Facilities", Exhibit 16-4 (LOS by travel speed as % of base free-flow speed). Later editions: HCM 6th ed. (2016), 7th ed. (2022).
4. Direktorat Jenderal Bina Marga (1997). *Manual Kapasitas Jalan Indonesia (MKJI).* Departemen Pekerjaan Umum, Jakarta. (Indonesian road/junction capacity, smp/PCU equivalents).
5. Kementerian PUPR. *Pedoman Kapasitas Jalan Indonesia (PKJI)*, 2014, revised 2023. (successor to MKJI).
6. Webster, F. V. (1958). *Traffic Signal Settings.* Road Research Technical Paper No. 39, HMSO, London. (classic signalised-junction delay formula).
7. OpenStreetMap Wiki: Overpass API and Overpass QL. https://wiki.openstreetmap.org/wiki/Overpass_API
8. OpenStreetMap copyright and licence (ODbL). https://www.openstreetmap.org/copyright
9. TomTom Traffic API: Flow Segment Data and Flow Tiles. https://developer.tomtom.com/traffic-api/documentation/traffic-flow/flow-segment-data
10. HERE Traffic API v7: flow. https://www.here.com/docs/bundle/traffic-api-developer-guide-v7/page/README.html
11. Waze for Cities (Waze partner data feeds). https://www.waze.com/wazeforcities
12. Google Maps Platform: Routes API (traffic-aware routing). https://developers.google.com/maps/documentation/routes
13. Satu Data Jakarta (Jakarta open data portal). https://satudata.jakarta.go.id
14. OpenLR location referencing standard. https://www.openlr.org
15. Valhalla routing engine: map matching (Meili). https://valhalla.github.io/valhalla/
16. OSRM: `match` service. https://project-osrm.org/docs/v5.24.0/api/#match-service
17. CARTO basemap styles (Positron, Dark Matter). https://github.com/CartoDB/basemap-styles

*URLs were correct when written. Provider APIs and portals change, so check the current docs before integrating.*
