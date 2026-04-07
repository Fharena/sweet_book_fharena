"use client";

import { useEffect } from "react";

const AUTO_DARK_CLASS = "auto-dark-force";

function detectAutoDarkTheme() {
  if (typeof document === "undefined") {
    return false;
  }

  const detection = document.createElement("div");
  detection.style.display = "none";
  detection.style.backgroundColor = "canvas";
  detection.style.colorScheme = "light";
  document.body.appendChild(detection);

  const backgroundColor = getComputedStyle(detection).backgroundColor;
  document.body.removeChild(detection);

  return backgroundColor !== "rgb(255, 255, 255)";
}

export function AutoDarkGuard() {
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    const syncThemeClass = () => {
      const isAutoDark = detectAutoDarkTheme();
      root.classList.toggle(AUTO_DARK_CLASS, isAutoDark);
      body.classList.toggle(AUTO_DARK_CLASS, isAutoDark);
    };

    syncThemeClass();
    window.addEventListener("pageshow", syncThemeClass);
    document.addEventListener("visibilitychange", syncThemeClass);

    return () => {
      window.removeEventListener("pageshow", syncThemeClass);
      document.removeEventListener("visibilitychange", syncThemeClass);
    };
  }, []);

  return null;
}
