"use client";

import { useState, useEffect, useCallback } from "react";
import { WaterNav } from "@/components/water/water-nav";
import { WaterReadingForm } from "@/components/water/water-reading-form";
import { WaterReadingsTable } from "@/components/water/water-readings-table";
import { WaterChemistryChart } from "@/components/water/water-chemistry-chart";
import type { WaterReading } from "@/lib/water";

export default function ReadingsPage() {
  const [readings, setReadings] = useState<WaterReading[]>([]);

  const load = useCallback(() => {
    fetch("/api/water/readings?limit=100")
      .then((r) => r.json())
      .then((d) => setReadings(d.readings || []));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    // Simple delete via a custom inline fetch
    await fetch(`/api/water/readings?id=${id}`, { method: "DELETE" }).catch(() => {});
    load();
  }

  return (
    <>
      <WaterNav />
      <div className="space-y-6">
        <WaterReadingForm onSaved={load} />
        <WaterChemistryChart readings={readings} />
        <WaterReadingsTable readings={readings} onDelete={handleDelete} />
      </div>
    </>
  );
}
