"use client";

import {
  Circle,
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
} from "react-leaflet";

export type IncidentLocationMapProps = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

export default function IncidentLocationMap({
  latitude,
  longitude,
  accuracy,
}: IncidentLocationMapProps) {
  const position: [number, number] = [
    latitude,
    longitude,
  ];

  const safeAccuracy =
    typeof accuracy === "number" &&
    Number.isFinite(accuracy) &&
    accuracy >= 0
      ? accuracy
      : 0;

  // Initial map zoom.
  // The map remains centered on the exact incident location,
  // but the administrator starts zoomed out.
  const zoom = 10;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
      <MapContainer
        center={position}
        zoom={zoom}
        scrollWheelZoom
        className="h-[420px] w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {safeAccuracy > 0 && (
          <Circle
            center={position}
            radius={safeAccuracy}
            pathOptions={{
              color: "#dc2626",
              fillColor: "#ef4444",
              fillOpacity: 0.12,
              weight: 2,
            }}
          />
        )}

        <CircleMarker
          center={position}
          radius={9}
          pathOptions={{
            color: "#ffffff",
            weight: 3,
            fillColor: "#dc2626",
            fillOpacity: 1,
          }}
        >
          <Popup>
            <div className="text-xs">
              <p className="font-bold text-slate-900">
                Report submission location
              </p>

              <p className="mt-1 text-slate-600">
                {latitude.toFixed(6)},{" "}
                {longitude.toFixed(6)}
              </p>

              {safeAccuracy > 0 && (
                <p className="mt-1 text-slate-600">
                  Accuracy: approximately{" "}
                  {Math.round(safeAccuracy)} m
                </p>
              )}
            </div>
          </Popup>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}