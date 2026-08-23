"use client";

import { Button } from "antd";
import type { ButtonProps } from "antd";
import type { CSSProperties, ReactNode } from "react";

import { uiAssetAttributes } from "../internal/uiAssetAttributes";
import { tokens, type TokenName } from "../tokens/tokens";

export type BasicButtonMode = "with-icon" | "without-icon" | "icon-only";
export type BasicButtonColorToken = Extract<TokenName, `color.${string}`>;
export type BasicButtonBackground = BasicButtonColorToken | "none";
export type BasicButtonTextColor = BasicButtonColorToken | "none";

export const basicButtonColorTokens = Object.keys(tokens).filter(
  (tokenName): tokenName is BasicButtonColorToken => tokenName.startsWith("color."),
);

export interface BasicButtonProps extends Omit<ButtonProps, "children" | "icon" | "style"> {
  children?: ReactNode;
  icon?: ReactNode;
  mode?: BasicButtonMode;
  backgroundColor?: BasicButtonBackground;
  textColor?: BasicButtonTextColor;
  iconLabel?: string;
  style?: CSSProperties;
}

function resolveTokenColor(tokenName: BasicButtonColorToken): string {
  return String(tokens[tokenName]);
}

export function BasicButton({
  children,
  icon,
  mode = "without-icon",
  backgroundColor,
  textColor,
  iconLabel,
  style,
  "aria-label": ariaLabel,
  ...buttonProps
}: BasicButtonProps) {
  const tokenStyle: CSSProperties = {
    ...(backgroundColor === "none"
      ? {
          backgroundColor: "transparent",
          border: "none",
          boxShadow: "none",
        }
      : backgroundColor
        ? {
            backgroundColor: resolveTokenColor(backgroundColor),
            borderColor: resolveTokenColor(backgroundColor),
          }
        : {}),
    ...(textColor && textColor !== "none" ? { color: resolveTokenColor(textColor) } : {}),
  };

  return (
    <Button
      {...buttonProps}
      {...uiAssetAttributes("basic-button", "BasicButton", "component")}
      aria-label={mode === "icon-only" ? iconLabel ?? ariaLabel : ariaLabel}
      icon={mode === "without-icon" ? undefined : icon}
      style={{ ...tokenStyle, ...style }}
    >
      {mode === "icon-only" ? undefined : children}
    </Button>
  );
}
