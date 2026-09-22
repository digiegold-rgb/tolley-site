"use client";

import { useEffect } from "react";

import "./call.css";

export function WdCallShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const parent = document.querySelector(".wd-page");
    parent?.classList.add("wd-call-active");
    return () => parent?.classList.remove("wd-call-active");
  }, []);

  return <div className="wd-call">{children}</div>;
}
