import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { executeCli, type CliDependencies } from "../../src/cli/main.ts";
import {
  canvasPointToFrame,
  moveItem,
  removeItem,
  updateItemMetadata,
  validateDraft,
  type CompositionDraft,
} from "../../src/domain/composition/index.ts";
import { createHuman2AiServer } from "../../src/server/runtime.ts";

const guide = await readFile("skills/human2ai/references/composition-projection.md", "utf8");
const examples = [...guide.matchAll(/```json\n([\s\S]*?)\n```/g)].map((match) =>
  validateDraft(JSON.parse(match[1])));

it("provides executable draft examples for both composition modes", () => {
  expect(examples.map((draft) => draft.processingSemantic).sort()).toEqual([
    "editorial-layout", "scene-composition",
  ]);
  for (const draft of examples) {
    expect(draft.overallNote).toBe("");
    for (const node of [
      ...draft.areas, ...draft.focusPoints, ...(draft.directionLine ? [draft.directionLine] : []),
    ]) {
      expect(node.origin).toBe("import");
      expect(node.note).toBe("");
      expect(node.annotation).not.toBe("");
    }
    for (const area of draft.areas) {
      const shapeFactor = area.primitive === "circle" ? Math.PI / 4
        : area.primitive === "triangle" ? 0.5 : 1;
      expect(area.area).toBeCloseTo(area.width! * area.height! * shapeFactor);
      const point = canvasPointToFrame(area, draft.frame);
      expect(point.x).toBeGreaterThan(0);
      expect(point.x).toBeLessThan(1);
      expect(point.y).toBeGreaterThan(0);
      expect(point.y).toBeLessThan(1);
    }
  }
});

describe.each(examples)("$processingSemantic reference projection", (draft) => {
  it("round-trips an imported composition through user edits, Agent continuation, conflict and undo", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "human2ai-projection-"));
    const server = createHuman2AiServer({ databasePath: ":memory:", artifactsDirectory: directory });
    const dependencies: CliDependencies = {
      serviceUrl: "http://human2ai.test",
      webUrl: "http://human2ai.test",
      fetch: async (input, init) => {
        const url = new URL(input instanceof Request ? input.url : input.toString());
        const response = await server.inject({
          method: (init?.method ?? "GET") as "GET" | "POST",
          url: `${url.pathname}${url.search}`,
          payload: typeof init?.body === "string" ? init.body : undefined,
          headers: { "content-type": "application/json" },
        });
        return new Response(response.body, { status: response.statusCode });
      },
    };
    const cli = (args: string[]) => executeCli(args, dependencies);
    const inputPath = path.join(directory, "draft.json");
    try {
      const session = await cli([
        "session", "create", "--type", "image-composition", "--title", "Reference projection",
      ]) as { id: string };
      const capture = ["--session", session.id, "--kind", "composition-draft"];
      await writeFile(inputPath, JSON.stringify(draft));
      const first = await cli([
        "capture", "save", ...capture, "--input", inputPath, "--expected-revision", "0",
      ]) as { revision: number; document: CompositionDraft };
      expect(first).toMatchObject({ revision: 1, document: draft });
      expect(await cli(["session", "connect", "--session", session.id])).toMatchObject({
        capture: { latest: { revision: 1 } },
        ui: { editUrl: `http://human2ai.test/composition/?session=${session.id}` },
      });

      const subject = first.document.areas[0];
      const userDraft = updateItemMetadata(
        removeItem(first.document, first.document.areas.at(-1)!.id),
        subject.id,
        { note: "保留此区域，向右移动一点" },
      );
      const userSave = await server.inject({
        method: "POST",
        url: `/api/v1/sessions/${session.id}/composition/drafts`,
        payload: { expectedLatestRevision: 1, draft: userDraft },
      });
      expect(userSave.statusCode).toBe(201);
      const latest = await cli([
        "capture", "get", ...capture, "--revision", "2",
      ]) as { document: CompositionDraft };
      const continued = moveItem(latest.document, subject.id, { x: subject.x + 0.02, y: subject.y });
      await writeFile(inputPath, JSON.stringify(continued));
      await expect(cli([
        "capture", "save", ...capture, "--input", inputPath, "--expected-revision", "1",
      ])).rejects.toMatchObject({ code: "DRAFT_REVISION_CONFLICT" });
      expect(await cli([
        "capture", "save", ...capture, "--input", inputPath, "--expected-revision", "2",
      ])).toMatchObject({ revision: 3, document: continued });
      expect(continued.areas[0]).toMatchObject({
        id: subject.id, origin: "import", annotation: subject.annotation, note: "保留此区域，向右移动一点",
      });
      expect(continued.areas.map(({ id }) => id)).toEqual(userDraft.areas.map(({ id }) => id));
      expect(continued.areas.map(({ displayText }) => displayText)).toEqual(
        userDraft.areas.map(({ displayText }) => displayText),
      );
      expect(await cli([
        "capture", "undo", ...capture, "--change-revision", "3", "--expected-revision", "3",
      ])).toMatchObject({ revision: 4, document: userDraft });
      expect(await cli([
        "capture", "get", ...capture, "--revision", "1",
      ])).toMatchObject({ document: draft });
    } finally {
      await server.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
