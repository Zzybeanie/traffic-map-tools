import type { ExpressionSpecification } from "maplibre-gl";

// Single source of truth for green / amber / red. Must match FREE_FLOW / CONGESTED in
// backend/data/traffic_model.py. Everything colored by congestion (lines, dots, popups, lists) uses this.
export const FREE_FLOW = 0.85;
export const CONGESTED = 0.5;

export const LEVELS = {
  free_flow: { label: "Free flow", color: "#10b981", dot: "bg-emerald-500" },
  moderate: { label: "Moderate", color: "#f59e0b", dot: "bg-amber-500" },
  congested: { label: "Congested", color: "#f43f5e", dot: "bg-rose-500" },
} as const;

export type Level = (typeof LEVELS)[keyof typeof LEVELS];

export function levelOf(ratio: number): Level {
  if (ratio >= FREE_FLOW) return LEVELS.free_flow;
  return ratio >= CONGESTED ? LEVELS.moderate : LEVELS.congested;
}

// MapLibre equivalent of levelOf, so the map paints exactly what the cards say
export const RATIO_COLOR: ExpressionSpecification = [
  "step",
  ["get", "congestion_ratio"],
  LEVELS.congested.color,
  CONGESTED,
  LEVELS.moderate.color,
  FREE_FLOW,
  LEVELS.free_flow.color,
];
