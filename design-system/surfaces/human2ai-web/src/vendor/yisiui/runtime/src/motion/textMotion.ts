import { tokens } from "../tokens/tokens";

export const TEXT_MOTION_SPEEDS = ["slow", "medium", "fast"] as const;

export type TextMotionSpeed = (typeof TEXT_MOTION_SPEEDS)[number];

function numericToken(name: keyof typeof tokens): number {
  const value = Number.parseFloat(String(tokens[name]));
  if (!Number.isFinite(value)) {
    throw new Error(`Motion token ${name} must resolve to a finite number.`);
  }
  return value;
}

export const TEXT_MOTION_SPEED_MULTIPLIERS: Readonly<Record<TextMotionSpeed, number>> = {
  slow: numericToken("motion.textSpeed.slow"),
  medium: numericToken("motion.textSpeed.medium"),
  fast: numericToken("motion.textSpeed.fast"),
};

export function textMotionSpeedMultiplier(speed: TextMotionSpeed): number {
  if (!TEXT_MOTION_SPEEDS.includes(speed)) {
    throw new Error(`Text motion speed must be one of: ${TEXT_MOTION_SPEEDS.join(", ")}.`);
  }
  const multiplier = TEXT_MOTION_SPEED_MULTIPLIERS[speed];
  if (multiplier <= 0) {
    throw new Error(`Motion token motion.textSpeed.${speed} must be greater than 0.`);
  }
  return multiplier;
}
