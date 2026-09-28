"use client";

import { useCallback, type ReactNode } from "react";
import type { CompositionDraft } from "../../../../../src/domain/composition";
import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";
import { renderCompositionSketchSvg } from "./compositionExport";
import { CanvasPreviewHover } from "./CanvasPreviewHover";

export interface CompositionPreviewHoverProps {
  draft: CompositionDraft;
  resolveImageSource?: (assetId: string) => string | undefined;
  label: string;
  disabled?: boolean;
  children: ReactNode;
}

export function CompositionPreviewHover({ draft, resolveImageSource, label, disabled, children }: CompositionPreviewHoverProps) {
  const renderSvg = useCallback(() => renderCompositionSketchSvg(draft, resolveImageSource), [draft, resolveImageSource]);
  return (
    <span className="human2ai-composition-preview-hover" {...uiAssetAttributes({
      namespace: "human2ai", id: "composition-preview-hover", name: "CompositionPreviewHover",
      category: "module", origin: "project", status: "candidate",
    })}>
      <CanvasPreviewHover renderSvg={renderSvg} label={label} disabled={disabled}>
        {children}
      </CanvasPreviewHover>
    </span>
  );
}
