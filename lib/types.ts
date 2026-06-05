export type Place = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  custom_category: string | null;
  notes: string | null;
  visited: boolean;
  opening_hours: string | null;
  osm_id: string | null;
  created_at: string;
};

export type Collection = {
  id: string;
  name: string;
  share_token: string;
  created_at: string;
};

export type PlaceCollection = {
  place_id: string;
  collection_id: string;
};

export type AIQueueItem = {
  id: string;
  image_data: string;
  status: string;
  retry_after: string | null;
  result: string | null;
  created_at: string;
};
