"use client";

import { Popover } from "antd";
import { useId, useMemo, type ReactNode } from "react";
import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";
import "./CanvasPreviewHover.css";

export interface CanvasPreviewHoverProps {
  renderSvg: () => string;
  label: string;
  disabled?: boolean;
  children: ReactNode;
}

function PreviewImage({ renderSvg, label }: CanvasPreviewHoverProps) {
  const id = useId().replace(/:/g, "");
  const markup = useMemo(() => ({ __html: renderSvg()
    .replace(/\bid="([^"]+)"/g, `id="${id}-$1"`)
    .replace(/\bhref="#([^"]+)"/g, `href="#${id}-$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${id}-$1)`) }), [renderSvg, id]);
  return <div className="human2ai-canvas-preview-hover__image" role="img"
    aria-label={label} dangerouslySetInnerHTML={markup} />;
}

/** Popover owns transient hover/focus state; the image mounts only while open. */
export function CanvasPreviewHover(props: CanvasPreviewHoverProps) {
  return (
    <Popover placement="left" trigger={["hover", "focus"]} destroyOnHidden
      open={props.disabled ? false : undefined}
      content={() => <PreviewImage {...props} />}>
      <span className="human2ai-canvas-preview-hover" {...uiAssetAttributes({
        namespace: "human2ai", id: "canvas-preview-hover", name: "CanvasPreviewHover",
        category: "module", origin: "project", status: "candidate",
      })}>
        {props.children}
      </span>
    </Popover>
  );
}
