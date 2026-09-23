"""
Static description of the monitored Jakarta road network.

Geometry comes from OpenStreetMap (see scripts/fetch_osm_roads.py -> data/roads.geojson).
Everything here is the slow-changing "road inventory" a traffic agency would keep:
  free_flow_speed  km/h a car does on an empty road (posted limit / design speed)
  lanes            lanes per direction, a proxy for capacity
  sensitivity      0..1, how badly the road chokes when city demand peaks
                   (bottleneck-prone roads like Gatot Subroto ~0.9, airport toll ~0.5)
"""

from typing import TypedDict


class Corridor(TypedDict):
    id: str
    name: str
    osm_names: list[str]
    category: str  # highway | primary | secondary
    free_flow_speed: float
    lanes: int
    sensitivity: float


class Spot(TypedDict):
    id: str
    name: str
    coords: tuple[float, float]  # lng, lat
    sub_district: str
    capacity_pcu: int  # passenger-car units per hour at saturation
    sensitivity: float
    context: str


def _c(id: str, name: str, osm: list[str], cat: str, ff: float, lanes: int, sens: float) -> Corridor:
    return Corridor(id=id, name=name, osm_names=osm, category=cat, free_flow_speed=ff, lanes=lanes, sensitivity=sens)


CORRIDORS: list[Corridor] = [
    # Toll network
    _c("tol-dalam-kota", "Tol Dalam Kota (Inner Ring)", ["Jalan Tol Cawang–Pluit", "Jalan Tol Lingkar Dalam Jakarta", "Tol Dalam Kota Jakarta"], "highway", 70, 3, 0.85),
    _c("tol-jorr", "Tol JORR (Outer Ring)", ["Jalan Tol Lingkar Luar Jakarta"], "highway", 80, 3, 0.70),
    _c("tol-wiyoto", "Tol Wiyoto Wiyono (Cawang–Priok)", ["Jalan Tol Insinyur Wiyoto Wiyono", "Jalan Tol Lingkar Wiyoto Wiyono"], "highway", 70, 2, 0.60),
    _c("tol-sedyatmo", "Tol Sedyatmo (Airport)", ["Jalan Tol Profesor Doktor Sedyatmo"], "highway", 80, 3, 0.50),
    _c("tol-jagorawi", "Tol Jagorawi", ["Jalan Tol Jakarta–Bogor–Ciawi"], "highway", 80, 3, 0.65),
    _c("tol-cikampek", "Tol Jakarta–Cikampek", ["Jalan Tol Jakarta–Cikampek"], "highway", 80, 3, 0.80),
    # Central business district spine
    _c("sudirman", "Jl. Jenderal Sudirman", ["Jalan Jenderal Sudirman"], "primary", 50, 4, 0.80),
    _c("thamrin", "Jl. M.H. Thamrin", ["Jalan Mohammad Husni Thamrin"], "primary", 48, 4, 0.70),
    _c("gatot-subroto", "Jl. Gatot Subroto", ["Jalan Jenderal Gatot Subroto"], "primary", 55, 4, 0.90),
    _c("rasuna-said", "Jl. H.R. Rasuna Said", ["Jalan Hajjah R. Rasuna Said"], "primary", 45, 3, 0.85),
    _c("satrio", "Jl. Prof. Dr. Satrio", ["Jalan Profesor Doktor Satrio"], "primary", 40, 3, 0.85),
    _c("mampang-buncit", "Jl. Mampang – Buncit Raya", ["Jalan Mampang Prapatan Raya", "Jalan Buncit Raya"], "primary", 40, 2, 0.90),
    _c("kapten-tendean", "Jl. Kapten Tendean", ["Jalan Kapten Tendean"], "secondary", 40, 2, 0.75),
    # North–central
    _c("gajah-mada", "Jl. Gajah Mada – Hayam Wuruk", ["Jalan Gajah Mada", "Jalan Hayam Wuruk"], "primary", 45, 3, 0.70),
    _c("gunung-sahari", "Jl. Gunung Sahari Raya", ["Jalan Gunung Sahari Raya"], "primary", 45, 3, 0.75),
    _c("salemba-kramat", "Jl. Salemba – Kramat Raya", ["Jalan Salemba Raya", "Jalan Kramat Raya"], "primary", 40, 3, 0.80),
    _c("pramuka", "Jl. Pramuka", ["Jalan Pramuka"], "primary", 45, 3, 0.75),
    _c("yos-sudarso", "Jl. Yos Sudarso", ["Jalan Yos Sudarso"], "primary", 50, 3, 0.70),
    # East
    _c("mt-haryono", "Jl. M.T. Haryono", ["Jalan Letnan Jenderal MT Haryono"], "primary", 50, 3, 0.85),
    _c("ahmad-yani", "Jl. Jenderal Ahmad Yani", ["Jalan Jenderal Ahmad Yani"], "primary", 50, 3, 0.75),
    _c("di-panjaitan", "Jl. D.I. Panjaitan", ["Jalan D. I. Panjaitan"], "primary", 50, 3, 0.80),
    _c("raya-bogor", "Jl. Raya Bogor", ["Jalan Raya Bogor"], "primary", 45, 2, 0.85),
    # West
    _c("s-parman", "Jl. Letjen S. Parman", ["Jalan Letnan Jenderal Siswondo Parman"], "primary", 50, 3, 0.85),
    _c("daan-mogot", "Jl. Daan Mogot", ["Jalan Daan Mogot"], "primary", 45, 3, 0.80),
    _c("panjang", "Jl. Panjang Raya", ["Jalan Panjang Raya"], "primary", 45, 2, 0.85),
    # South
    _c("tb-simatupang", "Jl. T.B. Simatupang", ["Jalan Tahi Bonar Simatupang"], "primary", 50, 3, 0.95),
    _c("fatmawati", "Jl. RS Fatmawati", ["Jalan RS Fatmawati"], "primary", 40, 2, 0.80),
    _c("pasar-minggu", "Jl. Pasar Minggu Raya", ["Jalan Pasar Minggu Raya"], "primary", 40, 2, 0.80),
]


SPOTS: list[Spot] = [
    Spot(id="semanggi", name="Semanggi Interchange", coords=(106.8156, -6.2185), sub_district="Setiabudi", capacity_pcu=4800, sensitivity=0.95, context="Cloverleaf where Gatot Subroto weaves into Sudirman."),
    Spot(id="pancoran", name="Pancoran Flyover", coords=(106.8432, -6.2415), sub_district="Pancoran", capacity_pcu=5100, sensitivity=0.95, context="Pasar Minggu arterial merges with Gatot Subroto."),
    Spot(id="tomang", name="Tomang Interchange", coords=(106.7932, -6.1779), sub_district="Grogol Petamburan", capacity_pcu=4600, sensitivity=0.90, context="Jakarta–Merak toll inflow converges onto S. Parman."),
    Spot(id="senayan", name="Bundaran Senayan", coords=(106.7997, -6.2272), sub_district="Kebayoran Baru", capacity_pcu=2400, sensitivity=0.55, context="Signalised roundabout above the MRT line."),
    Spot(id="harmoni", name="Harmoni Junction", coords=(106.8202, -6.1607), sub_district="Gambir", capacity_pcu=3900, sensitivity=0.85, context="Gajah Mada / Hayam Wuruk split at the old-town gateway."),
    Spot(id="bundaran-hi", name="Bundaran HI", coords=(106.8230, -6.1950), sub_district="Menteng", capacity_pcu=2900, sensitivity=0.55, context="Monument roundabout joining Thamrin and Sudirman."),
    Spot(id="kuningan", name="Kuningan Underpass", coords=(106.8296, -6.2307), sub_district="Mampang Prapatan", capacity_pcu=4750, sensitivity=0.95, context="Two-tier junction of Rasuna Said and Gatot Subroto."),
    Spot(id="cawang", name="Cawang Interchange", coords=(106.8650, -6.2460), sub_district="Kramat Jati", capacity_pcu=5300, sensitivity=0.90, context="Jagorawi, Cikampek and Inner Ring tolls converge."),
    Spot(id="dukuh-atas", name="Dukuh Atas TOD", coords=(106.8217, -6.2023), sub_district="Setiabudi", capacity_pcu=2100, sensitivity=0.50, context="MRT, KRL, LRT and airport-rail interchange."),
    Spot(id="fatmawati", name="Fatmawati Flyover", coords=(106.7958, -6.2925), sub_district="Cilandak", capacity_pcu=3100, sensitivity=0.60, context="South arterial under the elevated MRT guideway."),
    Spot(id="senen", name="Pasar Senen", coords=(106.8413, -6.1766), sub_district="Senen", capacity_pcu=3600, sensitivity=0.85, context="Market, bus terminal and rail station share one junction."),
    Spot(id="blok-m", name="Blok M", coords=(106.7997, -6.2443), sub_district="Kebayoran Baru", capacity_pcu=3000, sensitivity=0.70, context="Bus terminal and MRT station at the south CBD edge."),
    Spot(id="kampung-melayu", name="Kampung Melayu", coords=(106.8664, -6.2247), sub_district="Jatinegara", capacity_pcu=3300, sensitivity=0.90, context="Terminal plus Ciliwung bridge pinch point."),
    Spot(id="grogol", name="Grogol", coords=(106.7897, -6.1672), sub_district="Grogol Petamburan", capacity_pcu=3500, sensitivity=0.80, context="Kyai Tapa meets the S. Parman toll ramps."),
    Spot(id="lebak-bulus", name="Lebak Bulus", coords=(106.7743, -6.2894), sub_district="Cilandak", capacity_pcu=3400, sensitivity=0.75, context="MRT terminus next to the JORR on-ramp."),
    Spot(id="tanjung-priok", name="Tanjung Priok Port Gate", coords=(106.8816, -6.1097), sub_district="Tanjung Priok", capacity_pcu=4200, sensitivity=0.85, context="Container truck queue for Indonesia's busiest port."),
    Spot(id="kalibata", name="Kalibata", coords=(106.8546, -6.2560), sub_district="Pancoran", capacity_pcu=3000, sensitivity=0.80, context="Level rail crossing on a dense residential arterial."),
    Spot(id="pasar-minggu", name="Pasar Minggu", coords=(106.8445, -6.2837), sub_district="Pasar Minggu", capacity_pcu=2900, sensitivity=0.85, context="Traditional market spilling into the carriageway."),
]
