import { describe, expect, it } from "vitest";
import {
  addArea, auditRefinement, compositionStates, createCompositionState, createDraft, draftFingerprint,
  inspectComposition, selectCompositionState, setCompositionPreviewMode, validateDraft,
} from "../../src/domain/composition/index.ts";
import { CanvasEditHistory } from "../../src/domain/session/canvas-edit-history.ts";
import { buildCompositionPrompt } from "../../design-system/surfaces/human2ai-web/src/local/compositionExport.ts";
import { promptTranslationKey } from "../../locales/promptKeys.ts";
import { createAppI18n } from "../../web/i18n/createI18n.ts";

describe("composition preview mode", () => {
  it("starts new drafts in soft mode and preserves saved selections", () => {
    expect(createDraft().previewMode).toBe("soft");
    expect(validateDraft(createDraft()).previewMode).toBe("soft");
    expect(validateDraft({ ...createDraft(), previewMode: "precise" }).previewMode).toBe("precise");
  });

  it("defaults old drafts to precise without changing their fingerprint or structure", () => {
    const draft = createDraft();
    delete draft.previewMode;
    expect(validateDraft(draft)).not.toHaveProperty("previewMode");
    expect(inspectComposition(draft).previewMode).toBe("precise");
    expect(draftFingerprint({ ...draft, previewMode: "precise" })).toBe(draftFingerprint(draft));
    expect(draftFingerprint(setCompositionPreviewMode(draft, "soft"))).not.toBe(draftFingerprint(draft));
    expect(() => validateDraft({ ...draft, previewMode: "invalid" })).toThrow();
  });

  it("preserves node identities and retains the setting across states, history and serialization", () => {
    const draft = addArea(setCompositionPreviewMode(createDraft(), "precise"), { primitive: "triangle" }).draft;
    const soft = setCompositionPreviewMode(draft, "soft");
    expect(soft.areas).toBe(draft.areas);
    expect(soft.frame).toBe(draft.frame);
    expect(setCompositionPreviewMode(soft, "soft")).toBe(soft);
    const second = createCompositionState(soft, compositionStates(soft)[0].id, "second");
    expect(selectCompositionState(second, second.states![0].id).previewMode).toBe("soft");
    expect(validateDraft(JSON.parse(JSON.stringify(second))).previewMode).toBe("soft");
    const history = new CanvasEditHistory(draft);
    history.record(soft);
    expect(inspectComposition(history.undo()!.draft).previewMode).toBe("precise");
    expect(history.redo()!.draft.previewMode).toBe("soft");
    expect(auditRefinement(soft, { ...soft, previewMode: "precise" }).failedChecks).toContain("preserved.previewMode");
  });

  it.each(["zh-CN", "en"] as const)("gives agents consistent precise and soft instructions in %s", locale => {
    const i18n = createAppI18n(locale);
    const draft = addArea(createDraft(), { primitive: "quadrilateral" }).draft;
    draft.areas[0].isLightSource = true;
    const prompt = (mode: "precise" | "soft") => buildCompositionPrompt(setCompositionPreviewMode(draft, mode), (key, values) => {
      const path = promptTranslationKey("composition", key);
      expect(i18n.exists(path)).toBe(true);
      return i18n.t(path, values);
    });
    const precise = prompt("precise");
    const soft = prompt("soft");
    expect(precise).toContain(i18n.t("composition.previewMode.preciseGuidance"));
    expect(precise).toContain(i18n.t("composition.previewMode.preciseLightGuidance"));
    expect(precise).not.toContain(i18n.t("composition.prompt.flexibleImplementation"));
    expect(precise).not.toContain(i18n.t("composition.prompt.lightBandGuidance"));
    expect(soft).toContain(i18n.t("composition.prompt.flexibleImplementation"));
    expect(soft).toContain(i18n.t("composition.prompt.lightBandGuidance"));
    expect(soft).not.toContain(i18n.t("composition.previewMode.preciseGuidance"));
  });
});
