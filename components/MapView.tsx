"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet";
import { useEffect } from "react";
import { areaById } from "@/lib/areas";
import type { Area, Provider } from "@/lib/types";

const zoomFor = (radiusKm: number) =>
  radiusKm >= 50 ? 9 : radiusKm >= 15 ? 10 : radiusKm >= 5 ? 12 : 14;

function FocusArea({ area }: { area: Area | null }) {
  const map = useMap();
  useEffect(() => {
    if (area) map.flyTo([area.lat, area.lng], zoomFor(area.radius_km), { duration: 0.8 });
  }, [area, map]);
  return null;
}

const groupIcon = (count: number, verified: boolean) =>
  L.divIcon({
    className: "",
    html: `<div class="kolo-group${verified ? " kolo-verified" : ""}">${count}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });

const shopIcon = L.divIcon({
  className: "",
  html: `<div class="kolo-pin">🏪</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 30],
});

export default function MapView({
  providers,
  focus,
  onSelectGroup,
  onSelectProvider,
}: {
  providers: Provider[];
  focus: Area | null;
  onSelectGroup: (areaId: string, list: Provider[]) => void;
  onSelectProvider: (p: Provider) => void;
}) {
  const shops = providers.filter((p) => p.locationPrecision === "exact" && p.lat && p.lng);
  // Home-based providers are grouped by area and drawn at the area's fixed center.
  const groups = new Map<string, Provider[]>();
  for (const p of providers) {
    if (p.locationPrecision === "exact") continue;
    groups.set(p.areaId, [...(groups.get(p.areaId) || []), p]);
  }

  return (
    <MapContainer center={[37.70, -122.25]} zoom={9} className="h-full w-full" zoomControl={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FocusArea area={focus} />
      {[...groups.entries()].map(([areaId, list]) => {
        const area = areaById(areaId);
        if (!area) return null;
        return (
          <div key={areaId}>
            <Circle
              center={[area.lat, area.lng]}
              radius={area.radius_km * 1000}
              pathOptions={{ color: "#c2410c", fillColor: "#fb923c", fillOpacity: 0.12, weight: 1 }}
            />
            <Marker
              position={[area.lat, area.lng]}
              icon={groupIcon(list.length, list.some((p) => p.verified))}
              eventHandlers={{
                click: () => (list.length === 1 ? onSelectProvider(list[0]) : onSelectGroup(areaId, list)),
              }}
            />
          </div>
        );
      })}
      {shops.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat!, p.lng!]}
          icon={shopIcon}
          eventHandlers={{ click: () => onSelectProvider(p) }}
        />
      ))}
    </MapContainer>
  );
}
