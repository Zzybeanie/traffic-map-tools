"use client";

import React, { useState } from "react";
import {
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Gauge,
  AlertTriangle,
  Route,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import { FilterControlsState, TrafficSummary } from "@/types/traffic";
import { levelOf } from "@/lib/levels";

interface ControlPanelProps {
  filters: FilterControlsState;
  onFilterChange: (newFilters: Partial<FilterControlsState>) => void;
  summary: TrafficSummary;
  hour: number | null;
  onHourChange: (hour: number | null) => void;
  corridorsList: Array<{ id: string; name: string; ratio: number; speed: number; coords: [number, number] }>;
  spotsList: Array<{ id: string; name: string; ratio: number; speed: number; coords: [number, number] }>;
  onFlyToLocation: (coords: [number, number], zoom?: number, name?: string) => void;
}

export function ControlPanel({
  filters,
  onFilterChange,
  summary,
  hour,
  onHourChange,
  corridorsList,
  spotsList,
  onFlyToLocation,
}: ControlPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"controls" | "browse">("controls");

  return (
    <aside className="fixed left-6 top-28 z-20 transition-all duration-300 pointer-events-none">
      <div className="pointer-events-auto relative">
        {/* Toggle Collapse Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? "Expand Control Panel" : "Collapse Control Panel"}
          className="absolute -right-3.5 top-6 z-30 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200/90 bg-white shadow-md text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all active:scale-95"
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>

        {/* Collapsed Mini-Badge */}
        {isCollapsed ? (
          <div
            onClick={() => setIsCollapsed(false)}
            className="cursor-pointer flex items-center gap-2.5 rounded-2xl glass p-3.5 hover:bg-white/70 transition-all"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <div className="pr-2">
              <div className="text-xs font-bold text-slate-900">Traffic Controls</div>
              <div className="text-[10px] text-slate-500">{summary.average_speed_kmh} km/h avg</div>
            </div>
          </div>
        ) : (
          /* Main Panel */
          <div className="w-80 rounded-3xl glass p-5 max-h-[calc(100vh-8.5rem)] flex flex-col overflow-hidden">
            
            {/* Header Tabs */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/70 mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 leading-tight">Control Panel</h2>
                  <p className="text-[11px] text-slate-500 font-medium">Urban Flow Filters</p>
                </div>
              </div>

              <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium">
                <button
                  onClick={() => setActiveTab("controls")}
                  className={`rounded-md px-2.5 py-1 text-[11px] transition-all ${
                    activeTab === "controls"
                      ? "bg-white text-slate-900 shadow-xs font-semibold"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Filters
                </button>
                <button
                  onClick={() => setActiveTab("browse")}
                  className={`rounded-md px-2.5 py-1 text-[11px] transition-all ${
                    activeTab === "browse"
                      ? "bg-white text-slate-900 shadow-xs font-semibold"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Browse ({corridorsList.length + spotsList.length})
                </button>
              </div>
            </div>

            {/* Scrollable Container */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
              
              {activeTab === "controls" ? (
                <>
                  <TimeOfDay summary={summary} hour={hour} onHourChange={onHourChange} />

                  {/* Mode Radio Toggle */}
                  <div className="rounded-2xl border border-white/50 bg-white/35 p-3 shadow-xs">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                      Corridor Scope
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100/90 text-xs font-medium">
                      <button
                        onClick={() => onFilterChange({ filterMode: "all", minThreshold: 0.0 })}
                        className={`rounded-lg py-1.5 px-2 text-center transition-all ${
                          filters.filterMode === "all"
                            ? "bg-white text-slate-900 shadow-xs font-semibold"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        All Roads
                      </button>
                      <button
                        onClick={() => onFilterChange({ filterMode: "free_flow_only", minThreshold: 0.85 })}
                        className={`rounded-lg py-1.5 px-2 text-center transition-all ${
                          filters.filterMode === "free_flow_only"
                            ? "bg-emerald-600 text-white shadow-xs font-semibold"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Free-Flow (R ≥ 0.85)
                      </button>
                    </div>
                  </div>

                  {/* Layer Visibility Checkboxes */}
                  <div className="rounded-2xl border border-white/50 bg-white/35 p-3 shadow-xs space-y-2.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                      Active Spatial Layers
                    </label>
                    
                    <label className="flex items-center justify-between cursor-pointer group">
                      <span className="flex items-center gap-2 text-xs font-medium text-slate-700 group-hover:text-slate-900">
                        <Route className="h-4 w-4 text-emerald-600" />
                        Road Corridor Lines
                      </span>
                      <input
                        type="checkbox"
                        checked={filters.showCorridors}
                        onChange={(e) => onFilterChange({ showCorridors: e.target.checked })}
                        className="h-4 w-4 rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer group">
                      <span className="flex items-center gap-2 text-xs font-medium text-slate-700 group-hover:text-slate-900">
                        <MapPin className="h-4 w-4 text-rose-500" />
                        Bottlenecks & Clear Spots
                      </span>
                      <input
                        type="checkbox"
                        checked={filters.showSpots}
                        onChange={(e) => onFilterChange({ showSpots: e.target.checked })}
                        className="h-4 w-4 rounded-md border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer accent-rose-600"
                      />
                    </label>
                  </div>

                  {/* Congestion Threshold Slider */}
                  <div className="rounded-2xl border border-white/50 bg-white/35 p-3 shadow-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Speed Ratio (R ≥ {filters.minThreshold.toFixed(2)})
                      </span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-mono font-bold text-slate-800">
                        {Math.round(filters.minThreshold * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.50"
                      max="1.00"
                      step="0.05"
                      value={filters.minThreshold}
                      onChange={(e) => onFilterChange({ minThreshold: parseFloat(e.target.value) })}
                      aria-label="Minimum speed ratio"
                      className="range"
                      style={{ "--range-track": ratioTrack(filters.minThreshold) } as React.CSSProperties}
                    />
                    {/* Ticks sit at their true positions on the 0.50–1.00 scale */}
                    <div className="relative mt-1 h-4 text-[10px] font-mono font-semibold text-slate-500">
                      <span className="absolute left-0">0.50</span>
                      <span className="absolute left-[70%] -translate-x-1/2 whitespace-nowrap text-emerald-700">0.85</span>
                      <span className="absolute right-0">1.00</span>
                    </div>
                  </div>

                  {/* Real-time KPI Metrics Cards */}
                  <div className="rounded-2xl border border-white/50 bg-white/35 p-3 shadow-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        DKI Mobility Telemetry
                      </span>
                      <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {/* Average Speed */}
                      <div className="rounded-xl border border-slate-200/60 bg-white/55 p-2 text-center shadow-xs">
                        <Gauge className="h-3.5 w-3.5 text-slate-500 mx-auto mb-1" />
                        <div className="text-sm font-bold text-slate-900 tracking-tight leading-none">
                          {summary.average_speed_kmh}
                        </div>
                        <div className="text-[9px] text-slate-500 font-medium mt-1">Avg Speed (km/h)</div>
                      </div>

                      {/* Open Roads % */}
                      <div className="rounded-xl border border-slate-200/60 bg-white/55 p-2 text-center shadow-xs">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mx-auto mb-1" />
                        <div className="text-sm font-bold text-emerald-700 tracking-tight leading-none">
                          {summary.open_roads_pct}%
                        </div>
                        <div className="text-[9px] text-slate-500 font-medium mt-1">Open Roads</div>
                      </div>

                      {/* Bottlenecks */}
                      <div className="rounded-xl border border-slate-200/60 bg-white/55 p-2 text-center shadow-xs">
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-500 mx-auto mb-1" />
                        <div className="text-sm font-bold text-rose-600 tracking-tight leading-none">
                          {summary.active_bottlenecks_count}
                        </div>
                        <div className="text-[9px] text-slate-500 font-medium mt-1">Active Jams</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                      <span>Monitored Road Network:</span>
                      <span className="font-semibold text-slate-700">{summary.monitored_network_length_km} km</span>
                    </div>
                  </div>
                </>
              ) : (
                /* Browse Quick Jump List */
                <div className="space-y-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Major Corridors ({corridorsList.length})
                    </div>
                    <div className="space-y-1.5">
                      {corridorsList.map((c) => {
                        const level = levelOf(c.ratio);
                        return (
                          <button
                            key={c.id}
                            onClick={() => onFlyToLocation(c.coords, 14, c.name)}
                            className="w-full flex items-center justify-between p-2 rounded-xl bg-white/80 hover:bg-white border border-slate-200/70 text-left transition-all active:scale-98 group"
                          >
                            <div className="truncate pr-2">
                              <div className="text-xs font-semibold text-slate-900 group-hover:text-emerald-700 truncate">
                                {c.name}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {c.speed} km/h • Ratio {(c.ratio * 100).toFixed(0)}%
                              </div>
                            </div>
                            <span
                              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                                level.dot
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Critical Hotspots & Hubs ({spotsList.length})
                    </div>
                    <div className="space-y-1.5">
                      {spotsList.map((s) => {
                        const level = levelOf(s.ratio);
                        return (
                          <button
                            key={s.id}
                            onClick={() => onFlyToLocation(s.coords, 15, s.name)}
                            className="w-full flex items-center justify-between p-2 rounded-xl bg-white/80 hover:bg-white border border-slate-200/70 text-left transition-all active:scale-98 group"
                          >
                            <div className="truncate pr-2">
                              <div className="text-xs font-semibold text-slate-900 group-hover:text-rose-600 truncate">
                                {s.name}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {level.label} • {s.speed} km/h
                              </div>
                            </div>
                            <span
                              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                                level.dot
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Bottom Citation */}
            <div className="pt-3 border-t border-slate-200/70 text-[10px] text-slate-400 flex items-center justify-between">
              <span>DKI Jakarta Open Mobility</span>
              <span className="font-mono text-emerald-600 font-semibold">Active Sync</span>
            </div>

          </div>
        )}
      </div>
    </aside>
  );
}

function TimeOfDay({
  summary,
  hour,
  onHourChange,
}: {
  summary: TrafficSummary;
  hour: number | null;
  onHourChange: (hour: number | null) => void;
}) {
  const shown = hour ?? summary.hour;
  const isLive = hour === null;

  return (
    <div className="rounded-2xl border border-white/50 bg-white/35 p-3 shadow-xs">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Time of Day</span>
        <button
          onClick={() => onHourChange(null)}
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-all ${
            isLive ? "bg-emerald-600 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:text-slate-900"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-white animate-pulse" : "bg-slate-400"}`} />
          Now
        </button>
      </div>

      {/* Demand profile: how busy the city is at each hour, the input to the traffic model */}
      <div className="flex h-10 items-end gap-[2px]" aria-hidden>
        {summary.demand_profile.map((d, h) => (
          <button
            key={h}
            tabIndex={-1}
            onClick={() => onHourChange(h)}
            title={`${String(h).padStart(2, "0")}:00 — demand ${Math.round(d * 100)}%`}
            style={{ height: `${Math.max(d * 100, 6)}%` }}
            className={`flex-1 rounded-sm transition-colors ${
              h === shown ? "bg-slate-900" : d >= 0.85 ? "bg-rose-300/80 hover:bg-rose-400" : "bg-slate-300/80 hover:bg-slate-400"
            }`}
          />
        ))}
      </div>

      <input
        type="range"
        min={0}
        max={23}
        step={1}
        value={shown}
        onChange={(e) => onHourChange(Number(e.target.value))}
        aria-label="Hour of day"
        className="range mt-2"
      />
      <div className="mt-1 flex items-baseline justify-between">
        <span className="font-mono text-sm font-bold text-slate-900">{String(shown).padStart(2, "0")}:00 WIB</span>
        <span className="text-[11px] font-medium text-slate-500">{summary.period}</span>
      </div>
    </div>
  );
}

// Track shows the legend scale over the slider's 0.50–1.00 range (amber until 0.85, then emerald);
// the part left of the thumb is greyed because those roads are hidden.
function ratioTrack(value: number): string {
  const hidden = Math.max(0, Math.min(1, (value - 0.5) / 0.5)) * 100;
  return `linear-gradient(90deg, rgba(71, 85, 105, 0.85) 0 ${hidden}%, transparent ${hidden}%), linear-gradient(90deg, #f59e0b 0 70%, #10b981 70% 100%)`;
}
