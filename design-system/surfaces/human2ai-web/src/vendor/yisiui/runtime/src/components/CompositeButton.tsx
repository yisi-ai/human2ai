"use client";

import { Button, Tooltip, Typography } from "antd";
import type { ButtonProps } from "antd";
import type { AriaAttributes, ReactNode } from "react";
import { createContext, useContext } from "react";

import "../../styles/tokens.css";
import "../../styles/composite-button.css";

import { uiAssetAttributes } from "../internal/uiAssetAttributes";
import { tokens, type TokenName } from "../tokens/tokens";

export type CompositeButtonColorToken = Extract<TokenName, `color.${string}`>;
export type CompositeButtonTextColor = CompositeButtonColorToken | "none";

export interface CompositeButtonAction {
  key: string;
  icon: ReactNode;
  label: string;
  onClick?: ButtonProps["onClick"];
  disabled?: boolean;
  loading?: ButtonProps["loading"];
}

export interface CompositeButtonProps {
  label: ReactNode;
  icon: ReactNode;
  description?: ReactNode;
  actions?: readonly CompositeButtonAction[];
  onClick?: ButtonProps["onClick"];
  textColor?: CompositeButtonTextColor;
  collapsed?: boolean;
  /** Required when collapsed and label is not plain text. */
  collapsedLabel?: string;
  "aria-current"?: AriaAttributes["aria-current"];
  "aria-label"?: AriaAttributes["aria-label"];
  title?: string;
  disabled?: boolean;
  loading?: ButtonProps["loading"];
  className?: string;
}

const CompositeButtonCollapseContext = createContext(false);

export interface CompositeButtonCollapseProviderProps {
  collapsed: boolean;
  children: ReactNode;
}

export function CompositeButtonCollapseProvider({
  collapsed,
  children,
}: CompositeButtonCollapseProviderProps) {
  return (
    <CompositeButtonCollapseContext.Provider value={collapsed}>
      {children}
    </CompositeButtonCollapseContext.Provider>
  );
}

function resolveTokenColor(tokenName: CompositeButtonColorToken): string {
  return String(tokens[tokenName]);
}

export function CompositeButton({
  label,
  icon,
  description,
  actions = [],
  onClick,
  textColor = "color.text.primary",
  collapsed,
  collapsedLabel,
  "aria-current": ariaCurrent,
  "aria-label": ariaLabel,
  title,
  disabled = false,
  loading = false,
  className,
}: CompositeButtonProps) {
  const inheritedCollapsed = useContext(CompositeButtonCollapseContext);
  const isCollapsed = collapsed ?? inheritedCollapsed;
  const resolvedCollapsedLabel =
    collapsedLabel ?? ariaLabel ?? (typeof label === "string" ? label : title);
  const resolvedTextColor = textColor === "none" ? undefined : resolveTokenColor(textColor);
  const actionTextColor = resolveTokenColor("color.text.secondary");

  if (isCollapsed && !resolvedCollapsedLabel) {
    throw new Error("CompositeButton collapsed state requires a plain-text label or collapsedLabel");
  }

  const mainButton = (
    <Button
      className="yisi-composite-button-main"
      size="small"
      type="text"
      icon={icon}
      aria-current={ariaCurrent}
      aria-label={isCollapsed ? resolvedCollapsedLabel : ariaLabel}
      title={isCollapsed ? undefined : title}
      disabled={disabled}
      loading={loading}
      onClick={onClick}
      style={resolvedTextColor ? { color: resolvedTextColor } : undefined}
    >
      {isCollapsed ? null : (
        <Typography.Text className="yisi-composite-button-label" style={{ color: "inherit" }}>
          {label}
        </Typography.Text>
      )}
    </Button>
  );

  return (
    <div
      {...uiAssetAttributes("composite-button", "CompositeButton", "component")}
      className={
        [
          "yisi-composite-button",
          isCollapsed ? "yisi-composite-button--collapsed" : null,
          !isCollapsed && actions.length ? "yisi-composite-button--has-actions" : null,
          className,
        ]
          .filter(Boolean)
          .join(" ")
      }
      data-collapsed={isCollapsed ? "true" : "false"}
    >
      {isCollapsed ? (
        <Tooltip title={resolvedCollapsedLabel} placement="right">
          {mainButton}
        </Tooltip>
      ) : mainButton}

      {!isCollapsed && description ? (
        <Typography.Text
          className="yisi-composite-button-description"
          type="secondary"
          style={{ color: "var(--yisiui-color-text-muted)" }}
        >
          {description}
        </Typography.Text>
      ) : null}

      {!isCollapsed && actions.length ? (
        <div className="yisi-composite-button-actions" role="group" aria-label="行操作">
          {actions.map((action) => (
            <Button
              key={action.key}
              className="yisi-composite-button-action"
              size="small"
              type="text"
              icon={action.icon}
              aria-label={action.label}
              title={action.label}
              disabled={disabled || action.disabled}
              loading={action.loading}
              onClick={action.onClick}
              style={{ color: actionTextColor }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
