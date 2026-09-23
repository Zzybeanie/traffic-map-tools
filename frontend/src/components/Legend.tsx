"use client";

import React, { useState } from "react";
import { Plus, Minus, Compass, ChevronDown, ChevronUp } from "lucide-react";

interface LegendProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetNorth: () => void;
  currentZoom: number;
}

export function Legend({
  onZoomIn,
  onZoomOut,
  onResetNorth,
  currentZoom,
}: LegendProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="fixed bottom-6 right-6 z-20 pointer-events-none flex flex-col items-end gap-2.5">
      {/* Zoom and Navigation Controls */}
      <div className="pointer-events-auto flex flex-col rounded-2xl glass p-1 ">
        <button
          onClick={onZoomIn}
          title="Zoom In"
          className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 hover:text-slate-900 active:scale-95 transition-all"
        >
          <Plus className="h-4 w-4" />
        </button>
        <div className="mx-2 h-px bg-slate-200/70" />
        <button
          onClick={onZoomOut}
          title="Zoom Out"
          className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 hover:text-slate-900 active:scale-95 transition-all"
        >
          <Minus className="h-4 w-4" />
        </button>
        <div className="mx-2 h-px bg-slate-200/70" />
        <button
          onClick={onResetNorth}
          title="Reset North Orientation"
          className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 hover:text-slate-900 active:scale-95 transition-all"
        >
          <Compass className="h-4 w-4" />
        </button>
      </div>

      {/* Main Legend Glassmorphic Card */}
      <div className="pointer-events-auto w-64 rounded-2xl glass p-4 transition-all">
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex cursor-pointer items-center justify-between pb-1"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Traffic Legend
            </h3>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="font-mono text-[10px]">z{currentZoom.toFixed(1)}</span>
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </div>
        </div>

        {isExpanded && (
          <div className="space-y-3 pt-2 text-xs">
            {/* Speed & Flow Ratios */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Speed Ratio (S_current / S_freeflow)
              </div>
              
              {/* Free Flow */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-5 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500/30" />
                  <span className="font-medium text-slate-800">Free Flow</span>
                </div>
                <span className="font-mono text-[11px] font-semibold text-emerald-700">R ≥ 0.85</span>
              </div>

              {/* Moderate */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-5 rounded-full bg-amber-500 shadow-xs shadow-amber-500/30" />
                  <span className="font-medium text-slate-800">Moderate Flow</span>
                </div>
                <span className="font-mono text-[11px] font-semibold text-amber-700">0.50 – 0.84</span>
              </div>

              {/* Congested */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-5 rounded-full bg-rose-500 shadow-xs shadow-rose-500/30" />
                  <span className="font-medium text-slate-800">Congested Jams</span>
                </div>
                <span className="font-mono text-[11px] font-semibold text-rose-600">R &lt; 0.50</span>
              </div>
            </div>

            <div className="h-px bg-slate-200/70" />

            {/* Spot Point Types */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Junction & Hotspot Types
              </div>

              {/* Free Flow Hub */}
              <div className="flex items-center gap-2.5">
                <div className="relative flex h-3.5 w-3.5 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-70"></span>
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600 border border-white"></span>
                </div>
                <span className="text-[11px] font-medium text-slate-700">Junction, same color scale</span>
              </div>

              {/* Bottleneck Marker */}
              <div className="flex items-center gap-2.5">
                <div className="relative flex h-3.5 w-3.5 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-600 border border-white"></span>
                </div>
                <span className="text-[11px] font-medium text-slate-700">Bottleneck junction (pulses)</span>
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 p-2 text-[10px] text-slate-500 border border-slate-200/60 leading-tight">
              Roads: <span className="font-semibold text-slate-700">OpenStreetMap</span> • Speeds: <span className="font-semibold text-slate-700">simulated</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
