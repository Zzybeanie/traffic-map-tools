import type { Map as MapLibreMap } from "maplibre-gl";

// Positron is near-white, which washes out white glass panels. Recolor it to a cool slate grey so the
// panels float and the traffic colors carry the contrast. Keys match Positron layer-id prefixes.
const GREY: Array<[RegExp, string, string]> = [
  [/^background$/, "background-color", "#c3c9d1"],
  [/^(landcover|landuse|park)/, "fill-color", "rgba(148, 160, 174, 0.18)"],
  [/^water$/, "fill-color", "#9eabb9"],
  [/^waterway$/, "line-color", "#9eabb9"],
  [/^building/, "fill-color", "#b6bdc6"],
  [/_case/, "line-color", "#adb4be"],
  [/(road|bridge|tunnel)_.*_fill/, "line-color", "#dde1e6"],
  [/^(rail|tunnel_rail)$/, "line-color", "#a8b0ba"],
  [/^place_/, "text-color", "#3f4b5b"],
  [/^roadname_/, "text-color", "#5b6676"],
  [/^(waterway_label|watername_)/, "text-color", "#56677a"],
  [/^place_/, "text-halo-color", "rgba(215, 220, 227, 0.9)"],
];

export function applyGreyBasemap(map: MapLibreMap): void {
  for (const layer of map.getStyle().layers) {
    for (const [pattern, prop, color] of GREY) {
      if (!pattern.test(layer.id)) continue;
      // ponytail: prop/layer-type mismatches are skipped by maplibre with a console warning, not an error
      if (prop.split("-")[0] !== layer.type.replace("symbol", "text")) continue;
      map.setPaintProperty(layer.id, prop as never, color as never);
    }
  }
}
