import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

import "../../styles/tokens.css";
import "../../styles/decorative-title.css";

import { uiAssetAttributes } from "../internal/uiAssetAttributes";

export type DecorativeTitleVariant = "blue" | "mint" | "amber" | "rose";
export type DecorativeTitlePattern = "arcs" | "waves" | "dots" | "none";
export interface DecorativeTitleColors {
  border?: string;
  iconBackground?: string;
  background?: string;
  text?: string;
  icon?: string;
  decoration?: string;
}
export interface DecorativeTitleProps
  extends Omit<HTMLAttributes<HTMLElement>, "title" | "children" | "color"> {
  title: ReactNode;
  /** Decorative, non-interactive icon; the title supplies the accessible name. */
  icon?: ReactNode;
  as?: "div" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  variant?: DecorativeTitleVariant;
  pattern?: DecorativeTitlePattern;
  /** Optional non-interactive artwork. null hides the decoration. */
  decoration?: ReactNode;
  colors?: DecorativeTitleColors;
}

const patterns: Record<DecorativeTitleVariant, DecorativeTitlePattern> = {
  blue: "arcs", mint: "waves", amber: "dots", rose: "arcs",
};
const colorProperties: Record<keyof DecorativeTitleColors, string> = {
  border: "--yisiui-decorative-title-border",
  iconBackground: "--yisiui-decorative-title-icon-background",
  background: "--yisiui-decorative-title-background",
  text: "--yisiui-decorative-title-text",
  icon: "--yisiui-decorative-title-icon-color",
  decoration: "--yisiui-decorative-title-decoration-color",
};

function Pattern({ pattern }: { pattern: DecorativeTitlePattern }) {
  if (pattern === "none") return null;
  return (
    <svg viewBox="0 0 160 96" fill="none" aria-hidden="true" focusable="false">
      {pattern === "arcs" ? (
        <g stroke="currentColor" strokeWidth="2">
          {[26, 42, 58, 74].map((radius) => <circle key={radius} cx="138" cy="48" r={radius} />)}
        </g>
      ) : pattern === "waves" ? (
        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {[8, 28, 48, 68].map((y) => <path key={y} d={`M12 ${y} Q42 ${y - 20} 72 ${y} T132 ${y} T192 ${y}`} />)}
        </g>
      ) : (
        <g fill="currentColor">
          {[28, 52, 76, 100, 124, 148].flatMap((x) => [18, 42, 66, 90].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="3" />))}
        </g>
      )}
    </svg>
  );
}

export function DecorativeTitle({
  title, icon, as: Root = "div", variant = "blue", pattern = patterns[variant],
  decoration, colors, className, style, ...rootProps
}: DecorativeTitleProps) {
  const colorStyle = Object.fromEntries(
    Object.entries(colors ?? {}).filter(([, value]) => value !== undefined)
      .map(([key, value]) => [colorProperties[key as keyof DecorativeTitleColors], value]),
  ) as CSSProperties;
  const artwork = decoration === undefined ? <Pattern pattern={pattern} /> : decoration;
  return (
    <Root
      {...rootProps}
      {...uiAssetAttributes("decorative-title", "DecorativeTitle")}
      className={["yisi-decorative-title", className].filter(Boolean).join(" ")}
      data-variant={variant}
      style={{ ...colorStyle, ...style }}
    >
      {artwork && (decoration !== undefined || pattern !== "none") ? (
        <span className="yisi-decorative-title-decoration" data-yisiui-slot="decoration" aria-hidden="true">
          {artwork}
        </span>
      ) : null}
      <span className="yisi-decorative-title-icon" data-yisiui-slot="icon" aria-hidden="true">{icon}</span>
      <span className="yisi-decorative-title-text" data-yisiui-slot="title" title={typeof title === "string" ? title : undefined}>{title}</span>
    </Root>
  );
}
