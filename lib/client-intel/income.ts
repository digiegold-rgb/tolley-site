interface IncomeEstimate {
  estimated: number;
  rangeLow: number;
  rangeHigh: number;
  source: string;
  confidence: "high" | "medium" | "low";
  details: {
    occupationMedian?: number;
    occupationSource?: string;
    zipMedian?: number;
    zipSource?: string;
  };
}

interface CareerOneStopWage {
  Pct10: number;
  Pct25: number;
  Median: number;
  Pct75: number;
  Pct90: number;
}

async function fetchCareerOneStopSalary(
  keyword: string,
  location: string
): Promise<CareerOneStopWage | null> {
  const userId = process.env.CAREERONESTOP_USER_ID;
  const apiKey = process.env.CAREERONESTOP_API_KEY;
  if (!userId || !apiKey) return null;

  try {
    const url = `https://api.careeronestop.org/v1/comparesalaries/${encodeURIComponent(userId)}/wage?keyword=${encodeURIComponent(keyword)}&location=${encodeURIComponent(location)}&sortColumns=Median&sortDirections=DESC`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const wages = data?.OccupationWages?.[0]?.Wages;
    if (!wages) return null;

    return {
      Pct10: Number(wages.NationalPctWage10) || 0,
      Pct25: Number(wages.NationalPctWage25) || 0,
      Median: Number(wages.NationalMedianWage) || 0,
      Pct75: Number(wages.NationalPctWage75) || 0,
      Pct90: Number(wages.NationalPctWage90) || 0,
    };
  } catch {
    return null;
  }
}

async function fetchCensusMedianIncome(zip: string): Promise<number | null> {
  try {
    const url = `https://api.census.gov/data/2023/acs/acs5?get=NAME,B19013_001E&for=zip+code+tabulation+area:${zip}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data || data.length < 2) return null;

    const income = Number(data[1][1]);
    return income > 0 ? income : null;
  } catch {
    return null;
  }
}

export async function estimateIncome(
  jobTitle: string,
  location: string,
  zip?: string | null
): Promise<IncomeEstimate> {
  const [occData, zipMedian] = await Promise.all([
    fetchCareerOneStopSalary(jobTitle, location),
    zip ? fetchCensusMedianIncome(zip) : Promise.resolve(null),
  ]);

  const details: IncomeEstimate["details"] = {};

  if (occData) {
    details.occupationMedian = occData.Median;
    details.occupationSource = "CareerOneStop (BLS)";
  }
  if (zipMedian) {
    details.zipMedian = zipMedian;
    details.zipSource = "Census ACS 5-Year";
  }

  // Blended formula: 70% occupation + 30% zip
  let estimated: number;
  let rangeLow: number;
  let rangeHigh: number;
  let confidence: "high" | "medium" | "low";
  let source: string;

  if (occData && zipMedian) {
    estimated = Math.round(occData.Median * 0.7 + zipMedian * 0.3);
    rangeLow = Math.round(occData.Pct25 * 0.7 + zipMedian * 0.3 * 0.85);
    rangeHigh = Math.round(occData.Pct75 * 0.7 + zipMedian * 0.3 * 1.15);
    confidence = "high";
    source = "careeronestop+census";
  } else if (occData) {
    estimated = occData.Median;
    rangeLow = occData.Pct25;
    rangeHigh = occData.Pct75;
    confidence = "medium";
    source = "careeronestop";
  } else if (zipMedian) {
    estimated = zipMedian;
    rangeLow = Math.round(zipMedian * 0.75);
    rangeHigh = Math.round(zipMedian * 1.25);
    confidence = "low";
    source = "census";
  } else {
    // National median fallback
    estimated = 65000;
    rangeLow = 45000;
    rangeHigh = 90000;
    confidence = "low";
    source = "national_median_fallback";
  }

  return { estimated, rangeLow, rangeHigh, source, confidence, details };
}
