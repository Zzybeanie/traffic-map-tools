"use client";

import React, { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type {
  ExpressionSpecification,
  FilterSpecification,
  MapLayerMouseEvent,
  Map as MapLibreMap,
  Popup,
} from "maplibre-gl";
import {
  JAKARTA_CENTER,
  JAKARTA_DEFAULT_ZOOM,
  JAKARTA_BOUNDS,
  MAP_STYLE_URL,
} from "@/lib/constants";
import {
  GeoJsonFeatureCollection,
  CorridorProperties,
  SpotProperties,
  FilterControlsState,
} from "@/types/traffic";
import {
  createCorridorPopupHtml,
  createSpotPopupHtml,
} from "./TrafficPopup";
import { applyGreyBasemap } from "@/lib/basemap";

// Same thresholds as the backend model and the legend: free flow >= 0.85, congested < 0.50
const RATIO_COLOR: ExpressionSpecification = ["step", ["get", "congestion_ratio"], "#f43f5e", 0.5, "#f59e0b", 0.85, "#10b981"];

// ponytail: maplibre v6 resolves its worker next to import.meta.url, which Turbopack bundling breaks.
// Worker + shared chunk are copied to public/maplibre by the postinstall script.
maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

interface MapProps {
  corridors: GeoJsonFeatureCollection<CorridorProperties>;
  spots: GeoJsonFeatureCollection<SpotProperties>;
  filters: FilterControlsState;
  onZoomChange?: (zoom: number) => void;
  flyToTarget: { coords: [number, number]; zoom: number; key: number } | null;
  pitchTarget: number;
}

export function MapComponent({
  corridors,
  spots,
  filters,
  onZoomChange,
  flyToTarget,
  pitchTarget,
}: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize MapLibre GL
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let isUnmounted = false;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE_URL,
      center: JAKARTA_CENTER,
      zoom: JAKARTA_DEFAULT_ZOOM,
      minZoom: 10,
      maxZoom: 18,
      maxBounds: JAKARTA_BOUNDS,
      attributionControl: false,
      pitch: 0,
      bearing: 0,
    });

    mapRef.current = map;

    // Custom attribution
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution: "© CartoDB, © OpenStreetMap contributors | Jakarta FlowGIS",
      }),
      "bottom-left"
    );

    // Track zoom
    map.on("zoom", () => {
      if (onZoomChange) {
        onZoomChange(map.getZoom());
      }
    });

    // Error logger to catch any network/rendering glitches
    map.on("error", (e: maplibregl.ErrorEvent) => {
      // Don't crash on individual tile errors
      if (e?.error?.message && !e.error.message.includes("404")) {
        console.warn("MapLibre event note:", e.error.message);
      }
    });

    // Global popup instance
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 12,
    });
    popupRef.current = popup;

    const setupLayers = () => {
      if (isUnmounted || !mapRef.current) return;
      if (map.getSource("corridors-src")) return; // already initialized

      setMapLoaded(true);
      applyGreyBasemap(map);

      // 1. Add Corridors Source
      map.addSource("corridors-src", {
        type: "geojson",
        data: corridors,
      });

      // 2. Corridor outline casing for crisp contrast over light streets
      map.addLayer({
        id: "corridors-casing",
        type: "line",
        source: "corridors-src",
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#ffffff",
          "line-width": [
            "match",
            ["get", "road_category"],
            "highway", 7.5,
            "primary", 6.5,
            4.5,
          ],
          "line-opacity": 0.85,
        },
      });

      // 3. Corridor Colored Flow Line
      map.addLayer({
        id: "corridors-flow",
        type: "line",
        source: "corridors-src",
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": [
            "step",
            ["get", "congestion_ratio"],
            "#f43f5e", // < 0.50 (Congested Rose)
            0.50,
            "#f59e0b", // 0.50 - 0.84 (Moderate Amber)
            0.85,
            "#10b981", // >= 0.85 (Free Flow Emerald)
          ],
          "line-width": [
            "match",
            ["get", "road_category"],
            "highway", 5,
            "primary", 4,
            2.5,
          ],
          "line-opacity": 0.95,
        },
      });

      // 4. Add Spots Source
      map.addSource("spots-src", {
        type: "geojson",
        data: spots,
      });

      // 5. Spots Outer Pulsing Aura (Animated)
      map.addLayer({
        id: "spots-pulsing-aura",
        type: "circle",
        source: "spots-src",
        paint: {
          "circle-radius": [
            "match",
            ["get", "spot_type"],
            "traffic_jam_bottleneck", 18,
            12,
          ],
          "circle-color": RATIO_COLOR,
          "circle-opacity": [
            "match",
            ["get", "spot_type"],
            "traffic_jam_bottleneck", 0.25,
            0.18,
          ],
          "circle-blur": 0.35,
        },
      });

      // 6. Spots Core Point Layer
      map.addLayer({
        id: "spots-core",
        type: "circle",
        source: "spots-src",
        paint: {
          "circle-radius": [
            "match",
            ["get", "spot_type"],
            "traffic_jam_bottleneck", 7,
            6,
          ],
          "circle-color": RATIO_COLOR,
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 1.0,
        },
      });

      // 7. Pulsing Animation Loop for Bottleneck spots
      const startTime = performance.now();
      const animateAura = (time: number) => {
        if (isUnmounted || !mapRef.current) return;
        const elapsed = (time - startTime) / 1000;
        const phase = (elapsed % 1.8) / 1.8;
        const currentRadius = 14 + Math.sin(phase * Math.PI) * 8;
        const currentOpacity = 0.35 * (1 - phase * 0.7);

        try {
          if (map.getLayer("spots-pulsing-aura")) {
            map.setPaintProperty("spots-pulsing-aura", "circle-radius", [
              "match",
              ["get", "spot_type"],
              "traffic_jam_bottleneck", currentRadius,
              12,
            ]);
            map.setPaintProperty("spots-pulsing-aura", "circle-opacity", [
              "match",
              ["get", "spot_type"],
              "traffic_jam_bottleneck", currentOpacity,
              0.18,
            ]);
          }
        } catch {
          // Layer might be in transition
        }

        animFrameRef.current = requestAnimationFrame(animateAura);
      };

      animFrameRef.current = requestAnimationFrame(animateAura);

      // --- Interactive Hover Events ---

      // Spot hover
      map.on("mouseenter", "spots-core", (e: MapLayerMouseEvent) => {
        map.getCanvas().style.cursor = "pointer";
        if (!e.features || !e.features[0]) return;

        const feature = e.features[0];
        const coordinates = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
        const properties = feature.properties as SpotProperties;

        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
          coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
        }

        popup
          .setLngLat(coordinates)
          .setHTML(createSpotPopupHtml(properties))
          .addTo(map);
      });

      map.on("mouseleave", "spots-core", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });

      // Corridor hover
      map.on("mouseenter", "corridors-flow", (e: MapLayerMouseEvent) => {
        map.getCanvas().style.cursor = "pointer";
        if (!e.features || !e.features[0]) return;

        const feature = e.features[0];
        const properties = feature.properties as CorridorProperties;

        popup
          .setLngLat(e.lngLat)
          .setHTML(createCorridorPopupHtml(properties))
          .addTo(map);
      });

      map.on("mouseleave", "corridors-flow", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });
    };

    // Attach to both load and style.load to guarantee trigger
    map.on("load", setupLayers);
    map.on("styledata", () => {
      if (map.isStyleLoaded()) {
        setupLayers();
      }
    });

    if (map.isStyleLoaded()) {
      setupLayers();
    }

    return () => {
      isUnmounted = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      popup.remove();
      map.remove();
      mapRef.current = null;
    };
    // Create the map once; later data changes flow through the setData effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update Data Sources when corridors/spots change
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    try {
      const corridorsSrc = map.getSource<maplibregl.GeoJSONSource>("corridors-src");
      if (corridorsSrc) {
        corridorsSrc.setData(corridors);
      }

      const spotsSrc = map.getSource<maplibregl.GeoJSONSource>("spots-src");
      if (spotsSrc) {
        spotsSrc.setData(spots);
      }
    } catch (e) {
      console.warn("Source update sync:", e);
    }
  }, [corridors, spots, mapLoaded]);

  // Update Filters & Layer Visibility
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    try {
      // Visibility toggles
      const corridorVisibility = filters.showCorridors ? "visible" : "none";
      if (map.getLayer("corridors-casing")) {
        map.setLayoutProperty("corridors-casing", "visibility", corridorVisibility);
      }
      if (map.getLayer("corridors-flow")) {
        map.setLayoutProperty("corridors-flow", "visibility", corridorVisibility);
      }

      const spotVisibility = filters.showSpots ? "visible" : "none";
      if (map.getLayer("spots-pulsing-aura")) {
        map.setLayoutProperty("spots-pulsing-aura", "visibility", spotVisibility);
      }
      if (map.getLayer("spots-core")) {
        map.setLayoutProperty("spots-core", "visibility", spotVisibility);
      }

      // Filter expressions
      if (filters.filterMode === "free_flow_only") {
        const corridorFilter = [">=", ["get", "congestion_ratio"], 0.85] as FilterSpecification;
        if (map.getLayer("corridors-casing")) map.setFilter("corridors-casing", corridorFilter);
        if (map.getLayer("corridors-flow")) map.setFilter("corridors-flow", corridorFilter);

        const spotFilter = ["==", ["get", "spot_type"], "free_flow_hub"] as FilterSpecification;
        if (map.getLayer("spots-pulsing-aura")) map.setFilter("spots-pulsing-aura", spotFilter);
        if (map.getLayer("spots-core")) map.setFilter("spots-core", spotFilter);
      } else {
        const corridorFilter = [">=", ["get", "congestion_ratio"], filters.minThreshold] as FilterSpecification;
        if (map.getLayer("corridors-casing")) map.setFilter("corridors-casing", corridorFilter);
        if (map.getLayer("corridors-flow")) map.setFilter("corridors-flow", corridorFilter);

        if (map.getLayer("spots-pulsing-aura")) map.setFilter("spots-pulsing-aura", null);
        if (map.getLayer("spots-core")) map.setFilter("spots-core", null);
      }
    } catch (e) {
      console.warn("Filter update sync:", e);
    }
  }, [filters, mapLoaded]);

  // Handle Fly-To triggers from browse list
  useEffect(() => {
    if (!mapRef.current || !flyToTarget) return;
    mapRef.current.flyTo({
      center: flyToTarget.coords,
      zoom: flyToTarget.zoom,
      speed: 1.4,
      curve: 1.2,
      essential: true,
    });
  }, [flyToTarget]);

  // Handle 3D Pitch tilt changes
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.easeTo({
      pitch: pitchTarget,
      duration: 800,
    });
  }, [pitchTarget]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-100">
      <div ref={mapContainerRef} className="h-full w-full" />
    </div>
  );
}

export default MapComponent;
