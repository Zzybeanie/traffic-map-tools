import { CorridorProperties, SpotProperties } from "@/types/traffic";

export function createCorridorPopupHtml(props: CorridorProperties): string {
  const isFree = props.congestion_ratio >= 0.85;
  const isModerate = props.congestion_ratio >= 0.50 && props.congestion_ratio < 0.85;
  const statusColor = isFree ? "#10b981" : isModerate ? "#f59e0b" : "#f43f5e";
  const statusBg = isFree ? "rgba(16, 185, 129, 0.12)" : isModerate ? "rgba(245, 158, 11, 0.12)" : "rgba(244, 63, 94, 0.12)";
  const statusText = isFree ? "Free Flow" : isModerate ? "Moderate" : "Congested";
  const pctRatio = Math.round(props.congestion_ratio * 100);

  return `
    <div style="
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.95);
      box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.08);
      border-radius: 16px;
      padding: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #0f172a;
      width: 260px;
    ">
      <!-- Header -->
      <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 8px;">
        <div>
          <div style="font-size: 13px; font-weight: 700; color: #0f172a; line-height: 1.2;">
            ${props.road_name}
          </div>
          <div style="font-size: 10px; color: #64748b; font-weight: 500; text-transform: uppercase; margin-top: 2px;">
            ${props.corridor_code} • ${props.road_category}
          </div>
        </div>
        <span style="
          background: ${statusBg};
          color: ${statusColor};
          border: 1px solid ${statusColor}40;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 9999px;
          white-space: nowrap;
        ">
          ${statusText}
        </span>
      </div>

      <!-- Speed & Ratio Metrics -->
      <div style="
        background: rgba(248, 250, 252, 0.85);
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 8px 10px;
        margin-bottom: 8px;
      ">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
          <span style="font-size: 11px; color: #64748b;">Current Speed</span>
          <span style="font-size: 14px; font-weight: 800; color: #0f172a;">${props.current_speed} <span style="font-size: 10px; font-weight: 500; color: #64748b;">km/h</span></span>
        </div>
        
        <!-- Speed Bar -->
        <div style="height: 5px; background: #e2e8f0; border-radius: 9999px; overflow: hidden; margin: 4px 0;">
          <div style="
            width: ${Math.min(pctRatio, 100)}%;
            height: 100%;
            background: ${statusColor};
            border-radius: 9999px;
          "></div>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 10px; color: #64748b; margin-top: 4px;">
          <span>Free-flow: ${props.free_flow_speed} km/h</span>
          <span style="font-weight: 700; color: ${statusColor};">${pctRatio}% efficiency</span>
        </div>
      </div>

      <!-- Detail rows -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11px; margin-bottom: 8px;">
        <div style="background: #f1f5f9; padding: 5px 8px; border-radius: 8px;">
          <div style="font-size: 9px; color: #64748b; text-transform: uppercase;">Est. Delay</div>
          <div style="font-weight: 700; color: #0f172a;">+${props.delay_mins} mins</div>
        </div>
        <div style="background: #f1f5f9; padding: 5px 8px; border-radius: 8px;">
          <div style="font-size: 9px; color: #64748b; text-transform: uppercase;">Corridor Span</div>
          <div style="font-weight: 700; color: #0f172a;">${props.length_km} km</div>
        </div>
      </div>

      <!-- Description note -->
      <div style="font-size: 10px; color: #64748b; line-height: 1.35; border-top: 1px solid #f1f5f9; pt: 6px;">
        ${props.status_description}
      </div>
    </div>
  `;
}

export function createSpotPopupHtml(props: SpotProperties): string {
  const isBottleneck = props.spot_type === "traffic_jam_bottleneck";
  const statusColor = isBottleneck ? "#f43f5e" : "#10b981";
  const statusBg = isBottleneck ? "rgba(244, 63, 94, 0.12)" : "rgba(16, 185, 129, 0.12)";
  const typeLabel = isBottleneck ? "Traffic Jam Bottleneck" : "Free-Flow Open Hub";

  return `
    <div style="
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.95);
      box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.08);
      border-radius: 16px;
      padding: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #0f172a;
      width: 270px;
    ">
      <!-- Header -->
      <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 8px;">
        <div>
          <div style="font-size: 13px; font-weight: 700; color: #0f172a; line-height: 1.2;">
            ${props.spot_name}
          </div>
          <div style="font-size: 10px; color: #64748b; font-weight: 500; margin-top: 2px;">
            ${props.sub_district}
          </div>
        </div>
        <span style="
          background: ${statusBg};
          color: ${statusColor};
          border: 1px solid ${statusColor}40;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 9999px;
          white-space: nowrap;
        ">
          ${props.alert_priority.toUpperCase()}
        </span>
      </div>

      <!-- Spot Category pill -->
      <div style="
        font-size: 10.5px;
        font-weight: 600;
        color: ${statusColor};
        background: ${statusBg};
        padding: 4px 8px;
        border-radius: 8px;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
      ">
        <span style="display: inline-block; width: 6px; height: 6px; border-radius: 9999px; background: ${statusColor};"></span>
        ${typeLabel}
      </div>

      <!-- Metrics -->
      <div style="
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 6px;
        margin-bottom: 8px;
        text-align: center;
      ">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px 4px; border-radius: 8px;">
          <div style="font-size: 9px; color: #64748b;">Avg Speed</div>
          <div style="font-size: 13px; font-weight: 800; color: #0f172a;">${props.average_speed_kmh}</div>
          <div style="font-size: 8px; color: #94a3b8;">km/h</div>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px 4px; border-radius: 8px;">
          <div style="font-size: 9px; color: #64748b;">Delay</div>
          <div style="font-size: 13px; font-weight: 800; color: ${isBottleneck ? '#f43f5e' : '#10b981'};">+${props.delay_mins}m</div>
          <div style="font-size: 8px; color: #94a3b8;">queue</div>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px 4px; border-radius: 8px;">
          <div style="font-size: 9px; color: #64748b;">Volume</div>
          <div style="font-size: 13px; font-weight: 800; color: #0f172a;">${props.vessel_volume_pcu}</div>
          <div style="font-size: 8px; color: #94a3b8;">pcu/hr</div>
        </div>
      </div>

      <!-- Description note -->
      <div style="font-size: 10px; color: #64748b; line-height: 1.35; border-top: 1px solid #f1f5f9; pt: 6px;">
        ${props.status_description}
      </div>
    </div>
  `;
}
