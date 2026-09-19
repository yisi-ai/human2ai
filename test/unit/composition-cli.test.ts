import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { executeCli, isMainModule } from "../../src/cli/main.js";
import {
  addArea,
  addFocus,
  createDraft,
  draftFingerprint,
  framePointToCanvas,
  setProcessingSemantic,
} from "../../src/domain/composition/index.js";

describe("composition CLI", () => {
  it("recognizes an npm-style symlink as the CLI entrypoint", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "human2ai-cli-link-"));
    const entrypoint = path.join(directory, "human2ai");
    try {
      await symlink(path.resolve("src/cli/main.ts"), entrypoint);
      expect(isMainModule(entrypoint)).toBe(true);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("lets an Agent inspect methods, view a draft, and apply an explicit plan", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "human2ai-composition-cli-"));
    try {
      let draft = addFocus(
        setProcessingSemantic(createDraft(), "scene-composition"),
        { x: 0.49, y: 0.54 },
      ).draft;
      draft = addArea(draft, {
        primitive: "triangle",
        area: 0.1,
        x: 0.5,
        y: 0.6,
      }).draft;
      const draftPath = path.join(directory, "draft.json");
      const planPath = path.join(directory, "plan.json");
      const inspectionPreview = path.join(directory, "inspection.svg");
      const resultPath = path.join(directory, "result.json");
      const resultPreview = path.join(directory, "refined.svg");
      await writeFile(draftPath, JSON.stringify(draft), "utf8");
      await writeFile(
        planPath,
        JSON.stringify({
          version: 1,
          kind: "composition-refinement-plan",
          sourceFingerprint: draftFingerprint(draft),
          rationale: "Agent selects the optical center after reviewing the draft.",
          operations: [
            {
              method: "focus-anchor",
              methodVersion: 1,
              targetFocusId: "focus-1",
              anchor: "optical-center",
              strength: "subtle",
            },
          ],
        }),
        "utf8",
      );

      const methods = (await executeCli(["composition", "methods"])) as {
        decisionOwner: string;
        methods: Array<{ id: string }>;
        planSchema: object;
      };
      expect(methods.decisionOwner).toBe("agent");
      expect(methods.methods.map((method) => method.id)).toEqual([
        "focus-anchor", "axis-relation", "rotation-alignment", "block-alignment",
        "spacing-rhythm", "frame-placement", "size-ratio", "mirror-symmetry", "focus-flow",
      ]);
      expect(methods.planSchema).toHaveProperty("$defs");

      const inspection = (await executeCli([
        "composition",
        "inspect",
        "--draft",
        draftPath,
        "--preview",
        inspectionPreview,
      ])) as { sourceFingerprint: string; artifacts: { previewSvg: string } };
      expect(inspection.sourceFingerprint).toBe(draftFingerprint(draft));
      expect(inspection.artifacts.previewSvg).toBe(inspectionPreview);
      expect(await readFile(inspectionPreview, "utf8")).toMatch(/^<svg/);

      const result = (await executeCli([
        "composition",
        "apply",
        "--draft",
        draftPath,
        "--plan",
        planPath,
        "--output",
        resultPath,
        "--preview",
        resultPreview,
      ])) as { audit: { passed: boolean }; refinedDraft: { focusPoints: Array<{ y: number }> } };
      expect(result.audit.passed).toBe(true);
      expect(result.refinedDraft.focusPoints[0].y).toBe(
        framePointToCanvas({ x: 0.5, y: 0.55 }, draft.frame).y,
      );
      expect(JSON.parse(await readFile(resultPath, "utf8"))).toMatchObject({
        kind: "composition-refinement-result",
        audit: { passed: true },
      });
      expect(await readFile(resultPreview, "utf8")).toMatch(/^<svg/);

      await expect(
        executeCli([
          "composition",
          "apply",
          "--draft",
          draftPath,
          "--plan",
          planPath,
          "--output",
          draftPath,
        ]),
      ).rejects.toThrow(/must not overwrite the draft/i);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("exposes an unselected mode and refuses to refine until the user chooses", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "human2ai-composition-mode-"));
    try {
      const draft = createDraft();
      const draftPath = path.join(directory, "draft.json");
      const planPath = path.join(directory, "plan.json");
      await writeFile(draftPath, JSON.stringify(draft), "utf8");
      await writeFile(planPath, JSON.stringify({
        version: 1,
        kind: "composition-refinement-plan",
        sourceFingerprint: draftFingerprint(draft),
        rationale: "The Agent must ask the user before selecting a mode.",
        operations: [],
      }), "utf8");

      const inspection = (await executeCli([
        "composition",
        "inspect",
        "--draft",
        draftPath,
      ])) as { processingSemantic: string | null };
      expect(inspection.processingSemantic).toBeNull();

      await expect(executeCli([
        "composition",
        "apply",
        "--draft",
        draftPath,
        "--plan",
        planPath,
      ])).rejects.toThrow(/mode is not selected.*ask the user/i);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("reports a stable error when the local session service is unavailable", async () => {
    const unavailableFetch = (() =>
      Promise.reject(new Error("connection refused"))) as typeof fetch;

    await expect(
      executeCli(
        ["composition", "drafts", "--session", "session-1"],
        { fetch: unavailableFetch },
      ),
    ).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      status: null,
    });
  });
});
