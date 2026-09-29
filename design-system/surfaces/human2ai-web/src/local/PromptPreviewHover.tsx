"use client";

import { Popover } from "antd";
import { useEffect, useState, type ReactNode } from "react";
import { LoadingState } from "../vendor/yisiui/runtime/src/components/LoadingState";
import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";
import "./PromptPreviewHover.css";

export interface PromptPreviewHoverProps {
  readPrompt(): string | Promise<string>;
  label: string;
  loadingLabel: string;
  errorLabel: string;
  disabled?: boolean;
  children: ReactNode;
}

function PromptContent({ readPrompt, label, loadingLabel, errorLabel }: PromptPreviewHoverProps) {
  const [result, setResult] = useState<{ reader: typeof readPrompt; text?: string; failed?: boolean }>();
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(readPrompt).then(text => {
      if (!cancelled) setResult({ reader: readPrompt, text });
    }, () => {
      if (!cancelled) setResult({ reader: readPrompt, failed: true });
    });
    return () => { cancelled = true; };
  }, [readPrompt]);
  return <div className="human2ai-prompt-preview-hover__content" role="region" aria-label={label} tabIndex={0}>
    {result?.reader !== readPrompt ? <LoadingState label={loadingLabel} rows={4} compact />
      : result.failed ? <p role="alert">{errorLabel}</p>
        : <pre>{result.text}</pre>}
  </div>;
}

/** Reads text only while the local hover/focus popup is mounted. */
export function PromptPreviewHover(props: PromptPreviewHoverProps) {
  return <Popover placement="top" trigger={["hover", "focus"]} destroyOnHidden
    getPopupContainer={trigger => trigger.ownerDocument.body}
    styles={{ root: { position: "fixed" } }}
    title={props.label} open={props.disabled ? false : undefined}
    content={() => <PromptContent {...props} />}>
    <span className="human2ai-prompt-preview-hover" {...uiAssetAttributes({
      namespace: "human2ai", id: "prompt-preview-hover", name: "PromptPreviewHover",
      category: "module", origin: "project", status: "candidate",
    })}>{props.children}</span>
  </Popover>;
}
