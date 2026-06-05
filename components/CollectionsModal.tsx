"use client";

import { useEffect, useMemo, useState } from "react";
import CollectionDetailModal from "@/components/CollectionDetailModal";
import { supabase } from "@/lib/supabase";
import type { Collection, Place, PlaceCollection } from "@/lib/types";

type CollectionsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  places: Place[];
  onPlaceSelect: (place: Place) => void;
};

type CollectionWithCount = Collection & {
  placeCount: number;
};

function Spinner() {
  return (
    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
  );
}

function makeShareToken() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

export default function CollectionsModal({
  isOpen,
  onClose,
  places,
  onPlaceSelect,
}: CollectionsModalProps) {
  const [collections, setCollections] = useState<CollectionWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [selectedCollection, setSelectedCollection] = useState<CollectionWithCount | null>(
    null,
  );
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copyFeedbackId, setCopyFeedbackId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedCollection(null);
      setDeleteConfirmId(null);
      setCopyFeedbackId(null);
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
      return;
    }

    async function loadCollections() {
      setIsLoading(true);
      setError("");

      const [{ data: collectionsData, error: collectionsError }, { data: linksData, error: linksError }] =
        await Promise.all([
          supabase.from("collections").select("*").order("created_at", { ascending: false }),
          supabase.from("place_collections").select("collection_id"),
        ]);

      if (collectionsError || linksError) {
        setError("Could not load collections.");
        setCollections([]);
        setIsLoading(false);
        return;
      }

      const countMap = new Map<string, number>();

      ((linksData ?? []) as Array<Pick<PlaceCollection, "collection_id">>).forEach((link) => {
        countMap.set(link.collection_id, (countMap.get(link.collection_id) ?? 0) + 1);
      });

      const nextCollections = ((collectionsData ?? []) as Collection[]).map((collection) => ({
        ...collection,
        placeCount: countMap.get(collection.id) ?? 0,
      }));

      setCollections(nextCollections);
      setIsLoading(false);
    }

    void loadCollections();
  }, [isOpen]);

  const hasCollections = useMemo(() => collections.length > 0, [collections.length]);

  async function handleCreateCollection() {
    const name = newCollectionName.trim();

    if (!name) {
      return;
    }

    setIsCreating(true);
    setError("");

    const payload = {
      name,
      share_token: makeShareToken(),
    };

    const { data, error: insertError } = await supabase
      .from("collections")
      .insert(payload)
      .select()
      .single();

    if (insertError) {
      setError("Could not create this collection.");
      setIsCreating(false);
      return;
    }

    setCollections((currentCollections) => [
      { ...(data as Collection), placeCount: 0 },
      ...currentCollections,
    ]);
    setNewCollectionName("");
    setIsCreating(false);
  }

  async function handleDeleteCollection(collectionId: string) {
    setDeletingId(collectionId);
    setError("");

    const { error: linksError } = await supabase
      .from("place_collections")
      .delete()
      .eq("collection_id", collectionId);

    if (linksError) {
      setError("Could not delete this collection.");
      setDeletingId(null);
      return;
    }

    const { error: deleteError } = await supabase
      .from("collections")
      .delete()
      .eq("id", collectionId);

    if (deleteError) {
      setError("Could not delete this collection.");
      setDeletingId(null);
      return;
    }

    setCollections((currentCollections) =>
      currentCollections.filter((collection) => collection.id !== collectionId),
    );
    setSelectedCollection((currentCollection) =>
      currentCollection?.id === collectionId ? null : currentCollection,
    );
    setDeleteConfirmId(null);
    setDeletingId(null);
  }

  async function handleShare(collection: CollectionWithCount) {
    const shareUrl = `${window.location.origin}/collection/${collection.share_token}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyFeedbackId(collection.id);
      window.setTimeout(() => {
        setCopyFeedbackId((currentId) =>
          currentId === collection.id ? null : currentId,
        );
      }, 1500);
    } catch {
      setError("Could not copy share link.");
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[1200] bg-[#f5efdf] text-slate-900">
      <div className="flex h-full flex-col">
        <div className="border-b border-black/5 bg-[#f5efdf]/95 px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
                Collections
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">
                Group saved places
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg text-slate-700 ring-1 ring-slate-200"
              aria-label="Close collections"
            >
              ×
            </button>
          </div>

          <div className="mt-4 rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">New Collection</p>
              {!isCreating ? (
                <button
                  type="button"
                  onClick={() => setIsCreating(true)}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  New Collection
                </button>
              ) : null}
            </div>

            {isCreating ? (
              <div className="mt-3 flex gap-2">
                <input
                  value={newCollectionName}
                  onChange={(event) => setNewCollectionName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleCreateCollection();
                    }
                  }}
                  placeholder="Weekend wine trip"
                  className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => void handleCreateCollection()}
                  className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white"
                >
                  ✓
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
          {isLoading ? (
            <div className="flex items-center justify-center gap-3 rounded-[28px] bg-white px-4 py-10 text-sm font-medium text-slate-500 ring-1 ring-slate-200">
              <Spinner />
              Loading collections...
            </div>
          ) : hasCollections ? (
            <div className="space-y-3">
              {collections.map((collection) => (
                <div
                  key={collection.id}
                  className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedCollection(collection)}
                    className="w-full text-left"
                  >
                    <p className="text-base font-semibold text-slate-900">
                      {collection.name}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {collection.placeCount} {collection.placeCount === 1 ? "place" : "places"}
                    </p>
                  </button>

                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleShare(collection)}
                      className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
                    >
                      {copyFeedbackId === collection.id ? "Copied" : "Share"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(collection.id)}
                      className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-200"
                    >
                      Delete
                    </button>
                  </div>

                  {deleteConfirmId === collection.id ? (
                    <div className="mt-3 rounded-2xl bg-rose-50 px-4 py-4 ring-1 ring-rose-200">
                      <p className="text-sm font-semibold text-rose-700">
                        Delete this collection?
                      </p>
                      <div className="mt-3 flex gap-3">
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="flex-1 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteCollection(collection.id)}
                          disabled={deletingId === collection.id}
                          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {deletingId === collection.id ? <Spinner /> : null}
                          {deletingId === collection.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[28px] bg-white px-4 py-10 text-center text-sm font-medium text-slate-500 ring-1 ring-slate-200">
              No collections yet. Create your first one above.
            </div>
          )}

          {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
        </div>
      </div>

      {selectedCollection ? (
        <CollectionDetailModal
          collection={selectedCollection}
          isOpen={selectedCollection !== null}
          onClose={() => setSelectedCollection(null)}
          places={places}
          onPlaceSelect={(place) => {
            setSelectedCollection(null);
            onClose();
            onPlaceSelect(place);
          }}
          onCollectionUpdated={(updatedCollection) => {
            setCollections((currentCollections) =>
              currentCollections.map((collection) =>
                collection.id === updatedCollection.id
                  ? {
                      ...collection,
                      ...updatedCollection,
                    }
                  : collection,
              ),
            );
            setSelectedCollection((currentCollection) =>
              currentCollection
                ? { ...currentCollection, ...updatedCollection }
                : currentCollection,
            );
          }}
          onMembershipChanged={(collectionId, placeCount) => {
            setCollections((currentCollections) =>
              currentCollections.map((collection) =>
                collection.id === collectionId
                  ? { ...collection, placeCount }
                  : collection,
              ),
            );
            setSelectedCollection((currentCollection) =>
              currentCollection?.id === collectionId
                ? { ...currentCollection, placeCount }
                : currentCollection,
            );
          }}
        />
      ) : null}
    </div>
  );
}
