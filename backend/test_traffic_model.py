"""Run: .venv/bin/python test_traffic_model.py  (or pytest)"""

from data import traffic_model as m
from data.network import CORRIDORS


def test_rush_hour_is_slower_than_night():
    assert m.summary(8)["average_speed_kmh"] < m.summary(3)["average_speed_kmh"]
    assert m.summary(3)["open_roads_pct"] > m.summary(8)["open_roads_pct"]


def test_bpr_curve_is_monotonic_and_bounded():
    ratios = [m.speed_ratio(vc / 10) for vc in range(0, 30)]
    assert ratios == sorted(ratios, reverse=True)
    assert ratios[0] == 1.0 and min(ratios) >= 0.12


def test_every_corridor_has_geometry_and_valid_ratio():
    fc = m.corridors(17)
    assert len(fc["features"]) == len(CORRIDORS)
    for f in fc["features"]:
        assert f["geometry"]["type"] == "MultiLineString" and f["geometry"]["coordinates"]
        assert 0 < f["properties"]["congestion_ratio"] <= 1


def test_level_text_matches_published_ratio():
    # The map colors by congestion_ratio; every label must agree with that exact number
    for h in range(24):
        for f in m.corridors(h)["features"] + m.spots(h)["features"]:
            p = f["properties"]
            assert m.level(p["congestion_ratio"]) in (p.get("traffic_level"), {"free_flow_hub": "free_flow", "moderate": "moderate", "traffic_jam_bottleneck": "congested"}.get(p.get("spot_type")))


def test_filters():
    assert all(f["properties"]["congestion_ratio"] >= 0.85 for f in m.corridors(8, 0.85)["features"])
    assert all(f["properties"]["spot_type"] == "traffic_jam_bottleneck" for f in m.spots(8, "bottleneck_only")["features"])


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
    print("ok")
