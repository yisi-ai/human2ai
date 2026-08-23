"use client";

import { Button, Flex } from "antd";
import type { ReactNode } from "react";

import "../../styles/tokens.css";
import "../../styles/form-actions.css";

import { uiAssetAttributes } from "../internal/uiAssetAttributes";

export interface FormActionsProps {
  onCancel?: () => void;
  cancelLabel?: string;
  primaryLabel?: string;
  primaryLoading?: boolean;
  primaryDisabled?: boolean;
  primaryIcon?: ReactNode;
  children?: ReactNode;
  onSubmit?: () => void;
}

export function FormActions({ onCancel, cancelLabel = "取消", primaryLabel = "保存", primaryLoading = false, primaryDisabled = false, primaryIcon, children, onSubmit }: FormActionsProps) {
  return (
    <Flex
      {...uiAssetAttributes("form-actions", "FormActions", "pattern")}
      className="yisi-form-actions"
      justify="end"
      align="center"
      wrap
      gap={8}
    >
      {children}
      {onCancel ? <Button onClick={onCancel}>{cancelLabel}</Button> : null}
      <Button type="primary" icon={primaryIcon} loading={primaryLoading} disabled={primaryDisabled} onClick={onSubmit}>
        {primaryLabel}
      </Button>
    </Flex>
  );
}
