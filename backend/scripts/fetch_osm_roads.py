"""
One-off: pull real road geometry for every corridor in data/network.py from OpenStreetMap (Overpass API)
and write data/roads.geojson. Run from backend/:  .venv/bin/python -m scripts.fetch_osm_roads
(python.org builds on macOS may need SSL_CERT_FILE=/etc/ssl/cert.pem for HTTPS.)

OSM splits a road into many "ways" (a new way wherever a tag changes, and one per direction on
divided roads), so each corridor becomes a MultiLineString.
"""

import json
import math
import re
import urllib.parse
import urllib.request
from pathlib import Path

from data.network import CORRIDORS

OVERPASS = "https://overpass-api.de/api/interpreter"
BBOX = "-6.37,106.68,-6.08,106.98"  # south,west,north,east — DKI Jakarta
OUT = Path(__file__).resolve().parent.parent / "data" / "roads.geojson"


def haversine_km(a: list[float], b: list[float]) -> float:
    lng1, lat1, lng2, lat2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def fetch_ways() -> list[dict]:
    names = sorted({n for c in CORRIDORS for n in c["osm_names"]})
    pattern = "^(" + "|".join(re.escape(n) for n in names) + ")$"
    query = f'[out:json][timeout:180];way["highway"~"^(motorway|trunk|primary|secondary)$"]["name"~"{pattern}"]({BBOX});out geom;'
    req = urllib.request.Request(
        OVERPASS,
        data=urllib.parse.urlencode({"data": query}).encode(),
        headers={"User-Agent": "jakarta-flowgis-mvp/0.1 (github.com/Zzybeanie/traffic-map-tools)"},
    )
    with urllib.request.urlopen(req, timeout=200) as res:
        return json.load(res)["elements"]


def build() -> dict:
    ways = fetch_ways()
    features = []
    for c in CORRIDORS:
        lines, length = [], 0.0
        for w in ways:
            if w["tags"]["name"] not in c["osm_names"]:
                continue
            line = [[round(p["lon"], 5), round(p["lat"], 5)] for p in w["geometry"]]
            seg = sum(haversine_km(a, b) for a, b in zip(line, line[1:]))
            # ponytail: divided roads are mapped once per direction; halve oneway ways to approximate road length
            length += seg / 2 if w["tags"].get("oneway") == "yes" else seg
            lines.append(line)
        if not lines:
            raise SystemExit(f"No OSM ways found for {c['id']} ({c['osm_names']}) — check the name tags")
        pts = [p for line in lines for p in line]
        cx, cy = sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)
        focus = min(pts, key=lambda p: (p[0] - cx) ** 2 + (p[1] - cy) ** 2)
        features.append({
            "type": "Feature",
            "id": c["id"],
            "geometry": {"type": "MultiLineString", "coordinates": lines},
            "properties": {"length_km": round(length, 1), "focus": focus, "osm_ways": len(lines)},
        })
    return {"type": "FeatureCollection", "attribution": "© OpenStreetMap contributors (ODbL)", "features": features}


if __name__ == "__main__":
    fc = build()
    OUT.write_text(json.dumps(fc, separators=(",", ":")))
    for f in fc["features"]:
        print(f"{f['id']:<16} {f['properties']['osm_ways']:>4} ways  {f['properties']['length_km']:>6} km")
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")
