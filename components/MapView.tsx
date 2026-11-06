"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from "react-leaflet";
import { useEffect, useState } from "react";
import { areaById, metroOf } from "@/lib/areas";
import type { Provider } from "@/lib/types";

export type MapTarget = { lat: number; lng: number; radius_km: number; nonce: number } | { us: true; nonce: number };
export type Bounds = { south: number; west: number; north: number; east: number };

const US_CENTER: [number, number] = [39.5, -98.35];
const CLUSTER_BELOW_ZOOM = 7;

/** Where a provider shows on the map: shop pin, or her chosen area's fixed center (never jittered). */
export function positionOf(p: Provider): [number, number] | null {
  if (p.locationPrecision === "exact" && p.lat && p.lng) return [p.lat, p.lng];
  const a = areaById(p.areaId);
  return a ? [a.lat, a.lng] : null;
}

function Controller({ target, onBounds, onZoom }: { target: MapTarget | null; onBounds: (b: Bounds) => void; onZoom: (z: number) => void }) {
  const map = useMap();
  const report = () => {
    const b = map.getBounds();
    onBounds({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() });
    onZoom(map.getZoom());
  };
  useMapEvents({ moveend: report, zoomend: report });
  useEffect(report, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!target) return;
    if ("us" in target) map.flyTo(US_CENTER, 4, { duration: 0.8 });
    else map.flyToBounds(L.latLng(target.lat, target.lng).toBounds(target.radius_km * 2000), { duration: 0.8, padding: [20, 20] });
  }, [target, map]);
  return null;
}

const countIcon = (count: number, verified: boolean, big = false) =>
  L.divIcon({
    className: "",
    html: `<div class="kolo-group${verified ? " kolo-verified" : ""}${big ? " kolo-metro" : ""}">${count}</div>`,
    iconSize: big ? [44, 44] : [34, 34],
    iconAnchor: big ? [22, 22] : [17, 17],
  });

const shopIcon = L.divIcon({ className: "", html: `<div class="kolo-pin">🏪</div>`, iconSize: [32, 32], iconAnchor: [16, 30] });

export default function MapView({
  providers,
  target,
  onBounds,
  onSelectGroup,
  onSelectProvider,
  onFly,
}: {
  providers: Provider[];
  target: MapTarget | null;
  onBounds: (b: Bounds) => void;
  onSelectGroup: (areaId: string, list: Provider[]) => void;
  onSelectProvider: (p: Provider) => void;
  onFly: (areaId: string) => void;
}) {
  const [zoom, setZoom] = useState(9);
  // A fresh container per effect run: Fast Refresh / StrictMode re-run effects on the same
  // DOM, and Leaflet refuses to initialize twice on one <div> ("Map container is being reused").
  const [mountId, setMountId] = useState(0);
  useEffect(() => {
    setMountId((n) => n + 1);
  }, []);
  if (mountId === 0) return <div className="h-full w-full bg-sand" />;
  return (
    <MapContainer key={mountId} center={[37.7, -122.25]} zoom={9} className="kolo-map h-full w-full" zoomControl={false}>
      <Tiles />
      <Controller target={target} onBounds={onBounds} onZoom={setZoom} />
      {zoom < CLUSTER_BELOW_ZOOM ? (
        <MetroClusters providers={providers} onFly={onFly} />
      ) : (
        <AreaLayers providers={providers} onSelectGroup={onSelectGroup} onSelectProvider={onSelectProvider} />
      )}
    </MapContainer>
  );
}

/** Whole-country view: one cluster per metro (or state, for state-level providers). Click zooms in. */
function MetroClusters({ providers, onFly }: { providers: Provider[]; onFly: (areaId: string) => void }) {
  const clusters = new Map<string, Provider[]>();
  for (const p of providers) {
    const m = metroOf(p.areaId);
    if (m) clusters.set(m.id, [...(clusters.get(m.id) || []), p]);
  }
  return (
    <>
      {[...clusters.entries()].map(([id, list]) => {
        const a = areaById(id)!;
        return (
          <Marker key={id} position={[a.lat, a.lng]} icon={countIcon(list.length, list.some((p) => p.verified), true)}
            title={a.name} eventHandlers={{ click: () => onFly(id) }} />
        );
      })}
    </>
  );
}

function AreaLayers({ providers, onSelectGroup, onSelectProvider }: {
  providers: Provider[];
  onSelectGroup: (areaId: string, list: Provider[]) => void;
  onSelectProvider: (p: Provider) => void;
}) {
  const shops = providers.filter((p) => p.locationPrecision === "exact" && p.lat && p.lng);
  const groups = new Map<string, Provider[]>();
  for (const p of providers) {
    if (p.locationPrecision === "exact") continue;
    groups.set(p.areaId, [...(groups.get(p.areaId) || []), p]);
  }
  return (
    <>
      {[...groups.entries()].map(([areaId, list]) => {
        const area = areaById(areaId);
        if (!area) return null;
        return (
          <div key={areaId}>
            <Circle
              center={[area.lat, area.lng]}
              radius={area.radius_km * 1000}
              pathOptions={{ color: "#c2410c", fillColor: "#fb923c", fillOpacity: area.level === "state" ? 0.05 : 0.12, weight: 1 }}
            />
            <Marker
              position={[area.lat, area.lng]}
              icon={countIcon(list.length, list.some((p) => p.verified))}
              title={area.name}
              eventHandlers={{ click: () => (list.length === 1 ? onSelectProvider(list[0]) : onSelectGroup(areaId, list)) }}
            />
          </div>
        );
      })}
      {shops.map((p) => (
        <Marker key={p.id} position={[p.lat!, p.lng!]} icon={shopIcon} title={p.name} eventHandlers={{ click: () => onSelectProvider(p) }} />
      ))}
    </>
  );
}

function Tiles() {
  return (
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
  );
}
