// Algorithm regression cases ported from lishi/tests/tools/png-to-human2ai.test.mjs.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { splitTransparentPng, previewTransparentPng, alphaThreshold, partitionPngPieces, minimumPieceSize } from '../../src/domain/ui-sketch/transparent-png.ts';
import { compactGeometry } from '../../src/domain/ui-sketch/png-canvas.ts';
import type { PngSplitRegion } from '../../src/domain/ui-sketch/png-split-regions.ts';

async function png(width: number, height: number, paint: (pixel: (x: number, y: number, color?: number[]) => void) => void) {
    const rgba = Buffer.alloc(width * height * 4);
    const pixel = (x: number, y: number, color = [30, 70, 90, 255]) => rgba.set(color, (y * width + x) * 4);
    paint(pixel);
    return { rgba, bytes: await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer() };
}

test('minimum size uses strict AND boundaries and keeps thin pieces without altering them', () => {
    const pieces = [[15, 15], [15, 16], [16, 15], [1, 300], [300, 1], [16, 16]].map(([width, height]) => ({ width, height }));
    const filtered = partitionPngPieces(pieces);
    assert.deepEqual(filtered.discarded, [pieces[0]]);
    assert.deepEqual(filtered.kept, pieces.slice(1));
    assert(filtered.kept.every((piece, index) => piece === pieces[index + 1]));
    assert.deepEqual(partitionPngPieces(pieces, 0), { kept: pieces, discarded: [] });
    assert.equal(minimumPieceSize(), 16);
    for (const value of [-1, 16.5, NaN, Infinity, '16', Number.MAX_SAFE_INTEGER + 1]) {
        assert.throws(() => minimumPieceSize(value as number), /nonnegative safe integer/);
    }
    assert.throws(() => partitionPngPieces([{ width: 0, height: 16 }]), /Invalid PNG piece dimensions/);
});

test('all nonzero alpha pixels survive exactly once, including tiny and identical components', async () => {
    const source = await png(9, 7, pixel => {
        pixel(0, 0, [1, 2, 3, 1]); pixel(1, 1, [45, 65, 85, 127]); // Diagonal joins.
        pixel(7, 0); pixel(7, 4); // Identical dots must remain separate.
        pixel(0, 6, [11, 23, 37, 254]);
    });
    const split = await splitTransparentPng(source.bytes);
    assert.equal(split.pieces.length, 4);
    assert.deepEqual(split.pieces.map(p => p.pixelCount), [2, 1, 1, 1]);
    const reconstructed = Buffer.alloc(source.rgba.length);
    for (const piece of split.pieces) {
        const cut = await sharp(piece.png).raw().toBuffer();
        const [left, top, width, height] = piece.sourceRect;
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            const offset = (y * width + x) * 4;
            if (!cut[offset + 3]) continue;
            const target = ((top + y) * split.width + left + x) * 4;
            assert.equal(reconstructed[target + 3], 0, 'Pixel belongs to more than one piece');
            cut.copy(reconstructed, target, offset, offset + 4);
        }
    }
    assert.deepEqual(reconstructed, source.rgba);
});

test('overlapping bounding boxes do not contaminate each other', async () => {
    const source = await png(7, 7, pixel => {
        for (let i = 0; i < 7; i++) { pixel(i, 0); pixel(i, 6); pixel(0, i); pixel(6, i); }
        pixel(3, 3, [7, 11, 19, 70]);
    });
    const split = await splitTransparentPng(source.bytes);
    assert.equal(split.pieces.length, 2);
    assert.deepEqual(split.pieces[0].sourceRect, [0, 0, 7, 7]);
    const ring = await sharp(split.pieces[0].png).raw().toBuffer();
    assert.equal(ring[(3 * 7 + 3) * 4 + 3], 0);
    const dot = await sharp(split.pieces[1].png).raw().toBuffer();
    assert.deepEqual([...dot], [7, 11, 19, 70]);
});

test('alpha threshold separates faint bridges without erasing or duplicating original soft pixels', async () => {
    const source = await png(11, 7, pixel => {
        for (let y = 2; y <= 4; y++) { pixel(1, y); pixel(2, y); pixel(7, y); pixel(8, y); }
        for (let x = 3; x <= 6; x++) pixel(x, 3, [13, 17, 19, 8]);
        pixel(0, 3, [45, 65, 85, 1]); pixel(9, 3, [45, 65, 85, 7]);
        pixel(10, 0, [5, 6, 7, 3]); // A detached all-faint island must still survive.
    });
    const strict = await splitTransparentPng(source.bytes, { alphaThreshold: 0 });
    const split = await splitTransparentPng(source.bytes, { alphaThreshold: 8 });
    assert.equal(strict.pieces.length, 2);
    assert.equal(split.pieces.length, 3);
    assert.equal(split.alphaThreshold, 8);
    assert.equal(split.pieces.filter(piece => piece.strongPixelCount === 0).length, 1);
    const reconstructed = Buffer.alloc(source.rgba.length);
    for (const piece of split.pieces) {
        const raw = await sharp(piece.png).raw().toBuffer(), [left, top, width, height] = piece.sourceRect;
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            const offset = (y * width + x) * 4;
            if (!raw[offset + 3]) continue;
            const target = ((top + y) * 11 + left + x) * 4;
            assert.equal(reconstructed[target + 3], 0, 'Soft pixel was copied into several pieces');
            raw.copy(reconstructed, target, offset, offset + 4);
        }
    }
    assert.deepEqual(reconstructed, source.rgba);
    assert.deepEqual(split, await splitTransparentPng(source.bytes, { alphaThreshold: 8 }));
});

test('threshold preserves wholly faint images and rejects invalid parameters', async () => {
    const source = await png(5, 3, pixel => { pixel(0, 1, [5, 6, 7, 1]); pixel(4, 1, [8, 9, 10, 8]); });
    const split = await splitTransparentPng(source.bytes, { alphaThreshold: 8 });
    assert.equal(split.pieces.length, 2);
    assert(split.pieces.every(piece => piece.strongPixelCount === 0));
    for (const invalid of [-1, 255, 8.5, NaN, '8']) assert.throws(() => alphaThreshold(invalid as number), /integer from 0 to 254/);
    assert.equal(alphaThreshold(), 8);
});

test('preview bounds match actual masked slices, including overlapping boxes and faint bridges', async () => {
    const source = await png(12, 8, pixel => {
        for (let i = 0; i < 7; i++) { pixel(i, 0); pixel(i, 6); pixel(0, i); pixel(6, i); }
        pixel(3, 3); pixel(7, 3, [10, 20, 30, 5]); pixel(8, 3); pixel(11, 7, [1, 2, 3, 1]);
    });
    for (const threshold of [0, 8, 254]) {
        const preview = await previewTransparentPng(source.bytes, { alphaThreshold: threshold });
        const split = await splitTransparentPng(source.bytes, { alphaThreshold: threshold });
        assert.deepEqual(preview.pieces, split.pieces.map(({ png, ...piece }) => piece));
        assert.equal(preview.width, split.width);
        assert.equal(preview.height, split.height);
    }
});

test('nontransparent, empty, and non-PNG inputs fail instead of fabricating cuts', async () => {
    const opaque = await png(2, 2, pixel => { for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) pixel(x, y); });
    const empty = await png(2, 2, () => {});
    await assert.rejects(splitTransparentPng(opaque.bytes), /fully transparent pixels/);
    await assert.rejects(splitTransparentPng(empty.bytes), /no non-transparent/);
    const jpeg = await sharp(opaque.bytes).jpeg().toBuffer();
    await assert.rejects(splitTransparentPng(jpeg), /must be a PNG/);
});

test('manual polygons separate connected pixels, unite disconnected islands and bypass the size filter', async () => {
    const source = await png(12, 6, pixel => {
        for (let x = 1; x <= 9; x++) pixel(x, 2, [x, 20, 30, x === 5 ? 2 : 255]);
        pixel(2, 4); pixel(11, 5);
    });
    const regions: PngSplitRegion[] = [[[0, 0], [5, 0], [5, 6], [0, 6]]];
    const split = await splitTransparentPng(source.bytes, { regions });
    const manual = split.pieces.find(piece => piece.manual)!;
    assert.equal(manual.pixelCount, 5);
    assert.deepEqual(manual.sourceRect, [1, 2, 4, 3]);
    assert.equal(partitionPngPieces(split.pieces, 100).kept.length, 1);
    assert.equal(partitionPngPieces(split.pieces, 100).kept[0], manual);
    assert.equal(split.pieces.filter(piece => !piece.manual).length, 2);
    const preview = await previewTransparentPng(source.bytes, { regions });
    assert.deepEqual(preview.pieces, split.pieces.map(({ png, ...piece }) => piece));
});

test('overlapping and concave manual regions preserve each original RGBA pixel exactly once', async () => {
    const source = await png(10, 8, pixel => {
        for (let y = 1; y < 7; y++) for (let x = 1; x < 9; x++) pixel(x, y, [x, y, 100, (x + y) % 2 ? 255 : 3]);
    });
    const regions: PngSplitRegion[] = [
        [[-10, -10], [5, -10], [5, 3], [3, 3], [3, 5], [-10, 5]],
        [[2, 2], [8, 2], [8, 6], [2, 6]],
        [[20, 20], [30, 20], [30, 30]], // Empty/outside selections create no blank nodes.
    ];
    const split = await splitTransparentPng(source.bytes, { regions });
    assert.equal(split.pieces.filter(piece => piece.manual).length, 2);
    const reconstructed = Buffer.alloc(source.rgba.length);
    for (const piece of split.pieces) {
        const raw = await sharp(piece.png).raw().toBuffer(), [left, top, width, height] = piece.sourceRect;
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            const offset = (y * width + x) * 4;
            if (!raw[offset + 3]) continue;
            const target = ((top + y) * 10 + left + x) * 4;
            assert.equal(reconstructed[target + 3], 0);
            raw.copy(reconstructed, target, offset, offset + 4);
        }
    }
    assert.deepEqual(reconstructed, source.rgba);
    const first = split.pieces.find(piece => piece.manual)!;
    const firstRaw = await sharp(first.png).raw().toBuffer();
    assert.equal(firstRaw[((2 - first.sourceRect[1]) * first.width + 2 - first.sourceRect[0]) * 4 + 3], source.rgba[(2 * 10 + 2) * 4 + 3]);
    await assert.rejects(splitTransparentPng(source.bytes, { regions: [[[0, 0], [1, 1], [2, 2]]] }), /Invalid PNG split regions/);
});

function assertSpaced(geometry: { x: number; y: number; width: number; height: number }[], gap: number) {
    for (let a = 0; a < geometry.length; a++) for (let b = a + 1; b < geometry.length; b++) {
        const first = geometry[a], second = geometry[b];
        assert(first.x + first.width + gap <= second.x || second.x + second.width + gap <= first.x ||
            first.y + first.height + gap <= second.y || second.y + second.height + gap <= first.y, 'Images overlap or lose their gap');
    }
}

test('compact packing keeps exact native sizes and spacing for mixed large and tiny pieces', () => {
    const items = [{ width: 480, height: 120 }, { width: 60, height: 480 }, { width: 4, height: 2 },
        ...Array.from({ length: 60 }, (_, i) => ({ width: 1 + i % 5, height: 1 + i % 3 }))];
    const result = compactGeometry(items, 100, -200);
    assert.deepEqual(result, compactGeometry(items, 100, -200));
    assert.deepEqual(result.geometry.map(({width,height})=>({width,height})), items);
    assert.equal(Math.min(...result.geometry.map(p => p.x)), 100);
    assert.equal(Math.min(...result.geometry.map(p => p.y)), -200);
    assertSpaced(result.geometry, 12);
    assert.throws(() => compactGeometry(items, NaN, 0), /coordinates/);
    assert.throws(() => compactGeometry(items, 0, 0, -1), /gap/);
});

test('many images occupy a compact rectangle with multiple rows and columns', () => {
    const items = Array.from({ length: 36 }, () => ({ width: 100, height: 100 }));
    const { geometry, bounds } = compactGeometry(items, 0, 0);
    assert(new Set(geometry.map(item => item.x)).size > 1);
    assert(new Set(geometry.map(item => item.y)).size > 1);
    assert(Math.max(bounds.width / bounds.height, bounds.height / bounds.width) < 2);
    assert(bounds.width * bounds.height < items.length * 112 * 112 * 1.5);
    assertSpaced(geometry, 12);
});
