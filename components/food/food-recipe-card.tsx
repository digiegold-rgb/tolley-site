"use client";

import Link from "next/link";
import { useState } from "react";

import { FoodAddToPlanModal } from "./food-add-to-plan-modal";

interface Recipe {
  id: string;
  title: string;
  slug: string;
  imageUrl?: string | null;
  cuisine?: string | null;
  mealType: string[];
  prepTime?: number | null;
  cookTime?: number | null;
  rating?: number | null;
  tags: string[];
  timesCooked: number;
}

const RECIPE_EMOJIS = [
  "🍝",
  "🌮",
  "🍲",
  "🥗",
  "🍕",
  "🍜",
  "🥘",
  "🍗",
  "🥧",
  "🍳",
];
function recipeEmoji(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return RECIPE_EMOJIS[h % RECIPE_EMOJIS.length];
}

const THUMB_GRADIENTS = [
  "linear-gradient(135deg, #fce4ec, #f3e5f5)",
  "linear-gradient(135deg, #fff3e0, #fce4ec)",
  "linear-gradient(135deg, #e8eaf6, #e0f2f1)",
  "linear-gradient(135deg, #f3e5f5, #e8eaf6)",
];

function tagColor(tag: string): string {
  const t = tag.toLowerCase();
  if (/dinner|italian|mexican|comfort|breakfast/.test(t)) return "food-tag-pink";
  if (/healthy|quick|vegan|veg/.test(t)) return "food-tag-mint";
  if (/dessert|budget|sweet/.test(t)) return "food-tag-peach";
  if (/lunch|snack/.test(t)) return "food-tag-lavender";
  return "food-tag-lavender";
}

export function FoodRecipeCard({ recipe }: { recipe: Recipe }) {
  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
  const [imageBroken, setImageBroken] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);

  const showImage = recipe.imageUrl && !imageBroken;
  const gradientIndex = recipe.id.charCodeAt(0) % THUMB_GRADIENTS.length;
  const emoji = recipeEmoji(recipe.title);

  // Up to 2 visible tags: mealType[0] + first tag, deduped
  const visibleTags: string[] = [];
  if (recipe.mealType[0]) visibleTags.push(recipe.mealType[0]);
  for (const t of recipe.tags) {
    if (visibleTags.length >= 2) break;
    if (!visibleTags.includes(t)) visibleTags.push(t);
  }

  return (
    <>
      <Link
        href={`/food/recipes/${recipe.slug}`}
        className="food-card no-underline flex items-center"
        style={{
          gap: 14,
          padding: 14,
          background: "white",
          border: "1px solid var(--food-border)",
          borderRadius: 18,
          position: "relative",
        }}
      >
        {/* 64x64 thumbnail */}
        <div
          aria-hidden="true"
          style={{
            width: 64,
            height: 64,
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            background: showImage ? undefined : THUMB_GRADIENTS[gradientIndex],
            overflow: "hidden",
            position: "relative",
            flexShrink: 0,
          }}
        >
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={recipe.imageUrl!}
              alt={recipe.title}
              onError={() => setImageBroken(true)}
              loading="lazy"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <span>{emoji}</span>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-fredoka), system-ui, sans-serif",
              fontWeight: 700,
              fontSize: 15,
              color: "var(--food-text)",
              marginBottom: 4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {recipe.title}
          </div>
          <div
            style={{
              fontFamily: "var(--font-sora), sans-serif",
              fontSize: 12,
              color: "var(--food-text-secondary)",
              marginBottom: visibleTags.length ? 6 : 0,
            }}
          >
            {totalTime > 0 ? `${totalTime} min` : "—"}
            {recipe.timesCooked > 0 ? ` · cooked ${recipe.timesCooked}x` : ""}
            {recipe.rating && recipe.rating > 0
              ? ` · ⭐ ${recipe.rating.toFixed(1)}`
              : ""}
          </div>
          {visibleTags.length > 0 && (
            <div className="flex flex-wrap" style={{ gap: 4 }}>
              {visibleTags.map((t) => (
                <span
                  key={t}
                  className={`food-tag ${tagColor(t)}`}
                  style={{ fontSize: 10, padding: "2px 8px" }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right chevron */}
        <span
          aria-hidden="true"
          style={{
            color: "var(--food-text-secondary)",
            fontSize: 18,
            flexShrink: 0,
            paddingLeft: 4,
          }}
        >
          ›
        </span>

        {/* Floating add-to-plan pill, top-right */}
        <button
          type="button"
          aria-label="Add to meal plan"
          title="Add to meal plan"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowPlanModal(true);
          }}
          style={{
            position: "absolute",
            top: 8,
            right: 36,
            width: 28,
            height: 28,
            borderRadius: 9999,
            border: "none",
            background: "rgba(255,255,255,0.92)",
            boxShadow: "0 2px 8px rgba(74, 32, 64, 0.12)",
            cursor: "pointer",
            fontSize: 14,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--food-pink)",
          }}
        >
          📅
        </button>
      </Link>

      {showPlanModal && (
        <FoodAddToPlanModal
          recipeId={recipe.id}
          recipeTitle={recipe.title}
          onClose={() => setShowPlanModal(false)}
        />
      )}
    </>
  );
}
