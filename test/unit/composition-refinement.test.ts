import { describe, expect, it } from "vitest";
import {
  addArea,
  addDirectionLine,
  addFocus,
  applyRefinementPlan,
  auditRefinement,
  createDraft,
  draftFingerprint,
  framePointToCanvas,
  inspectComposition,
  moveItem,
  refinementMethods,
  setProcessingSemantic,
  updateAreaMetadata,
  updateItemMetadata,
  validateRefinementPlan,
  type CompositionDraft,
  type CompositionRefinementPlan,
} from "../../src/domain/composition/index.js";

describe("agent-authored composition refinement", () => {
  it("exposes methods without selecting an aesthetic treatment", () => {
    expect(refinementMethods()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "focus-anchor", decisionOwner: "agent" }),
      expect.objectContaining({ id: "axis-relation", decisionOwner: "agent" }),
      expect.objectContaining({ id: "rotation-alignment", decisionOwner: "agent" }),
      expect.objectContaining({
        id: "block-alignment",
        processingSemantics: ["editorial-layout"],
      }),
      expect.objectContaining({
        id: "spacing-rhythm",
        processingSemantics: ["editorial-layout"],
      }),
    ]));

    const inspection = inspectComposition(createDualAxisDraft());
    expect(inspection.kind).toBe("composition-inspection");
    expect(inspection.processingSemantic).toBe("scene-composition");
    expect(inspection.layout).toBeNull();
    expect(inspection.overallNote).toBe("");
    expect(inspection.axes.focus).toHaveLength(1);
    expect(inspection.axes.area).toHaveLength(1);
    expect(inspection.focusPoints[0]).toMatchObject({ x: 0.25, y: 0.25 });
    expect(inspection.areas[0].center).toEqual({ x: 0.25, y: 0.7 });
    expect(inspection).not.toHaveProperty("recommendation");
    expect(inspection).not.toHaveProperty("selectedMethod");
  });

  it("keeps the draft fingerprint stable across JSON property ordering", () => {
    const draft = createDualAxisDraft();
    const reordered = JSON.parse(
      JSON.stringify(draft, [
        "areas",
        "images",
        "bounds",
        "frame",
        "focusPoints",
        "height",
        "id",
        "kind",
        "processingSemantic",
        "overallNote",
        "primitive",
        "version",
        "width",
        "x",
        "y",
        "area",
        "aspect",
        "rotation",
        "directionLine",
        "origin",
        "note",
        "annotation",
        "semanticType",
        "shotScale",
        "visualWeight",
        "displayText",
        "plans",
        "type",
        "axes",
        "visible",
      ]),
    );

    expect(reordered).toEqual(draft);
    expect(draftFingerprint(reordered)).toBe(draftFingerprint(draft));
    expect(
      draftFingerprint(updateItemMetadata(draft, "area-1", { note: "画面主体" })),
    ).not.toBe(draftFingerprint(draft));
    expect(
      draftFingerprint(updateItemMetadata(draft, "area-1", { shotScale: "foreground" })),
    ).not.toBe(draftFingerprint(draft));
    expect(draftFingerprint({ ...draft, overallNote: "突出主体" })).not.toBe(
      draftFingerprint(draft),
    );
    expect(
      draftFingerprint(setProcessingSemantic(draft, "editorial-layout")),
    ).not.toBe(draftFingerprint(draft));
    expect(
      draftFingerprint({ ...createDraft(), processingSemantic: null }),
    ).not.toBe(draftFingerprint(createDraft()));
    expect(
      draftFingerprint(updateAreaMetadata(draft, "area-1", { visualWeight: "high" })),
    ).not.toBe(draftFingerprint(draft));
  });

  it("applies an Agent-selected focus anchor and rotation while preserving the draft", () => {
    const empty = setProcessingSemantic(createDraft(), "scene-composition");
    let draft = addFocus(empty, framePointToCanvas({ x: 0.61, y: 0.39 }, empty.frame)).draft;
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
      origin: "user",
      note: "",
      annotation: "",
      semanticType: "",
      shotScale: "auto",
      ...framePointToCanvas(
        { x: 0.61803398875, y: 0.38196601125 },
        draft.frame,
      ),
    });
    expect(result.refinedDraft.areas[0].rotation).toBe(0);
    expect(result.refinedDraft.directionLine).toEqual(draft.directionLine);
    expect(result.refinedDraft.areas[0].area).toBe(draft.areas[0].area);
    expect(result.audit.passed).toBe(true);
    expect(result.audit.preserved).toEqual({
      processingSemantic: true,
      frame: true,
      focusIdentity: true,
      areaIdentity: true,
      areaGeometryInputs: true,
      areaMetadata: true,
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

  it("exposes whole-page layout facts and applies editorial alignment methods", () => {
    let draft = setProcessingSemantic(createDraft({ width: 1200, height: 800 }), "editorial-layout");
    for (const [x, weight] of [
      [0.25, "high"],
      [0.51, "medium"],
      [0.75, "low"],
    ] as const) {
      const added = addArea(draft, {
        primitive: "quadrilateral",
        aspect: "free",
        area: 0.04,
        ...framePointToCanvas({ x, y: 0.5 }, draft.frame),
      });
      draft = updateAreaMetadata(added.draft, added.id, { visualWeight: weight });
    }
    const focus = addFocus(
      draft,
      framePointToCanvas({ x: 0.25, y: 0.5 }, draft.frame),
    );
    draft = focus.draft;

    const inspection = inspectComposition(draft);
    expect(inspection.layout).toMatchObject({
      textRegionIds: [],
      weightGroups: {
        high: ["area-1"],
        medium: ["area-2"],
        low: ["area-3"],
      },
      focusRelations: [{ focusId: focus.id, nearestAreaId: "area-1", distance: 0 }],
    });
    expect(inspection.layout?.pairs).toHaveLength(3);
    expect(inspection.layout?.pairs[0].heightRatio).toBeCloseTo(1, 5);

    const spacingPlan: CompositionRefinementPlan = {
      version: 1,
      kind: "composition-refinement-plan",
      sourceFingerprint: draftFingerprint(draft),
      rationale: "Agent reinforces an even horizontal reading rhythm.",
      operations: [{
        method: "spacing-rhythm",
        methodVersion: 1,
        targetAreaIds: ["area-1", "area-2", "area-3"],
        axis: "horizontal",
        distribution: "equal",
        strength: "subtle",
      }],
    };
    const uneven = moveItem(draft, "area-2", { ...draft.areas[1], x: draft.areas[1].x + 0.1 });
    const spaced = applyRefinementPlan(uneven, { ...spacingPlan, sourceFingerprint: draftFingerprint(uneven) });
    expect(spaced.audit.changes.maximumAreaShift).toBeGreaterThan(0.04);
    expect(spaced.audit.passed).toBe(true);
    expect(spaced.appliedOperations[0].method).toBe("spacing-rhythm");

    const alignmentSource = moveItem(spaced.refinedDraft, "area-2", {
      ...spaced.refinedDraft.areas[1],
      y: spaced.refinedDraft.areas[1].y + 0.2,
    });
    const aligned = applyRefinementPlan(alignmentSource, {
      version: 1,
      kind: "composition-refinement-plan",
      sourceFingerprint: draftFingerprint(alignmentSource),
      rationale: "Agent restores a shared top edge.",
      operations: [{
        method: "block-alignment",
        methodVersion: 1,
        targetAreaIds: ["area-1", "area-2"],
        anchorAreaId: "area-1",
        alignment: "top",
        strength: "subtle",
      }],
    });
    expect(aligned.audit.passed).toBe(true);
    expect(aligned.audit.changes.maximumAreaShift).toBeGreaterThan(0.04);
    expect(aligned.appliedOperations[0].method).toBe("block-alignment");
  });

  it("allows substantial axis and rotation adjustments without changing the source", () => {
    const draft = createDualAxisDraft();
    const original = structuredClone(draft);
    const result = applyRefinementPlan(draft, {
      version: 1,
      kind: "composition-refinement-plan",
      sourceFingerprint: draftFingerprint(draft),
      rationale: "Agent chooses parallel masses and a diagonal shape in a separate result.",
      operations: [
        { method: "axis-relation", methodVersion: 1, focusIds: ["focus-1", "focus-2"],
          areaIds: ["area-1", "area-2"], relation: "parallel" },
        { method: "rotation-alignment", methodVersion: 1, targetAreaIds: ["area-1"],
          axis: "falling-diagonal" },
      ],
    });
    expect(result.audit.passed).toBe(true);
    expect(result.audit.changes.maximumAreaShift).toBeGreaterThan(0.04);
    expect(result.audit.changes.maximumRotationShift).toBe(45);
    expect(result.refinedDraft.areas[0].rotation).toBe(45);
    const inspection = inspectComposition(result.refinedDraft);
    expect(inspection.axes.area[0].angle).toBeCloseTo(inspection.axes.focus[0].angle, 5);
    expect(draft).toEqual(original);
  });

  it("rejects editorial-only methods for image composition", () => {
    const draft = createDualAxisDraft();
    expect(() => applyRefinementPlan(draft, {
      version: 1,
      kind: "composition-refinement-plan",
      sourceFingerprint: draftFingerprint(draft),
      rationale: "This method requires editorial layout semantics.",
      operations: [{
        method: "block-alignment",
        methodVersion: 1,
        targetAreaIds: ["area-1", "area-2"],
        anchorAreaId: "area-1",
        alignment: "left",
        strength: "subtle",
      }],
    })).toThrow(/does not support scene-composition/i);
  });

  it("requires the user to choose a composition mode before refinement", () => {
    const draft = { ...createDraft(), processingSemantic: null };
    expect(inspectComposition(draft).processingSemantic).toBeNull();
    expect(() => applyRefinementPlan(draft, {
      version: 1,
      kind: "composition-refinement-plan",
      sourceFingerprint: draftFingerprint(draft),
      rationale: "The Agent must not infer a mode.",
      operations: [],
    })).toThrow(/mode is not selected.*ask the user/i);
  });

  it("rejects stale and free-coordinate plans while allowing Agent-selected movement", () => {
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
    const result = applyRefinementPlan(draft, basePlan);
    expect(result.audit.passed).toBe(true);
    expect(result.audit.changes.maximumFocusShift).toBeGreaterThan(0.08);
    expect(result.refinedDraft.focusPoints[0]).toMatchObject(
      framePointToCanvas({ x: 0.5, y: 0.5 }, draft.frame),
    );
  });

  it("records movement and clipping while still rejecting content changes", () => {
    const draft = createDualAxisDraft();
    const moved = moveItem(draft, "area-1", { x: 0.5, y: 0.7 });
    const audit = auditRefinement(draft, moved);

    expect(audit.passed).toBe(true);
    expect(audit.changes.maximumAreaShift).toBeGreaterThan(0.04);
    expect(audit.failedChecks).toEqual([]);
    const outside = moveItem(draft, "area-1", { x: -0.2, y: -0.2 });
    const clippingAudit = auditRefinement(draft, outside);
    expect(clippingAudit.passed).toBe(true);
    expect(clippingAudit.preserved.clippingSides).toBe(false);

    const reweighted = updateAreaMetadata(draft, "area-1", { visualWeight: "high" });
    const metadataAudit = auditRefinement(draft, reweighted);
    expect(metadataAudit.passed).toBe(false);
    expect(metadataAudit.failedChecks).toContain("preserved.areaMetadata");
  });
});

function createDualAxisDraft(): CompositionDraft {
  const empty = setProcessingSemantic(
    createDraft({ width: 1200, height: 800 }),
    "scene-composition",
  );
  let draft = addFocus(
    empty,
    framePointToCanvas({ x: 0.25, y: 0.25 }, empty.frame),
  ).draft;
  draft = addFocus(
    draft,
    framePointToCanvas({ x: 0.75, y: 0.75 }, draft.frame),
  ).draft;
  draft = addArea(draft, {
    primitive: "quadrilateral",
    aspect: "free",
    area: 0.08,
    ...framePointToCanvas({ x: 0.25, y: 0.7 }, draft.frame),
  }).draft;
  return addArea(draft, {
    primitive: "triangle",
    area: 0.06,
    ...framePointToCanvas({ x: 0.75, y: 0.3 }, draft.frame),
  }).draft;
}
