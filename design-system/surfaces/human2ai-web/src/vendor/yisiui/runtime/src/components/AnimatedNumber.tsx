"use client";

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import "../../styles/tokens.css";
import "../../styles/animated-number.css";

import { uiAssetAttributes } from "../internal/uiAssetAttributes";

export type AnimatedNumberMotion = "auto" | "always" | "none";

export interface AnimatedNumberProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  value: number;
  unit?: ReactNode;
  fontSize?: number | string;
  color?: CSSProperties["color"];
  fontWeight?: CSSProperties["fontWeight"];
  precision?: number;
  duration?: number;
  motion?: AnimatedNumberMotion;
}

const DEFAULT_DURATION = 220;
const PLACE_DURATION_STEP = 120;
const MAX_PRECISION = 20;
const DIGITS = Array.from({ length: 10 }, (_, digit) => String(digit));

type NumberToken =
  | { kind: "digit"; key: string; digit: number; placeIndex: number }
  | { kind: "static"; key: string; value: string; className: string };

interface AnimatedDigitProps {
  digit: number;
  placeIndex: number;
  duration: number;
  motion: AnimatedNumberMotion;
}

function normalizePrecision(precision: number | undefined): number | undefined {
  if (precision === undefined) {
    return undefined;
  }
  if (!Number.isInteger(precision) || precision < 0 || precision > MAX_PRECISION) {
    throw new Error(`AnimatedNumber precision must be an integer between 0 and ${MAX_PRECISION}.`);
  }
  return precision;
}

function normalizeDuration(duration: number | undefined): number {
  const resolvedDuration = duration ?? DEFAULT_DURATION;
  if (!Number.isFinite(resolvedDuration) || resolvedDuration < 0) {
    throw new Error("AnimatedNumber duration must be a finite number greater than or equal to 0.");
  }
  return resolvedDuration;
}

function formatValue(value: number, precision: number | undefined): string {
  if (!Number.isFinite(value)) {
    throw new Error("AnimatedNumber value must be a finite number.");
  }

  const options: Intl.NumberFormatOptions = {
    useGrouping: false,
    ...(precision === undefined
      ? { maximumFractionDigits: MAX_PRECISION }
      : { minimumFractionDigits: precision, maximumFractionDigits: precision }),
  };
  return new Intl.NumberFormat("en-US", options).format(value);
}

function buildTokens(formattedValue: string): NumberToken[] {
  const characters = Array.from(formattedValue);
  const placeIndexes = new Map<number, number>();
  let placeIndex = 0;

  for (let index = characters.length - 1; index >= 0; index -= 1) {
    if (/^[0-9]$/.test(characters[index])) {
      placeIndexes.set(index, placeIndex);
      placeIndex += 1;
    }
  }

  return characters.map((character, index) => {
    const currentPlaceIndex = placeIndexes.get(index);
    if (currentPlaceIndex !== undefined) {
      return {
        kind: "digit",
        key: `digit-${currentPlaceIndex}`,
        digit: Number(character),
        placeIndex: currentPlaceIndex,
      };
    }

    return {
      kind: "static",
      key: character === "." ? "decimal" : character === "-" ? "sign" : `static-${index}`,
      value: character,
      className: character === "." ? "decimal" : character === "-" ? "sign" : "static",
    };
  });
}

function toCssLength(value: number | string): string {
  if (typeof value === "number") {
    return `${value}px`;
  }

  return /^-?(?:\d+\.?\d*|\.\d+)$/.test(value.trim()) ? `${value}px` : value;
}

function accessibleUnitText(unit: ReactNode): string {
  return typeof unit === "string" || typeof unit === "number" || typeof unit === "bigint" ? String(unit) : "";
}

function AnimatedDigit({ digit, placeIndex, duration, motion }: AnimatedDigitProps) {
  const [displayDigit, setDisplayDigit] = useState(digit);

  useEffect(() => {
    setDisplayDigit(digit);
  }, [digit]);

  const digitDuration = motion === "none" ? 0 : duration + placeIndex * PLACE_DURATION_STEP;
  const trackStyle = {
    transform: `translateY(-${displayDigit * 10}%)`,
    "--yisiui-animated-number-duration": `${digitDuration}ms`,
  } as CSSProperties;

  return (
    <span className="yisi-animated-number-digit" aria-hidden="true">
      <span className="yisi-animated-number-digit-track" style={trackStyle}>
        {DIGITS.map((currentDigit) => (
          <span className="yisi-animated-number-digit-glyph" key={currentDigit}>
            {currentDigit}
          </span>
        ))}
      </span>
    </span>
  );
}

export function AnimatedNumber({
  value,
  unit,
  fontSize,
  color,
  fontWeight,
  precision,
  duration,
  motion = "auto",
  className,
  style,
  "aria-live": ariaLive,
  "aria-atomic": ariaAtomic,
  ...spanProps
}: AnimatedNumberProps) {
  const resolvedPrecision = normalizePrecision(precision);
  const resolvedDuration = normalizeDuration(duration);
  const formattedValue = useMemo(
    () => formatValue(value, resolvedPrecision),
    [resolvedPrecision, value],
  );
  const tokens = useMemo(() => buildTokens(formattedValue), [formattedValue]);
  const visualStyle: CSSProperties = {
    ...style,
    ...(fontSize === undefined ? {} : { fontSize: toCssLength(fontSize) }),
    ...(color === undefined ? {} : { color }),
    ...(fontWeight === undefined ? {} : { fontWeight }),
  };
  const accessibleText = `${formattedValue}${accessibleUnitText(unit)}`;

  return (
    <span
      {...spanProps}
      {...uiAssetAttributes("animated-number", "AnimatedNumber", "component")}
      className={[
        "yisi-animated-number",
        `yisi-animated-number-motion-${motion}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-live={ariaLive ?? "off"}
      aria-atomic={ariaAtomic ?? true}
      style={visualStyle}
    >
      <span className="yisi-animated-number-visual" aria-hidden="true">
        {tokens.map((token) =>
          token.kind === "digit" ? (
            <AnimatedDigit
              key={token.key}
              digit={token.digit}
              placeIndex={token.placeIndex}
              duration={resolvedDuration}
              motion={motion}
            />
          ) : (
            <span
              key={token.key}
              className={`yisi-animated-number-static yisi-animated-number-static-${token.className}`}
            >
              {token.value}
            </span>
          ),
        )}
      </span>
      {unit === undefined || unit === null ? null : (
        <span className="yisi-animated-number-unit" aria-hidden="true">
          {unit}
        </span>
      )}
      <span className="yisi-animated-number-accessible">{accessibleText}</span>
    </span>
  );
}
