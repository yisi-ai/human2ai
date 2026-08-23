"use client";

import { CheckOutlined, CopyOutlined } from "@ant-design/icons";
import { Button } from "antd";
import type { ButtonProps } from "antd";
import { useEffect, useRef, useState } from "react";

import { uiAssetAttributes } from "../internal/uiAssetAttributes";

export type CopyActionWriter = (content: string) => Promise<void>;

export interface CopyActionProps extends Omit<ButtonProps, "children" | "icon" | "loading" | "onClick"> {
  content?: string;
  loadContent?: () => Promise<string>;
  label: string;
  copiedLabel?: string;
  emptyMessage?: string;
  errorMessage?: string;
  resetDelayMs?: number;
  writeText?: CopyActionWriter;
  onCopied?: () => void;
  onCopyError?: (message: string, error: unknown) => void;
}

async function writeToClipboard(content: string): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    throw new Error("当前浏览器不支持复制到剪贴板。");
  }
  await navigator.clipboard.writeText(content);
}

export function CopyAction({
  content,
  loadContent,
  label,
  copiedLabel = "已复制",
  emptyMessage = "没有可复制的内容。",
  errorMessage = "复制失败。",
  resetDelayMs = 1600,
  writeText = writeToClipboard,
  onCopied,
  onCopyError,
  disabled,
  ...buttonProps
}: CopyActionProps) {
  const [status, setStatus] = useState<"idle" | "copied">("idle");
  const [isCopying, setIsCopying] = useState(false);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
  }, []);

  async function handleCopy(): Promise<void> {
    setIsCopying(true);
    try {
      const nextContent = loadContent ? await loadContent() : content;
      if (!nextContent?.trim()) {
        throw new Error(emptyMessage);
      }
      await writeText(nextContent);
      setStatus("copied");
      onCopied?.();
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = window.setTimeout(() => {
        setStatus("idle");
        resetTimerRef.current = null;
      }, resetDelayMs);
    } catch (copyError) {
      setStatus("idle");
      const message = copyError instanceof Error ? copyError.message : errorMessage;
      onCopyError?.(message, copyError);
    } finally {
      setIsCopying(false);
    }
  }

  return (
    <Button
      {...buttonProps}
      {...uiAssetAttributes("copy-action", "CopyAction", "component")}
      disabled={disabled || isCopying}
      icon={status === "copied" ? <CheckOutlined /> : <CopyOutlined />}
      loading={isCopying}
      onClick={() => void handleCopy()}
    >
      {status === "copied" ? copiedLabel : label}
    </Button>
  );
}
