"""
Jakarta FlowGIS - Urban Mobility & Hotspot Explorer Backend
FastAPI server serving high-fidelity GeoJSON endpoints for road corridors and intersections.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.traffic import router as traffic_router

app = FastAPI(
    title="Jakarta FlowGIS API",
    description="Spatial telemetry and traffic flow services for DKI Jakarta metropolitan area",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS for local development and Next.js frontend
app.add_middleware(
    CORSMiddleware,
    # ponytail: the Next.js dev proxy makes calls same-origin; this only matters when hitting :8000 directly
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(traffic_router)

@app.get("/", summary="Root Health & Metadata")
async def root():
    return {
        "service": "Jakarta FlowGIS API",
        "version": "1.0.0",
        "status": "online",
        "documentation": "/docs",
        "endpoints": {
            "corridors": "/api/v1/traffic/corridors",
            "spots": "/api/v1/traffic/spots",
            "summary": "/api/v1/traffic/summary"
        },
        "spatial_reference": "EPSG:4326 (WGS84)",
        "bounding_box": [106.689, -6.370, 106.975, -6.088],
        "data": "Road geometry © OpenStreetMap contributors; speeds simulated"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
