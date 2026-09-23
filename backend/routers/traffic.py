"""
GeoJSON endpoints for the Jakarta traffic map.
`hour` (0-23 WIB) replays a time of day; omit it for the current WIB hour.
"""

from typing import Any, Literal, Optional

from fastapi import APIRouter, Query

from data import traffic_model

router = APIRouter(prefix="/api/v1/traffic", tags=["Jakarta Traffic Flow"])

Hour = Query(None, ge=0, le=23, description="Hour of day in WIB; omit for now")


@router.get("/corridors", summary="Road corridors as GeoJSON MultiLineStrings")
def get_corridors(
    hour: Optional[int] = Hour,
    min_ratio: float = Query(0.0, ge=0.0, le=1.0, description="Keep corridors with speed ratio >= this"),
) -> dict[str, Any]:
    return traffic_model.corridors(hour, min_ratio)


@router.get("/spots", summary="Junction hotspots as GeoJSON Points")
def get_spots(
    hour: Optional[int] = Hour,
    spot_type: Literal["all", "free_flow_only", "bottleneck_only", "free_flow_hub", "moderate", "traffic_jam_bottleneck"] = "all",
) -> dict[str, Any]:
    return traffic_model.spots(hour, spot_type)


@router.get("/summary", summary="Network-wide KPIs")
def get_summary(hour: Optional[int] = Hour) -> dict[str, Any]:
    return traffic_model.summary(hour)
