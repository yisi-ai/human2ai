"use client";

import { Button } from "antd";
import type { ButtonProps } from "antd";
import type { CSSProperties, ReactNode } from "react";
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";

import "../../styles/tokens.css";
import "../../styles/basic-button.css";

import { useUiAssetAttributes } from "../internal/uiAssetAttributeScope";
import { uiAssetAttributes } from "../internal/uiAssetAttributes";
import { tokens, type TokenName } from "../tokens/tokens";

export type BasicButtonMode = "with-icon" | "without-icon" | "icon-only" | "hover-text";
export type BasicButtonColorToken = Extract<TokenName, `color.${string}`>;
export type BasicButtonBackground = BasicButtonColorToken | "none";
export type BasicButtonTextColor = BasicButtonColorToken | "none";

export const basicButtonColorTokens = Object.keys(tokens).filter(
  (tokenName): tokenName is BasicButtonColorToken => tokenName.startsWith("color."),
);

export interface BasicButtonProps extends Omit<ButtonProps, "children" | "icon" | "style"> {
  children?: ReactNode;
  icon?: ReactNode;
  /** hover-text expands from an icon square to text on hover or keyboard focus. */
  mode?: BasicButtonMode;
  backgroundColor?: BasicButtonBackground;
  textColor?: BasicButtonTextColor;
  iconLabel?: string;
  style?: CSSProperties;
}

function resolveTokenColor(tokenName: BasicButtonColorToken): string {
  return String(tokens[tokenName]);
}

export const BasicButton = forwardRef<HTMLButtonElement | HTMLAnchorElement, BasicButtonProps>(function BasicButton({
  children,
  icon,
  mode = "without-icon",
  backgroundColor,
  textColor,
  iconLabel,
  style,
  "aria-label": ariaLabel,
  ...buttonProps
}: BasicButtonProps, forwardedRef) {
  const buttonRef = useRef<HTMLButtonElement | HTMLAnchorElement>(null);
  // Expose the same DOM node used for hover-text measurements to popup triggers.
  // Run after each commit so switching between a button and a link updates refs too.
  useImperativeHandle(forwardedRef, () => buttonRef.current!);
  const labelRef = useRef<HTMLSpanElement>(null);
  const hoverLabel = children ?? iconLabel ?? ariaLabel;
  const hasHoverLabel = hoverLabel != null && hoverLabel !== "" && typeof hoverLabel !== "boolean";
  const hoverMode = mode === "hover-text" && icon != null && icon !== false && hasHoverLabel;
  const iconOnly = mode === "icon-only" || (mode === "hover-text" && !hasHoverLabel);

  useLayoutEffect(() => {
    if (!hoverMode) return;
    const button = buttonRef.current;
    const label = labelRef.current;
    if (!button || !label) return;
    const measure = () => {
      const css = getComputedStyle(button);
      const length = (value: string) => Number.parseFloat(value) || 0;
      const collapsed = button.offsetHeight;
      if (!collapsed) return;
      const padding = length(css.paddingLeft) + length(css.paddingRight);
      const border = length(css.borderLeftWidth) + length(css.borderRightWidth);
      const expanded = Math.max(collapsed, Math.ceil(label.scrollWidth + padding + border));
      for (const [name, value] of [["collapsed", collapsed], ["expanded", expanded]] as const) {
        const property = `--yisiui-basic-button-${name}-width`;
        const next = `${value}px`;
        if (button.style.getPropertyValue(property) !== next) button.style.setProperty(property, next);
      }
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    observer?.observe(button);
    observer?.observe(label);
    window.addEventListener("resize", measure);
    document.fonts?.addEventListener("loadingdone", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      document.fonts?.removeEventListener("loadingdone", measure);
      button.style.removeProperty("--yisiui-basic-button-collapsed-width");
      button.style.removeProperty("--yisiui-basic-button-expanded-width");
    };
  }, [hoverMode, hoverLabel, buttonProps.size, buttonProps.shape, buttonProps.className, style]);

  const assetAttributes = useUiAssetAttributes(
    uiAssetAttributes("basic-button", "BasicButton", "component"),
  );
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

  // Ant Design passes the effective disabled/loading values (including context
  // and loading.delay) to semantic classNames. Keep its request/click behavior.
  const hoverClassNames: ButtonProps["classNames"] = (info) => {
    const provided = typeof buttonProps.classNames === "function" ? buttonProps.classNames(info) : buttonProps.classNames;
    return {
      ...provided,
      root: [
        provided?.root,
        "yisi-basic-button-hover-text",
        info.props.disabled && "yisi-basic-button-hover-disabled",
        info.props.loading && "yisi-basic-button-hover-loading",
        info.props.block && "yisi-basic-button-hover-block",
      ].filter(Boolean).join(" "),
      icon: [provided?.icon, "yisi-basic-button-hover-icon"].filter(Boolean).join(" "),
    };
  };
  const accessibleLabel = mode === "hover-text"
    ? iconLabel ?? ariaLabel ?? (typeof hoverLabel === "string" || typeof hoverLabel === "number" ? String(hoverLabel) : undefined)
    : mode === "icon-only" ? iconLabel ?? ariaLabel : ariaLabel;

  return (
    <Button
      {...buttonProps}
      {...assetAttributes}
      ref={buttonRef}
      aria-label={accessibleLabel}
      classNames={hoverMode ? hoverClassNames : buttonProps.classNames}
      autoInsertSpace={hoverMode ? false : buttonProps.autoInsertSpace}
      icon={mode === "without-icon" ? undefined : hoverMode ? <span aria-hidden="true">{icon}</span> : icon}
      style={{ ...tokenStyle, ...style }}
    >
      {hoverMode ? <span ref={labelRef} className="yisi-basic-button-hover-label">{hoverLabel}</span> : iconOnly ? undefined : mode === "hover-text" ? hoverLabel : children}
    </Button>
  );
});
