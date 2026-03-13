"use client";

import { useEffect } from "react";
import "./admin.css";

export default function WdAdminLayout({ children }: { children: React.ReactNode }) {
  // Hide bubbles and footer from parent WD layout
  useEffect(() => {
    const parent = document.querySelector(".wd-page");
    if (parent) {
      parent.classList.add("wd-admin-active");
    }
    return () => {
      parent?.classList.remove("wd-admin-active");
    };
  }, []);

  return <div className="wd-admin">{children}</div>;
}
