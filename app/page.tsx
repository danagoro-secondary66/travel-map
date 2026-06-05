"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import AddPlaceModal from "@/components/AddPlaceModal";
import CollectionsModal from "@/components/CollectionsModal";
import PlaceDetailModal from "@/components/PlaceDetailModal";
import { supabase } from "@/lib/supabase";
import type { Place } from "@/lib/types";

const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,_#f7f0e0,_#ebe3d3_55%,_#ddd4c2)] text-sm font-medium text-slate-600">
      Loading map...
    </div>
  ),
});

const categories = [
  "All",
  "Restaurant",
  "Cafe",
  "Winery",
  "Waterfall",
  "Beach",
  "Hiking Trail",
  "Viewpoint",
  "Park",
  "Museum",
  "Historical Site",
  "Art Gallery",
  "Activities",
  "Shopping",
  "Hotel",
  "Camping",
  "Other",
] as const;

export default function Home() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [filter, setFilter] = useState<(typeof categories)[number]>("All");
  const [isAddPlaceOpen, setIsAddPlaceOpen] = useState(false);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(true);
  const [placesError, setPlacesError] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [collectionsOpen, setCollectionsOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadPlaces() {
      setIsLoadingPlaces(true);
      setPlacesError("");

      const { data, error } = await supabase
        .from("places")
        .select("*")
        .order("created_at", { ascending: false });

      if (!isMounted) {
        return;
      }

      if (error) {
        setPlacesError("Could not load places. Pull to refresh.");
        setPlaces([]);
      } else {
        setPlaces((data ?? []) as Place[]);
      }

      setIsLoadingPlaces(false);
    }

    void loadPlaces();

    return () => {
      isMounted = false;
    };
  }, []);

  function handlePlaceAdded(place: Place) {
    setPlaces((currentPlaces) => [place, ...currentPlaces]);
  }

  function handlePlaceUpdated(updatedPlace: Place) {
    setPlaces((currentPlaces) =>
      currentPlaces.map((place) =>
        place.id === updatedPlace.id ? updatedPlace : place,
      ),
    );
    setSelectedPlace(updatedPlace);
  }

  function handlePlaceDeleted(placeId: string) {
    setPlaces((currentPlaces) =>
      currentPlaces.filter((place) => place.id !== placeId),
    );
    setSelectedPlace((currentPlace) =>
      currentPlace?.id === placeId ? null : currentPlace,
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#f5efdf] text-slate-900">
      <header className="sticky top-0 z-[1000] border-b border-black/5 bg-[#f5efdf]/95 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
              Travel Map
            </p>
            <h1 className="text-xl font-semibold tracking-tight">
              Save places worth coming back to
            </h1>
          </div>

          {placesError ? (
            <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
              Could not load places. Pull to refresh.
            </div>
          ) : null}

          <div className="-mx-1 overflow-x-auto pb-1">
            <div className="flex min-w-max items-center gap-2 px-1">
              <button
                type="button"
                onClick={() => setCollectionsOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white/80 text-slate-700"
                aria-label="Open collections"
              >
                ≡
              </button>

              {categories.map((category) => {
                const isActive = filter === category;

                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setFilter(category)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      isActive
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 bg-white/80 text-slate-700"
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      <section className="relative flex-1">
        <div className="absolute inset-0">
          {isLoadingPlaces ? (
            <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,_#f7f0e0,_#ebe3d3_55%,_#ddd4c2)] text-sm font-medium text-slate-600">
              Loading...
            </div>
          ) : (
            <Map
              places={places}
              filter={filter}
              onPlaceSelect={(place) => setSelectedPlace(place)}
            />
          )}
        </div>
      </section>

      <div className="sticky bottom-0 z-[1000] border-t border-black/5 bg-[#f5efdf]/92 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-end">
          <button
            type="button"
            aria-label="Add a new place"
            onClick={() => setIsAddPlaceOpen(true)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-3xl font-light text-white shadow-[0_14px_28px_rgba(37,99,235,0.35)] transition hover:bg-blue-500"
          >
            +
          </button>
        </div>
      </div>

      <AddPlaceModal
        isOpen={isAddPlaceOpen}
        onClose={() => setIsAddPlaceOpen(false)}
        onPlaceAdded={handlePlaceAdded}
      />

      <CollectionsModal
        isOpen={collectionsOpen}
        onClose={() => setCollectionsOpen(false)}
        places={places}
        onPlaceSelect={(place) => setSelectedPlace(place)}
      />

      <PlaceDetailModal
        place={selectedPlace}
        isOpen={selectedPlace !== null}
        onClose={() => setSelectedPlace(null)}
        onPlaceUpdated={handlePlaceUpdated}
        onPlaceDeleted={handlePlaceDeleted}
      />
    </main>
  );
}
