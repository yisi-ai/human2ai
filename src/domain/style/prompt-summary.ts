export const MAX_STYLE_PROMPT_SUMMARY_LENGTH = 240;

// Compatibility for styles saved before a dedicated prompt sentence existed.
export function defaultStylePromptSummary(description: string): string {
  const sentence = description.trim().split(/\r?\n|(?<=[。！？])|(?<=[.!?])\s/u)
    .find((line) => line.trim())?.trim() ?? "";
  const characters = [...sentence.replace(/\s+/gu, " ")];
  return characters.length <= MAX_STYLE_PROMPT_SUMMARY_LENGTH
    ? characters.join("")
    : `${characters.slice(0, MAX_STYLE_PROMPT_SUMMARY_LENGTH - 1).join("")}…`;
}
