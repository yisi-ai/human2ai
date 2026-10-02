import assert from 'node:assert/strict';
import sharp from 'sharp';
import { validatePngSplitRegions, visitPngSplitRegion, type PngSplitRegion } from './png-split-regions.ts';

// Automatic connectivity is ported from lishi/tools/lib/transparent-png.mjs.
// Explicit manual masks claim their pixels before that automatic pass.
export interface PngPiece {
    sourceRect: [number, number, number, number];
    pixelCount: number; strongPixelCount: number; width: number; height: number; png: Buffer;
    manual?: true;
}

export const SPLIT_ALGORITHM = 'alpha-threshold-soft-edges-8-connected-v2';
export const MANUAL_SPLIT_ALGORITHM = 'alpha-threshold-manual-regions-v3';
export const DEFAULT_ALPHA_THRESHOLD = 8;
export const SIZE_FILTER_ALGORITHM = 'both-dimensions-below-v1';
export const DEFAULT_MIN_SIZE = 16;

export function alphaThreshold(value: number = DEFAULT_ALPHA_THRESHOLD) {
    assert(Number.isInteger(value) && value >= 0 && value <= 254, 'Alpha threshold must be an integer from 0 to 254');
    return value;
}

export function minimumPieceSize(value: number = DEFAULT_MIN_SIZE) {
    assert(Number.isSafeInteger(value) && value >= 0, 'Minimum piece size must be a nonnegative safe integer');
    return value;
}

// Compare original PNG dimensions, independent of canvas scaling or cropping.
// Keep thin pieces whenever either dimension reaches the boundary.
export function partitionPngPieces<T extends { width: number; height: number; manual?: true }>(pieces: T[], minSize = DEFAULT_MIN_SIZE) {
    minimumPieceSize(minSize);
    const kept: T[] = [], discarded: T[] = [];
    for (const piece of pieces) {
        assert(Number.isSafeInteger(piece.width) && piece.width > 0 &&
            Number.isSafeInteger(piece.height) && piece.height > 0, 'Invalid PNG piece dimensions');
        (!piece.manual && piece.width < minSize && piece.height < minSize ? discarded : kept).push(piece);
    }
    return { kept, discarded };
}

// Threshold is used for connectivity only. Original nonzero-alpha pixels
// survive exactly once; soft edges are assigned to their nearest strong region.
async function analyzeTransparentPng(bytes: Buffer, options: { alphaThreshold?: number; regions?: PngSplitRegion[] }) {
    const threshold = alphaThreshold(options.alphaThreshold);
    validatePngSplitRegions(options.regions ?? []);
    const image = sharp(bytes, { limitInputPixels: 33_554_432 });
    const metadata = await image.metadata();
    assert.equal(metadata.format, 'png', 'Input must be a PNG');
    assert(metadata.hasAlpha, 'Input PNG must have an alpha channel');
    assert(!metadata.pages || metadata.pages === 1, 'Animated PNG is not supported');
    const { data, info } = await image.toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    assert.equal(channels, 4, 'PNG must decode to RGBA');
    const size = width * height, labels = new Uint32Array(size), queue = new Uint32Array(size);
    const regions: { label: number; strongPixelCount: number; left: number; top: number; right: number; bottom: number; pixelCount: number; firstPixel: number; manual?: true }[] = [];
    for (const polygon of options.regions ?? []) {
        const region = { label: regions.length + 1, strongPixelCount: 0, left: width, top: height, right: -1, bottom: -1, pixelCount: 0, firstPixel: size, manual: true as const };
        visitPngSplitRegion(polygon, width, height, pixel => {
            if (!labels[pixel] && data[pixel * 4 + 3] > 0) {
                labels[pixel] = region.label;
                region.pixelCount++;
                if (data[pixel * 4 + 3] > threshold) region.strongPixelCount++;
            }
        });
        if (region.pixelCount) regions.push(region);
    }
    let transparent = false;
    for (let seed = 0; seed < size; seed++) {
        if (data[seed * 4 + 3] === 0) { transparent = true; continue; }
        if (data[seed * 4 + 3] <= threshold) continue;
        if (labels[seed]) continue;
        const label = regions.length + 1;
        let head = 0, tail = 1, left = seed % width, right = left;
        let top = Math.floor(seed / width), bottom = top;
        queue[0] = seed;
        labels[seed] = label;
        while (head < tail) {
            const pixel = queue[head++], x = pixel % width, y = Math.floor(pixel / width);
            left = Math.min(left, x); right = Math.max(right, x);
            top = Math.min(top, y); bottom = Math.max(bottom, y);
            for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) {
                for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) {
                    const next = yy * width + xx;
                    if (!labels[next] && data[next * 4 + 3] > threshold) {
                        labels[next] = label;
                        queue[tail++] = next;
                    }
                }
            }
        }
        regions.push({ label, strongPixelCount: tail, left: width, top: height, right: -1, bottom: -1, pixelCount: 0, firstPixel: size });
    }
    assert(transparent, 'Input PNG must contain fully transparent pixels');
    // Multi-source BFS: a faint bridge cannot merge the strong regions, but its
    // original pixels are distributed to the nearest region without being erased.
    let head = 0, tail = 0;
    for (let pixel = 0; pixel < size; pixel++) if (labels[pixel] && !regions[labels[pixel] - 1].manual) queue[tail++] = pixel;
    while (head < tail) {
        const pixel = queue[head++], x = pixel % width, y = Math.floor(pixel / width);
        for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) {
            for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) {
                const next = yy * width + xx;
                if (!labels[next] && data[next * 4 + 3] > 0) {
                    labels[next] = labels[pixel];
                    queue[tail++] = next;
                }
            }
        }
    }
    // Entirely faint islands, disconnected from any strong region, also remain.
    for (let seed = 0; seed < size; seed++) {
        if (labels[seed] || data[seed * 4 + 3] === 0) continue;
        const label = regions.length + 1;
        regions.push({ label, strongPixelCount: 0, left: width, top: height, right: -1, bottom: -1, pixelCount: 0, firstPixel: size });
        head = 0; tail = 1; queue[0] = seed; labels[seed] = label;
        while (head < tail) {
            const pixel = queue[head++], x = pixel % width, y = Math.floor(pixel / width);
            for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) {
                for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) {
                    const next = yy * width + xx;
                    if (!labels[next] && data[next * 4 + 3] > 0) {
                        labels[next] = label; queue[tail++] = next;
                    }
                }
            }
        }
    }
    assert(regions.length, 'Input PNG has no non-transparent pixels');
    for (const region of regions) Object.assign(region, { left: width, top: height, right: -1, bottom: -1, pixelCount: 0, firstPixel: size });
    for (let pixel = 0; pixel < size; pixel++) {
        if (!labels[pixel]) continue;
        const region = regions[labels[pixel] - 1], x = pixel % width, y = Math.floor(pixel / width);
        region.left = Math.min(region.left, x); region.right = Math.max(region.right, x);
        region.top = Math.min(region.top, y); region.bottom = Math.max(region.bottom, y);
        region.firstPixel = Math.min(region.firstPixel, pixel); region.pixelCount++;
    }
    regions.sort((a, b) => a.firstPixel - b.firstPixel);
    return { width, height, threshold, data, labels, regions };
}

export async function previewTransparentPng(bytes: Buffer, options: { alphaThreshold?: number; regions?: PngSplitRegion[] } = {}) {
    const { width, height, regions } = await analyzeTransparentPng(bytes, options);
    return { width, height, pieces: regions.map(region => ({
        sourceRect: [region.left, region.top, region.right - region.left + 1, region.bottom - region.top + 1] as PngPiece["sourceRect"],
        pixelCount: region.pixelCount, strongPixelCount: region.strongPixelCount,
        width: region.right - region.left + 1, height: region.bottom - region.top + 1,
        ...(region.manual ? { manual: true as const } : {}),
    })) };
}

export async function splitTransparentPng(bytes: Buffer, options: { alphaThreshold?: number; regions?: PngSplitRegion[] } = {}) {
    const { width, height, threshold, data, labels, regions } = await analyzeTransparentPng(bytes, options);
    const pieces: PngPiece[] = [];
    for (const region of regions) {
        const sourceRect: PngPiece["sourceRect"] = [region.left, region.top, region.right - region.left + 1, region.bottom - region.top + 1];
        const [x, y, w, h] = sourceRect, rgba = Buffer.alloc(w * h * 4);
        // Mask by component identity, not just its rectangle: bounding boxes
        // can overlap, e.g. a ring and a separate dot inside the ring.
        for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
            const source = (y + yy) * width + x + xx;
            if (labels[source] === region.label) data.copy(rgba, (yy * w + xx) * 4, source * 4, source * 4 + 4);
        }
        const png = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
        pieces.push({ sourceRect, pixelCount: region.pixelCount, strongPixelCount: region.strongPixelCount,
            width: w, height: h, png, ...(region.manual ? { manual: true } : {}) });
    }
    return { width, height, algorithm: options.regions?.length ? MANUAL_SPLIT_ALGORITHM : SPLIT_ALGORITHM, alphaThreshold: threshold, pieces };
}
