import {
  compositionPlanGeometry,
  frameBoundsInCanvas,
  inspectComposition,
  renderCompositionReferenceSvg,
  validateDraft,
  type CompositionDraft,
} from "../../../../../src/domain/composition/index.ts";

export type CompositionSketchCopyResult = "copied" | "downloaded";

export type CompositionPromptKey =
  | "planningHeading" | "planningGuidance" | "planningGrid" | "planningSymmetry"
  | "planningSpiral" | "planningTriangle" | "planningRadial" | "planningRadialFree" | "planningThirds" | "planningGoldenSection"
  | "planningBoth" | "planningHorizontal" | "planningVertical"
  | "planningClockwise" | "planningCounterclockwise"
  | "title"
  | "outputRatio"
  | "processingSemantic"
  | "unselected"
  | "sceneComposition"
  | "editorialLayout"
  | "unselectedGuidance"
  | "sceneGuidance"
  | "editorialGuidance"
  | "regionSemanticsGuidance"
  | "displayTextGuidance"
  | "generatedDisplayText"
  | "layoutHeading"
  | "coordinateOrigin"
  | "referenceValues"
  | "flexibleImplementation"
  | "referenceImageGuidance"
  | "globalNoteHeading"
  | "metricsHeading"
  | "occupied"
  | "negativeSpace"
  | "focusHeading"
  | "focusNumber"
  | "areaHeading"
  | "areaNumber"
  | "lightSourceNumber"
  | "lightSourceGuidance"
  | "lightBandGuidance"
  | "imageHeading"
  | "imageNumber"
  | "textRegionNumber"
  | "flowHeading"
  | "note"
  | "displayText"
  | "visualWeight"
  | "weightHigh"
  | "weightMedium"
  | "weightLow"
  | "weightDecorative"
  | "shotScale"
  | "foreground"
  | "midground"
  | "background"
  | "referencePosition"
  | "referenceArea"
  | "referenceRotation"
  | "referenceClipping"
  | "flowReference"
  | "sideSeparator"
  | "top"
  | "right"
  | "bottom"
  | "left";

export type CompositionPromptTranslator = (
  key: CompositionPromptKey,
  values?: Record<string, string | number>,
) => string;

export function buildCompositionPrompt(
  input: CompositionDraft,
  translate: CompositionPromptTranslator,
  stylePrompt?: string,
): string {
  const draft = validateDraft(input);
  const inspection = inspectComposition(draft);
  const plans = draft.plans ?? [];
  const planningLines = plans.flatMap((plan) => {
    let description: string;
    if (plan.type === "thirds" || plan.type === "golden-section") {
      description = translate("planningGrid", {
        type: translate(plan.type === "thirds" ? "planningThirds" : "planningGoldenSection"),
        axes: translate(plan.axes === "both" ? "planningBoth" : plan.axes === "horizontal" ? "planningHorizontal" : "planningVertical"),
      });
    } else if (plan.type === "triangle") {
      const frame = frameBoundsInCanvas(draft.frame);
      description = translate("planningTriangle", { points: compositionPlanGeometry(plan, draft.frame).handles
        .map((point) => `(${percentage((point.x - frame.x) / frame.width)}%, ${percentage((point.y - frame.y) / frame.height)}%)`).join("; ") });
    } else if (plan.type === "radial") {
      description = plan.mode === "free" ? translate("planningRadialFree", {
        x: percentage(plan.x), y: percentage(plan.y), rayCount: plan.angles.length,
        angles: plan.angles.map((angle) => `${Math.round(angle * 10) / 10}°`).join(", "),
      }) : translate("planningRadial", {
        x: percentage(plan.x), y: percentage(plan.y), rotation: Math.round(plan.rotation * 10) / 10,
        rayCount: plan.rayCount, spread: Math.round(plan.spread * 10) / 10,
      });
    } else if (plan.type === "symmetry" || plan.type === "golden-spiral") {
      description = translate(plan.type === "symmetry" ? "planningSymmetry" : "planningSpiral", {
        x: percentage(plan.x), y: percentage(plan.y), rotation: Math.round(plan.rotation * 10) / 10,
        ...(plan.type === "golden-spiral" ? { scale: percentage(plan.scale), winding: translate(plan.mirrored ? "planningCounterclockwise" : "planningClockwise") } : {}),
      });
    } else return [];
    return [description];
  });
  const hasTextRegions = inspection.areas.some(
    (area) => area.semanticType === "text-region",
  );
  const divisor = greatestCommonDivisor(draft.frame.width, draft.frame.height);
  const focusSections = inspection.focusPoints.map((focus, index) => [
    translate("focusNumber", { index: index + 1 }),
    ...metadataLines(focus, translate),
    translate("referencePosition", {
      x: percentage(focus.x),
      y: percentage(focus.y),
    }),
  ]);
  const areaSections = inspection.areas.map((area, index) => [
    translate(
      area.isLightSource ? "lightSourceNumber" : area.semanticType === "text-region" ? "textRegionNumber" : "areaNumber",
      { index: index + 1 },
    ),
    ...metadataLines(area, translate),
    ...(area.isLightSource && area.primitive === "quadrilateral"
      ? [translate("lightBandGuidance")]
      : []),
    ...(area.displayText?.trim()
      ? [translate("displayText", { text: area.displayText.trim() })]
      : area.semanticType === "text-region"
        ? [translate("generatedDisplayText")]
        : []),
    ...(area.visualWeight === "auto"
      ? []
      : [translate("visualWeight", {
          weight: translate(visualWeightPromptKey(area.visualWeight)),
        })]),
    translate("referencePosition", {
      x: percentage(area.center.x),
      y: percentage(area.center.y),
    }),
    ...(area.isLightSource ? [] : [translate("referenceArea", {
      area: percentage(area.visibleAreaShare),
    })]),
    ...(!area.isLightSource && Math.abs(area.rotation) > 1e-6
      ? [translate("referenceRotation", { rotation: Math.round(area.rotation) })]
      : []),
    ...(!area.isLightSource && area.clippedSides.length
      ? [translate("referenceClipping", {
          sides: area.clippedSides
            .map((side) => translate(side))
            .join(translate("sideSeparator")),
        })]
      : []),
  ]);
  const imageSections = inspection.images.map((image, index) => [
    translate("imageNumber", { index: index + 1 }),
    ...metadataLines(image, translate),
    ...(image.visualWeight === "auto"
      ? []
      : [translate("visualWeight", {
          weight: translate(visualWeightPromptKey(image.visualWeight)),
        })]),
    translate("referencePosition", {
      x: percentage(image.center.x),
      y: percentage(image.center.y),
    }),
    translate("referenceArea", { area: percentage(image.areaShare) }),
    ...(Math.abs(image.rotation) > 1e-6
      ? [translate("referenceRotation", { rotation: Math.round(image.rotation) })]
      : []),
    ...(image.clippedSides.length
      ? [translate("referenceClipping", {
          sides: image.clippedSides
            .map((side) => translate(side))
            .join(translate("sideSeparator")),
        })]
      : []),
  ]);
  const directionLines = inspection.directionLine
    ? [
        translate("flowHeading"),
        ...metadataLines(inspection.directionLine, translate),
        translate("flowReference", {
          x: percentage(inspection.directionLine.x),
          y: percentage(inspection.directionLine.y),
          rotation: Math.round(inspection.directionLine.rotation),
        }),
      ]
    : [];

  return [
    translate("title"),
    "",
    translate("outputRatio", {
      ratio: `${draft.frame.width / divisor}:${draft.frame.height / divisor}`,
    }),
    translate("processingSemantic", {
      semantic: translate(
        draft.processingSemantic === "editorial-layout"
          ? "editorialLayout"
          : draft.processingSemantic === "scene-composition"
            ? "sceneComposition"
            : "unselected",
      ),
    }),
    "",
    translate("layoutHeading"),
    translate(
      draft.processingSemantic === "editorial-layout"
        ? "editorialGuidance"
        : draft.processingSemantic === "scene-composition"
          ? "sceneGuidance"
          : "unselectedGuidance",
    ),
    translate("regionSemanticsGuidance"),
    ...(inspection.areas.some((area) => area.isLightSource)
      ? [translate("lightSourceGuidance")]
      : []),
    ...(hasTextRegions
      ? [translate("displayTextGuidance")]
      : []),
    translate("coordinateOrigin"),
    translate("referenceValues"),
    translate("flexibleImplementation"),
    translate("referenceImageGuidance"),
    ...(inspection.overallNote.trim()
      ? ["", translate("globalNoteHeading"), inspection.overallNote.trim()]
      : []),
    ...(stylePrompt?.trim() ? ["", stylePrompt.trim()] : []),
    ...(plans.length ? ["", translate("planningHeading"), translate("planningGuidance"), ...planningLines] : []),
    ...(inspection.areas.length
      ? [
          "",
          translate("metricsHeading"),
          translate("occupied", { value: percentage(inspection.metrics.occupiedArea) }),
          translate("negativeSpace", { value: percentage(inspection.metrics.negativeSpace) }),
        ]
      : []),
    ...(focusSections.length ? ["", translate("focusHeading")] : []),
    ...focusSections.flatMap((section) => ["", ...section]),
    ...(areaSections.length ? ["", translate("areaHeading")] : []),
    ...areaSections.flatMap((section) => ["", ...section]),
    ...(imageSections.length ? ["", translate("imageHeading")] : []),
    ...imageSections.flatMap((section) => ["", ...section]),
    ...(directionLines.length ? ["", ...directionLines] : []),
  ].join("\n").trimEnd();
}

function visualWeightPromptKey(
  weight: Exclude<CompositionDraft["areas"][number]["visualWeight"], "auto">,
): "weightHigh" | "weightMedium" | "weightLow" | "weightDecorative" {
  if (weight === "high") return "weightHigh";
  if (weight === "medium") return "weightMedium";
  if (weight === "low") return "weightLow";
  return "weightDecorative";
}

export async function copyCompositionSketchPng(
  draft: CompositionDraft,
  resolveImageSource?: (assetId: string) => string | undefined,
): Promise<CompositionSketchCopyResult> {
  const png = await renderCompositionSketchPng(draft, resolveImageSource);
  if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
    return "copied";
  }
  downloadBlob(png, "composition-sketch.png");
  return "downloaded";
}

export async function renderCompositionSketchPng(
  draft: CompositionDraft,
  resolveImageSource?: (assetId: string) => string | undefined,
): Promise<Blob> {
  const validated = validateDraft(draft);
  const svg = renderCompositionSketchSvg(validated, resolveImageSource);
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = validated.frame.width;
    canvas.height = validated.frame.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The browser could not create the composition canvas.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await canvasBlob(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function renderCompositionSketchSvg(
  input: CompositionDraft,
  resolveImageSource?: (assetId: string) => string | undefined,
): string {
  return renderCompositionReferenceSvg(input, resolveImageSource);
}

function metadataLines(
  item: { note: string; shotScale: CompositionDraft["areas"][number]["shotScale"] },
  translate: CompositionPromptTranslator,
): string[] {
  return [
    ...(item.note.trim() ? [translate("note", { note: item.note.trim() })] : []),
    ...(item.shotScale === "auto"
      ? []
      : [translate("shotScale", { shotScale: translate(item.shotScale) })]),
  ];
}

function percentage(value: number): number {
  return Math.round(value * 100);
}

function greatestCommonDivisor(left: number, right: number): number {
  let dividend = Math.abs(left);
  let divisor = Math.abs(right);
  while (divisor !== 0) {
    [dividend, divisor] = [divisor, dividend % divisor];
  }
  return dividend || 1;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The browser could not render the composition sketch."));
    image.src = url;
  });
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The browser could not generate the composition PNG."));
    }, "image/png");
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
