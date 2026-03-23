"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function SectionWrapper({
  children,
  id,
  delay = "0s",
  className = "",
}: {
  children: React.ReactNode;
  id?: string;
  delay?: string;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Check reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.opacity = "1";
      return;
    }

    const delaySeconds = parseFloat(delay) || 0;

    gsap.fromTo(
      el,
      { opacity: 0, y: 28 },
      {
        opacity: 1,
        y: 0,
        duration: 0.7,
        delay: delaySeconds,
        ease: "power2.out",
        scrollTrigger: {
          trigger: el,
          start: "top 90%",
          once: true,
        },
      },
    );

    return () => {
      ScrollTrigger.getAll()
        .filter((t) => t.trigger === el)
        .forEach((t) => t.kill());
    };
  }, [delay]);

  return (
    <section
      ref={ref}
      id={id}
      className={`cl-section ${className}`}
      style={{ opacity: 0 }}
    >
      {children}
    </section>
  );
}
