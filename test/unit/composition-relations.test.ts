import { describe, expect, it } from "vitest";
import {
  addArea, addDirectionLine, addFocus, applyRefinementPlan, createDraft, draftFingerprint,
  framePointToCanvas, inspectComposition, moveItem, setProcessingSemantic,
  type CompositionDraft, type DirectedRefinementPlan,
} from "../../src/domain/composition/index.js";

function fixture() {
  let draft = setProcessingSemantic(createDraft({ width: 1200, height: 1600 }), "scene-composition");
  draft = addArea(draft, { primitive: "quadrilateral", aspect: "free", area: 0.03,
    ...framePointToCanvas({ x: 0.2, y: 0.3 }, draft.frame) }).draft;
  draft = addArea(draft, { primitive: "quadrilateral", aspect: "free", area: 0.06,
    ...framePointToCanvas({ x: 0.7, y: 0.7 }, draft.frame) }).draft;
  draft = addFocus(draft, { x: draft.areas[0].x, y: draft.areas[0].y - 0.01 }).draft;
  return moveItem(addDirectionLine(draft).draft, "direction-1", framePointToCanvas({ x: 0.1, y: 0.9 }, draft.frame));
}
function plan(draft: CompositionDraft, operations: DirectedRefinementPlan["operations"]): DirectedRefinementPlan {
  return { version: 2, kind: "composition-refinement-plan", sourceFingerprint: draftFingerprint(draft),
    decision: operations.length ? "refine" : "retain", objective: "Clarify the relationship of the two masses.",
    assessment: { intent: "Two separated masses with a focus.", observations: ["The left mass anchors attention."], uncertainties: [] },
    rationale: "Use only the relationships that support the chosen objective.", preserve: ["Keep the two subjects."],
    tradeoffs: [], fixedIds: [], focusLinks: [], operations };
}
const explanation = { reason: "The measured placement weakens the intended relationship.", expectedEffect: "Make the selected relationship explicit." };

describe("goal-directed composition relations", () => {
  it("records a reasoned decision to retain the source with no operations", () => {
    const draft = fixture();
    const result = applyRefinementPlan(draft, plan(draft, []));
    expect(result.refinedDraft).toEqual(draft);
    expect(result.audit.relations).toEqual([]);
    expect(result.audit.passed).toBe(true);
    expect(() => applyRefinementPlan(draft, { ...plan(draft, []), objective: "" })).toThrow();
    expect(() => applyRefinementPlan(draft, { ...plan(draft, []), decision: "refine" })).toThrow();
  });

  it("places a subject on a golden division and carries its linked focus", () => {
    const draft = fixture();
    const original = structuredClone(draft);
    const p = plan(draft, [{ method: "frame-placement", methodVersion: 1, targetId: "area-1", axis: "x",
      alignment: "center", division: "golden-end", ...explanation }]);
    p.focusLinks = [{ focusId: "focus-1", areaId: "area-1" }];
    const result = applyRefinementPlan(draft, p);
    expect(inspectComposition(result.refinedDraft).areas[0].center.x).toBeCloseTo(0.61803398875, 6);
    expect(result.refinedDraft.focusPoints[0].x - result.refinedDraft.areas[0].x).toBeCloseTo(0);
    expect(result.audit.relations?.[0]).toMatchObject({ passed: true });
    expect(result.audit.relations?.[0].target).toBeCloseTo(0.61803398875, 10);
    expect(result.audit.relations?.[0].guides).toHaveLength(1);
    expect(draft).toEqual(original);
  });

  it("sets a physical width/height ratio independently of the portrait frame", () => {
    const draft = fixture();
    const result = applyRefinementPlan(draft, plan(draft, [{ method: "size-ratio", methodVersion: 1,
      targetAreaId: "area-1", dimension: "width", referenceId: "area-1", referenceDimension: "height",
      ratio: (1 + Math.sqrt(5)) / 2, ...explanation }]));
    const area = result.refinedDraft.areas[0];
    expect(area.width! * 1200 / (area.height! * 800)).toBeCloseTo((1 + Math.sqrt(5)) / 2, 8);
    expect(result.audit.passed).toBe(true);
  });

  it("makes an exact geometric mirror while preserving content and origin", () => {
    const draft = fixture();
    draft.areas[0].rotation = 27;
    const result = applyRefinementPlan(draft, plan(draft, [{ method: "mirror-symmetry", methodVersion: 1,
      anchorAreaId: "area-1", targetAreaId: "area-2", axis: "vertical", division: "center", match: "geometry", ...explanation }]));
    const [a, b] = inspectComposition(result.refinedDraft).areas;
    expect(a.center.x + b.center.x).toBeCloseTo(1, 5);
    expect(a.center.y).toBe(b.center.y);
    expect(result.refinedDraft.areas[1].rotation).toBe(333);
    expect(result.refinedDraft.areas[1].origin).toBe(draft.areas[1].origin);
    expect(result.audit.relations?.[0].error).toBeLessThan(1e-6);
  });

  it("aims the existing direction line at the focus without adding nodes", () => {
    const draft = fixture();
    const result = applyRefinementPlan(draft, plan(draft, [{ method: "focus-flow", methodVersion: 1,
      sourceId: "direction-1", targetFocusId: "focus-1", localAxis: "x", ...explanation }]));
    const line = result.refinedDraft.directionLine!;
    const focus = draft.focusPoints[0];
    const expected = Math.atan2((focus.y - line.y) * 800, (focus.x - line.x) * 1200) * 180 / Math.PI;
    expect(line.rotation).toBeCloseTo((expected + 360) % 360, 6);
    expect(result.refinedDraft.areas).toEqual(draft.areas);
    expect(result.audit.passed).toBe(true);
  });

  it("rejects a later operation that undoes an earlier relationship", () => {
    const draft = fixture();
    const operations: DirectedRefinementPlan["operations"] = ["golden-end", "center"].map((division) => ({
      method: "frame-placement", methodVersion: 1, targetId: "area-1", axis: "x", alignment: "center",
      division: division as "golden-end" | "center", ...explanation,
    }));
    expect(() => applyRefinementPlan(draft, plan(draft, operations))).toThrow(/relations/);
    const locked = plan(draft, [operations[0]]);
    locked.fixedIds = ["area-1"];
    expect(() => applyRefinementPlan(draft, locked)).toThrow(/fixed/);
  });
  it("links multiple focuses through subject scaling, then verifies final guidance", () => {
    let draft = fixture();
    draft = addFocus(draft, { x: draft.areas[0].x + 0.02, y: draft.areas[0].y }).draft;
    const p = plan(draft, [
      { method: "size-ratio", methodVersion: 1, targetAreaId: "area-1", dimension: "area",
        referenceId: "area-2", referenceDimension: "area", ratio: 1, ...explanation },
      { method: "focus-flow", methodVersion: 1, sourceId: "direction-1", targetFocusId: "focus-1", localAxis: "x", ...explanation },
    ]);
    p.focusLinks = [{ focusId: "focus-1", areaId: "area-1" }, { focusId: "focus-2", areaId: "area-1" }];
    const result = applyRefinementPlan(draft, p);
    expect(result.refinedDraft.focusPoints[1].x - result.refinedDraft.areas[0].x).toBeCloseTo(0.02 * Math.sqrt(2), 8);
    expect(result.audit.relations?.every((check) => check.passed)).toBe(true);
    const guidance = inspectComposition(result.refinedDraft).guidance.find((fact) => fact.sourceId === "direction-1" && fact.focusId === "focus-1")!;
    expect(guidance.angleError).toBe(0);
    expect(guidance.perpendicularDistance).toBe(0);
    expect(guidance.forwardDistance).toBeGreaterThan(0);
  });

  it("moves all linked focuses with their subject regardless of link order", () => {
    let draft = fixture();
    draft = addFocus(draft, { x: draft.areas[0].x + 0.02, y: draft.areas[0].y }).draft;
    const p = plan(draft, [{ method: "frame-placement", methodVersion: 1, targetId: "focus-2", axis: "x",
      alignment: "center", division: "golden-end", ...explanation }]);
    p.focusLinks = [{ focusId: "focus-1", areaId: "area-1" }, { focusId: "focus-2", areaId: "area-1" }];
    const result = applyRefinementPlan(draft, p);
    const subjectShift = result.refinedDraft.areas[0].x - draft.areas[0].x;
    for (const [index, focus] of result.refinedDraft.focusPoints.entries()) {
      expect(focus.x - draft.focusPoints[index].x).toBeCloseTo(subjectShift, 8);
      expect(focus.y).toBeCloseTo(draft.focusPoints[index].y, 8);
    }
    const reversed = applyRefinementPlan(draft, { ...p, focusLinks: [...p.focusLinks].reverse() });
    expect(reversed.refinedDraft).toEqual(result.refinedDraft);
  });

  it("rejects incompatible dimensions, ambiguous linkage and different shapes in geometry symmetry", () => {
    const draft = fixture();
    const ratio = plan(draft, [{ method: "size-ratio", methodVersion: 1, targetAreaId: "area-1", dimension: "width",
      referenceId: "area-2", referenceDimension: "area", ratio: 1, ...explanation }]);
    expect(() => applyRefinementPlan(draft, ratio)).toThrow(/length ratio/);
    const linked = plan(draft, []);
    linked.focusLinks = [{ focusId: "focus-1", areaId: "area-1" }, { focusId: "focus-1", areaId: "area-2" }];
    expect(() => applyRefinementPlan(draft, linked)).toThrow(/only one area/);
    const different = addArea(draft, { primitive: "triangle", area: 0.03, x: 0.3, y: 0.3 }).draft;
    expect(() => applyRefinementPlan(different, plan(different, [{ method: "mirror-symmetry", methodVersion: 1,
      anchorAreaId: "area-1", targetAreaId: "area-3", axis: "vertical", division: "center", match: "geometry", ...explanation }]))).toThrow(/matching primitives/);
  });

  it("does not accept evidence-free operations or a retain decision with changes", () => {
    const draft = fixture();
    const p = plan(draft, [{ method: "frame-placement", methodVersion: 1, targetId: "area-1", axis: "x",
      alignment: "center", division: "center", ...explanation }]);
    expect(() => applyRefinementPlan(draft, { ...p, decision: "retain" })).toThrow();
    expect(() => applyRefinementPlan(draft, { ...p, operations: [{ ...p.operations[0], reason: "" }] })).toThrow();
    expect(() => applyRefinementPlan(draft, { ...p, sourceFingerprint: "draft-00000000" })).toThrow(/stale/);
  });

});
