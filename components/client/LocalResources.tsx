"use client";

import { useState, useEffect } from "react";

interface POIStat {
  type: string;
  count: number;
}

interface POIItem {
  id: string;
  name: string | null;
  type: string;
  lat: number;
  lng: number;
  tags: Record<string, string> | null;
}

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  restaurant: { label: "Restaurants", icon: "🍽", color: "#E2C97E" },
  school: { label: "Schools", icon: "🏫", color: "#34D399" },
  park: { label: "Parks", icon: "🌳", color: "#4ADE80" },
  hospital: { label: "Hospitals", icon: "🏥", color: "#F87171" },
  grocery: { label: "Grocery", icon: "🛒", color: "#60A5FA" },
  library: { label: "Libraries", icon: "📚", color: "#A78BFA" },
  fire_station: { label: "Fire Stations", icon: "🚒", color: "#FB923C" },
  police: { label: "Police", icon: "👮", color: "#60A5FA" },
  sports: { label: "Sports", icon: "⚽", color: "#34D399" },
  courthouse: { label: "Courts", icon: "⚖", color: "#9A9A8E" },
  mall: { label: "Malls", icon: "🏬", color: "#F472B6" },
  airport: { label: "Airports", icon: "✈", color: "#38BDF8" },
};

export function LocalResources() {
  const [stats, setStats] = useState<POIStat[]>([]);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [pois, setPois] = useState<POIItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/client/pois?stats=true")
      .then((r) => r.json())
      .then((d) => setStats(d.stats || []))
      .catch(() => {});
  }, []);

  const loadPois = (type: string) => {
    if (selectedType === type) {
      setSelectedType(null);
      setPois([]);
      return;
    }
    setSelectedType(type);
    setLoading(true);
    fetch(`/api/client/pois?type=${type}&limit=30`)
      .then((r) => r.json())
      .then((d) => {
        setPois(d.pois || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const totalPois = stats.reduce((sum, s) => sum + s.count, 0);

  return (
    <div>
      <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--cl-text)", marginBottom: "0.5rem" }}>
        Local Resources & Services
      </h2>
      <p style={{ fontSize: "0.85rem", color: "var(--cl-text-muted)", marginBottom: "1.25rem" }}>
        {totalPois.toLocaleString()} points of interest mapped across the KC metro — schools, restaurants, parks, hospitals & more
      </p>

      {/* Type grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
        {stats.map((s) => {
          const config = TYPE_CONFIG[s.type] || { label: s.type, icon: "📍", color: "#9A9A8E" };
          const isActive = selectedType === s.type;
          return (
            <button
              key={s.type}
              onClick={() => loadPois(s.type)}
              style={{
                padding: "1rem",
                borderRadius: "12px",
                background: isActive ? "rgba(201, 168, 76, 0.12)" : "rgba(22, 22, 28, 0.6)",
                border: `1px solid ${isActive ? "rgba(201, 168, 76, 0.3)" : "rgba(255,255,255,0.05)"}`,
                cursor: "pointer",
                textAlign: "center",
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ fontSize: "1.5rem", marginBottom: "4px" }}>{config.icon}</div>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: isActive ? config.color : "var(--cl-text-muted)" }}>
                {config.label}
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--cl-text-light)", marginTop: "2px" }}>
                {s.count.toLocaleString()}
              </div>
            </button>
          );
        })}
      </div>

      {/* POI list */}
      {selectedType && (
        <div>
          {loading ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "var(--cl-text-muted)", fontSize: "0.85rem" }}>
              Loading {TYPE_CONFIG[selectedType]?.label || selectedType}…
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "0.75rem" }}>
              {pois.map((poi) => {
                const tags = poi.tags as Record<string, string> | null;
                const cuisine = tags?.cuisine;
                const phone = tags?.phone;
                const website = tags?.website;
                return (
                  <div
                    key={poi.id}
                    className="cl-card"
                    style={{ padding: "1rem" }}
                  >
                    <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--cl-text)", marginBottom: "4px" }}>
                      {poi.name || "Unnamed"}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", fontSize: "0.7rem" }}>
                      {cuisine && (
                        <span style={{ padding: "2px 6px", borderRadius: "4px", background: "rgba(201,168,76,0.1)", color: "var(--cl-gold-light)" }}>
                          {cuisine}
                        </span>
                      )}
                      {phone && (
                        <span style={{ color: "var(--cl-text-light)" }}>
                          {phone}
                        </span>
                      )}
                      {website && (
                        <a
                          href={website.startsWith("http") ? website : `https://${website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "var(--cl-gold)", textDecoration: "none" }}
                        >
                          Website →
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
