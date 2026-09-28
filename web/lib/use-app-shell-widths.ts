"use client";

import { useLayoutEffect, useState } from "react";

const DEFAULT_WIDTHS = { sidebarWidth: 280, rightPanelWidth: 300 };
type Panel = keyof typeof DEFAULT_WIDTHS;

function readWidth(panel: Panel): number {
  try {
    const width = Number(window.localStorage.getItem(`human2ai.appShell.${panel}`));
    if (Number.isFinite(width) && width > 0) return width;
  } catch { /* Browser storage may be unavailable. */ }
  return DEFAULT_WIDTHS[panel];
}

function saveWidth(panel: Panel, width: number): void {
  try {
    window.localStorage.setItem(`human2ai.appShell.${panel}`, String(width));
  } catch { /* Resizing still works when browser storage is unavailable. */ }
}

const saveSidebarWidth = (width: number) => saveWidth("sidebarWidth", width);
const saveRightPanelWidth = (width: number) => saveWidth("rightPanelWidth", width);

export function useAppShellWidths() {
  const [widths, setWidths] = useState(DEFAULT_WIDTHS);
  useLayoutEffect(() => {
    const restored = { sidebarWidth: readWidth("sidebarWidth"), rightPanelWidth: readWidth("rightPanelWidth") };
    setWidths(current => current.sidebarWidth === restored.sidebarWidth && current.rightPanelWidth === restored.rightPanelWidth
      ? current : restored);
  }, []);

  // AppShellFrame owns live widths. Its commit callbacks persist without rerendering slots.
  return { ...widths, onSidebarWidthChange: saveSidebarWidth, onRightPanelWidthChange: saveRightPanelWidth };
}
