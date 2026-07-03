/**
 * KC-metro neighborhood seed list. Used to bootstrap the NeighborhoodPage
 * table. Slugs are URL-safe; pages render at /real-estate-agent/[slug].
 *
 * Add new rows here, then run the admin generator (or re-run the cron) to
 * fill in PAA + KG content via SerpAPI.
 */

export interface SeedNeighborhood {
  slug: string;
  name: string;
  city: string;
  state: string;
  zip?: string;
  lat?: number;
  lng?: number;
}

export const NEIGHBORHOOD_SEEDS: SeedNeighborhood[] = [
  // Independence MO core
  { slug: "independence-mo", name: "Independence MO", city: "Independence", state: "MO", zip: "64055", lat: 39.0911, lng: -94.4155 },
  { slug: "independence-64052", name: "Independence MO 64052", city: "Independence", state: "MO", zip: "64052", lat: 39.0769, lng: -94.4147 },
  { slug: "independence-64055", name: "Independence MO 64055", city: "Independence", state: "MO", zip: "64055", lat: 39.0467, lng: -94.3661 },
  { slug: "blue-springs-mo", name: "Blue Springs MO", city: "Blue Springs", state: "MO", zip: "64015", lat: 39.0169, lng: -94.2816 },
  { slug: "lees-summit-mo", name: "Lee's Summit MO", city: "Lee's Summit", state: "MO", zip: "64063", lat: 38.9108, lng: -94.3822 },
  { slug: "raytown-mo", name: "Raytown MO", city: "Raytown", state: "MO", zip: "64133", lat: 39.0086, lng: -94.4633 },
  { slug: "grain-valley-mo", name: "Grain Valley MO", city: "Grain Valley", state: "MO", zip: "64029", lat: 39.0152, lng: -94.1958 },
  { slug: "oak-grove-mo", name: "Oak Grove MO", city: "Oak Grove", state: "MO", zip: "64075", lat: 39.0092, lng: -94.1366 },
  { slug: "buckner-mo", name: "Buckner MO", city: "Buckner", state: "MO", zip: "64016", lat: 39.1331, lng: -94.1996 },

  // KC MO
  { slug: "kansas-city-mo", name: "Kansas City MO", city: "Kansas City", state: "MO", zip: "64111", lat: 39.0997, lng: -94.5786 },
  { slug: "westport-kc", name: "Westport (KC MO)", city: "Kansas City", state: "MO", zip: "64111", lat: 39.0507, lng: -94.5905 },
  { slug: "brookside-kc", name: "Brookside (KC MO)", city: "Kansas City", state: "MO", zip: "64113", lat: 39.0144, lng: -94.5896 },
  { slug: "waldo-kc", name: "Waldo (KC MO)", city: "Kansas City", state: "MO", zip: "64114", lat: 38.9772, lng: -94.5905 },
  { slug: "northland-kc", name: "Northland (KC MO)", city: "Kansas City", state: "MO", zip: "64118", lat: 39.2333, lng: -94.5658 },
  { slug: "country-club-plaza", name: "Country Club Plaza (KC MO)", city: "Kansas City", state: "MO", zip: "64112", lat: 39.0411, lng: -94.5917 },

  // KC KS
  { slug: "kansas-city-ks", name: "Kansas City KS", city: "Kansas City", state: "KS", zip: "66101", lat: 39.1141, lng: -94.6275 },
  { slug: "olathe-ks", name: "Olathe KS", city: "Olathe", state: "KS", zip: "66062", lat: 38.8814, lng: -94.7375 },
  { slug: "overland-park-ks", name: "Overland Park KS", city: "Overland Park", state: "KS", zip: "66212", lat: 38.9822, lng: -94.6708 },
  { slug: "leawood-ks", name: "Leawood KS", city: "Leawood", state: "KS", zip: "66209", lat: 38.9269, lng: -94.6169 },
  { slug: "shawnee-ks", name: "Shawnee KS", city: "Shawnee", state: "KS", zip: "66203", lat: 39.0228, lng: -94.7152 },
  { slug: "lenexa-ks", name: "Lenexa KS", city: "Lenexa", state: "KS", zip: "66215", lat: 38.9536, lng: -94.7336 },
  { slug: "mission-ks", name: "Mission KS", city: "Mission", state: "KS", zip: "66202", lat: 39.0286, lng: -94.6552 },
  { slug: "merriam-ks", name: "Merriam KS", city: "Merriam", state: "KS", zip: "66202", lat: 39.0239, lng: -94.6936 },
  { slug: "prairie-village-ks", name: "Prairie Village KS", city: "Prairie Village", state: "KS", zip: "66208", lat: 38.9914, lng: -94.6336 },
];
