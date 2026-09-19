"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { CSSProperties, SVGProps } from "react";

import "../../styles/animated-icon.css";
import { uiAssetAttributes } from "../internal/uiAssetAttributes";
import { IconGlyph } from "../icons/glyphs";
import type { AnimatedIconName } from "../icons/catalog";
export { animatedIconCatalog } from "../icons/catalog";
export type { AnimatedIconName } from "../icons/catalog";

export interface AnimatedIconHandle {
  /** Starts from the default pose, including when already playing. */
  play: () => void;
  /** Immediately restores the default pose, also stopping loops. */
  stop: () => void;
}

export interface AnimatedIconProps extends Omit<SVGProps<SVGSVGElement>, "name" | "children" | "ref" | "onAnimationEnd"> {
  name: AnimatedIconName;
  size?: number | string;
  /** Omit for decorative use, including inside an already labelled button. */
  label?: string;
  loop?: boolean;
  /** Change this value to replay once. Initial value does not autoplay. */
  playKey?: number | string;
  /** Duration of one cycle in milliseconds. */
  duration?: number;
  motion?: "auto" | "none";
  /** Called after a single complete playback, not on stop or for loops. */
  onAnimationComplete?: () => void;
}

export const AnimatedIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(function AnimatedIcon({
  name, size = "1em", label, loop = false, playKey, duration = 720, motion = "auto",
  onAnimationComplete, className, style, ...svgProps
}, ref) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [run, setRun] = useState({ id: 0, playing: false });
  const svgRef = useRef<SVGSVGElement>(null);
  const lastPlayKey = useRef(playKey);
  const motionEnabled = motion !== "none" && !reducedMotion;
  const cycleDuration = Number.isFinite(duration) && duration > 0 ? duration : 720;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const play = useCallback(() => {
    if (!motionEnabled) return;
    setRun((current) => ({ id: current.id + 1, playing: true }));
  }, [motionEnabled]);
  const stop = useCallback(() => setRun((current) => ({ ...current, playing: false })), []);
  useImperativeHandle(ref, () => ({ play, stop }), [play, stop]);

  useEffect(() => {
    setRun((current) => ({ id: current.id + 1, playing: loop && motionEnabled }));
  }, [name, loop, motionEnabled]);

  useEffect(() => {
    if (playKey !== lastPlayKey.current && playKey !== undefined) play();
    lastPlayKey.current = playKey;
  }, [playKey, play]);

  useEffect(() => {
    const svg = svgRef.current;
    const complete = (event: Event) => {
      if (loop || !run.playing || !motionEnabled || !(event.target instanceof SVGElement)
        || event.target.getAttribute("data-animated-icon-part") !== "motion") return;
      stop();
      onAnimationComplete?.();
    };
    svg?.addEventListener("animationend", complete);
    return () => svg?.removeEventListener("animationend", complete);
  }, [loop, motionEnabled, run.playing, onAnimationComplete, stop]);

  return (
    <svg
      {...svgProps}
      ref={svgRef}
      {...uiAssetAttributes("animated-icon", "AnimatedIcon")}
      className={["yisi-animated-icon", className].filter(Boolean).join(" ")}
      data-icon={name}
      data-playing={run.playing && motionEnabled ? "true" : "false"}
      data-loop={loop ? "true" : "false"}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={svgProps.strokeWidth ?? 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      style={{ "--yisiui-animated-icon-duration": `${cycleDuration}ms`, ...style } as CSSProperties}
    >
      <IconGlyph key={`${name}:${run.id}`} name={name} />
    </svg>
  );
});
AnimatedIcon.displayName = "AnimatedIcon";
