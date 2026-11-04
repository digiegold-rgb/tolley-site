// Representative city centers only. Never customer coordinates.
export const AREAS = [
  {
    "id": "kc-mo",
    "label": "Kansas City, MO",
    "lat": 39.1,
    "lng": -94.579
  },
  {
    "id": "kc-ks",
    "label": "Kansas City, KS",
    "lat": 39.116,
    "lng": -94.627
  },
  {
    "id": "independence",
    "label": "Independence, MO",
    "lat": 39.091,
    "lng": -94.416
  },
  {
    "id": "raytown",
    "label": "Raytown, MO",
    "lat": 39.009,
    "lng": -94.464
  },
  {
    "id": "gladstone",
    "label": "Gladstone, MO",
    "lat": 39.204,
    "lng": -94.555
  },
  {
    "id": "grandview",
    "label": "Grandview, MO",
    "lat": 38.886,
    "lng": -94.533
  },
  {
    "id": "belton",
    "label": "Belton, MO",
    "lat": 38.815,
    "lng": -94.535
  },
  {
    "id": "olathe",
    "label": "Olathe, KS",
    "lat": 38.881,
    "lng": -94.819
  },
  {
    "id": "prairie-village",
    "label": "Prairie Village, KS",
    "lat": 38.992,
    "lng": -94.634
  },
  {
    "id": "lawrence",
    "label": "Lawrence, KS",
    "lat": 38.972,
    "lng": -95.235
  },
  {
    "id": "warrensburg",
    "label": "Warrensburg, MO",
    "lat": 38.763,
    "lng": -93.736
  },
  {
    "id": "oak-grove",
    "label": "Oak Grove, MO",
    "lat": 39.005,
    "lng": -94.129
  },
  {
    "id": "henrietta",
    "label": "Henrietta, MO",
    "lat": 39.234,
    "lng": -93.935
  },
  {
    "id": "overland-park",
    "label": "Overland Park, KS",
    "lat": 38.982,
    "lng": -94.671
  },
  {
    "id": "lees-summit",
    "label": "Lee's Summit, MO",
    "lat": 38.911,
    "lng": -94.382
  },
  {
    "id": "blue-springs",
    "label": "Blue Springs, MO",
    "lat": 39.017,
    "lng": -94.282
  },
  {
    "id": "liberty",
    "label": "Liberty, MO",
    "lat": 39.246,
    "lng": -94.419
  }
] as const;
export type AreaId = (typeof AREAS)[number]["id"];
export function areaLabel(id: string | null) { return AREAS.find(a => a.id === id)?.label || "Area unconfirmed"; }
