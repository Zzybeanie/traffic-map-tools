export interface CorridorProperties {
  road_name: string;
  corridor_code: string;
  current_speed: number;
  free_flow_speed: number;
  congestion_ratio: number;
  traffic_level: "free_flow" | "moderate" | "congested";
  road_category: "primary" | "secondary" | "highway";
  length_km: number;
  delay_mins: number;
  lanes: number;
  vc_ratio: number;
  focus: [number, number];
  status_description: string;
}

export interface SpotProperties {
  spot_name: string;
  spot_code: string;
  spot_type: "free_flow_hub" | "moderate" | "traffic_jam_bottleneck";
  sub_district: string;
  delay_mins: number;
  average_speed_kmh: number;
  congestion_ratio: number;
  vessel_volume_pcu: number;
  status_description: string;
  alert_priority: "normal" | "high" | "critical";
  vc_ratio: number;
}

export type GeoJsonFeatureCollection<P, G extends GeoJSON.Geometry = GeoJSON.Geometry> = GeoJSON.FeatureCollection<G, P> & {
  metadata?: { hour: number; is_live: boolean; source: string };
};

export interface TrafficSummary {
  hour: number;
  is_live: boolean;
  period: string;
  demand_profile: number[];
  average_speed_kmh: number;
  open_roads_pct: number;
  active_bottlenecks_count: number;
  free_flow_hubs_count: number;
  average_network_delay_mins: number;
  monitored_network_length_km: number;
  total_corridors_tracked: number;
  total_hotspots_tracked: number;
  timestamp_wib: string;
}

export interface FilterControlsState {
  filterMode: "all" | "free_flow_only";
  showCorridors: boolean;
  showSpots: boolean;
  minThreshold: number; // 0.50 to 1.00
  selectedCorridorId: string | null;
  selectedSpotId: string | null;
}
