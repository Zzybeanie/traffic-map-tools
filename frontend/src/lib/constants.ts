import { TrafficSummary } from "@/types/traffic";

export const JAKARTA_CENTER: [number, number] = [106.8272, -6.1754]; // Monas [lng, lat]
export const JAKARTA_DEFAULT_ZOOM = 11.8;
export const JAKARTA_BOUNDS: [[number, number], [number, number]] = [
  [106.689, -6.370], // Southwest
  [106.975, -6.088], // Northeast
];

export const INITIAL_SUMMARY: TrafficSummary = {
  hour: 0,
  is_live: true,
  period: "",
  demand_profile: [],
  average_speed_kmh: 0,
  open_roads_pct: 0,
  active_bottlenecks_count: 0,
  free_flow_hubs_count: 0,
  average_network_delay_mins: 0,
  monitored_network_length_km: 0,
  total_corridors_tracked: 0,
  total_hotspots_tracked: 0,
  timestamp_wib: "",
};

export const EMPTY_COLLECTION = { type: "FeatureCollection" as const, features: [] };
