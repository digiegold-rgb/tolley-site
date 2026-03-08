import type { Prisma } from "@prisma/client";

type SavedResultInput = {
  query?: unknown;
  title?: unknown;
  contentJson?: unknown;
  contentText?: unknown;
};

export type SavedResultPayload = {
  query: string;
  title: string;
  contentJson: Prisma.InputJsonValue;
  contentText: string;
};

function normalizeString(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

export function parseSavedResultPayload(input: SavedResultInput) {
  const query = normalizeString(input.query, 500);
  const title = normalizeString(input.title, 160);
  const contentText = normalizeString(input.contentText, 25000);
  const contentJson =
    input.contentJson && typeof input.contentJson === "object"
      ? (input.contentJson as Prisma.InputJsonValue)
      : null;

  const errors: string[] = [];
  if (!query) {
    errors.push("Query is required.");
  }
  if (!title) {
    errors.push("Title is required.");
  }
  if (!contentJson) {
    errors.push("contentJson is required.");
  }
  if (!contentText) {
    errors.push("contentText is required.");
  }

  if (errors.length || !contentJson) {
    return {
      errors,
      payload: null,
    };
  }

  const payload: SavedResultPayload = {
    query,
    title,
    contentJson,
    contentText,
  };

  return {
    errors,
    payload,
  };
}
