/**
 * Runtime reader for ~/business-os/persona-identity.json.
 * No identity traits are baked into source — missing fields hard-error.
 */

export interface PersonaLady {
  key: "lady1" | "lady2";
  name: string;
  description: string;
  attire?: string;
  role?: string;
}

export interface PersonaIdentity {
  description: string;
  facePath?: string;
  ladies: PersonaLady[];
}

function asRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function str(raw: unknown): string | undefined {
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

function ladyFrom(
  key: "lady1" | "lady2",
  fallbackName: string,
  bag: Record<string, unknown> | null,
  sharedDescription: string,
): PersonaLady {
  const description = str(bag?.description) || str(bag?.descriptor) || sharedDescription;
  if (!description) {
    throw new Error(
      `persona-identity.json has no description for ${fallbackName} (and no top-level description)`,
    );
  }
  return {
    key,
    name: str(bag?.name) || fallbackName,
    description,
    attire: str(bag?.attire) || str(bag?.wardrobe),
    role: str(bag?.role),
  };
}

/** Parse the DGX persona file. Traits come from the file, never from defaults. */
export function parsePersonaIdentity(raw: unknown): PersonaIdentity {
  const rec = asRecord(raw);
  if (!rec) throw new Error("persona-identity.json must be a JSON object");

  const description =
    str(rec.description) || str(rec.descriptor) || str(rec.identity) || "";

  const facePath =
    str(rec.face) ||
    str(rec.facePath) ||
    str(rec.image) ||
    str(rec.imagePath) ||
    str(rec.ref) ||
    str(rec.characterRef) ||
    str(rec.character_ref);

  const listed = Array.isArray(rec.ladies) ? rec.ladies : null;
  const lady1Bag = asRecord(rec.lady1) || asRecord(listed?.[0]);
  const lady2Bag = asRecord(rec.lady2) || asRecord(listed?.[1]);

  const ladies: PersonaLady[] = [
    ladyFrom("lady1", "Lady 1", lady1Bag, description),
    ladyFrom("lady2", "Lady 2", lady2Bag, description),
  ];

  return {
    description: description || ladies[0].description,
    facePath,
    ladies,
  };
}
