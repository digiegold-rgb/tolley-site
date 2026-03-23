/**
 * JSON-LD structured data component for SEO.
 * Content is always server-generated from static/trusted data — never from user input.
 */
"use client";

import { useEffect } from "react";

interface JsonLdProps {
  data: Record<string, unknown>;
  id?: string;
}

export function JsonLd({ data, id = "json-ld" }: JsonLdProps) {
  useEffect(() => {
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const script = document.createElement("script");
    script.id = id;
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
    return () => {
      document.getElementById(id)?.remove();
    };
  }, [data, id]);

  return null;
}
