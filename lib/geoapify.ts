export type GeoapifyResult = {
  lat: number;
  lng: number;
  category: string;
  displayName: string;
};

export function mapGeoapifyCategory(category: string): string {
  const c = category || "";

  if (c === "catering.restaurant") return "Restaurant";
  if (c === "catering.cafe") return "Cafe";
  if (c === "catering.bar" || c === "catering.wine_bar") return "Bar";
  if (c === "catering.ice_cream") return "Other";
  if (c === "commercial.food_and_drink.wine") return "Winery";
  if (c === "accommodation.hotel") return "Hotel";
  if (c === "accommodation.farm") return "Other";
  if (c === "accommodation.camping") return "Camping";
  if (c === "tourism.attraction.castle") return "Historical Site";
  if (c === "tourism.attraction") return "Historical Site";
  if (c === "tourism.sights.castle") return "Historical Site";
  if (c === "tourism.sights.waterfall") return "Waterfall";
  if (c === "tourism.sights.beach") return "Beach";
  if (c === "tourism.sights") return "Historical Site";
  if (c === "natural.water.waterfall") return "Waterfall";
  if (c === "natural.beach") return "Beach";
  if (c === "natural.park") return "Park/Garden";
  if (c === "leisure.park") return "Park/Garden";
  if (c === "entertainment.museum") return "Museum";
  if (c === "entertainment.culture.gallery") return "Art Gallery";
  if (c === "sport.outdoor") return "Hiking Trail";

  return "Other";
}

function autoAssignOSMCategory(osmClass: string, osmType: string): string {
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

async function searchNominatimFallback(name: string, countryHint?: string): Promise<GeoapifyResult | null> {
  try {
    const query = countryHint ? `${name} ${countryHint}` : name;
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("addressdetails", "1");

    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "TravelMapFallback/1.0",
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0) {
        const item = data[0];
        const category = autoAssignOSMCategory(item.class || "", item.type || "");
        return {
          lat: Number(item.lat),
          lng: Number(item.lon),
          category,
          displayName: item.display_name,
        };
      }
    }
  } catch (error) {
    console.error("Nominatim fallback failed:", error);
  }
  return null;
}

export async function searchPlace(name: string, countryHint?: string): Promise<GeoapifyResult | null> {
  const apiKey = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;

  if (apiKey && apiKey.trim().length > 0) {
    try {
      const query = countryHint ? `${name} ${countryHint}` : name;
      const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(query)}&format=json&limit=1&apiKey=${apiKey}`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data && data.results && data.results.length > 0) {
          const result = data.results[0];
          const lat = Number(result.lat);
          const lng = Number(result.lon);
          const category = mapGeoapifyCategory(result.category);
          const displayName = result.formatted || result.name || name;

          return { lat, lng, category, displayName };
        }
      }
    } catch (error) {
      console.error("Geoapify search error:", error);
    }
  }

  // Fallback to Nominatim if key is empty or call yields no results
  return searchNominatimFallback(name, countryHint);
}
