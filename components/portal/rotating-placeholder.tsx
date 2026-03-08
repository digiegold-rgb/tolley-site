"use client";

import { useEffect, useState } from "react";

const ROTATE_MS = 4200;

type RotatingPlaceholderProps = {
  prompts: readonly string[];
  hidden?: boolean;
};

export function RotatingPlaceholder({
  prompts,
  hidden = false,
}: RotatingPlaceholderProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (prompts.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((currentIndex) => (currentIndex + 1) % prompts.length);
    }, ROTATE_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [prompts.length]);

  if (hidden || prompts.length === 0) {
    return null;
  }

  return (
    <span key={activeIndex} className="placeholder-cycle block truncate">
      {prompts[activeIndex]}
    </span>
  );
}
