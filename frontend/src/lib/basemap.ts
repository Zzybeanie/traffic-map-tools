import type { Map as MapLibreMap } from "maplibre-gl";

export type Theme = "light" | "dark";

export const MAP_STYLES: Record<Theme, string> = {
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

type Recolor = Array<[RegExp, string, string]>;

// Light: Positron is almost pure white, which swallows white glass. Tint land cool-grey and water blue so
// the base has some life while staying quiet enough for the traffic colors. Keys match layer-id prefixes.
const LIGHT: Recolor = [
  [/^background$/, "background-color", "#e6eaf0"],
  [/^(landcover|landuse|park)/, "fill-color", "rgba(134, 170, 140, 0.16)"],
  [/^water$/, "fill-color", "#aac4de"],
  [/^waterway$/, "line-color", "#aac4de"],
  [/^building/, "fill-color", "#d6dbe2"],
  [/_case/, "line-color", "#c5ccd6"],
  [/(road|bridge|tunnel)_.*_fill/, "line-color", "#fbfcfd"],
  [/^place_/, "text-color", "#334155"],
  [/^roadname_/, "text-color", "#64748b"],
];

// Dark: Dark Matter is fine as-is; lift water a touch so the coastline reads.
const DARK: Recolor = [[/^water$/, "fill-color", "#0e1a2b"]];

export function applyBasemapTheme(map: MapLibreMap, theme: Theme): void {
  const rules = theme === "light" ? LIGHT : DARK;
  for (const layer of map.getStyle().layers) {
    for (const [pattern, prop, color] of rules) {
      if (!pattern.test(layer.id)) continue;
      if (prop.split("-")[0] !== layer.type.replace("symbol", "text")) continue;
      map.setPaintProperty(layer.id, prop as never, color as never);
    }
  }
}
