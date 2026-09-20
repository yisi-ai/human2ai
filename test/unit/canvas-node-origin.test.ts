import { describe, expect, it } from "vitest";
import { addArea, createDraft, validateDraft } from "../../src/domain/composition/index.ts";
import { createUiSketchDraft, validateUiSketchDraft } from "../../src/domain/ui-sketch/index.ts";

describe.each([
  { name: "composition", create: () => addArea(createDraft(), { primitive: "circle", area: 0.1 }).draft, validate: validateDraft, key: "areas" },
  { name: "UI", create: () => ({ ...createUiSketchDraft(), rectangles: [{ id: "region-1", x: 20, y: 20, width: 200, height: 100 }] }), validate: validateUiSketchDraft, key: "rectangles" },
])("$name node origin", ({ create, validate, key }) => {
  it("normalizes legacy nodes and preserves an Agent accent through later edits", () => {
    const legacy = create() as unknown as Record<string, Array<Record<string, unknown>>>;
    delete legacy[key][0].origin;
    const normalized = validate(legacy) as unknown as Record<string, Array<Record<string, unknown>>>;
    expect(normalized[key][0].origin).toBe("user");
    normalized[key][0] = { ...normalized[key][0], origin: "agent", annotation: "Small geometric accent", note: "Move slightly right" };
    const saved = validate(normalized) as unknown as Record<string, Array<Record<string, unknown>>>;
    expect(saved[key][0]).toMatchObject({ origin: "agent", annotation: "Small geometric accent", note: "Move slightly right" });
    saved[key][0].origin = "unknown";
    expect(() => validate(saved)).toThrow();
  });
});
