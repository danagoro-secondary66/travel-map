"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Place } from "@/lib/types";

type PlaceDetailModalProps = {
  place: Place | null;
  isOpen: boolean;
  onClose: () => void;
  onPlaceUpdated: (place: Place) => void;
  onPlaceDeleted: (placeId: string) => void;
};

type EditableDraft = {
  name: string;
  category: string;
  customCategory: string;
  notes: string;
  visited: boolean;
};

const categories = [
  "Restaurant",
  "Cafe",
  "Bar",
  "Winery",
  "Brewery",
  "Street Food/Market",
  "Waterfall",
  "Beach",
  "Hiking Trail",
  "Viewpoint/Lookout",
  "Park/Garden",
  "Forest",
  "Museum",
  "Historical Site",
  "Art Gallery",
  "Archaeology",
  "Escape Room",
  "Extreme Sports",
  "Spa/Wellness",
  "Tour/Experience",
  "Market",
  "Boutique",
  "Hotel",
  "Airbnb/Rental",
  "Camping",
  "Activities",
  "Other",
] as const;

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
  Activities: "🎬",
  Other: "📍",
};

function Spinner() {
  return (
    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
  );
}

function makeDraft(place: Place): EditableDraft {
  return {
    name: place.name,
    category: place.category || "Other",
    customCategory: place.custom_category ?? "",
    notes: place.notes ?? "",
    visited: place.visited,
  };
}

export default function PlaceDetailModal({
  place,
  isOpen,
  onClose,
  onPlaceUpdated,
  onPlaceDeleted,
}: PlaceDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const [draft, setDraft] = useState<EditableDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingVisited, setIsUpdatingVisited] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !place) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, place]);

  useEffect(() => {
    if (!isOpen || !place) {
      setIsEditing(false);
      setIsDeleteConfirming(false);
      setDraft(null);
      setIsSaving(false);
      setIsDeleting(false);
      setIsUpdatingVisited(false);
      setError("");
      return;
    }

    setDraft(makeDraft(place));
    setIsEditing(false);
    setIsDeleteConfirming(false);
    setError("");
  }, [isOpen, place]);

  const displayCategory = useMemo(() => {
    if (!place) {
      return "Other";
    }

    return place.category || "Other";
  }, [place]);

  async function handleVisitedToggle(nextVisited: boolean) {
    if (!place) {
      return;
    }

    setIsUpdatingVisited(true);
    setError("");

    try {
      const { data, error: updateError } = await supabase
        .from("places")
        .update({ visited: nextVisited })
        .eq("id", place.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      onPlaceUpdated(data as Place);
    } catch {
      setError("Could not update this place. Please try again.");
    } finally {
      setIsUpdatingVisited(false);
    }
  }

  async function handleSaveEdit() {
    if (!place || !draft) {
      return;
    }

    if (!draft.name.trim()) {
      setError("Name is required.");
      return;
    }

    if (draft.category === "Other" && !draft.customCategory.trim()) {
      setError("Add a custom category or pick one from the list.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const { data, error: updateError } = await supabase
        .from("places")
        .update({
          name: draft.name.trim(),
          category: draft.category,
          custom_category: draft.category === "Other" ? draft.customCategory.trim() : null,
          notes: draft.notes.trim() || null,
          visited: draft.visited,
        })
        .eq("id", place.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      onPlaceUpdated(data as Place);
      setIsEditing(false);
    } catch {
      setError("Could not save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!place) {
      return;
    }

    setIsDeleting(true);
    setError("");

    try {
      const { error: deleteError } = await supabase
        .from("places")
        .delete()
        .eq("id", place.id);

      if (deleteError) {
        throw deleteError;
      }

      onPlaceDeleted(place.id);
      onClose();
    } catch {
      setError("Could not delete this place. Please try again.");
    } finally {
      setIsDeleting(false);
      setIsDeleteConfirming(false);
    }
  }

  if (!isOpen || !place || !draft) {
    return null;
  }

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;
  const wazeUrl = `https://waze.com/ul?ll=${place.lat},${place.lng}&navigate=yes`;
  const emoji = categoryEmoji[displayCategory] ?? categoryEmoji.Other;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-end bg-slate-950/45"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[92vh] w-full overflow-hidden rounded-t-[28px] bg-[#faf7ef] shadow-[0_-20px_60px_rgba(15,23,42,0.35)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Place details"
      >
        <div className="mx-auto mt-3 h-1.5 w-14 rounded-full bg-slate-300" />

        <div className="flex items-center justify-between px-5 pb-3 pt-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
              Place Details
            </p>
            <h2 className="text-xl font-semibold text-slate-900">
              {isEditing ? "Edit place" : "Saved place"}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-lg text-slate-700"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <div className="max-h-[calc(92vh-6rem)] overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
          {!isEditing ? (
            <section className="space-y-4">
              <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h3 className="text-2xl font-bold tracking-tight text-slate-900">
                  {place.name}
                </h3>
                <p className="mt-2 text-sm font-medium text-slate-500">
                  {emoji} {displayCategory}
                </p>

                <label className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {place.visited ? "Visited" : "Want to visit"}
                    </p>
                    <p className="text-xs text-slate-500">
                      Toggle to update this place instantly
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isUpdatingVisited ? <Spinner /> : null}
                    <input
                      type="checkbox"
                      checked={place.visited}
                      onChange={(event) => void handleVisitedToggle(event.target.checked)}
                      className="h-5 w-5 rounded border-slate-300"
                    />
                  </div>
                </label>

                {place.opening_hours ? (
                  <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Opening hours
                    </p>
                    <p className="mt-2 text-sm leading-5 text-slate-700">
                      {place.opening_hours}
                    </p>
                  </div>
                ) : null}

                <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Notes
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {place.notes?.trim() || "No notes yet."}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <a
                    href={wazeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-4 text-base font-semibold text-white"
                  >
                    Waze
                  </a>
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center rounded-2xl bg-blue-600 px-4 py-4 text-base font-semibold text-white"
                  >
                    Google Maps
                  </a>
                </div>

                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(makeDraft(place));
                      setIsEditing(true);
                      setIsDeleteConfirming(false);
                      setError("");
                    }}
                    className="flex-1 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDeleteConfirming(true)}
                    className="flex-1 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-200"
                  >
                    🗑️ Delete
                  </button>
                </div>

                {isDeleteConfirming ? (
                  <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-4 ring-1 ring-rose-200">
                    <p className="text-sm font-semibold text-rose-700">
                      Delete this place?
                    </p>
                    <div className="mt-3 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setIsDeleteConfirming(false)}
                        className="flex-1 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete()}
                        disabled={isDeleting}
                        className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {isDeleting ? <Spinner /> : null}
                        {isDeleting ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          ) : (
            <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-700">
                    Edit Place
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">
                    {draft.name || place.name}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setDraft(makeDraft(place));
                    setIsEditing(false);
                    setError("");
                  }}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
              </div>

              <div className="mt-4 rounded-3xl bg-[linear-gradient(135deg,#dbeafe,#eff6ff_55%,#f8fafc)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Coordinates
                </p>
                <p className="mt-2 text-sm font-medium text-slate-800">
                  {place.lat}, {place.lng}
                </p>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Name
                  </label>
                  <input
                    value={draft.name}
                    onChange={(event) =>
                      setDraft((current) =>
                        current ? { ...current, name: event.target.value } : current,
                      )
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Category
                  </label>
                  <select
                    value={draft.category}
                    onChange={(event) =>
                      setDraft((current) =>
                        current ? { ...current, category: event.target.value } : current,
                      )
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                {draft.category === "Other" ? (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Custom category
                    </label>
                    <input
                      value={draft.customCategory}
                      onChange={(event) =>
                        setDraft((current) =>
                          current
                            ? { ...current, customCategory: event.target.value }
                            : current,
                        )
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                    />
                  </div>
                ) : null}

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Notes
                  </label>
                  <textarea
                    value={draft.notes}
                    onChange={(event) =>
                      setDraft((current) =>
                        current ? { ...current, notes: event.target.value } : current,
                      )
                    }
                    rows={5}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </div>

                <label className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="text-sm font-medium text-slate-700">
                    Visited
                  </span>
                  <input
                    type="checkbox"
                    checked={draft.visited}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? { ...current, visited: event.target.checked }
                          : current,
                      )
                    }
                    className="h-5 w-5 rounded border-slate-300"
                  />
                </label>

                {error ? <p className="text-sm text-rose-600">{error}</p> : null}

                <button
                  type="button"
                  onClick={() => void handleSaveEdit()}
                  disabled={isSaving}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {isSaving ? <Spinner /> : null}
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </section>
          )}

          {!isEditing && error ? (
            <p className="mt-4 text-sm text-rose-600">{error}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
