const EMBED_URL = process.env.EMBED_URL || "http://127.0.0.1:8004";
const QDRANT_URL = process.env.QDRANT_URL || "http://127.0.0.1:6333";
const COLLECTION = "food_recipes";

/**
 * Get embedding vector for a text string via the embed server.
 */
export async function embedText(text: string): Promise<number[]> {
  const res = await fetch(`${EMBED_URL}/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    throw new Error(`Embed server error: ${res.status} ${await res.text()}`);
  }

  const { embedding } = await res.json();
  return embedding;
}

/**
 * Ensure the Qdrant collection exists, creating it if needed.
 */
async function ensureCollection(vectorSize: number): Promise<void> {
  const check = await fetch(`${QDRANT_URL}/collections/${COLLECTION}`);
  if (check.ok) return;

  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      vectors: {
        size: vectorSize,
        distance: "Cosine",
      },
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Failed to create Qdrant collection: ${res.status} ${await res.text()}`
    );
  }
}

/**
 * Upsert a recipe embedding into Qdrant.
 * The text should be a concatenation of recipe title, description, ingredients, tags, etc.
 */
export async function upsertRecipeEmbedding(
  recipeId: string,
  text: string
): Promise<void> {
  const embedding = await embedText(text);
  await ensureCollection(embedding.length);

  // Use a deterministic numeric ID from the string ID
  const numericId = hashStringToInt(recipeId);

  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      points: [
        {
          id: numericId,
          vector: embedding,
          payload: { recipeId, text: text.slice(0, 500) },
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Qdrant upsert error: ${res.status} ${await res.text()}`
    );
  }
}

/**
 * Search for similar recipes by text query.
 * Returns recipe IDs sorted by similarity (most similar first).
 */
export async function searchRecipes(
  query: string,
  limit: number = 10
): Promise<string[]> {
  const embedding = await embedText(query);

  const res = await fetch(
    `${QDRANT_URL}/collections/${COLLECTION}/points/search`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vector: embedding,
        limit,
        with_payload: true,
      }),
    }
  );

  if (!res.ok) {
    // Collection may not exist yet — return empty
    if (res.status === 404) return [];
    throw new Error(
      `Qdrant search error: ${res.status} ${await res.text()}`
    );
  }

  const data = await res.json();
  const results: { id: number; payload: { recipeId: string } }[] =
    data.result || [];

  return results.map((r) => r.payload.recipeId);
}

/**
 * Simple hash of a string to a positive integer for Qdrant point IDs.
 */
function hashStringToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & 0x7fffffff; // Keep positive 31-bit
  }
  return hash || 1; // Avoid 0
}
