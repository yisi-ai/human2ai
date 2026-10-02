import type { PngSplitOptions } from "../../src/domain/ui-sketch/png-split";

export const PNG_SPLIT_SETTINGS_KEY = "human2ai.pngSplitOptions";

export function isValidPngSplitOptions(value: unknown): value is PngSplitOptions {
  if (!value || typeof value !== "object") return false;
  const { alphaThreshold, minSize, gap } = value as Partial<PngSplitOptions>;
  return typeof alphaThreshold === "number" && Number.isInteger(alphaThreshold) && alphaThreshold >= 0 && alphaThreshold <= 254
    && typeof minSize === "number" && Number.isSafeInteger(minSize) && minSize >= 0
    && typeof gap === "number" && Number.isFinite(gap) && gap >= 0;
}

export function readPngSplitOptions(fallback: PngSplitOptions): PngSplitOptions {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(PNG_SPLIT_SETTINGS_KEY) ?? "null");
    return isValidPngSplitOptions(saved) ? saved : fallback;
  } catch {
    return fallback;
  }
}

export function savePngSplitOptions(options: PngSplitOptions): void {
  try {
    localStorage.setItem(PNG_SPLIT_SETTINGS_KEY, JSON.stringify(options));
  } catch {
    // Keep the current dialog usable when browser storage is unavailable.
  }
}
