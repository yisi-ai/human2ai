"use client";

import { Button, Popconfirm } from "antd";
import type { ButtonProps } from "antd";
import type { ReactNode } from "react";

import "../../styles/tokens.css";
import "../../styles/confirm-action.css";

import { uiAssetAttributes } from "../internal/uiAssetAttributes";

export interface ConfirmActionProps extends Omit<ButtonProps, "onClick" | "title"> {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  onConfirm: () => void | Promise<void>;
  confirmLabel?: string;
  cancelLabel?: string;
  scopeLabel?: ReactNode;
}

export function ConfirmAction({
  title,
  description,
  children,
  onConfirm,
  confirmLabel = "确认",
  cancelLabel = "取消",
  scopeLabel,
  danger = true,
  ...buttonProps
}: ConfirmActionProps) {
  return (
    <Popconfirm
      title={title}
      description={
        scopeLabel || description ? (
          <div className="yisi-confirm-action-description">
            {scopeLabel ? <strong>{scopeLabel}</strong> : null}
            {description ? <span>{description}</span> : null}
          </div>
        ) : undefined
      }
      okText={confirmLabel}
      cancelText={cancelLabel}
      okButtonProps={{ danger }}
      onConfirm={onConfirm}
    >
      <Button
        {...buttonProps}
        {...uiAssetAttributes("confirm-action", "ConfirmAction", "action-pattern")}
        danger={danger}
      >
        {children}
      </Button>
    </Popconfirm>
  );
}
