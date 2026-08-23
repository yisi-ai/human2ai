"use client";

import type { CSSProperties, HTMLAttributes } from "react";
import { useEffect, useRef } from "react";

import "../../styles/tokens.css";
import "../../styles/text-shine.css";

import { tokens } from "../tokens/tokens";
import { uiAssetAttributes } from "../internal/uiAssetAttributes";
import {
  TEXT_MOTION_SPEEDS,
  type TextMotionSpeed,
  textMotionSpeedMultiplier,
} from "../motion/textMotion";

export const TEXT_SHINE_SPEEDS = TEXT_MOTION_SPEEDS;

export type TextShineSpeed = TextMotionSpeed;

export interface TextShineProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "children" | "color"> {
  children: string;
  active?: boolean;
  color?: CSSProperties["color"];
  speed?: TextShineSpeed;
}

type TextShineStyle = CSSProperties & {
  "--yisiui-text-shine-color"?: CSSProperties["color"];
  "--yisiui-text-shine-beam-width"?: string;
};

function numericToken(name: keyof typeof tokens): number {
  const value = Number.parseFloat(String(tokens[name]));
  if (!Number.isFinite(value)) {
    throw new Error(`TextShine token ${name} must resolve to a finite number.`);
  }
  return value;
}

const BEAM_WIDTH = numericToken("component.textShine.beamWidth");
const BASE_VELOCITY = numericToken("component.textShine.baseVelocity");
const SCALE_MEASUREMENT_INTERVAL = 500;

function textShineVelocityPxPerSecond(speed: TextShineSpeed): number {
  return Number((BASE_VELOCITY * textMotionSpeedMultiplier(speed)).toFixed(3));
}

interface TextGeometry {
  localWidth: number;
  viewportScale: number;
}

function measureTextGeometry(root: HTMLSpanElement): TextGeometry {
  const localWidth = root.offsetWidth;
  const viewportWidth = root.getBoundingClientRect().width;
  const viewportScale = localWidth > 0 && viewportWidth > 0 ? viewportWidth / localWidth : 1;
  return { localWidth, viewportScale };
}

export function TextShine({
  children,
  active = true,
  color,
  speed = "medium",
  className,
  style,
  ...spanProps
}: TextShineProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const overlayRef = useRef<HTMLSpanElement>(null);
  const velocity = textShineVelocityPxPerSecond(speed);

  useEffect(() => {
    const root = rootRef.current;
    const overlay = overlayRef.current;
    if (!active || !root || !overlay || !children) {
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let geometry = measureTextGeometry(root);
    let animationFrame = 0;
    let startedAt: number | null = null;
    let lastScaleMeasurement = 0;

    const resetGeometry = () => {
      geometry = measureTextGeometry(root);
      startedAt = null;
      overlay.style.backgroundPositionX = `${-BEAM_WIDTH}px`;
    };

    const drawFrame = (timestamp: number) => {
      if (timestamp - lastScaleMeasurement >= SCALE_MEASUREMENT_INTERVAL) {
        const nextGeometry = measureTextGeometry(root);
        const scaleChanged = Math.abs(nextGeometry.viewportScale - geometry.viewportScale) > 0.01;
        const widthChanged = nextGeometry.localWidth !== geometry.localWidth;
        if (scaleChanged || widthChanged) {
          geometry = nextGeometry;
          startedAt = timestamp;
        }
        lastScaleMeasurement = timestamp;
      }

      if (startedAt === null) {
        startedAt = timestamp;
      }

      const localDistance = geometry.localWidth + BEAM_WIDTH;
      const viewportDistance = localDistance * geometry.viewportScale;
      const travelDuration = viewportDistance / velocity * 1000;
      const elapsed = travelDuration > 0 ? (timestamp - startedAt) % travelDuration : 0;
      const progress = travelDuration > 0 ? elapsed / travelDuration : 1;
      const position = -BEAM_WIDTH + localDistance * progress;
      overlay.style.backgroundPositionX = `${position}px`;
      animationFrame = window.requestAnimationFrame(drawFrame);
    };

    const syncMotionPreference = () => {
      if (animationFrame !== 0) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      resetGeometry();
      if (!reducedMotion.matches) {
        animationFrame = window.requestAnimationFrame(drawFrame);
      }
    };

    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(resetGeometry);
    resizeObserver?.observe(root);
    syncMotionPreference();
    reducedMotion.addEventListener("change", syncMotionPreference);

    return () => {
      reducedMotion.removeEventListener("change", syncMotionPreference);
      resizeObserver?.disconnect();
      if (animationFrame !== 0) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [active, children, velocity]);

  const rootStyle: TextShineStyle = {
    ...style,
    ...(color === undefined ? {} : { "--yisiui-text-shine-color": color }),
    "--yisiui-text-shine-beam-width": `${BEAM_WIDTH}px`,
  };

  return (
    <span
      {...spanProps}
      {...uiAssetAttributes("text-shine", "TextShine", "motion")}
      ref={rootRef}
      className={[
        "yisi-text-shine",
        active ? "yisi-text-shine-active" : "yisi-text-shine-inactive",
        `yisi-text-shine-speed-${speed}`,
        className,
      ].filter(Boolean).join(" ")}
      data-yisi-text-shine-speed={speed}
      data-yisi-text-shine-velocity={velocity}
      style={rootStyle}
    >
      <span className="yisi-text-shine-base">{children}</span>
      {active && children ? (
        <span ref={overlayRef} className="yisi-text-shine-overlay" aria-hidden="true">
          {children}
        </span>
      ) : null}
    </span>
  );
}
