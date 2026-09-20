"use client";

import { CheckOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { BasicButton } from "./BasicButton";
import type { BasicButtonProps } from "./BasicButton";
import { UiAssetAttributeScope } from "../internal/uiAssetAttributeScope";
import { uiAssetAttributes } from "../internal/uiAssetAttributes";
import "../../styles/action-button.css";

export type ActionButtonStatus = "idle" | "pending" | "success" | "error";
export type ActionButtonMotion = "auto" | "none";

export interface ActionButtonProps
  extends Omit<
    BasicButtonProps,
    "children" | "icon" | "iconLabel" | "loading" | "mode" | "onClick"
  > {
  label: string;
  pendingLabel: string;
  successLabel: string;
  errorLabel: string;
  onAction: () => void | Promise<void>;
  idleIcon?: ReactNode;
  successIcon?: ReactNode;
  errorIcon?: ReactNode;
  feedbackDurationMs?: number | null;
  motion?: ActionButtonMotion;
  onStatusChange?: (status: ActionButtonStatus) => void;
  onActionError?: (error: unknown) => void;
}

function feedbackIcon(className: string, icon: ReactNode): ReactNode {
  return <span className={className}>{icon}</span>;
}

export function ActionButton({
  label,
  pendingLabel,
  successLabel,
  errorLabel,
  onAction,
  idleIcon,
  successIcon = <CheckOutlined />,
  errorIcon = <CloseCircleOutlined />,
  feedbackDurationMs = 1600,
  motion = "auto",
  onStatusChange,
  onActionError,
  className,
  disabled,
  ...buttonProps
}: ActionButtonProps) {
  const [status, setStatus] = useState<ActionButtonStatus>("idle");
  const mountedRef = useRef(true);
  const executingRef = useRef(false);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  function transitionTo(nextStatus: ActionButtonStatus): void {
    if (!mountedRef.current) return;
    setStatus(nextStatus);
    onStatusChange?.(nextStatus);
  }

  function clearResetTimer(): void {
    if (resetTimerRef.current === null) return;
    window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = null;
  }

  function scheduleReset(): void {
    if (!mountedRef.current || feedbackDurationMs === null) return;
    resetTimerRef.current = window.setTimeout(() => {
      resetTimerRef.current = null;
      transitionTo("idle");
    }, Math.max(0, feedbackDurationMs));
  }

  async function handleAction(): Promise<void> {
    if (executingRef.current) return;
    executingRef.current = true;
    clearResetTimer();
    transitionTo("pending");

    try {
      await onAction();
      if (!mountedRef.current) return;
      transitionTo("success");
      scheduleReset();
    } catch (error) {
      if (!mountedRef.current) return;
      transitionTo("error");
      onActionError?.(error);
      scheduleReset();
    } finally {
      executingRef.current = false;
    }
  }

  const currentLabel = status === "pending"
    ? pendingLabel
    : status === "success"
      ? successLabel
      : status === "error"
        ? errorLabel
        : label;
  const currentIcon = status === "success"
    ? feedbackIcon("yisi-action-button-feedback-icon", successIcon)
    : status === "error"
      ? feedbackIcon("yisi-action-button-feedback-icon", errorIcon)
      : idleIcon;
  const pending = status === "pending";

  return (
    <UiAssetAttributeScope attributes={uiAssetAttributes("action-button", "ActionButton")}>
      <>
        <BasicButton
          {...buttonProps}
          aria-label={buttonProps["aria-label"] ?? currentLabel}
          aria-busy={pending || undefined}
          className={[
            "yisi-action-button",
            `yisi-action-button-motion-${motion}`,
            className,
          ].filter(Boolean).join(" ")}
          data-action-status={status}
          disabled={disabled || pending}
          icon={currentIcon}
          loading={pending}
          mode="with-icon"
          onClick={() => void handleAction()}
        >
          <span data-yisiui-slot="label">{currentLabel}</span>
        </BasicButton>
        <span
          aria-atomic="true"
          aria-live="polite"
          className="yisi-action-button-announcement"
          role="status"
        >
          {status === "idle" ? "" : currentLabel}
        </span>
      </>
    </UiAssetAttributeScope>
  );
}
