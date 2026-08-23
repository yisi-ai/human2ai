import { validateDraft } from "./draft.ts";
import { areaGeometry, directionLineGeometry } from "./geometry.ts";
import type { CompositionDraft } from "./types.ts";

export function renderCompositionSvg(input: CompositionDraft): string {
  const draft = validateDraft(input);
  const elements = [
    `<rect width="${draft.frame.width}" height="${draft.frame.height}" fill="#ffffff"/>`,
  ];

  for (const area of draft.areas) {
    const geometry = areaGeometry(area, draft.frame);
    if (geometry.type === "circle") {
      elements.push(
        `<circle cx="${format(geometry.cx)}" cy="${format(geometry.cy)}" r="${format(geometry.radius)}" fill="#c8c8c8" stroke="#000000" stroke-width="4"/>`,
      );
    } else {
      elements.push(
        `<polygon points="${geometry.points.map((point) => `${format(point.x)},${format(point.y)}`).join(" ")}" fill="#c8c8c8" stroke="#000000" stroke-width="4"/>`,
      );
    }
  }

  if (draft.directionLine) {
    const line = directionLineGeometry(draft.directionLine, draft.frame);
    elements.push(
      `<line x1="${format(line.start.x)}" y1="${format(line.start.y)}" x2="${format(line.end.x)}" y2="${format(line.end.y)}" stroke="#000000" stroke-width="3"/>`,
    );
  }

  for (const focus of draft.focusPoints) {
    const x = focus.x * draft.frame.width;
    const y = focus.y * draft.frame.height;
    elements.push(
      `<line x1="${format(x - 14)}" y1="${format(y)}" x2="${format(x + 14)}" y2="${format(y)}" stroke="#000000" stroke-width="3"/>`,
      `<line x1="${format(x)}" y1="${format(y - 14)}" x2="${format(x)}" y2="${format(y + 14)}" stroke="#000000" stroke-width="3"/>`,
      `<circle cx="${format(x)}" cy="${format(y)}" r="9" fill="#ffffff" stroke="#000000" stroke-width="3"/>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${draft.frame.width} ${draft.frame.height}" width="${draft.frame.width}" height="${draft.frame.height}" role="img" aria-label="构图草图">
${elements.map((element) => `  ${element}`).join("\n")}
</svg>`;
}

function format(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}
