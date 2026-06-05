"use client";

import { useEffect, useMemo, useState } from "react";
import Tesseract from "tesseract.js";
import { extractPlaceFromImage, QuotaExceededError } from "@/lib/gemini";
import { supabase } from "@/lib/supabase";
import type { Place } from "@/lib/types";
import { searchPlace } from "@/lib/geoapify";

type AddPlaceModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onPlaceAdded: (place: Place) => void;
};

type TabKey = "search" | "screenshot" | "manual";

type Category = (typeof categories)[number];

type SearchResult = {
  display_name: string;
  lat: string;
  lon: string;
  category?: string;
  osm_id?: number;
};

type DraftPlace = {
  name: string;
  lat: string;
  lng: string;
  category: string;
  customCategory: string;
  notes: string;
  visited: boolean;
  openingHours: string | null;
  osmId: string | null;
};

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "search", label: "Search" },
  { key: "screenshot", label: "Screenshot" },
  { key: "manual", label: "Manual" },
];

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
  "Other",
] as const;

const initialDraft: DraftPlace = {
  name: "",
  lat: "",
  lng: "",
  category: "Other",
  customCategory: "",
  notes: "",
  visited: false,
  openingHours: null,
  osmId: null,
};

function Spinner() {
  return (
    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
  );
}

function extractShortName(displayName: string) {
  return displayName.split(",")[0]?.trim() || displayName;
}

function createDraftFromResult(result: SearchResult): DraftPlace {
  return {
    name: extractShortName(result.display_name),
    lat: result.lat,
    lng: result.lon,
    category: (result.category as Category) || "Other",
    customCategory: "",
    notes: "",
    visited: false,
    openingHours: null,
    osmId: result.osm_id ? String(result.osm_id) : null,
  };
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Could not read the image."));
    };

    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.readAsDataURL(file);
  });
}

export default function AddPlaceModal({
  isOpen,
  onClose,
  onPlaceAdded,
}: AddPlaceModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [ocrError, setOcrError] = useState("");
  const [isRunningOcr, setIsRunningOcr] = useState(false);
  const [draftPlace, setDraftPlace] = useState<DraftPlace | null>(null);
  const [manualForm, setManualForm] = useState<DraftPlace>(initialDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setActiveTab("search");
      setSearchQuery("");
      setSearchResults([]);
      setIsSearching(false);
      setSearchError("");
      setOcrText("");
      setOcrError("");
      setIsRunningOcr(false);
      setDraftPlace(null);
      setManualForm(initialDraft);
      setIsSaving(false);
      setSaveError("");
    }
  }, [isOpen]);

  const canSave = useMemo(() => {
    if (!draftPlace) {
      return false;
    }

    if (!draftPlace.name.trim() || !draftPlace.lat.trim() || !draftPlace.lng.trim()) {
      return false;
    }

    if (!draftPlace.category) {
      return false;
    }

    if (draftPlace.category === "Other" && !draftPlace.customCategory.trim()) {
      return false;
    }

    return true;
  }, [draftPlace]);

  async function handleSearch(queryOverride?: string) {
    const query = (queryOverride ?? searchQuery).trim();
    if (!query) {
      setSearchError("Type a place name to search.");
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setSearchError("");

    try {
      const result = await searchPlace(query);
      if (result) {
        setSearchResults([
          {
            display_name: result.displayName,
            lat: String(result.lat),
            lon: String(result.lng),
            category: result.category,
          },
        ]);
      } else {
        setSearchResults([]);
        setSearchError("No places found. Try a more specific name.");
      }
    } catch {
      setSearchError("Search failed. Please try again.");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  async function handleScreenshotUpload(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsRunningOcr(true);
    setOcrError("");
    setOcrText("");
    setSearchError("");
    setSearchResults([]);

    try {
      const base64Image = await readFileAsDataUrl(file);
      const result = await Tesseract.recognize(file, "eng");
      const rawText = result.data.text.replace(/\s+/g, " ").trim();

      if (rawText.length >= 10) {
        setOcrText(rawText);
        const query = rawText.slice(0, 120);
        setSearchQuery(query);
        await handleSearch(query);
        return;
      }

      try {
        const geminiText = await extractPlaceFromImage(base64Image);
        setOcrText(geminiText);
        const query = geminiText.slice(0, 120);
        setSearchQuery(query);
        await handleSearch(query);
      } catch (error) {
        if (error instanceof QuotaExceededError) {
          const retryAfter = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
          await supabase.from("ai_queue").insert({
            image_data: base64Image.split(",")[1] ?? base64Image,
            status: "pending",
            retry_after: retryAfter,
          });
          setOcrError(
            "We'll process this image in a few hours. You can also add the place manually.",
          );
          return;
        }

        setOcrError("Couldn't read the image clearly. Try typing the name instead.");
      }
    } catch {
      setOcrError("Couldn't read the image clearly. Try typing the name instead.");
    } finally {
      setIsRunningOcr(false);
      event.target.value = "";
    }
  }

  function handleManualContinue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !manualForm.name.trim() ||
      !manualForm.lat.trim() ||
      !manualForm.lng.trim() ||
      !manualForm.category
    ) {
      return;
    }

    setDraftPlace({
      ...manualForm,
      name: manualForm.name.trim(),
      lat: manualForm.lat.trim(),
      lng: manualForm.lng.trim(),
      notes: manualForm.notes.trim(),
      customCategory: manualForm.customCategory.trim(),
    });
  }

  async function handleSave() {
    if (!draftPlace || !canSave) {
      return;
    }

    setIsSaving(true);
    setSaveError("");

    try {
      const payload = {
        name: draftPlace.name.trim(),
        lat: Number(draftPlace.lat),
        lng: Number(draftPlace.lng),
        category: draftPlace.category,
        custom_category:
          draftPlace.category === "Other"
            ? draftPlace.customCategory.trim()
            : null,
        notes: draftPlace.notes.trim() || null,
        visited: draftPlace.visited,
        opening_hours: draftPlace.openingHours,
        osm_id: draftPlace.osmId,
      };

      const { data, error } = await supabase
        .from("places")
        .insert(payload)
        .select()
        .single();

      if (error) {
        throw error;
      }

      onPlaceAdded(data as Place);
      onClose();
    } catch {
      setSaveError("Could not save this place. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isOpen) {
    return null;
  }

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
        aria-label="Add a place"
      >
        <div className="mx-auto mt-3 h-1.5 w-14 rounded-full bg-slate-300" />

        <div className="flex items-center justify-between px-5 pb-3 pt-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
              Add Place
            </p>
            <h2 className="text-xl font-semibold text-slate-900">
              Save something for the map
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

        <div className="border-b border-slate-200 px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto">
            {tabs.map((tab) => {
              const isActive = tab.key === activeTab;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-600 ring-1 ring-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="max-h-[calc(92vh-10.5rem)] overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          {activeTab === "search" ? (
            <section className="space-y-4">
              <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Search by place name
                </label>
                <div className="flex gap-2">
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Cafe Gitane, Tel Aviv..."
                    className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSearch()}
                    disabled={isSearching}
                    className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {isSearching ? "..." : "Search"}
                  </button>
                </div>
                {searchError ? (
                  <p className="mt-3 text-sm text-rose-600">{searchError}</p>
                ) : null}
              </div>

              {searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map((result) => (
                    <button
                      key={`${result.osm_id ?? result.display_name}-${result.lat}-${result.lon}`}
                      type="button"
                      onClick={() => setDraftPlace(createDraftFromResult(result))}
                      className="w-full rounded-3xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-300"
                    >
                      <p className="font-semibold text-slate-900">
                        {extractShortName(result.display_name)}
                      </p>
                      <p className="mt-1 text-sm leading-5 text-slate-600">
                        {result.display_name}
                      </p>
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {activeTab === "screenshot" ? (
            <section className="space-y-4">
              <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <label className="block text-sm font-medium text-slate-700">
                  Upload a screenshot
                </label>
                <p className="mt-1 text-sm leading-5 text-slate-500">
                  We&apos;ll scan the image for text and search OpenStreetMap automatically.
                </p>
                <label className="mt-4 flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm font-medium text-slate-600">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => void handleScreenshotUpload(event)}
                  />
                  Choose image
                </label>

                {isRunningOcr ? (
                  <div className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    <Spinner />
                    Reading image and finding the place...
                  </div>
                ) : null}

                {ocrText ? (
                  <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Extracted text
                    </p>
                    <p className="mt-2 text-sm leading-5 text-slate-700">
                      {ocrText}
                    </p>
                  </div>
                ) : null}

                {ocrError ? (
                  <p className="mt-4 text-sm text-rose-600">{ocrError}</p>
                ) : null}
              </div>

              {searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map((result) => (
                    <button
                      key={`${result.osm_id ?? result.display_name}-${result.lat}-${result.lon}`}
                      type="button"
                      onClick={() => setDraftPlace(createDraftFromResult(result))}
                      className="w-full rounded-3xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-300"
                    >
                      <p className="font-semibold text-slate-900">
                        {extractShortName(result.display_name)}
                      </p>
                      <p className="mt-1 text-sm leading-5 text-slate-600">
                        {result.display_name}
                      </p>
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {activeTab === "manual" ? (
            <form className="space-y-4" onSubmit={handleManualContinue}>
              <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="grid gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Name
                    </label>
                    <input
                      required
                      value={manualForm.name}
                      onChange={(event) =>
                        setManualForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Latitude
                      </label>
                      <input
                        required
                        value={manualForm.lat}
                        onChange={(event) =>
                          setManualForm((current) => ({
                            ...current,
                            lat: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Longitude
                      </label>
                      <input
                        required
                        value={manualForm.lng}
                        onChange={(event) =>
                          setManualForm((current) => ({
                            ...current,
                            lng: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Category
                    </label>
                    <select
                      required
                      value={manualForm.category}
                      onChange={(event) =>
                        setManualForm((current) => ({
                          ...current,
                          category: event.target.value,
                        }))
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

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Notes
                    </label>
                    <textarea
                      value={manualForm.notes}
                      onChange={(event) =>
                        setManualForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                      rows={4}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                    />
                  </div>

                  <label className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span className="text-sm font-medium text-slate-700">
                      Visited
                    </span>
                    <input
                      type="checkbox"
                      checked={manualForm.visited}
                      onChange={(event) =>
                        setManualForm((current) => ({
                          ...current,
                          visited: event.target.checked,
                        }))
                      }
                      className="h-5 w-5 rounded border-slate-300"
                    />
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
              >
                Continue
              </button>
            </form>
          ) : null}

          {draftPlace ? (
            <section className="mt-5 rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-700">
                    Confirm Place
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">
                    {draftPlace.name}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setDraftPlace(null)}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"
                >
                  Reset
                </button>
              </div>

              <div className="mt-4 rounded-3xl bg-[linear-gradient(135deg,#dbeafe,#eff6ff_55%,#f8fafc)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Coordinates
                </p>
                <p className="mt-2 text-sm font-medium text-slate-800">
                  {draftPlace.lat}, {draftPlace.lng}
                </p>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Category
                  </label>
                  <select
                    value={draftPlace.category}
                    onChange={(event) =>
                      setDraftPlace((current) =>
                        current
                          ? { ...current, category: event.target.value }
                          : current,
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

                {draftPlace.category === "Other" ? (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Custom category
                    </label>
                    <input
                      value={draftPlace.customCategory}
                      onChange={(event) =>
                        setDraftPlace((current) =>
                          current
                            ? { ...current, customCategory: event.target.value }
                            : current,
                        )
                      }
                      placeholder="Type your own category"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                    />
                  </div>
                ) : null}

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Notes
                  </label>
                  <textarea
                    value={draftPlace.notes}
                    onChange={(event) =>
                      setDraftPlace((current) =>
                        current ? { ...current, notes: event.target.value } : current,
                      )
                    }
                    rows={4}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </div>

                <label className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="text-sm font-medium text-slate-700">
                    Visited
                  </span>
                  <input
                    type="checkbox"
                    checked={draftPlace.visited}
                    onChange={(event) =>
                      setDraftPlace((current) =>
                        current
                          ? { ...current, visited: event.target.checked }
                          : current,
                      )
                    }
                    className="h-5 w-5 rounded border-slate-300"
                  />
                </label>

                {saveError ? (
                  <p className="text-sm text-rose-600">{saveError}</p>
                ) : null}

                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={!canSave || isSaving}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {isSaving ? <Spinner /> : null}
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
