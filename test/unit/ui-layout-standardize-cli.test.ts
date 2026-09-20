import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { executeCli } from "../../src/cli/main.js";
import { createUiSketchDraft, uiSketchDraftFingerprint, validateUiSketchDraft } from "../../src/domain/ui-sketch/index.js";

describe("UI layout standardize CLI", () => {
  it("writes a validated document and reports changes without mutating the source or using the service", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "human2ai-standardize-"));
    try {
      const input = path.join(directory, "source.json");
      const output = path.join(directory, "standardized.json");
      const planPath = path.join(directory, "plan.json");
      const source = validateUiSketchDraft({
        ...createUiSketchDraft(),
        rectangles: [
          { id: "a", x: 10, y: 20, width: 100, height: 50 },
          { id: "b", x: 12.2, y: 100, width: 100.2, height: 50.4 },
        ],
      });
      await writeFile(input, JSON.stringify(source));
      await writeFile(planPath, JSON.stringify({
        sourceFingerprint: uiSketchDraftFingerprint(source),
        alignments: [{ stageId: "start", axis: "x", edge: "start", anchorId: "a", itemIds: ["b"] }],
      }));
      const report = await executeCli([
        "ui-layout", "standardize", "--input", input, "--output", output, "--plan", planPath,
      ], { fetch: () => { throw new Error("Standardization must be local."); } });
      expect(report).toMatchObject({ kind: "ui-layout-standardization-result", outputPath: output, changes: [{ id: "b", after: { x: 10, width: 100, height: 50 } }] });
      const standardized = validateUiSketchDraft(JSON.parse(await readFile(output, "utf8")));
      expect(standardized.rectangles[1]!.x).toBe(10);
      expect(JSON.parse(await readFile(input, "utf8"))).toEqual(source);
      await expect(executeCli(["ui-layout", "standardize", "--input", input, "--output", input])).rejects.toThrow("differ");
      await expect(executeCli(["ui-layout", "standardize", "--input", input, "--output", output, "--session", "wrong"])).rejects.toThrow();
      source.rectangles[1]!.x = 100;
      await writeFile(input, JSON.stringify(source));
      await expect(executeCli(["ui-layout", "standardize", "--input", input, "--output", output, "--plan", planPath])).rejects.toThrow("stale");
      expect(JSON.parse(await readFile(output, "utf8"))).toEqual(standardized);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
