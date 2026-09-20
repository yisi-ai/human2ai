const sharedPromptKeys: Record<string, string> = {
  globalNoteHeading: "notes.global.promptHeading",
  note: "notes.element.prompt",
  displayText: "textContent.prompt",
  visualWeight: "visualWeight.prompt",
  weightAuto: "visualWeight.auto",
  weightHigh: "visualWeight.high",
  weightMedium: "visualWeight.medium",
  weightLow: "visualWeight.low",
  weightDecorative: "visualWeight.decorative",
};

const compositionPromptKeys: Record<string, string> = {
  shotScale: "composition.depth.prompt",
  foreground: "composition.depth.foreground",
  midground: "composition.depth.midground",
  background: "composition.depth.background",
  processingSemantic: "composition.mode.prompt",
  sceneComposition: "composition.mode.scene",
  editorialLayout: "composition.mode.editorial",
  unselected: "composition.mode.unselected",
  unselectedGuidance: "composition.mode.unselectedGuidance",
  sceneGuidance: "composition.mode.sceneGuidance",
  editorialGuidance: "composition.mode.editorialGuidance",
  imageHeading: "canvas.imageNode.promptHeading",
  flowHeading: "composition.flow.promptHeading",
  flowReference: "composition.flow.promptReference",
};

const uiSketchPromptKeys: Record<string, string> = {
  stateName: "uiSketch.states.defaultName",
  visible: "uiSketch.canvasLabels.visible",
  hidden: "uiSketch.canvasLabels.hidden",
};

// Exporters use local message roles; callers resolve those roles to shared or
// domain-specific translation keys without duplicating locale entries.
export function promptTranslationKey(
  domain: "composition" | "uiSketch",
  key: string,
): string {
  return sharedPromptKeys[key]
    ?? (domain === "composition" ? compositionPromptKeys[key] : uiSketchPromptKeys[key])
    ?? `${domain}.prompt.${key}`;
}
