"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { Header } from "@/components/Header";
import { ControlPanel } from "@/components/ControlPanel";
import { Legend } from "@/components/Legend";
import {
  JAKARTA_CENTER,
  JAKARTA_DEFAULT_ZOOM,
  INITIAL_SUMMARY,
  EMPTY_COLLECTION,
} from "@/lib/constants";
import {
  GeoJsonFeatureCollection,
  CorridorProperties,
  SpotProperties,
  TrafficSummary,
  FilterControlsState,
} from "@/types/traffic";
import type { Theme } from "@/lib/basemap";

// Dynamically import MapComponent to ensure WebGL only runs client-side
const MapComponent = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-50 text-slate-500 font-medium">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-3 border-emerald-500 border-t-transparent shadow-sm" />
        <p className="text-sm font-semibold tracking-tight text-slate-700">
          Loading Jakarta FlowGIS Canvas...
        </p>
      </div>
    </div>
  ),
});

export default function JakartaTrafficPage() {
  const [corridors, setCorridors] = useState<GeoJsonFeatureCollection<CorridorProperties, GeoJSON.MultiLineString>>(EMPTY_COLLECTION);
  const [spots, setSpots] = useState<GeoJsonFeatureCollection<SpotProperties, GeoJSON.Point>>(EMPTY_COLLECTION);
  const [summary, setSummary] = useState<TrafficSummary>(INITIAL_SUMMARY);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  // null = follow the current WIB hour; 0-23 = replay that hour
  const [hour, setHour] = useState<number | null>(null);
  // The inline script in layout.tsx sets the .dark class before paint; mirror it into state
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  const handleToggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("theme", next);
    } catch {
      // private mode: theme just won't persist
    }
    setTheme(next);
  };
  const [currentZoom, setCurrentZoom] = useState(JAKARTA_DEFAULT_ZOOM);
  const [pitchTarget, setPitchTarget] = useState(0);
  const [flyToTarget, setFlyToTarget] = useState<{ coords: [number, number]; zoom: number; key: number } | null>(null);

  const [filters, setFilters] = useState<FilterControlsState>({
    filterMode: "all",
    showCorridors: true,
    showSpots: true,
    minThreshold: 0.0,
    selectedCorridorId: null,
    selectedSpotId: null,
  });

  // Backend is reached through the Next.js rewrite in next.config.ts
  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    const query = hour === null ? "" : `?hour=${hour}`;
    const get = async (path: string) => {
      const res = await fetch(`/api/v1/traffic/${path}${query}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
      return res.json();
    };

    try {
      const [corridorsData, spotsData, summaryData] = await Promise.all([get("corridors"), get("spots"), get("summary")]);
      setCorridors(corridorsData);
      setSpots(spotsData);
      setSummary(summaryData);
      setIsOffline(false);
    } catch (err) {
      console.error("Traffic API unreachable", err);
      setIsOffline(true);
    } finally {
      setIsRefreshing(false);
    }
  }, [hour]);

  useEffect(() => {
    // Polling an external API is exactly what effects are for; the sync setState is the loading flag
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Filter changes
  const handleFilterChange = (newFilters: Partial<FilterControlsState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  // Camera Actions
  const handleResetCenter = () => {
    setFlyToTarget({ coords: JAKARTA_CENTER, zoom: JAKARTA_DEFAULT_ZOOM, key: Date.now() });
    setPitchTarget(0);
  };

  const handleTogglePitch = () => {
    setPitchTarget((prev) => (prev === 0 ? 52 : 0));
  };

  const handleFlyToLocation = (coords: [number, number], zoom = 14) => {
    setFlyToTarget({ coords, zoom, key: Date.now() });
  };

  const handleZoomIn = () => {
    setFlyToTarget((prev) => ({
      coords: prev ? prev.coords : JAKARTA_CENTER,
      zoom: Math.min(currentZoom + 1, 18),
      key: Date.now(),
    }));
  };

  const handleZoomOut = () => {
    setFlyToTarget((prev) => ({
      coords: prev ? prev.coords : JAKARTA_CENTER,
      zoom: Math.max(currentZoom - 1, 10.5),
      key: Date.now(),
    }));
  };

  const handleResetNorth = () => {
    handleResetCenter();
  };

  // Memoized lists for the Browse Drawer
  const corridorsList = useMemo(() => {
    return corridors.features.map((f) => ({
      id: String(f.id),
      name: f.properties.road_name,
      ratio: f.properties.congestion_ratio,
      speed: f.properties.current_speed,
      coords: f.properties.focus,
    }));
  }, [corridors]);

  const spotsList = useMemo(() => {
    return spots.features.map((f) => {
      return {
        id: String(f.id),
        name: f.properties.spot_name,
        type: f.properties.spot_type,
        speed: f.properties.average_speed_kmh,
        coords: f.geometry.coordinates as [number, number],
      };
    });
  }, [spots]);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-slate-50 font-sans selection:bg-emerald-500 selection:text-white">
      {/* Fullscreen MapLibre GL Canvas */}
      <MapComponent
        corridors={corridors}
        spots={spots}
        filters={filters}
        onZoomChange={setCurrentZoom}
        flyToTarget={flyToTarget}
        pitchTarget={pitchTarget}
        theme={theme}
      />

      {/* Floating Top Header */}
      <Header
        onResetView={handleResetCenter}
        onTogglePitch={handleTogglePitch}
        is3D={pitchTarget > 0}
        onRefresh={fetchData}
        isRefreshing={isRefreshing}
        summary={summary}
        isOffline={isOffline}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Floating Collapsible Left Control Panel */}
      <ControlPanel
        filters={filters}
        onFilterChange={handleFilterChange}
        summary={summary}
        hour={hour}
        onHourChange={setHour}
        corridorsList={corridorsList}
        spotsList={spotsList}
        onFlyToLocation={handleFlyToLocation}
      />

      {/* Floating Bottom-Right Legend & Zoom Controls */}
      <Legend
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetNorth={handleResetNorth}
        currentZoom={currentZoom}
      />
    </main>
  );
}
