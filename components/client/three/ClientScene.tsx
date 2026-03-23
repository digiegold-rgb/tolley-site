"use client";

import { Component, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { useReducedMotion } from "./useReducedMotion";
import { useMobileDetect } from "./useMobileDetect";
import { SceneContent } from "./SceneContent";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function SceneInner() {
  const reduced = useReducedMotion();
  const tier = useMobileDetect();

  if (reduced || tier === "none") return null;

  return (
    <div className="cl-3d-canvas" aria-hidden="true">
      <Canvas
        dpr={tier === "full" ? [1, 1.5] : 1}
        gl={{ antialias: tier === "full", alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0, 6], fov: 50 }}
        style={{ pointerEvents: "none" }}
      >
        <SceneContent tier={tier} />
      </Canvas>
    </div>
  );
}

export default function ClientScene() {
  return (
    <ErrorBoundary>
      <SceneInner />
    </ErrorBoundary>
  );
}
