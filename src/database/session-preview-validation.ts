import type { DatabaseConnection } from "./migrate.ts";
import { InvalidRecordError } from "./project-session-repository.ts";
import { previewSourceKey } from "../domain/session/preview.ts";
import type { UiSketchDraft } from "../domain/ui-sketch/types.ts";

export function validateSessionPreviewReferences(database: DatabaseConnection, ownerId: string, draft: UiSketchDraft, previous?: UiSketchDraft): void {
  const owner = database.prepare<[string], { project_id: string | null }>("SELECT project_id FROM sessions WHERE id = ?").get(ownerId)!;
  for (const image of draft.images) {
    const ref = image.previewReference;
    if (!ref) continue;
    if (ref.sessionId === ownerId) throw new InvalidRecordError("A session preview cannot reference its own session.");
    if (!image.assetId || !database.prepare("SELECT id FROM image_assets WHERE id = ? AND session_id = ?").get(image.assetId, ownerId)) {
      throw new InvalidRecordError("Session previews require an image owned by the destination session.");
    }
    const source = database.prepare<[string], { project_id: string | null; session_type: string }>("SELECT project_id, session_type FROM sessions WHERE id = ?").get(ref.sessionId);
    if (!source || !owner.project_id || owner.project_id !== source.project_id || source.session_type !== ref.sessionType) {
      // Retain or restore only an exact destination-owned historical snapshot.
      // This also covers local undo submitted through the normal save endpoint.
      if (previous?.images.some(before => before.assetId === image.assetId && before.previewReference
        && previewSourceKey(before.previewReference) === previewSourceKey(ref) && before.previewReference.renderedRevision === ref.renderedRevision)) continue;
      const retained = database.prepare(`SELECT 1 FROM ui_sketch_draft_versions v, json_each(v.draft_json, '$.images') image
        WHERE v.session_id = ? AND json_extract(image.value, '$.assetId') = ?
        AND json_extract(image.value, '$.previewReference.sessionId') = ?
        AND json_extract(image.value, '$.previewReference.sessionType') = ?
        AND json_extract(image.value, '$.previewReference.renderedRevision') = ?
        AND coalesce(json_extract(image.value, '$.previewReference.stateId'), json_extract(image.value, '$.previewReference.cameraId')) = ? LIMIT 1`)
        .get(ownerId, image.assetId, ref.sessionId, ref.sessionType, ref.renderedRevision, ref.sessionType === "spatial" ? ref.cameraId : ref.stateId);
      if (retained) continue;
      throw new InvalidRecordError("Session previews require another session of the specified type in the same project.");
    }
    const table = ref.sessionType === "spatial" ? "spatial_draft_versions" : ref.sessionType === "ui-layout" ? "ui_sketch_draft_versions" : "composition_draft_versions";
    const row = database.prepare<[string, number], { draft_json: string }>(`SELECT draft_json FROM ${table} WHERE session_id = ? AND revision = ?`).get(ref.sessionId, ref.renderedRevision);
    if (!row) throw new InvalidRecordError("The preview source revision does not exist.");
    const content = JSON.parse(row.draft_json);
    const ids: string[] = ref.sessionType === "spatial" ? content.cameras.map((c: { id: string }) => c.id)
      : ref.sessionType === "ui-layout" ? content.stateTabs?.map((s: { id: string }) => s.id) ?? ["start", ...content.stages.map((s: { id: string }) => s.id)]
      : content.states?.map((s: { id: string }) => s.id) ?? ["state-1"];
    if (!ids.includes(ref.sessionType === "spatial" ? ref.cameraId : ref.stateId)) throw new InvalidRecordError("The selected preview output does not exist.");
  }
}
