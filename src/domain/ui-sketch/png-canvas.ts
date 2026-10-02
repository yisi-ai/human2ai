import type { UiSketchBounds } from "./types.ts";

// Ported from lishi/tools/lib/png-canvas.mjs; native-size skyline packing is unchanged.
function assert(value: unknown, message: string): asserts value {
    if (!value) throw new Error(message);
}

export const PACKING_ALGORITHM = 'native-size-skyline-v1';
export const DEFAULT_GAP = 12;

function packAtWidth(items: { index: number; width: number; height: number }[], width: number, gap: number) {
    const skyline = [{ x: 0, y: 0, width }], positions: UiSketchBounds[] = [];
    for (const item of items) {
        const w = item.width + gap, h = item.height + gap;
        let best: { index: number; x: number; y: number; top: number } | undefined;
        for (let index = 0; index < skyline.length; index++) {
            const x = skyline[index].x;
            if (x + w > width) continue;
            let remaining = w, y = 0;
            for (let next = index; remaining > 0 && next < skyline.length; next++) {
                y = Math.max(y, skyline[next].y);
                remaining -= skyline[next].width;
            }
            if (remaining > 0) continue;
            if (!best || y + h < best.top || (y + h === best.top && x < best.x)) best = { index, x, y, top: y + h };
        }
        assert(best, 'PNG rectangle cannot fit the packing width');
        skyline.splice(best.index, 0, { x: best.x, y: best.top, width: w });
        for (let next = best.index + 1; next < skyline.length; next++) {
            const overlap = best.x + w - skyline[next].x;
            if (overlap <= 0) break;
            if (overlap < skyline[next].width) {
                skyline[next].x += overlap; skyline[next].width -= overlap;
                break;
            }
            skyline.splice(next--, 1);
        }
        for (let next = 1; next < skyline.length; next++) {
            if (skyline[next - 1].y === skyline[next].y) {
                skyline[next - 1].width += skyline[next].width;
                skyline.splice(next--, 1);
            }
        }
        positions[item.index] = { x: best.x, y: best.y, width: item.width, height: item.height };
    }
    const bounds = { width: Math.max(...positions.map(p => p.x + p.width)), height: Math.max(...positions.map(p => p.y + p.height)) };
    return { positions, bounds };
}

export function compactGeometry(pieces: { width: number; height: number }[], x: number, y: number, gap = DEFAULT_GAP) {
    assert(Number.isFinite(x) && Number.isFinite(y), 'Start coordinates must be finite numbers');
    assert(Number.isFinite(gap) && gap >= 0, 'Invalid image gap');
    if (!pieces.length) return { geometry: [], bounds: { x, y, width: 0, height: 0 }, gap };
    const items = pieces.map((piece, index) => {
        assert(Number.isFinite(piece.width) && piece.width > 0 && Number.isFinite(piece.height) && piece.height > 0, 'Invalid piece dimensions');
        return { index, width: piece.width, height: piece.height };
    }).sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height) || b.width * b.height - a.width * a.height || a.index - b.index);
    const area = items.reduce((sum, item) => sum + (item.width + gap) * (item.height + gap), 0);
    const minimum = Math.max(...items.map(item => item.width + gap));
    const widths = [...new Set([0.8, 1, 1.2, 1.5].map(factor => Math.max(minimum, Math.ceil(Math.sqrt(area) * factor))))];
    let best: { positions: UiSketchBounds[]; bounds: { width: number; height: number }; score: number } | undefined;
    for (const width of widths) {
        const candidate = packAtWidth(items, width, gap), { width: w, height: h } = candidate.bounds;
        const score = w * h + 0.25 * (w - h) ** 2;
        if (!best || score < best.score) best = { ...candidate, score };
    }
    assert(best, 'Missing PNG packing');
    return { geometry: best.positions.map(position => ({ ...position, x: x + position.x, y: y + position.y })),
        bounds: { x, y, ...best.bounds }, gap };
}

export function nearFrameStart(frame: UiSketchBounds) {
    assert(frame && [frame.x, frame.y, frame.width, frame.height].every(Number.isFinite), 'Missing interface frame');
    return { x: frame.x + frame.width + 24, y: frame.y };
}
