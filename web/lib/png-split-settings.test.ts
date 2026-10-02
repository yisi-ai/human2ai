import { afterEach, expect, it, vi } from "vitest";
import { isValidPngSplitOptions, PNG_SPLIT_SETTINGS_KEY, readPngSplitOptions, savePngSplitOptions } from "./png-split-settings";

const defaults = { alphaThreshold: 8, minSize: 16, gap: 12 };
afterEach(() => vi.unstubAllGlobals());

it("restores saved settings independently of the next dialog defaults", () => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
  expect(readPngSplitOptions(defaults)).toBe(defaults);
  const options = { alphaThreshold: 0, minSize: 0, gap: 2.5 };
  savePngSplitOptions(options);
  expect(JSON.parse(values.get(PNG_SPLIT_SETTINGS_KEY)!)).toEqual(options);
  expect(readPngSplitOptions(defaults)).toEqual(options);
});

it.each(['broken json', 'null', '{}', '{"alphaThreshold":255,"minSize":16,"gap":12}', '{"alphaThreshold":8,"minSize":-1,"gap":12}', '{"alphaThreshold":8,"minSize":16,"gap":"12"}'])("ignores invalid stored settings: %s", saved => {
  vi.stubGlobal("localStorage", { getItem: () => saved });
  expect(readPngSplitOptions(defaults)).toBe(defaults);
});

it("keeps invalid values out of auto-save and works when browser storage is blocked", () => {
  expect(isValidPngSplitOptions({ ...defaults, gap: Infinity })).toBe(false);
  expect(isValidPngSplitOptions({ ...defaults, minSize: 1.5 })).toBe(false);
  expect(isValidPngSplitOptions({ ...defaults, alphaThreshold: 0.5 })).toBe(false);
  vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
  expect(readPngSplitOptions(defaults)).toBe(defaults);
  expect(() => savePngSplitOptions(defaults)).not.toThrow();
});
