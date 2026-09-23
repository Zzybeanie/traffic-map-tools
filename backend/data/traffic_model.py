"""
Simulated Jakarta traffic state.

There is no live feed yet, so speeds come from a small, standard transport-planning model:

1. DEMAND[hour]: share of peak-hour traffic on the road at each hour (Jakarta commuter double peak).
2. Volume/Capacity (V/C): demand scaled by how bottleneck-prone the road is.
3. BPR curve (US Bureau of Public Roads): travel_time = free_flow_time * (1 + ALPHA * (V/C)^BETA).
   So speed ratio = 1 / (1 + ALPHA * (V/C)^BETA). ALPHA is raised from the textbook 0.15 so
   Jakarta-like oversaturation actually shows as red.

Swapping this for real data means replacing `_vc_ratio` with measured speeds from a probe feed
(e.g. TomTom / HERE / Google Roads) — the GeoJSON contract to the frontend stays the same.
"""

import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from data.network import CORRIDORS, SPOTS

WIB = timezone(timedelta(hours=7))
ALPHA, BETA = 0.5, 4
FREE_FLOW, CONGESTED = 0.85, 0.50  # speed-ratio thresholds shared with the frontend legend
SPOT_FREE_FLOW_KMH = 40  # typical junction approach speed
SPOT_CLEAR_MINS = 3  # time to clear a junction when empty

# Share of peak demand by hour, 00..23 WIB. Morning 07-08 and evening 17-18 peaks.
DEMAND = [0.10, 0.06, 0.05, 0.05, 0.12, 0.35, 0.70, 0.95, 1.00, 0.80, 0.62, 0.60,
          0.62, 0.60, 0.62, 0.72, 0.88, 1.00, 0.98, 0.82, 0.60, 0.45, 0.30, 0.18]

_ROADS = {f["id"]: f for f in json.loads((Path(__file__).parent / "roads.geojson").read_text())["features"]}


def period_label(hour: int) -> str:
    if 6 <= hour < 10:
        return "Morning peak"
    if 16 <= hour < 20:
        return "Evening peak"
    if 10 <= hour < 16:
        return "Midday"
    return "Night"


def _vc_ratio(entity_id: str, sensitivity: float, hour: int, slot: int) -> float:
    # ponytail: seeded jitter so each road differs a little but stays stable within a 15-min slot
    jitter = random.Random(f"{entity_id}:{hour}:{slot}").uniform(0.85, 1.15)
    return DEMAND[hour] * (0.2 + 1.2 * sensitivity) * jitter


def speed_ratio(vc: float) -> float:
    # Rounded here, once: the client colors by this exact value, so the level text must be derived from it too
    return round(max(0.12, 1 / (1 + ALPHA * vc**BETA)), 2)


def level(ratio: float) -> str:
    if ratio >= FREE_FLOW:
        return "free_flow"
    return "moderate" if ratio >= CONGESTED else "congested"


STATUS = {
    "free_flow": "Moving freely: demand is well under road capacity.",
    "moderate": "Slowing: demand is approaching road capacity.",
    "congested": "Stop-and-go: demand exceeds what the road can carry.",
}


def _clock(hour: int | None) -> tuple[int, int, bool]:
    now = datetime.now(WIB)
    if hour is None:
        return now.hour, now.minute // 15, True
    return hour, 0, False


def corridors(hour: int | None = None, min_ratio: float = 0.0) -> dict[str, Any]:
    h, slot, _ = _clock(hour)
    features = []
    for c in CORRIDORS:
        road = _ROADS[c["id"]]
        vc = _vc_ratio(c["id"], c["sensitivity"], h, slot)
        ratio = speed_ratio(vc)
        speed = c["free_flow_speed"] * ratio
        length = road["properties"]["length_km"]
        features.append({
            "type": "Feature",
            "id": c["id"],
            "geometry": road["geometry"],
            "properties": {
                "road_name": c["name"],
                "corridor_code": c["id"].upper(),
                "road_category": c["category"],
                "lanes": c["lanes"],
                "length_km": length,
                "focus": road["properties"]["focus"],
                "free_flow_speed": c["free_flow_speed"],
                "current_speed": round(speed, 1),
                "congestion_ratio": ratio,
                "vc_ratio": round(vc, 2),
                "traffic_level": level(ratio),
                "delay_mins": round(length / speed * 60 - length / c["free_flow_speed"] * 60, 1),
                "status_description": STATUS[level(ratio)],
            },
        })
    return _collection([f for f in features if f["properties"]["congestion_ratio"] >= min_ratio], h, hour is None)


def spots(hour: int | None = None, spot_type: str = "all") -> dict[str, Any]:
    h, slot, _ = _clock(hour)
    features = []
    for s in SPOTS:
        vc = _vc_ratio(s["id"], s["sensitivity"], h, slot)
        ratio = speed_ratio(vc)
        lvl = level(ratio)
        features.append({
            "type": "Feature",
            "id": s["id"],
            "geometry": {"type": "Point", "coordinates": list(s["coords"])},
            "properties": {
                "spot_name": s["name"],
                "spot_code": s["id"].upper(),
                "spot_type": {"free_flow": "free_flow_hub", "moderate": "moderate", "congested": "traffic_jam_bottleneck"}[lvl],
                "sub_district": s["sub_district"],
                "congestion_ratio": ratio,
                "vc_ratio": round(vc, 2),
                "average_speed_kmh": round(SPOT_FREE_FLOW_KMH * ratio, 1),
                "delay_mins": round(SPOT_CLEAR_MINS * (1 / ratio - 1), 1),
                "vessel_volume_pcu": round(s["capacity_pcu"] * min(vc, 1.0)),
                "alert_priority": "critical" if ratio < 0.3 else "high" if ratio < CONGESTED else "normal",
                "status_description": f"{s['context']} {STATUS[lvl]}",
            },
        })
    wanted = {"free_flow_only": "free_flow_hub", "bottleneck_only": "traffic_jam_bottleneck"}.get(spot_type, spot_type)
    if wanted != "all":
        features = [f for f in features if f["properties"]["spot_type"] == wanted]
    return _collection(features, h, hour is None)


def summary(hour: int | None = None) -> dict[str, Any]:
    cs = corridors(hour)["features"]
    ss = spots(hour)["features"]
    props = [c["properties"] for c in cs]
    total_km = sum(p["length_km"] for p in props)
    # Length-weighted: a 60 km toll ring should count more than a 1.5 km avenue
    avg_speed = sum(p["current_speed"] * p["length_km"] for p in props) / total_km
    free_km = sum(p["length_km"] for p in props if p["congestion_ratio"] >= FREE_FLOW)
    h, _, live = _clock(hour)
    return {
        "hour": h,
        "is_live": live,
        "period": period_label(h),
        "demand_profile": DEMAND,
        "average_speed_kmh": round(avg_speed, 1),
        "open_roads_pct": round(free_km / total_km * 100, 1),
        "active_bottlenecks_count": sum(s["properties"]["spot_type"] == "traffic_jam_bottleneck" for s in ss),
        "free_flow_hubs_count": sum(s["properties"]["spot_type"] == "free_flow_hub" for s in ss),
        "average_network_delay_mins": round(sum(p["delay_mins"] for p in props) / len(props), 1),
        "monitored_network_length_km": round(total_km, 1),
        "total_corridors_tracked": len(cs),
        "total_hotspots_tracked": len(ss),
        "timestamp_wib": datetime.now(WIB).isoformat(),
    }


def _collection(features: list[dict], hour: int, live: bool) -> dict[str, Any]:
    return {
        "type": "FeatureCollection",
        "metadata": {"hour": hour, "is_live": live, "source": "simulated (BPR model on OSM geometry)"},
        "features": features,
    }
