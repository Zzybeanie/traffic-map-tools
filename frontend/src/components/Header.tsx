"use client";

import React, { useState, useEffect } from "react";
import { Compass, RefreshCw, RotateCcw, Box, Sun, Moon } from "lucide-react";
import { TrafficSummary } from "@/types/traffic";

interface HeaderProps {
  onResetView: () => void;
  onTogglePitch: () => void;
  is3D: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
  summary: TrafficSummary;
  isOffline: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

export function Header({
  onResetView,
  onTogglePitch,
  is3D,
  onRefresh,
  isRefreshing,
  summary,
  isOffline,
  theme,
  onToggleTheme,
}: HeaderProps) {
  const [wibTime, setWibTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(now);

      const dateStr = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Jakarta",
        weekday: "short",
        day: "2-digit",
        month: "short",
      }).format(now);

      setWibTime(`${timeStr} WIB • ${dateStr}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const replayHour = `${String(summary.hour).padStart(2, "0")}:00 WIB`;
  const statusText = isOffline
    ? "Backend offline • start uvicorn on :8000"
    : summary.is_live
      ? `Simulated live • ${summary.period || "DKI Jakarta"}`
      : `Replaying ${replayHour} • ${summary.period}`;
  const statusDot = isOffline
    ? ["bg-rose-400", "bg-rose-500"]
    : summary.is_live
      ? ["bg-emerald-400", "bg-emerald-500"]
      : ["bg-amber-400", "bg-amber-500"];

  return (
    <header className="pointer-events-none fixed top-4 left-0 right-0 z-30 px-4">
      <div className="pointer-events-auto mx-auto flex max-w-5xl items-center justify-between gap-3 rounded-full glass px-5 py-2.5 transition-all duration-300">
        
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-slate-900 via-slate-800 to-emerald-600 text-white shadow-md shadow-emerald-500/20">
            <Compass className="h-5 w-5" />
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 border-2 border-white"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-slate-900 text-base whitespace-nowrap">
                Jakarta FlowGIS
              </span>
              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap tracking-wide text-emerald-700 border border-emerald-200/60">
                v1.0 MVP
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block font-medium whitespace-nowrap">
              DKI Urban Flow & Hotspot Telemetry
            </p>
          </div>
        </div>

        {/* Center Live Monitoring pill */}
        <div className="hidden md:flex items-center gap-2 rounded-full bg-slate-100/80 whitespace-nowrap border border-slate-200/60 px-3 py-1 text-xs text-slate-700 font-medium">
          <span className="relative flex h-2 w-2">
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${statusDot[0]}`}></span>
            <span className={`relative inline-flex h-2 w-2 rounded-full ${statusDot[1]}`}></span>
          </span>
          <span>{statusText}</span>
          {wibTime && (
            <span className="text-slate-400 font-normal border-l border-slate-200 pl-2">
              {wibTime}
            </span>
          )}
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {/* 3D tilt toggle */}
          <button
            onClick={onTogglePitch}
            title={is3D ? "Switch to 2D Top View" : "Switch to 3D Perspective Tilt"}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all active:scale-95 ${
              is3D
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100/80 text-slate-700 hover:bg-slate-200/80"
            }`}
          >
            <Box className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{is3D ? "3D Tilt" : "2D View"}</span>
          </button>

          {/* Reset Camera to Monas */}
          <button
            onClick={onResetView}
            title="Reset Camera to Monas (Jakarta Central)"
            className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-100/80 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200/80 active:scale-95 transition-all"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Monas Center</span>
          </button>

          {/* Light / dark basemap + UI */}
          <button
            onClick={onToggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100/80 text-slate-700 hover:bg-slate-200/80 hover:text-slate-900 active:scale-95 transition-all"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Refresh data */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh Traffic Data from Backend"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

      </div>
    </header>
  );
}
