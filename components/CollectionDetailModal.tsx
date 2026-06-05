"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Collection, Place } from "@/lib/types";

type CollectionDetailModalProps = {
  collection: Collection;
  isOpen: boolean;
  onClose: () => void;
  places: Place[];
  onPlaceSelect: (place: Place) => void;
  onCollectionUpdated?: (collection: Collection) => void;
  onCollectionDeleted?: (collectionId: string) => void;
  onMembershipChanged?: (collectionId: string, placeCount: number) => void;
};

type PlaceCollectionRow = {
  place_id: string;
};

const categoryEmoji: Record<string, string> = {
  Restaurant: "🍽️",
  Cafe: "☕",
  Bar: "🍺",
  Winery: "🍷",
  Brewery: "🍺",
  "Street Food/Market": "🥙",
  Waterfall: "💧",
  Beach: "🏖️",
  "Hiking Trail": "🥾",
  "Viewpoint/Lookout": "🔭",
  "Park/Garden": "🌿",
  Forest: "🌲",
  Museum: "🏛️",
  "Historical Site": "🏰",
  "Art Gallery": "🎨",
  Archaeology: "⛏️",
  "Escape Room": "🔐",
  "Extreme Sports": "🪂",
  "Spa/Wellness": "🧘",
  "Tour/Experience": "🗺️",
  Market: "🛍️",
  Boutique: "👗",
  Hotel: "🏨",
  "Airbnb/Rental": "🏠",
  Camping: "⛺",
  Other: "📍",
};

function Spinner() {
  return (
    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
  );
}

export default function CollectionDetailModal({
  collection,
  isOpen,
  onClose,
  places,
  onPlaceSelect,
  onCollectionUpdated,
  onMembershipChanged,
}: CollectionDetailModalProps) {
  const [collectionPlaces, setCollectionPlaces] = useState<Place[]>([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [error, setError] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(collection.name);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isAddMode, setIsAddMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSavingSelection, setIsSavingSelection] = useState(false);
  const [removingPlaceId, setRemovingPlaceId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setRenameValue(collection.name);
  }, [collection.name, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setCollectionPlaces([]);
      setError("");
      setIsRenaming(false);
      setIsSavingName(false);
      setIsAddMode(false);
      setSearchTerm("");
      setSelectedIds([]);
      setIsSavingSelection(false);
      setRemovingPlaceId(null);
      return;
    }

    async function loadCollectionPlaces() {
      setIsLoadingPlaces(true);
      setError("");

      const { data, error: fetchError } = await supabase
        .from("place_collections")
        .select("place_id")
        .eq("collection_id", collection.id);

      if (fetchError) {
        setError("Could not load collection places.");
        setCollectionPlaces([]);
        setIsLoadingPlaces(false);
        return;
      }

      const placeIds = ((data ?? []) as PlaceCollectionRow[]).map((row) => row.place_id);
      const nextPlaces = placeIds
        .map((placeId) => places.find((place) => place.id === placeId))
        .filter((place): place is Place => Boolean(place));

      setCollectionPlaces(nextPlaces);
      setSelectedIds(placeIds);
      onMembershipChanged?.(collection.id, placeIds.length);
      setIsLoadingPlaces(false);
    }

    void loadCollectionPlaces();
  }, [collection.id, isOpen, onMembershipChanged, places]);

  const filteredPlaces = useMemo(() => {
    const lowerSearch = searchTerm.trim().toLowerCase();

    if (!lowerSearch) {
      return places;
    }

    return places.filter((place) => {
      const category = place.custom_category || place.category;
      return (
        place.name.toLowerCase().includes(lowerSearch) ||
        category.toLowerCase().includes(lowerSearch)
      );
    });
  }, [places, searchTerm]);

  async function handleRename() {
    const name = renameValue.trim();

    if (!name) {
      setError("Collection name cannot be empty.");
      return;
    }

    setIsSavingName(true);
    setError("");

    const { data, error: updateError } = await supabase
      .from("collections")
      .update({ name })
      .eq("id", collection.id)
      .select()
      .single();

    if (updateError) {
      setError("Could not rename this collection.");
      setIsSavingName(false);
      return;
    }

    onCollectionUpdated?.(data as Collection);
    setIsRenaming(false);
    setIsSavingName(false);
  }

  async function handleConfirmAddPlaces() {
    const existingIds = new Set(collectionPlaces.map((place) => place.id));
    const newIds = selectedIds.filter((placeId) => !existingIds.has(placeId));

    if (newIds.length === 0) {
      setIsAddMode(false);
      return;
    }

    setIsSavingSelection(true);
    setError("");

    const payload = newIds.map((placeId) => ({
      place_id: placeId,
      collection_id: collection.id,
    }));

    const { error: insertError } = await supabase
      .from("place_collections")
      .insert(payload);

    if (insertError) {
      setError("Could not add places to this collection.");
      setIsSavingSelection(false);
      return;
    }

    const addedPlaces = newIds
      .map((placeId) => places.find((place) => place.id === placeId))
      .filter((place): place is Place => Boolean(place));

    setCollectionPlaces((currentPlaces) => [...currentPlaces, ...addedPlaces]);
    onMembershipChanged?.(collection.id, collectionPlaces.length + addedPlaces.length);
    setIsAddMode(false);
    setIsSavingSelection(false);
  }

  async function handleRemovePlace(placeId: string) {
    setRemovingPlaceId(placeId);
    setError("");

    const { error: deleteError } = await supabase
      .from("place_collections")
      .delete()
      .eq("collection_id", collection.id)
      .eq("place_id", placeId);

    if (deleteError) {
      setError("Could not remove this place from the collection.");
      setRemovingPlaceId(null);
      return;
    }

    setCollectionPlaces((currentPlaces) =>
      currentPlaces.filter((place) => place.id !== placeId),
    );
    setSelectedIds((currentIds) => currentIds.filter((id) => id !== placeId));
    onMembershipChanged?.(collection.id, collectionPlaces.length - 1);
    setRemovingPlaceId(null);
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[1250] flex items-end bg-slate-950/35"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[92vh] w-full overflow-hidden rounded-t-[28px] bg-[#faf7ef] shadow-[0_-20px_60px_rgba(15,23,42,0.35)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Collection details"
      >
        <div className="mx-auto mt-3 h-1.5 w-14 rounded-full bg-slate-300" />

        <div className="flex items-center justify-between px-5 pb-3 pt-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
              Collection
            </p>
            {isRenaming ? (
              <div className="mt-1 flex items-center gap-2">
                <input
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleRename();
                    }
                  }}
                  className="min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-lg font-semibold outline-none focus:border-slate-400"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => void handleRename()}
                  disabled={isSavingName}
                  className="rounded-full bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {isSavingName ? "..." : "✓"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsRenaming(true)}
                className="mt-1 text-left text-xl font-semibold tracking-tight text-slate-900"
              >
                {collection.name}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-lg text-slate-700"
            aria-label="Close collection detail"
          >
            ×
          </button>
        </div>

        <div className="max-h-[calc(92vh-6rem)] overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
          <button
            type="button"
            onClick={() => setIsAddMode((current) => !current)}
            className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
          >
            Add places
          </button>

          {isAddMode ? (
            <div className="mt-4 rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search all places"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
              />

              <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
                {filteredPlaces.map((place) => (
                  <label
                    key={place.id}
                    className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(place.id)}
                      onChange={(event) =>
                        setSelectedIds((currentIds) =>
                          event.target.checked
                            ? [...new Set([...currentIds, place.id])]
                            : currentIds.filter((id) => id !== place.id),
                        )
                      }
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span className="text-sm font-medium text-slate-700">
                      {place.name}
                    </span>
                  </label>
                ))}
              </div>

              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddMode(false)}
                  className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmAddPlaces()}
                  disabled={isSavingSelection}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {isSavingSelection ? <Spinner /> : null}
                  {isSavingSelection ? "Saving..." : "Confirm"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {isLoadingPlaces ? (
              <div className="flex items-center justify-center rounded-[28px] bg-white px-4 py-10 text-sm font-medium text-slate-500 ring-1 ring-slate-200">
                Loading collection places...
              </div>
            ) : collectionPlaces.length > 0 ? (
              collectionPlaces.map((place) => {
                const emoji = categoryEmoji[place.category] ?? categoryEmoji.Other;

                return (
                  <div
                    key={place.id}
                    className="flex items-center gap-3 rounded-[28px] bg-white px-4 py-4 shadow-sm ring-1 ring-slate-200"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onPlaceSelect(place);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <span className="text-xl">{emoji}</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {place.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {place.visited ? "Visited" : "Want to visit"}
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleRemovePlace(place.id)}
                      disabled={removingPlaceId === place.id}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-sm font-semibold text-rose-700 ring-1 ring-rose-200 disabled:opacity-60"
                      aria-label={`Remove ${place.name}`}
                    >
                      {removingPlaceId === place.id ? "..." : "×"}
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[28px] bg-white px-4 py-10 text-center text-sm font-medium text-slate-500 ring-1 ring-slate-200">
                No places in this collection yet.
              </div>
            )}
          </div>

          {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
