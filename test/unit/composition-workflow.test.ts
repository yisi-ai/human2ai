import { describe, expect, it } from "vitest";
import {
  addArea,
  addFocus,
  applyRefinementPlan,
  beginCompositionRefinement,
  createCompositionWorkflowState,
  createDraft,
  draftFingerprint,
  moveItem,
  receiveCompositionRefinement,
  updateCompositionWorkflowDraft,
} from "../../src/domain/composition/index.js";

describe("composition refinement workflow", () => {
  it("shows only audited results for the current draft", () => {
    const draft = createRefinableDraft();
    const processing = beginCompositionRefinement(createCompositionWorkflowState(draft));
    const refinement = applyRefinementPlan(draft, {
      version: 1,
      kind: "composition-refinement-plan",
      sourceFingerprint: draftFingerprint(draft),
      rationale: "Agent chooses a nearby golden anchor.",
      operations: [
        {
          method: "focus-anchor",
          methodVersion: 1,
          targetFocusId: "focus-1",
          anchor: "golden-right-upper",
          strength: "subtle",
        },
      ],
    });

    const ready = receiveCompositionRefinement(processing, refinement);

    expect(ready.status).toBe("ready");
    expect(ready.refinement).toBe(refinement);
    expect(ready.requestedFingerprint).toBeNull();
  });

  it("invalidates an old result as soon as the user changes the draft", () => {
    const draft = createRefinableDraft();
    const refinement = applyRefinementPlan(draft, {
      version: 1,
      kind: "composition-refinement-plan",
      sourceFingerprint: draftFingerprint(draft),
      rationale: "Agent chooses a nearby golden anchor.",
      operations: [
        {
          method: "focus-anchor",
          methodVersion: 1,
          targetFocusId: "focus-1",
          anchor: "golden-right-upper",
          strength: "subtle",
        },
      ],
    });
    const ready = receiveCompositionRefinement(
      createCompositionWorkflowState(draft),
      refinement,
    );

    const changedDraft = moveItem(draft, "area-1", { x: 0.54, y: 0.5 });
    const stale = updateCompositionWorkflowDraft(ready, changedDraft);

    expect(stale.status).toBe("stale");
    expect(stale.refinement).toBe(refinement);
    expect(stale.draft).toBe(changedDraft);
  });

  it("does not accept a late result for an older draft", () => {
    const draft = createRefinableDraft();
    const refinement = applyRefinementPlan(draft, {
      version: 1,
      kind: "composition-refinement-plan",
      sourceFingerprint: draftFingerprint(draft),
      rationale: "Agent chooses a nearby golden anchor.",
      operations: [
        {
          method: "focus-anchor",
          methodVersion: 1,
          targetFocusId: "focus-1",
          anchor: "golden-right-upper",
          strength: "subtle",
        },
      ],
    });
    const processing = beginCompositionRefinement(createCompositionWorkflowState(draft));
    const changed = updateCompositionWorkflowDraft(
      processing,
      moveItem(draft, "area-1", { x: 0.54, y: 0.5 }),
    );

    expect(receiveCompositionRefinement(changed, refinement).status).toBe("stale");
  });

  it("does not expose a result that failed its protection audit", () => {
    const draft = createRefinableDraft();
    const refinement = applyRefinementPlan(draft, {
      version: 1,
      kind: "composition-refinement-plan",
      sourceFingerprint: draftFingerprint(draft),
      rationale: "Agent chooses a nearby golden anchor.",
      operations: [
        {
          method: "focus-anchor",
          methodVersion: 1,
          targetFocusId: "focus-1",
          anchor: "golden-right-upper",
          strength: "subtle",
        },
      ],
    });
    refinement.audit.passed = false;

    const state = receiveCompositionRefinement(
      createCompositionWorkflowState(draft),
      refinement,
    );

    expect(state.status).toBe("error");
    expect(state.refinement).toBeNull();
  });
});

function createRefinableDraft() {
  let draft = addFocus(createDraft(), { x: 0.61, y: 0.39 }).draft;
  draft = addArea(draft, {
    primitive: "quadrilateral",
    aspect: "free",
    area: 0.1,
    x: 0.5,
    y: 0.5,
  }).draft;
  return draft;
}
