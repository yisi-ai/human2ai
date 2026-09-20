import { describe, expect, it } from "vitest";
import { createAppI18n } from "../../web/i18n/createI18n.ts";

const retiredKeys = [
  "actions.back",
  "app.yisiuiReady",
  "canvasNodeEditor.annotation",
  "canvasNodeEditor.annotationPlaceholder",
  "canvasNodeEditor.imageKind",
  "canvasNodeEditor.semanticType",
  "canvasNodeEditor.semanticTypePlaceholder",
  "canvasNodeEditor.textKind",
  "composition.addCircle",
  "composition.addElements",
  "composition.addFocus",
  "composition.addQuadrilateral",
  "composition.addTriangle",
  "composition.deleteSelected",
  "composition.description",
  "composition.dragHint",
  "composition.editSelected",
  "composition.kicker",
  "composition.larger",
  "composition.properties",
  "composition.rotateLeft",
  "composition.rotateRight",
  "composition.rotation",
  "composition.session.notSaved",
  "composition.session.revision",
  "composition.session.unsavedChanges",
  "composition.size",
  "composition.smaller",
  "composition.title",
  "composition.workflow.draftReadyMessage",
  "composition.workflow.errorMessage",
  "composition.workflow.processingMessage",
  "composition.workflow.staleMessage",
  "composition.workflow.waitingMessage",
  "navigation.home"
] as const;

describe("retired legacy translations", () => {
  it.each(retiredKeys)("does not load the retired key %s", (key) => {
    for (const locale of ["zh-CN", "en"] as const) {
      expect(createAppI18n(locale).exists(key), locale).toBe(false);
    }
  });

  it("preserves the unresolved service error and active replacement labels", () => {
    for (const locale of ["zh-CN", "en"] as const) {
      const i18n = createAppI18n(locale);
      for (const key of [
        "uiSketch.session.serviceOutdated",
        "uiSketch.canvasLabels.text",
        "canvas.imageNode.label",
        "canvasNodeEditor.title",
        "canvasNodeEditor.shapeKind",
        "canvasNodeEditor.pointKind",
        "composition.toolNames.textRegion",
      ]) {
        expect(i18n.exists(key), key).toBe(true);
      }
    }
  });
});
