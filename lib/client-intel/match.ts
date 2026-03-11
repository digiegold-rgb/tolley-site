interface ClientForMatch {
  estimatedMaxHome?: number | null;
  maxPrice?: number | null;
  minPrice?: number | null;
  preferredCities: string[];
  preferredZips: string[];
  minBeds?: number | null;
  maxBeds?: number | null;
  minBaths?: number | null;
  minSqft?: number | null;
  maxSqft?: number | null;
  preferredPropertyTypes: string[];
  interests: string[];
}

interface ListingForMatch {
  listPrice?: number | null;
  city?: string | null;
  zip?: string | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  propertyType?: string | null;
}

interface EnrichmentForMatch {
  nearestParkDist?: number | null;
  parksWithin2mi?: number | null;
  restaurantsWithin1mi?: number | null;
  nearestSchoolDist?: number | null;
  schoolsWithin3mi?: number | null;
  nearestSportsDist?: number | null;
  nearestMallDist?: number | null;
  nearestGroceryDist?: number | null;
}

interface MatchResult {
  score: number;
  factors: {
    budgetMatch: number;
    locationMatch: number;
    propertyMatch: number;
    lifestyleMatch: number;
  };
}

const INTEREST_POI_MAP: Record<string, (e: EnrichmentForMatch) => number> = {
  dog_parks: (e) => (e.nearestParkDist != null && e.nearestParkDist < 2 ? 5 : e.nearestParkDist != null && e.nearestParkDist < 5 ? 3 : 0),
  hiking: (e) => (e.parksWithin2mi != null && e.parksWithin2mi >= 3 ? 5 : e.parksWithin2mi != null && e.parksWithin2mi >= 1 ? 3 : 0),
  parks: (e) => (e.nearestParkDist != null && e.nearestParkDist < 1.5 ? 5 : e.nearestParkDist != null && e.nearestParkDist < 4 ? 3 : 0),
  restaurants: (e) => (e.restaurantsWithin1mi != null && e.restaurantsWithin1mi >= 10 ? 5 : e.restaurantsWithin1mi != null && e.restaurantsWithin1mi >= 3 ? 3 : 0),
  coffee_shops: (e) => (e.restaurantsWithin1mi != null && e.restaurantsWithin1mi >= 5 ? 5 : e.restaurantsWithin1mi != null && e.restaurantsWithin1mi >= 1 ? 3 : 0),
  schools: (e) => (e.nearestSchoolDist != null && e.nearestSchoolDist < 1.5 ? 5 : e.schoolsWithin3mi != null && e.schoolsWithin3mi >= 2 ? 3 : 0),
  gyms: (e) => (e.nearestSportsDist != null && e.nearestSportsDist < 3 ? 5 : e.nearestSportsDist != null && e.nearestSportsDist < 8 ? 3 : 0),
  sports: (e) => (e.nearestSportsDist != null && e.nearestSportsDist < 5 ? 5 : e.nearestSportsDist != null && e.nearestSportsDist < 10 ? 3 : 0),
  shopping: (e) => (e.nearestMallDist != null && e.nearestMallDist < 5 ? 5 : e.nearestMallDist != null && e.nearestMallDist < 10 ? 3 : 0),
  groceries: (e) => (e.nearestGroceryDist != null && e.nearestGroceryDist < 2 ? 5 : e.nearestGroceryDist != null && e.nearestGroceryDist < 5 ? 3 : 0),
};

export function calculateMatchScore(
  client: ClientForMatch,
  listing: ListingForMatch,
  enrichment?: EnrichmentForMatch | null
): MatchResult {
  const factors = { budgetMatch: 0, locationMatch: 0, propertyMatch: 0, lifestyleMatch: 0 };

  // Budget match (0-30)
  const clientMax = client.estimatedMaxHome || client.maxPrice;
  if (clientMax && listing.listPrice) {
    const ratio = listing.listPrice / clientMax;
    if (ratio <= 1.0) factors.budgetMatch = 30;
    else if (ratio <= 1.2) factors.budgetMatch = 20;
    else if (ratio <= 1.4) factors.budgetMatch = 10;
  } else if (client.minPrice && client.maxPrice && listing.listPrice) {
    if (listing.listPrice >= client.minPrice && listing.listPrice <= client.maxPrice) {
      factors.budgetMatch = 30;
    } else if (listing.listPrice <= client.maxPrice * 1.2) {
      factors.budgetMatch = 15;
    }
  }

  // Location match (0-25)
  if (listing.zip && client.preferredZips.length > 0) {
    if (client.preferredZips.includes(listing.zip)) {
      factors.locationMatch = 25;
    }
  }
  if (factors.locationMatch === 0 && listing.city && client.preferredCities.length > 0) {
    const cityLower = listing.city.toLowerCase();
    if (client.preferredCities.some((c) => c.toLowerCase() === cityLower)) {
      factors.locationMatch = 18;
    }
  }

  // Property match (0-25)
  let propPoints = 0;
  if (listing.beds != null) {
    if (client.minBeds && listing.beds >= client.minBeds) propPoints += 7;
    if (client.maxBeds && listing.beds <= client.maxBeds) propPoints += 3;
    else if (!client.maxBeds && client.minBeds && listing.beds >= client.minBeds) propPoints += 3;
  }
  if (listing.baths != null && client.minBaths && listing.baths >= client.minBaths) {
    propPoints += 5;
  }
  if (listing.sqft != null) {
    if (client.minSqft && listing.sqft >= client.minSqft) propPoints += 3;
    if (client.maxSqft && listing.sqft <= client.maxSqft) propPoints += 2;
  }
  if (listing.propertyType && client.preferredPropertyTypes.length > 0) {
    if (client.preferredPropertyTypes.some((t) => t.toLowerCase() === listing.propertyType!.toLowerCase())) {
      propPoints += 5;
    }
  }
  factors.propertyMatch = Math.min(propPoints, 25);

  // Lifestyle match (0-20)
  if (enrichment && client.interests.length > 0) {
    let lifestylePoints = 0;
    for (const interest of client.interests) {
      const key = interest.toLowerCase().replace(/\s+/g, "_");
      const scorer = INTEREST_POI_MAP[key];
      if (scorer) {
        lifestylePoints += scorer(enrichment);
      }
    }
    factors.lifestyleMatch = Math.min(lifestylePoints, 20);
  }

  const score = factors.budgetMatch + factors.locationMatch + factors.propertyMatch + factors.lifestyleMatch;

  return { score: Math.min(100, score), factors };
}
