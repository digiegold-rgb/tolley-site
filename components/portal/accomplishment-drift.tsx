"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ACCOMPLISHMENT_LINES } from "@/components/portal/accomplishment-lines";

type DriftSlot = {
  slotId: number;
  lineIndex: number;
  cycle: number;
  style: CSSProperties;
};

const ALL_LINE_INDEXES = ACCOMPLISHMENT_LINES.map((_, index) => index);
const LANE_POSITIONS = [6, 10, 14, 18, 22, 26, 30, 70, 74, 78, 82, 86, 90, 94];
const MIN_DURATION_SECONDS = 42;
const MAX_DURATION_SECONDS = 62;

const randomBetween = (min: number, max: number) =>
  min + Math.random() * (max - min);

function shuffle(values: number[]) {
  const mutable = [...values];
  for (let index = mutable.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [mutable[index], mutable[randomIndex]] = [mutable[randomIndex], mutable[index]];
  }
  return mutable;
}

function getSlotCount(viewportWidth: number, viewportHeight: number) {
  if (viewportWidth < 640 || viewportHeight < 700) {
    return 8;
  }

  if (viewportWidth < 880) {
    return 9;
  }

  if (viewportWidth < 1080) {
    return 10;
  }

  if (viewportWidth < 1280) {
    return 11;
  }

  if (viewportWidth < 1520) {
    return 12;
  }

  if (viewportWidth < 1760) {
    return 13;
  }

  return 14;
}

function laneForSlot(slotId: number, slotCount: number) {
  const laneSpread = LANE_POSITIONS.length - 1;
  const laneIndex = Math.round((slotId / Math.max(1, slotCount - 1)) * laneSpread);
  const baseLane = LANE_POSITIONS[Math.min(laneSpread, laneIndex)];
  const jitter = randomBetween(-1.3, 1.3);

  return Math.max(4, Math.min(96, baseLane + jitter));
}

function createSlot(
  slotId: number,
  lineIndex: number,
  slotCount: number,
  cycle: number,
): DriftSlot {
  const leftToRight = Math.random() >= 0.5;
  const flowStartX = leftToRight ? "-136vw" : "118vw";
  const flowEndX = leftToRight ? "112vw" : "-142vw";
  const flowMidX = "-12vw";
  const duration = randomBetween(MIN_DURATION_SECONDS, MAX_DURATION_SECONDS);
  const delay = cycle === 0 ? slotId * randomBetween(0.9, 1.7) : 0;
  const lineOpacity = randomBetween(0.1, 0.19);
  const lineScale = randomBetween(0.97, 1.05);
  const lineBlur = randomBetween(0.4, 1.1);
  const lineDriftY = randomBetween(-10, 10);
  const lineFontSize = randomBetween(1.38, 1.88);
  const top = laneForSlot(slotId, slotCount);

  return {
    slotId,
    lineIndex,
    cycle,
    style: {
      top: `${top.toFixed(2)}%`,
      ["--flow-opacity" as string]: lineOpacity.toFixed(3),
      ["--flow-scale" as string]: lineScale.toFixed(3),
      ["--flow-blur" as string]: `${lineBlur.toFixed(2)}px`,
      ["--flow-drift-y" as string]: `${lineDriftY.toFixed(2)}px`,
      ["--flow-font-size" as string]: `${lineFontSize.toFixed(2)}rem`,
      ["--flow-duration" as string]: `${duration.toFixed(2)}s`,
      ["--flow-start-x" as string]: flowStartX,
      ["--flow-mid-x" as string]: flowMidX,
      ["--flow-end-x" as string]: flowEndX,
      animationDelay: `${delay.toFixed(2)}s`,
    },
  };
}

export function AccomplishmentDrift() {
  const activeLineIndexesRef = useRef(new Set<number>());
  const availablePoolRef = useRef<number[]>([]);
  const recyclePoolRef = useRef<number[]>([]);

  const drawNextLineIndex = useCallback(() => {
    if (availablePoolRef.current.length === 0) {
      availablePoolRef.current = shuffle(recyclePoolRef.current);
      recyclePoolRef.current = [];
    }

    if (availablePoolRef.current.length === 0) {
      const fallbackPool = ALL_LINE_INDEXES.filter(
        (lineIndex) => !activeLineIndexesRef.current.has(lineIndex),
      );
      availablePoolRef.current = shuffle(fallbackPool);
    }

    const nextLineIndex = availablePoolRef.current.pop();
    if (nextLineIndex === undefined) {
      const fallback = ALL_LINE_INDEXES.find(
        (lineIndex) => !activeLineIndexesRef.current.has(lineIndex),
      );

      if (fallback === undefined) {
        return 0;
      }

      activeLineIndexesRef.current.add(fallback);
      return fallback;
    }

    activeLineIndexesRef.current.add(nextLineIndex);
    return nextLineIndex;
  }, []);

  const buildFreshSlots = useCallback(
    (nextSlotCount: number) => {
      availablePoolRef.current = shuffle(ALL_LINE_INDEXES);
      recyclePoolRef.current = [];
      activeLineIndexesRef.current.clear();

      return Array.from({ length: nextSlotCount }, (_, slotId) => {
        const lineIndex = drawNextLineIndex();
        return createSlot(slotId, lineIndex, nextSlotCount, 0);
      });
    },
    [drawNextLineIndex],
  );

  const [slots, setSlots] = useState<DriftSlot[]>([]);

  useEffect(() => {
    let resizeFrameId = 0;
    let initialSyncFrameId = 0;

    const syncSlotCountToViewport = () => {
      const nextSlotCount = getSlotCount(window.innerWidth, window.innerHeight);
      setSlots((currentSlots) =>
        currentSlots.length === nextSlotCount
          ? currentSlots
          : buildFreshSlots(nextSlotCount),
      );
    };

    const handleResize = () => {
      window.cancelAnimationFrame(resizeFrameId);
      resizeFrameId = window.requestAnimationFrame(syncSlotCountToViewport);
    };

    window.addEventListener("resize", handleResize);
    initialSyncFrameId = window.requestAnimationFrame(syncSlotCountToViewport);

    return () => {
      window.cancelAnimationFrame(initialSyncFrameId);
      window.cancelAnimationFrame(resizeFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, [buildFreshSlots]);

  const handleFlowComplete = useCallback(
    (slotId: number) => {
      setSlots((currentSlots) => {
        const completedSlot = currentSlots.find((slot) => slot.slotId === slotId);
        if (!completedSlot) {
          return currentSlots;
        }

        activeLineIndexesRef.current.delete(completedSlot.lineIndex);
        recyclePoolRef.current.push(completedSlot.lineIndex);

        const nextLineIndex = drawNextLineIndex();
        const updatedSlot = createSlot(
          completedSlot.slotId,
          nextLineIndex,
          currentSlots.length,
          completedSlot.cycle + 1,
        );

        return currentSlots.map((slot) =>
          slot.slotId === slotId ? updatedSlot : slot,
        );
      });
    },
    [drawNextLineIndex],
  );

  return (
    <div className="drift-layer absolute inset-0 z-10 overflow-hidden pointer-events-none select-none">
      {slots.map((slot) => (
        <p
          key={`${slot.slotId}-${slot.cycle}`}
          className="flow-line absolute"
          style={slot.style}
          onAnimationEnd={() => handleFlowComplete(slot.slotId)}
        >
          {ACCOMPLISHMENT_LINES[slot.lineIndex]}
        </p>
      ))}
    </div>
  );
}
