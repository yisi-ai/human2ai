import { describe, expect, it } from "vitest";
import {
  addArea, addCompositionPlan, changeFrame, compositionPlanGeometry, createCompositionState,
  createDraft, draftFingerprint, inspectComposition, moveFrame, removeCompositionPlan,
  renderCompositionReferenceSvg, renderCompositionSvg, replaceCompositionPlan,
  selectCompositionState, transformCompositionPlan, validateDraft,
} from "../../src/domain/composition/index.ts";

function createUnplannedDraft(frame?: Parameters<typeof createDraft>[0]) {
  const draft = createDraft(frame);
  delete draft.plans;
  return draft;
}

describe("composition planning", () => {
  it("preserves legacy drafts and fingerprints without introducing planning fields", () => {
    const draft = createUnplannedDraft();
    expect(validateDraft(draft)).toEqual(draft);
    expect(validateDraft(draft).plans).toBeUndefined();
    expect(draftFingerprint(JSON.parse(JSON.stringify(draft)))).toBe(draftFingerprint(draft));
  });

  it("edits planning independently from content and includes it in inspection and fingerprints", () => {
    const original = addArea(createUnplannedDraft(), { primitive: "circle", x: 0.3, y: 0.4 }).draft;
    const added = addCompositionPlan(original, "golden-spiral");
    const plan = added.draft.plans![0];
    if (plan.type !== "golden-spiral") throw new Error("Wrong fixture type");
    const edited = replaceCompositionPlan(added.draft, { ...plan, x: 0.7, rotation: 30, scale: 1.2 });
    expect(edited.areas).toEqual(original.areas);
    expect(edited.frame).toEqual(original.frame);
    expect(edited.focusPoints).toEqual(original.focusPoints);
    expect(draftFingerprint(edited)).not.toBe(draftFingerprint(added.draft));
    expect(inspectComposition(edited).plans).toEqual(edited.plans);
    expect(removeCompositionPlan(edited, added.id).plans).toEqual([]);
    expect(original.plans).toBeUndefined();
    const reordered = { ...edited, plans: edited.plans!.map((entry) => Object.fromEntries(Object.entries(entry).reverse())) };
    expect(draftFingerprint(validateDraft(reordered))).toBe(draftFingerprint(edited));
  });

  it("copies and switches independent state plans including an absent planning layer", () => {
    const original = createUnplannedDraft();
    let draft = createCompositionState(original, "state-1", "second");
    draft = addCompositionPlan(draft, "triangle").draft;
    draft = createCompositionState(draft, "second", "third");
    const copied = draft.plans;
    draft = removeCompositionPlan(draft, draft.plans![0].id);
    expect(selectCompositionState(draft, "second").plans).toEqual(copied);
    expect(selectCompositionState(draft, "state-1").plans).toBeUndefined();
    const changed = structuredClone(draft);
    changed.states![1].layout.plans![0].visible = false;
    expect(draftFingerprint(changed)).not.toBe(draftFingerprint(draft));
  });

  it("validates plans from agents, including inactive layouts", () => {
    const draft = addCompositionPlan(createUnplannedDraft(), "golden-spiral").draft;
    const plan = draft.plans![0];
    expect(() => validateDraft({ ...draft, plans: [plan, plan] })).toThrow();
    expect(() => validateDraft({ ...draft, plans: [{ ...plan, scale: 0 }] })).toThrow();
    expect(() => validateDraft({ ...draft, plans: [{ ...plan, x: Infinity }] })).toThrow();
    expect(() => validateDraft({ ...draft, plans: [{ ...plan, type: "unknown" }] })).toThrow();
    const states = createCompositionState(draft, "state-1", "second");
    Object.assign(states.states![0].layout.plans![0], { scale: -1 });
    expect(() => validateDraft(states)).toThrow();
  });

  it("renders frame-relative guides in previews but leaves generation references unchanged", () => {
    let original = changeFrame(createUnplannedDraft(), { width: 900, height: 1600 });
    original = moveFrame(original, { x: -0.5, y: 0.2 });
    const draft = addCompositionPlan(original, "golden-section").draft;
    const geometry = compositionPlanGeometry(draft.plans![0], draft.frame);
    expect(geometry.paths).toHaveLength(4);
    expect(geometry.paths[0][0].x).toBeCloseTo(-600 + (3 - Math.sqrt(5)) / 2 * draft.frame.bounds.width * 1200);
    expect(renderCompositionSvg(draft)).toContain('data-composition-plan="plan-1"');
    expect(renderCompositionReferenceSvg(draft)).toBe(renderCompositionReferenceSvg(original));
    expect(renderCompositionSvg(replaceCompositionPlan(draft, { ...draft.plans![0], visible: false })))
      .not.toContain('data-composition-plan="plan-1"');
  });

  it("keeps spiral growth golden in physical coordinates across frame ratios and mirroring", () => {
    for (const size of [{ width: 1600, height: 900 }, { width: 900, height: 1600 }]) {
      const draft = addCompositionPlan(createUnplannedDraft(size), "golden-spiral").draft;
      const plan = draft.plans![0];
      if (plan.type !== "golden-spiral") throw new Error("Wrong fixture type");
      const { paths: [points], handles: [center] } = compositionPlanGeometry(plan, draft.frame);
      const distance = (i: number) => Math.hypot(points[i].x - center.x, points[i].y - center.y);
      expect(distance(240) / distance(220)).toBeCloseTo((1 + Math.sqrt(5)) / 2);
      const mirrored = compositionPlanGeometry({ ...plan, mirrored: true }, draft.frame);
      expect(mirrored.paths[0]).not.toEqual(points);
      expect(mirrored.handles).toEqual(compositionPlanGeometry(plan, draft.frame).handles);
    }
  });

  it("keeps triangle legs equal through numeric edits, control movement and frame ratio changes", () => {
    const original = addArea(createUnplannedDraft(), { primitive: "circle" }).draft;
    let draft = addCompositionPlan(original, "triangle").draft;
    const initial = draft.plans![0];
    if (initial.type !== "triangle") throw new Error("Wrong fixture type");
    draft = replaceCompositionPlan(draft, { ...initial, rotation: 37, width: 0.7, height: 0.4 });
    for (const size of [{ width: 1600, height: 900 }, { width: 900, height: 1600 }]) {
      const resized = changeFrame(draft, size);
      for (const handle of [undefined, 0, 1, 2]) {
        const plan = transformCompositionPlan(resized.plans![0], resized.frame, { x: 41, y: -29 }, handle);
        const edited = replaceCompositionPlan(resized, plan);
        const { handles: [apex, left, right] } = compositionPlanGeometry(plan, edited.frame);
        expect(Math.hypot(apex.x - left.x, apex.y - left.y)).toBeCloseTo(Math.hypot(apex.x - right.x, apex.y - right.y), 8);
        expect(edited.areas).toEqual(resized.areas);
        expect(plan).not.toEqual(resized.plans![0]);
      }
    }
    expect(() => validateDraft({ ...draft, plans: [{ ...initial, width: 0 }] })).toThrow();
    expect(() => validateDraft({ ...draft, plans: [{ ...initial, height: -1 }] })).toThrow();
  });

  it("loads earlier planning drafts with constrained triangles and retains thirds in every state", () => {
    const original = createCompositionState(addArea(createUnplannedDraft(), { primitive: "circle" }).draft, "state-1", "second");
    const plans = [
      { id: "plan-1", type: "triangle", enabled: true, visible: true, note: "keep", points: [{ x: 0.7, y: 0.2 }, { x: 0.2, y: 0.8 }, { x: 0.8, y: 0.8 }] },
      { id: "plan-2", type: "thirds", enabled: true, visible: true, note: "", axes: "both" },
    ];
    const input = { ...original, plans, states: original.states!.map((state) => ({ ...state, layout: { ...state.layout, plans } })) };
    const draft = validateDraft(input);
    expect(draft.areas).toEqual(original.areas);
    expect(draft.plans).toEqual([
      { id: "plan-1", type: "triangle", visible: true, x: 0.5, y: 0.5, rotation: 0, width: 0.6, height: 0.6 },
      { id: "plan-2", type: "thirds", visible: true, axes: "both" },
    ]);
    expect(selectCompositionState(draft, "state-1").plans).toEqual(draft.plans);
    expect(validateDraft(draft)).toEqual(draft);
    expect(input.plans).toHaveLength(2);
    expect(input.plans[0]).toHaveProperty("points");
  });
});
