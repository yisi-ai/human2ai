export type PngSplitPoint = [number, number];
export type PngSplitRegion = PngSplitPoint[];
export const MAX_PNG_SPLIT_REGIONS = 64;
export const MAX_PNG_SPLIT_POINTS = 256;

export function isValidPngSplitRegion(region: unknown): region is PngSplitRegion {
  if (!Array.isArray(region) || region.length < 3 || region.length > MAX_PNG_SPLIT_POINTS
    || !region.every(point => Array.isArray(point) && point.length === 2
      && point.every(value => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 1_000_000))) return false;
  const area = region.reduce((sum, [x, y], index) => {
    const next = region[(index + 1) % region.length];
    return sum + x * next[1] - y * next[0];
  }, 0);
  return Math.abs(area) > 1e-8;
}

export function validatePngSplitRegions(regions: PngSplitRegion[]): void {
  if (!Array.isArray(regions) || regions.length > MAX_PNG_SPLIT_REGIONS || !regions.every(isValidPngSplitRegion)) {
    throw new Error("Invalid PNG split regions.");
  }
}

// Scan pixel centres using the even-odd fill rule. Source clipping allows drawing
// outside the image without allocating an oversized mask or visiting off-image pixels.
export function visitPngSplitRegion(region: PngSplitRegion, width: number, height: number, visit: (pixel: number) => void): void {
  const firstRow = Math.max(0, Math.ceil(Math.min(...region.map(point => point[1])) - 0.5));
  const lastRow = Math.min(height, Math.ceil(Math.max(...region.map(point => point[1])) - 0.5));
  for (let y = firstRow; y < lastRow; y++) {
    const crossings: number[] = [], scanY = y + 0.5;
    for (let i = 0; i < region.length; i++) {
      const [ax, ay] = region[i], [bx, by] = region[(i + 1) % region.length];
      if ((ay > scanY) !== (by > scanY)) crossings.push(ax + (scanY - ay) * (bx - ax) / (by - ay));
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const start = Math.max(0, Math.ceil(crossings[i] - 0.5));
      const end = Math.min(width, Math.ceil(crossings[i + 1] - 0.5));
      for (let x = start; x < end; x++) visit(y * width + x);
    }
  }
}
