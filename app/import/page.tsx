"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Collection } from "@/lib/types";

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

type Category = (typeof categories)[number];

interface ParsedPlace {
  name: string;
  checked: boolean;
  category: Category;
  customCategory: string;
  lat: number;
  lng: number;
  status: "pending" | "searching" | "found" | "not_found";
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function makeShareToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  }
  return Math.random().toString(36).substring(2, 14);
}

function autoAssignCategory(osmClass: string, osmType: string): Category {
  const c = osmClass.toLowerCase();
  const t = osmType.toLowerCase();

  if (c === "amenity") {
    if (t === "restaurant" || t === "fast_food" || t === "food_court") return "Restaurant";
    if (t === "cafe") return "Cafe";
    if (t === "bar" || t === "pub" || t === "biergarten") return "Bar";
    if (t === "winery") return "Winery";
    if (t === "brewery") return "Brewery";
    if (t === "street_food" || t === "marketplace" || t === "market") return "Street Food/Market";
    if (t === "spa" || t === "public_bath") return "Spa/Wellness";
  }
  if (c === "tourism") {
    if (t === "hotel" || t === "motel" || t === "guest_house" || t === "hostel") return "Hotel";
    if (t === "museum") return "Museum";
    if (t === "viewpoint") return "Viewpoint/Lookout";
    if (t === "camp_site" || t === "caravan_site") return "Camping";
    if (t === "gallery") return "Art Gallery";
    if (t === "attraction" || t === "theme_park") return "Tour/Experience";
  }
  if (c === "leisure") {
    if (t === "park" || t === "garden") return "Park/Garden";
    if (t === "escape_game") return "Escape Room";
  }
  if (c === "natural") {
    if (t === "beach" || t === "sand") return "Beach";
    if (t === "waterfall") return "Waterfall";
    if (t === "wood" || t === "forest") return "Forest";
  }
  if (c === "historic") {
    if (t === "archaeological_site") return "Archaeology";
    return "Historical Site";
  }
  if (c === "shop") {
    if (t === "boutique" || t === "clothes" || t === "fashion") return "Boutique";
    return "Market";
  }

  // Text fallbacks based on type or keywords
  if (t.includes("restaurant") || t.includes("food")) return "Restaurant";
  if (t.includes("cafe") || t.includes("coffee")) return "Cafe";
  if (t.includes("bar") || t.includes("pub") || t.includes("wine") || t.includes("beer")) return "Bar";
  if (t.includes("hotel") || t.includes("hostel") || t.includes("stay") || t.includes("lodging")) return "Hotel";
  if (t.includes("museum") || t.includes("gallery")) return "Museum";
  if (t.includes("park") || t.includes("garden")) return "Park/Garden";
  if (t.includes("beach")) return "Beach";
  if (t.includes("hike") || t.includes("trail") || t.includes("path")) return "Hiking Trail";

  return "Other";
}

async function searchOSMItaly(name: string) {
  try {
    const searchUrl = new URL("https://nominatim.openstreetmap.org/search");
    searchUrl.searchParams.set("q", `${name} Italy`);
    searchUrl.searchParams.set("format", "jsonv2");
    searchUrl.searchParams.set("limit", "1");

    const response = await fetch(searchUrl.toString(), {
      headers: {
        "User-Agent": "TravelMapItalyImporter/1.0",
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0) {
        return {
          class: data[0].class || "",
          type: data[0].type || "",
          lat: Number(data[0].lat),
          lng: Number(data[0].lon),
        };
      }
    }
  } catch (error) {
    console.error("OSM search error for:", name, error);
  }
  return null;
}

export default function ImportPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("none");
  const [newCollectionName, setNewCollectionName] = useState("");
  
  const [rawText, setRawText] = useState("");
  const [places, setPlaces] = useState<ParsedPlace[]>([]);
  
  const [isSearching, setIsSearching] = useState(false);
  const [searchIndex, setSearchIndex] = useState(0);
  
  const [isImporting, setIsImporting] = useState(false);
  const [importIndex, setImportIndex] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [importDone, setImportDone] = useState(false);
  
  const isCanceledRef = useRef(false);

  // Fetch collections on mount
  useEffect(() => {
    async function loadCollections() {
      const { data, error } = await supabase
        .from("collections")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && data) {
        setCollections(data as Collection[]);
      }
    }
    void loadCollections();
  }, []);

  const parseTextList = (text: string): string[] => {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
      
    const namesSet = new Set<string>();

    const hebrewCategoryWords = [
      "יקב",
      "מסעדה",
      "בר",
      "מלון",
      "חווה",
      "גלידה",
      "בית קפה",
      "טוסקני",
      "איטלקי",
      "בר יינות",
      "טירה",
      "מלון 4 כוכבים",
      "מלון 3 כוכבים",
      "חווה אורגנית",
    ];

    // Pure numbers, including inside parentheses and containing commas/dots
    const numberPattern = /^\(?[0-9,./-]+\)?$/;
    // Price patterns like "10–20 €" or "€€"
    const pricePattern = /[0-9]+.*[€$]|[€$].*[0-9]+|^[€$]+$/;

    for (const line of lines) {
      if (line === "הערה") continue;
      if (numberPattern.test(line)) continue;
      if (hebrewCategoryWords.includes(line)) continue;
      if (pricePattern.test(line)) continue;
      if (line.includes("Province of") || line.includes("איטליה")) continue;

      // Ensure it contains letters (Hebrew or English)
      const hasLetters = /[a-zA-Z\u0590-\u05FF]/.test(line);
      if (!hasLetters) continue;

      // Filter out rating lines like "4.8 (1,412)"
      if (/^[0-9.]+\s*\(?[0-9,]+\)?$/.test(line)) continue;

      namesSet.add(line);
    }

    return Array.from(namesSet);
  };

  const handleParse = () => {
    const parsedNames = parseTextList(rawText);
    const parsed: ParsedPlace[] = parsedNames.map((name) => ({
      name,
      checked: true,
      category: "Other",
      customCategory: "",
      lat: 41.9028, // Default fallback to Rome, Italy
      lng: 12.4964,
      status: "pending",
    }));
    setPlaces(parsed);
    setImportDone(false);
    setImportedCount(0);
    setImportIndex(0);
    setSearchIndex(0);
  };

  const handleFindOnMap = async () => {
    if (places.length === 0) return;
    setIsSearching(true);
    isCanceledRef.current = false;

    for (let i = 0; i < places.length; i++) {
      if (isCanceledRef.current) break;
      if (!places[i].checked) continue;

      setSearchIndex(i);
      setPlaces((prev) => {
        const next = [...prev];
        if (next[i]) next[i].status = "searching";
        return next;
      });

      const data = await searchOSMItaly(places[i].name);

      setPlaces((prev) => {
        const next = [...prev];
        if (next[i]) {
          if (data) {
            next[i].lat = data.lat;
            next[i].lng = data.lng;
            next[i].category = autoAssignCategory(data.class, data.type);
            next[i].status = "found";
          } else {
            next[i].status = "not_found";
          }
        }
        return next;
      });

      // Respect Nominatim rate limit of 1 req/sec
      await delay(1000);
    }

    setIsSearching(false);
  };

  const handleStopSearch = () => {
    isCanceledRef.current = true;
    setIsSearching(false);
    setPlaces((prev) =>
      prev.map((place) =>
        place.status === "searching" || place.status === "pending"
          ? { ...place, status: "not_found" }
          : place
      )
    );
  };

  const handleToggleCheck = (index: number) => {
    setPlaces((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index].checked = !next[index].checked;
      }
      return next;
    });
  };

  const handleCategoryChange = (index: number, newCategory: Category) => {
    setPlaces((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index].category = newCategory;
        if (newCategory !== "Other") {
          next[index].customCategory = "";
        }
      }
      return next;
    });
  };

  const handleCustomCategoryChange = (index: number, val: string) => {
    setPlaces((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index].customCategory = val;
      }
      return next;
    });
  };

  const handleNameChange = (index: number, name: string) => {
    setPlaces((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index].name = name;
      }
      return next;
    });
  };

  const handleRemovePlace = (index: number) => {
    setPlaces((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImportSelected = async () => {
    const checkedPlaces = places.filter((p) => p.checked);
    if (checkedPlaces.length === 0) return;

    setIsImporting(true);
    setImportIndex(0);

    let activeCollectionId = selectedCollectionId;

    // 1. Handle New Collection Creation
    if (selectedCollectionId === "new") {
      const name = newCollectionName.trim() || "Imported List 🇮🇹";
      const payload = {
        name,
        share_token: makeShareToken(),
      };

      const { data, error } = await supabase
        .from("collections")
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error("Failed to create collection:", error);
        alert("Failed to create collection, importing places without a collection mapping.");
        activeCollectionId = "none";
      } else if (data) {
        activeCollectionId = data.id;
      }
    }

    let successCount = 0;

    // 2. Insert Checked Places and link them
    for (let i = 0; i < checkedPlaces.length; i++) {
      setImportIndex(i);
      const place = checkedPlaces[i];

      try {
        const placePayload = {
          name: place.name.trim(),
          lat: place.lat,
          lng: place.lng,
          category: place.category,
          custom_category: place.category === "Other" ? place.customCategory.trim() : null,
          notes: null,
          visited: false,
          opening_hours: null,
          osm_id: null,
        };

        const { data: placeData, error: placeError } = await supabase
          .from("places")
          .insert(placePayload)
          .select()
          .single();

        if (placeError) {
          console.error("Place insert error:", placeError);
        } else if (placeData && activeCollectionId !== "none") {
          // Link place to collection
          const linkPayload = {
            place_id: placeData.id,
            collection_id: activeCollectionId,
          };
          const { error: linkError } = await supabase
            .from("place_collections")
            .insert(linkPayload);

          if (linkError) {
            console.error("Linking error:", linkError);
          } else {
            successCount++;
          }
        } else {
          successCount++;
        }
      } catch (err) {
        console.error("Import error for:", place.name, err);
      }

      setImportedCount(successCount);
      await delay(100);
    }

    setIsImporting(false);
    setImportDone(true);
  };

  return (
    <main className="flex min-h-screen flex-col bg-[#f5efdf] text-slate-900 pb-12">
      <header className="sticky top-0 z-[1000] border-b border-black/5 bg-[#f5efdf]/95 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
              Travel Map Importer
            </p>
            <h1 className="text-xl font-semibold tracking-tight">
              Import Google Maps Saved List
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-300"
          >
            ← Map
          </Link>
        </div>
      </header>

      <section className="mx-auto mt-6 w-full max-w-5xl px-4 space-y-6">
        {importDone ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600">
              ✓
            </div>
            <h2 className="mt-4 text-2xl font-bold text-slate-900">Import Completed</h2>
            <p className="mt-2 text-slate-600">
              ✓ {importedCount} places successfully imported into your Travel Map!
            </p>
            <div className="mt-6 flex justify-center gap-4">
              <Link
                href="/"
                className="rounded-full bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                Go to Map
              </Link>
              <button
                type="button"
                onClick={() => {
                  setPlaces([]);
                  setRawText("");
                  setImportDone(false);
                }}
                className="rounded-full bg-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-300"
              >
                Import New List
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Input Options & Text Area */}
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-4">
              <h3 className="font-semibold text-slate-900">1. Setup Collection & Paste List</h3>
              
              {/* Collection Selector */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Add to Collection
                  </label>
                  <select
                    value={selectedCollectionId}
                    onChange={(e) => setSelectedCollectionId(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                  >
                    <option value="none">No Collection (Standard Map Only)</option>
                    <option value="new">Create a new collection...</option>
                    {collections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCollectionId === "new" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      New Collection Name
                    </label>
                    <input
                      type="text"
                      required
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                      placeholder="e.g. Italy 🇮🇹"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                    />
                  </div>
                )}
              </div>

              {/* Paste Input Area */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Paste raw Google Maps list text
                </label>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Paste saved list lines here..."
                  rows={8}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400 font-sans"
                />
              </div>

              <button
                type="button"
                onClick={handleParse}
                disabled={!rawText.trim()}
                className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                Parse Places
              </button>
            </div>

            {/* Places Preview and Nominatim Geocoding */}
            {places.length > 0 && (
              <div className="space-y-4">
                {/* Geocoding Controls */}
                <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {places.filter((p) => p.checked).length} of {places.length} places selected
                      </h3>
                      {isSearching && (
                        <p className="text-sm text-amber-700 mt-1 animate-pulse">
                          Searching on OpenStreetMap: {searchIndex + 1} / {places.length} completed...
                        </p>
                      )}
                      {isImporting && (
                        <p className="text-sm text-blue-700 mt-1">
                          Importing {importIndex + 1} / {places.filter((p) => p.checked).length} into database...
                        </p>
                      )}
                      {!isSearching && !isImporting && (
                        <p className="text-sm text-slate-500 mt-1">
                          Geocode list before importing to acquire precise map coordinates.
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {isSearching ? (
                        <button
                          type="button"
                          onClick={handleStopSearch}
                          className="rounded-full bg-amber-100 px-5 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-200"
                        >
                          Stop Search
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleFindOnMap}
                          className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                          Find on map
                        </button>
                      )}

                      {!isSearching && !isImporting && (
                        <button
                          type="button"
                          onClick={handleImportSelected}
                          className="rounded-full bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-blue-500"
                        >
                          Import selected
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress Bars */}
                  {(isSearching || isImporting) && (
                    <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full transition-all duration-300 ${isSearching ? "bg-amber-600" : "bg-blue-600"}`}
                        style={{
                          width: `${
                            isSearching
                              ? ((searchIndex + 1) / places.length) * 100
                              : ((importIndex + 1) / places.filter((p) => p.checked).length) * 100
                          }%`,
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Preview Table */}
                <div className="overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
                  <table className="w-full min-w-max border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        <th className="px-6 py-4 w-12">Import</th>
                        <th className="px-6 py-4 w-16 text-center">Status</th>
                        <th className="px-6 py-4">Place Name</th>
                        <th className="px-6 py-4">Category</th>
                        <th className="px-6 py-4">Location (Lat, Lng)</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {places.map((place, index) => (
                        <tr key={index} className={`hover:bg-slate-50/50 ${!place.checked ? "opacity-50" : ""}`}>
                          <td className="px-6 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={place.checked}
                              onChange={() => handleToggleCheck(index)}
                              className="h-5 w-5 rounded border-slate-300 accent-blue-600"
                            />
                          </td>
                          <td className="px-6 py-4 text-center text-lg">
                            {place.status === "pending" && <span className="text-slate-400">⏳</span>}
                            {place.status === "searching" && (
                              <span className="inline-block animate-pulse text-amber-500">🔍</span>
                            )}
                            {place.status === "found" && <span className="text-emerald-500 font-bold">✓</span>}
                            {place.status === "not_found" && <span className="text-rose-500 font-bold">✗</span>}
                          </td>
                          <td className="px-6 py-4 max-w-xs">
                            <input
                              type="text"
                              value={place.name}
                              onChange={(e) => handleNameChange(index, e.target.value)}
                              className="w-full font-medium text-slate-900 border-b border-transparent bg-transparent outline-none focus:border-slate-400 py-1"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1.5">
                              <select
                                value={place.category}
                                onChange={(e) => handleCategoryChange(index, e.target.value as Category)}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-slate-400"
                              >
                                {categories.map((cat) => (
                                  <option key={cat} value={cat}>
                                    {cat}
                                  </option>
                                ))}
                              </select>
                              {place.category === "Other" && (
                                <input
                                  type="text"
                                  placeholder="Custom Category"
                                  value={place.customCategory}
                                  onChange={(e) => handleCustomCategoryChange(index, e.target.value)}
                                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-slate-400"
                                />
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                            {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemovePlace(index)}
                              className="text-xs font-semibold text-rose-600 hover:text-rose-800 transition"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
