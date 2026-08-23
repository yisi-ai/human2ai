import { describe, expect, it } from "vitest";
import {
  addArea,
  addDirectionLine,
  addFocus,
  applyRefinementPlan,
  auditRefinement,
  createDraft,
  draftFingerprint,
  inspectComposition,
  moveItem,
  refinementMethods,
  validateRefinementPlan,
  type CompositionDraft,
  type CompositionRefinementPlan,
} from "../../src/domain/composition/index.js";

describe("agent-authored composition refinement", () => {
  it("exposes methods without selecting an aesthetic treatment", () => {
    expect(refinementMethods()).toEqual([
      expect.objectContaining({ id: "focus-anchor", decisionOwner: "agent" }),
      expect.objectContaining({ id: "axis-relation", decisionOwner: "agent" }),
      expect.objectContaining({ id: "rotation-alignment", decisionOwner: "agent" }),
    ]);

    const inspection = inspectComposition(createDualAxisDraft());
    expect(inspection.kind).toBe("composition-inspection");
    expect(inspection.axes.focus).toHaveLength(1);
    expect(inspection.axes.area).toHaveLength(1);
    expect(inspection).not.toHaveProperty("recommendation");
    expect(inspection).not.toHaveProperty("selectedMethod");
  });

  it("keeps the draft fingerprint stable across JSON property ordering", () => {
    const draft = createDualAxisDraft();
    const reordered = JSON.parse(
      JSON.stringify(draft, [
        "areas",
        "frame",
        "focusPoints",
        "height",
        "id",
        "kind",
        "primitive",
        "version",
        "width",
        "x",
        "y",
        "area",
        "aspect",
        "rotation",
        "directionLine",
      ]),
    );

    expect(reordered).toEqual(draft);
    expect(draftFingerprint(reordered)).toBe(draftFingerprint(draft));
  });

  it("applies an Agent-selected focus anchor and rotation while preserving the draft", () => {
    let draft = addFocus(createDraft(), { x: 0.61, y: 0.39 }).draft;
    draft = addArea(draft, {
      primitive: "quadrilateral",
      aspect: "free",
      area: 0.1,
      x: 0.5,
      y: 0.5,
      rotation: 2,
    }).draft;
    draft = addDirectionLine(draft).draft;
    const plan: CompositionRefinementPlan = {
      version: 1,
      kind: "composition-refinement-plan",
      sourceFingerprint: draftFingerprint(draft),
      rationale: "Agent chooses a golden focus and a horizontal structural axis.",
      operations: [
        {
          method: "focus-anchor",
          methodVersion: 1,
          targetFocusId: "focus-1",
          anchor: "golden-right-upper",
          strength: "subtle",
        },
        {
          method: "rotation-alignment",
          methodVersion: 1,
          targetAreaIds: ["area-1"],
          axis: "horizontal",
          strength: "subtle",
        },
      ],
    };

    const result = applyRefinementPlan(draft, plan);

    expect(result.refinedDraft.focusPoints[0]).toEqual({
      id: "focus-1",
      x: 0.61803398875,
      y: 0.38196601125,
    });
    expect(result.refinedDraft.areas[0].rotation).toBe(0);
    expect(result.refinedDraft.directionLine).toEqual(draft.directionLine);
    expect(result.refinedDraft.areas[0].area).toBe(draft.areas[0].area);
    expect(result.audit.passed).toBe(true);
    expect(result.audit.preserved).toEqual({
      frame: true,
      focusIdentity: true,
      areaIdentity: true,
      areaGeometryInputs: true,
      areaOrder: true,
      directionLine: true,
      clippingSides: true,
    });
  });

  it("strengthens only the axis relation selected by the Agent", () => {
    const draft = createDualAxisDraft();
    const result = applyRefinementPlan(draft, {
      version: 1,
      kind: "composition-refinement-plan",
      sourceFingerprint: draftFingerprint(draft),
      rationale: "Agent identifies a mirrored cross between focus and mass axes.",
      operations: [
        {
          method: "axis-relation",
          methodVersion: 1,
          focusIds: ["focus-1", "focus-2"],
          areaIds: ["area-1", "area-2"],
          relation: "mirrored-cross",
          strength: "subtle",
        },
      ],
    });

    expect(result.audit.changes.maximumAreaShift).toBeGreaterThan(0);
    expect(result.audit.changes.maximumAreaShift).toBeLessThanOrEqual(0.04);
    expect(result.refinedDraft.areas.map(({ area }) => area)).toEqual(
      draft.areas.map(({ area }) => area),
    );
    expect(result.appliedOperations[0]).toMatchObject({
      method: "axis-relation",
      targetIds: ["focus-1", "focus-2", "area-1", "area-2"],
    });
  });

  it("rejects stale, free-coordinate, and over-limit plans", () => {
    const draft = createDualAxisDraft();
    const basePlan = {
      version: 1,
      kind: "composition-refinement-plan",
      sourceFingerprint: draftFingerprint(draft),
      rationale: "Agent-authored plan.",
      operations: [
        {
          method: "focus-anchor",
          methodVersion: 1,
          targetFocusId: "focus-1",
          anchor: "geometric-center",
          strength: "subtle",
        },
      ],
    } as const;

    expect(() =>
      applyRefinementPlan(draft, { ...basePlan, sourceFingerprint: "draft-00000000" }),
    ).toThrow(/stale/i);
    expect(() =>
      validateRefinementPlan({
        ...basePlan,
        operations: [{ ...basePlan.operations[0], x: 0.5, y: 0.5 }],
      }),
    ).toThrow(/x|y/);
    expect(() => applyRefinementPlan(draft, basePlan)).toThrow(/exceeding subtle limit/i);
  });

  it("audits direct geometry changes against the same protection boundary", () => {
    const draft = createDualAxisDraft();
    const moved = moveItem(draft, "area-1", { x: 0.5, y: 0.7 });
    const audit = auditRefinement(draft, moved);

    expect(audit.passed).toBe(false);
    expect(audit.failedChecks).toContain("limits.maximumAreaShift");
  });
});

function createDualAxisDraft(): CompositionDraft {
  let draft = addFocus(createDraft(), { x: 0.25, y: 0.25 }).draft;
  draft = addFocus(draft, { x: 0.75, y: 0.75 }).draft;
  draft = addArea(draft, {
    primitive: "quadrilateral",
    aspect: "free",
    area: 0.08,
    x: 0.25,
    y: 0.7,
  }).draft;
  return addArea(draft, {
    primitive: "triangle",
    area: 0.06,
    x: 0.75,
    y: 0.3,
  }).draft;
}
