import { describe, expect, it } from "vitest";

import {
  createUiSketchDraft,
  UI_SKETCH_END_STAGE_ID,
  UI_SKETCH_START_STAGE_ID,
  uiSketchDraftFingerprint,
  uiSketchDraftForStage,
  updateUiSketchImageCrop,
  updateUiSketchStageDraft,
  validateUiSketchDraft,
} from "../../src/domain/ui-sketch/index.js";

describe("UI sketch draft", () => {
  it("creates an independent empty UI sketch", () => {
    const first = createUiSketchDraft();
    const second = createUiSketchDraft();
    first.frame.width = 1200;

    expect(second).toEqual({
      version: 1,
      kind: "ui-layout-draft",
      groups: [],
      frame: { x: 0, y: 0, width: 960, height: 560 },
      overallNote: "",
      rectangles: [],
      texts: [],
      images: [],
      stages: [],
    });
  });

  it("creates a stable fingerprint independent of JSON property order", () => {
    const draft = createUiSketchDraft();
    draft.overallNote = "突出主要操作";
    const reordered = {
      stages: draft.stages,
      texts: draft.texts,
      images: draft.images,
      rectangles: draft.rectangles,
      overallNote: draft.overallNote,
      frame: {
        height: draft.frame.height,
        width: draft.frame.width,
        y: draft.frame.y,
        x: draft.frame.x,
      },
      kind: draft.kind,
      version: draft.version,
    };

    expect(uiSketchDraftFingerprint(reordered)).toBe(uiSketchDraftFingerprint(draft));
    expect(uiSketchDraftFingerprint(draft)).toMatch(/^draft-[0-9a-f]{8}$/);
  });

  it("validates geometry and unique item ids", () => {
    const draft = createUiSketchDraft();
    draft.rectangles.push({
      id: "shared-id",
      x: 20,
      y: 20,
      width: 200,
      height: 100,
      note: "主要区域",
      annotation: "区域批注",
      semanticType: "主内容区",
      origin: "user",
      visible: true,
      weight: "auto",
    });
    draft.texts.push({
      id: "shared-id",
      x: 40,
      y: 40,
      text: "标题",
      fontSize: 24,
      note: "页面标题",
      annotation: "文字批注",
      semanticType: "标题",
      origin: "import",
      visible: true,
      weight: "high",
    });

    expect(() => validateUiSketchDraft(draft)).toThrow(
      "Duplicate UI sketch item id: shared-id.",
    );
    expect(() =>
      validateUiSketchDraft({ ...createUiSketchDraft(), unexpected: true }),
    ).toThrow("contains unknown field");
  });

  it("normalizes missing rectangle metadata from stored v1 drafts", () => {
    const legacyDraft = {
      ...createUiSketchDraft(),
      rectangles: [
        {
          id: "legacy-region",
          x: 20,
          y: 20,
          width: 200,
          height: 100,
          note: "历史区域",
        },
      ],
    };

    expect(validateUiSketchDraft(legacyDraft).rectangles[0]).toMatchObject({
      note: "历史区域",
      annotation: "",
      semanticType: "",
      origin: "user",
      visible: true,
      weight: "auto",
    });
  });

  it("normalizes missing text metadata from stored v1 drafts", () => {
    const legacyDraft = {
      ...createUiSketchDraft(),
      texts: [
        {
          id: "legacy-text",
          x: 40,
          y: 40,
          text: "历史文字",
          fontSize: 24,
        },
      ],
    };

    expect(validateUiSketchDraft(legacyDraft).texts[0]).toMatchObject({
      note: "",
      annotation: "",
      semanticType: "",
      origin: "user",
      visible: true,
      weight: "auto",
    });
  });

  it("preserves supported node origins and rejects unknown origins", () => {
    const draft = createUiSketchDraft();
    draft.rectangles.push({
      id: "projected-region",
      x: 20,
      y: 20,
      width: 200,
      height: 100,
      note: "",
      annotation: "旧界面的动态列表区域",
      semanticType: "project-list",
      origin: "import",
      visible: true,
      weight: "auto",
    });
    draft.texts.push({
      id: "agent-text",
      x: 40,
      y: 40,
      text: "新增说明",
      fontSize: 24,
      note: "",
      annotation: "Agent 新增的固定说明",
      semanticType: "supporting-text",
      origin: "agent",
      visible: true,
      weight: "medium",
    });

    expect(validateUiSketchDraft(draft)).toMatchObject({
      rectangles: [expect.objectContaining({ origin: "import" })],
      texts: [expect.objectContaining({ origin: "agent" })],
    });
    expect(() => validateUiSketchDraft({
      ...draft,
      rectangles: [{ ...draft.rectangles[0], origin: "legacy" }],
    })).toThrow("must be equal to one of");
  });

  it("rejects unsupported rectangle visual weights", () => {
    const draft = createUiSketchDraft();
    draft.rectangles.push({
      id: "invalid-region",
      x: 20,
      y: 20,
      width: 200,
      height: 100,
      note: "错误权重",
      annotation: "",
      semanticType: "",
      origin: "user",
      visible: true,
      weight: "critical" as "auto",
    });

    expect(() => validateUiSketchDraft(draft)).toThrow("must be equal to one of");
  });

  it("rejects unsupported text visual weights", () => {
    const draft = createUiSketchDraft();
    draft.texts.push({
      id: "invalid-text",
      x: 40,
      y: 40,
      text: "标题",
      fontSize: 24,
      note: "错误权重",
      annotation: "",
      semanticType: "",
      origin: "user",
      visible: true,
      weight: "critical" as "auto",
    });

    expect(() => validateUiSketchDraft(draft)).toThrow("must be equal to one of");
  });

  it("copies a stage snapshot and isolates geometry and visibility changes", () => {
    const draft = createUiSketchDraft();
    draft.rectangles.push({
      id: "hero",
      x: 20,
      y: 30,
      width: 200,
      height: 100,
      note: "首屏",
      annotation: "",
      semanticType: "主内容区",
      origin: "import",
      visible: true,
      weight: "high",
    });
    const stageDraft = uiSketchDraftForStage(draft, UI_SKETCH_END_STAGE_ID);
    stageDraft.rectangles[0] = {
      ...stageDraft.rectangles[0]!,
      x: 320,
      width: 280,
      note: "更新后的共享说明",
      visible: false,
    };
    const updated = updateUiSketchStageDraft(draft, UI_SKETCH_END_STAGE_ID, stageDraft);

    expect(uiSketchDraftForStage(updated, "start").rectangles[0]).toMatchObject({
      x: 20,
      width: 200,
      note: "更新后的共享说明",
      origin: "import",
      visible: true,
    });
    expect(uiSketchDraftForStage(updated, UI_SKETCH_END_STAGE_ID).rectangles[0]).toMatchObject({
      x: 320,
      width: 280,
      note: "更新后的共享说明",
      visible: false,
    });
    expect(updated.stages[0]?.id).toBe(UI_SKETCH_END_STAGE_ID);

    const legacyStageDraft = {
      ...updated,
      stages: [{ ...updated.stages[0]!, id: "stage-1" }],
    };
    expect(
      uiSketchDraftForStage(legacyStageDraft, UI_SKETCH_END_STAGE_ID).rectangles[0]?.x,
    ).toBe(320);
  });

  it("keeps image content shared while isolating image stage geometry", () => {
    const draft = createUiSketchDraft();
    draft.images.push({
      id: "hero-image",
      x: 40,
      y: 60,
      width: 320,
      height: 180,
      note: "首屏图片",
      annotation: "",
      semanticType: "主图",
      origin: "agent",
      visible: true,
      weight: "high",
      assetId: "asset-1",
      crop: { x: 0, y: 0, width: 1, height: 1 },
    });
    const end = uiSketchDraftForStage(draft, UI_SKETCH_END_STAGE_ID);
    end.images[0] = {
      ...end.images[0]!,
      x: 500,
      visible: false,
      assetId: "asset-2",
      crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
    };
    const updated = updateUiSketchStageDraft(draft, UI_SKETCH_END_STAGE_ID, end);

    expect(uiSketchDraftForStage(updated, UI_SKETCH_END_STAGE_ID).images[0]).toMatchObject({
      x: 500,
      visible: false,
      assetId: "asset-2",
      crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
    });
    expect(uiSketchDraftForStage(updated, UI_SKETCH_START_STAGE_ID).images[0]).toMatchObject({
      x: 40,
      visible: true,
      assetId: "asset-2",
      crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
    });
  });

  it("applies a cropped image ratio to every stage without changing stage widths", () => {
    const draft = createUiSketchDraft();
    draft.images.push({
      id: "hero-image",
      x: 40,
      y: 60,
      width: 320,
      height: 180,
      note: "首屏图片",
      annotation: "",
      semanticType: "主图",
      origin: "user",
      visible: true,
      weight: "high",
      assetId: "asset-1",
      crop: null,
    });
    const end = uiSketchDraftForStage(draft, UI_SKETCH_END_STAGE_ID);
    end.images[0] = { ...end.images[0]!, width: 240, height: 180 };
    const staged = updateUiSketchStageDraft(draft, UI_SKETCH_END_STAGE_ID, end);
    const crop = { x: 0.1, y: 0.2, width: 0.75, height: 0.5 };
    const updated = updateUiSketchImageCrop(staged, "hero-image", crop, 2);

    expect(uiSketchDraftForStage(updated, UI_SKETCH_START_STAGE_ID).images[0]).toMatchObject({
      width: 320,
      height: 160,
      y: 70,
      crop,
    });
    expect(uiSketchDraftForStage(updated, UI_SKETCH_END_STAGE_ID).images[0]).toMatchObject({
      width: 240,
      height: 120,
      y: 90,
      crop,
    });
    expect(staged.images[0]?.height).toBe(180);
  });
});
