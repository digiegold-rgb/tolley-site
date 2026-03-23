"use client";

import { FoodMealSlot } from "./food-meal-slot";

interface Slot {
  id: string;
  day: number;
  mealType: string;
  recipe?: { title: string; slug: string };
  customMeal?: string;
}

interface MealPlan {
  id: string;
  weekStart: string;
  slots: Slot[];
}

interface FoodMealCalendarProps {
  plan: MealPlan;
  onSlotClick: (day: number, mealType: string) => void;
  onSlotClear: (slotId: string) => void;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"];

export function FoodMealCalendar({ plan, onSlotClick, onSlotClear }: FoodMealCalendarProps) {
  const getSlot = (day: number, mealType: string): Slot | undefined => {
    return plan.slots.find(
      (s) => s.day === day && s.mealType.toLowerCase() === mealType.toLowerCase()
    );
  };

  return (
    <div className="food-enter">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)" }}>
          📅 Week of {new Date(plan.weekStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </h2>
      </div>

      <div className="food-calendar">
        {DAYS.map((day, dayIndex) => (
          <div key={day} className="food-day-col">
            <div className="food-day-header">{day}</div>
            {MEAL_TYPES.map((mealType) => {
              const slot = getSlot(dayIndex, mealType);
              return (
                <FoodMealSlot
                  key={`${dayIndex}-${mealType}`}
                  slot={slot}
                  mealType={mealType}
                  onClick={() => onSlotClick(dayIndex, mealType)}
                  onClear={slot ? () => onSlotClear(slot.id) : undefined}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
