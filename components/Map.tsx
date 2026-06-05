"use client";

import { useEffect, useMemo, useState } from "react";
import L, { DivIcon } from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { Place } from "@/lib/types";

const DEFAULT_CENTER: [number, number] = [20, 0];
const DEFAULT_ZOOM = 2;
const FOCUSED_ZOOM = 13;

type MapProps = {
  places: Place[];
  filter: string;
  onPlaceSelect: (place: Place) => void;
};

type CategoryMeta = {
  color: string;
  emoji: string;
  filter: string;
};

const categoryMap: Record<string, CategoryMeta> = {
  Restaurant: { color: "#dc2626", emoji: "🍽️", filter: "Restaurant" },
  Cafe: { color: "#92400e", emoji: "☕", filter: "Cafe" },
  Bar: { color: "#f97316", emoji: "🍺", filter: "Activities" },
  Winery: { color: "#7c3aed", emoji: "🍷", filter: "Winery" },
  Brewery: { color: "#c2410c", emoji: "🍺", filter: "Activities" },
  "Street Food/Market": { color: "#eab308", emoji: "🥙", filter: "Shopping" },
  "Street Food / Market": { color: "#eab308", emoji: "🥙", filter: "Shopping" },
  Waterfall: { color: "#2563eb", emoji: "💧", filter: "Waterfall" },
  Beach: { color: "#06b6d4", emoji: "🏖️", filter: "Beach" },
  "Hiking Trail": { color: "#16a34a", emoji: "🥾", filter: "Hiking Trail" },
  "Viewpoint/Lookout": { color: "#0f766e", emoji: "🔭", filter: "Viewpoint" },
  "Viewpoint / Lookout": { color: "#0f766e", emoji: "🔭", filter: "Viewpoint" },
  "Park/Garden": { color: "#84cc16", emoji: "🌿", filter: "Park" },
  "Park / Garden": { color: "#84cc16", emoji: "🌿", filter: "Park" },
  Forest: { color: "#166534", emoji: "🌲", filter: "Park" },
  Museum: { color: "#6b7280", emoji: "🏛️", filter: "Museum" },
  "Historical Site": { color: "#374151", emoji: "🏰", filter: "Historical Site" },
  "Art Gallery": { color: "#ec4899", emoji: "🎨", filter: "Art Gallery" },
  Archaeology: { color: "#8b5e3c", emoji: "⛏️", filter: "Historical Site" },
  "Escape Room": { color: "#581c87", emoji: "🔐", filter: "Activities" },
  "Extreme Sports": { color: "#ea580c", emoji: "🪂", filter: "Activities" },
  "Spa/Wellness": { color: "#c4b5fd", emoji: "🧘", filter: "Activities" },
  "Spa / Wellness": { color: "#c4b5fd", emoji: "🧘", filter: "Activities" },
  "Tour/Experience": { color: "#65a30d", emoji: "🗺️", filter: "Activities" },
  "Tour / Experience": { color: "#65a30d", emoji: "🗺️", filter: "Activities" },
  Market: { color: "#a3e635", emoji: "🛍️", filter: "Shopping" },
  Boutique: { color: "#fb7185", emoji: "👗", filter: "Shopping" },
  Hotel: { color: "#1e3a8a", emoji: "🏨", filter: "Hotel" },
  "Airbnb/Rental": { color: "#fb7185", emoji: "🏠", filter: "Hotel" },
  "Airbnb / Rental": { color: "#fb7185", emoji: "🏠", filter: "Hotel" },
  Camping: { color: "#15803d", emoji: "⛺", filter: "Camping" },
  Activities: { color: "#6366f1", emoji: "🎬", filter: "Activities" },
  Other: { color: "#6b7280", emoji: "📍", filter: "Other" },
};

const fallbackCategory: CategoryMeta = categoryMap.Other;

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x.src,
  iconUrl: markerIcon.src,
  shadowUrl: markerShadow.src,
});

function normalizeCategory(category: string) {
  return categoryMap[category]?.filter ?? "Other";
}

function getCategoryMeta(category: string) {
  return categoryMap[category] ?? fallbackCategory;
}

function createPlaceIcon(category: string) {
  const meta = getCategoryMeta(category);

  return new DivIcon({
    className: "",
    html: `<div class="place-marker" style="background:${meta.color}">${meta.emoji}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

function createUserIcon() {
  return new DivIcon({
    className: "",
    html: '<div class="user-location-marker"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function MapViewport({
  userLocation,
  visiblePlaces,
}: {
  userLocation: [number, number] | null;
  visiblePlaces: Place[];
}) {
  const map = useMap();

  useEffect(() => {
    if (visiblePlaces.length > 0) {
      const bounds = L.latLngBounds(
        visiblePlaces.map((place) => [place.lat, place.lng] as [number, number]),
      );

      if (userLocation) {
        bounds.extend(userLocation);
      }

      map.fitBounds(bounds, {
        padding: [36, 36],
        maxZoom: 14,
      });
      return;
    }

    if (userLocation) {
      map.setView(userLocation, FOCUSED_ZOOM);
    }
  }, [map, userLocation, visiblePlaces]);

  return null;
}

export default function Map({ places, filter, onPlaceSelect }: MapProps) {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUserLocation([coords.latitude, coords.longitude]);
      },
      () => {
        setUserLocation(null);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 60_000,
        timeout: 10_000,
      },
    );
  }, []);

  const filteredPlaces = useMemo(() => {
    if (filter === "All") {
      return places;
    }

    return places.filter((place) => normalizeCategory(place.category) === filter);
  }, [filter, places]);

  const userIcon = useMemo(() => createUserIcon(), []);

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
      className="h-full w-full"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapViewport userLocation={userLocation} visiblePlaces={filteredPlaces} />

      {userLocation ? (
        <Marker position={userLocation} icon={userIcon}>
          <Popup>You are here</Popup>
        </Marker>
      ) : null}

      {filteredPlaces.map((place) => {
        return (
          <Marker
            key={place.id}
            position={[place.lat, place.lng]}
            icon={createPlaceIcon(place.category)}
            eventHandlers={{
              click: () => onPlaceSelect(place),
            }}
          />
        );
      })}
    </MapContainer>
  );
}
