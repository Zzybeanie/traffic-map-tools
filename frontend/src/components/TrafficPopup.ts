import { CorridorProperties, SpotProperties } from "@/types/traffic";

// Popups are raw HTML injected by MapLibre, but they still live under <html class="dark">, so Tailwind
// classes (and the slate/white remap in globals.css) theme them like the rest of the UI.

type Level = { label: string; color: string };

// Same thresholds as the map and legend: free flow >= 0.85, congested < 0.50
function levelOf(ratio: number): Level {
  if (ratio >= 0.85) return { label: "Free flow", color: "#10b981" };
  if (ratio >= 0.5) return { label: "Moderate", color: "#f59e0b" };
  return { label: "Congested", color: "#f43f5e" };
}

function pill(text: string, color: string): string {
  return `<span class="whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold"
    style="color:${color};background:${color}22;box-shadow:inset 0 0 0 1px ${color}55">${text}</span>`;
}

function header(title: string, subtitle: string, badge: string): string {
  return `
    <div class="mb-2.5 flex items-start justify-between gap-2">
      <div>
        <div class="text-[13px] font-bold leading-tight text-slate-900">${title}</div>
        <div class="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">${subtitle}</div>
      </div>
      ${badge}
    </div>`;
}

function stat(label: string, value: string, unit: string, color?: string): string {
  return `
    <div class="rounded-lg border border-slate-200/70 bg-white/50 px-2 py-1.5">
      <div class="text-[9px] font-semibold uppercase tracking-wide text-slate-500">${label}</div>
      <div class="text-[13px] font-extrabold text-slate-900"${color ? ` style="color:${color}"` : ""}>${value}
        <span class="text-[9px] font-medium text-slate-500">${unit}</span></div>
    </div>`;
}

function footnote(text: string): string {
  return `<div class="mt-2.5 border-t border-slate-200/70 pt-2 text-[10.5px] leading-snug text-slate-600">${text}</div>`;
}

const SHELL = "glass w-[268px] rounded-2xl p-3.5 font-sans text-slate-900";

export function createCorridorPopupHtml(props: CorridorProperties): string {
  const level = levelOf(props.congestion_ratio);
  const pct = Math.min(Math.round(props.congestion_ratio * 100), 100);

  return `
    <div class="${SHELL}">
      ${header(props.road_name, `${props.road_category} • ${props.lanes} lanes`, pill(level.label, level.color))}

      <div class="mb-2 rounded-xl border border-slate-200/70 bg-white/50 px-2.5 py-2">
        <div class="flex items-baseline justify-between">
          <span class="text-[11px] text-slate-500">Current speed</span>
          <span class="text-[15px] font-extrabold text-slate-900">${props.current_speed}
            <span class="text-[10px] font-medium text-slate-500">km/h</span></span>
        </div>
        <div class="my-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div class="h-full rounded-full" style="width:${pct}%;background:${level.color}"></div>
        </div>
        <div class="flex justify-between text-[10px] text-slate-500">
          <span>Free-flow ${props.free_flow_speed} km/h</span>
          <span class="font-bold" style="color:${level.color}">${pct}% of free-flow</span>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-1.5">
        ${stat("Delay", `+${props.delay_mins}`, "min", level.color)}
        ${stat("Length", `${props.length_km}`, "km")}
        ${stat("V/C", `${props.vc_ratio}`, "")}
      </div>

      ${footnote(props.status_description)}
    </div>`;
}

export function createSpotPopupHtml(props: SpotProperties): string {
  const level = levelOf(props.congestion_ratio);
  const priority = props.alert_priority === "normal" ? "" : pill(props.alert_priority.toUpperCase(), level.color);

  return `
    <div class="${SHELL}">
      ${header(props.spot_name, props.sub_district, priority || pill(level.label, level.color))}

      <div class="mb-2 flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10.5px] font-semibold"
        style="color:${level.color};background:${level.color}1f">
        <span class="inline-block h-1.5 w-1.5 rounded-full" style="background:${level.color}"></span>
        ${level.label} junction
      </div>

      <div class="grid grid-cols-3 gap-1.5">
        ${stat("Speed", `${props.average_speed_kmh}`, "km/h")}
        ${stat("Delay", `+${props.delay_mins}`, "min", level.color)}
        ${stat("Volume", `${props.vessel_volume_pcu}`, "pcu/h")}
      </div>

      ${footnote(props.status_description)}
    </div>`;
}
