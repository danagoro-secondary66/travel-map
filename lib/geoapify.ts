export type GeoapifyResult = {
  lat: number;
  lng: number;
  category: string;
  displayName: string;
};

export function mapGeoapifyCategory(category: any): string {
  let c = "";
  if (typeof category === "string") {
    c = category;
  } else if (Array.isArray(category)) {
    c = category.join(",");
  }
  c = c.toLowerCase();

  if (c.includes("restaurant") || c.includes("trattoria") || c.includes("osteria") || c.includes("ristorante")) {
    return "Restaurant";
  }
  if (c.includes("cafe") || c.includes("coffee") || c.includes("bakery") || c.includes("gelateria") || c.includes("ice_cream") || c.includes("pasticceria")) {
    return "Cafe";
  }
  if (c.includes("wine_bar") || c.includes("enoteca")) {
    return "Bar";
  }
  if (c.includes("bar") && !c.includes("wine_bar")) {
    return "Bar";
  }
  if (c.includes("winery") || c.includes("wine") || c.includes("vineyard") || c.includes("cantina")) {
    return "Winery";
  }
  if (c.includes("hotel") || c.includes("guest_house") || c.includes("hostel") || c.includes("lodging")) {
    return "Hotel";
  }
  if (c.includes("farm") || c.includes("agriturismo") || c.includes("agriturismi")) {
    return "Other";
  }
  if (c.includes("camp")) {
    return "Camping";
  }
  if (c.includes("castle") || c.includes("fort") || c.includes("palazzo") || c.includes("villa")) {
    return "Historical Site";
  }
  if (c.includes("waterfall")) {
    return "Waterfall";
  }
  if (c.includes("beach")) {
    return "Beach";
  }
  if (c.includes("museum")) {
    return "Museum";
  }
  if (c.includes("gallery") || c.includes("art")) {
    return "Art Gallery";
  }
  if (c.includes("park") || c.includes("garden") || c.includes("nature")) {
    return "Park/Garden";
  }
  if (c.includes("viewpoint") || c.includes("lookout")) {
    return "Viewpoint/Lookout";
  }
  if (c.includes("trail") || c.includes("hiking") || c.includes("path")) {
    return "Hiking Trail";
  }
  if (c.includes("market") || c.includes("marketplace")) {
    return "Street Food/Market";
  }
  if (c.includes("cinema") || c.includes("theatre") || c.includes("entertainment")) {
    return "Activities";
  }
  if (c.includes("spa") || c.includes("wellness")) {
    return "Spa/Wellness";
  }

  return "Other";
}

export function fallbackCategoryByName(name: string, category: string): string {
  const n = (name || "").toLowerCase();
  const c = (category || "").toLowerCase();

  const hasWineContext = n.includes("wine") || n.includes("winery") || n.includes("cantina") || n.includes("vigne") || n.includes("vineyard") || n.includes("enoteca") || n.includes("viticoltori") || c.includes("wine") || c.includes("winery") || c.includes("cantina");
  if (n.includes("winer") || n.includes("wine") || n.includes("vinaio") || n.includes("cantina") || n.includes("chianti") || (n.includes("castello") && hasWineContext)) {
    return "Winery";
  }

  if (n.includes("gelateria") || n.includes("gelato") || n.includes("affogato")) {
    return "Cafe";
  }

  if (n.includes("trattoria") || n.includes("osteria") || n.includes("ristorante") || n.includes("buca") || n.includes("mangiar")) {
    return "Restaurant";
  }

  if (n.includes("caffè") || n.includes("caffe") || n.includes("cafe")) {
    return "Cafe";
  }

  if (n.includes("mercato") || n.includes("market")) {
    return "Street Food/Market";
  }

  if (n.includes("castle") || n.includes("castello")) {
    return "Historical Site";
  }

  if (n.includes("farmhouse") || n.includes("agriturismo") || n.includes("tenuta") || n.includes("fattoria")) {
    return "Other";
  }

  if (n.includes("bagni") || n.includes("terme") || n.includes("spa")) {
    return "Spa/Wellness";
  }

  if (n.includes("piazza") || n.includes("loggia")) {
    return "Historical Site";
  }

  if (n.includes("cascate") || n.includes("waterfall")) {
    return "Waterfall";
  }

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
          const displayName = result.formatted || result.name || name;
          let category = mapGeoapifyCategory(result.category);
          if (category === "Other") {
            category = fallbackCategoryByName(displayName, result.category || "");
          }

          return { lat, lng, category, displayName };
        }
      }
    } catch (error) {
      console.error("Geoapify search error:", error);
    }
  }

  // Fallback to Nominatim if key is empty or call yields no results
  const res = await searchNominatimFallback(name, countryHint);
  if (res && res.category === "Other") {
    res.category = fallbackCategoryByName(res.displayName, "");
  }
  return res;
}
