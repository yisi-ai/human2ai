import type { SessionPreviewSource } from "../../src/domain/session/preview";
import { listSessionPreviewSources, materializeSessionPreview, sessionPreviewUrl } from "./human2ai-api";

async function droppedSessionPreviewSource(targetSessionId: string, sourceSessionId: string): Promise<SessionPreviewSource> {
  const sources = await listSessionPreviewSources(targetSessionId);
  const source = sources.find(item => item.session.id === sourceSessionId);
  const output = source?.outputs[0];
  if (!source || !output) throw new Error("SESSION_PREVIEW_UNAVAILABLE");
  return source.session.sessionType === "spatial"
    ? { sessionId: sourceSessionId, sessionType: "spatial", cameraId: output.id }
    : { sessionId: sourceSessionId, sessionType: source.session.sessionType, stateId: output.id };
}

export async function droppedSessionPreviewUrl(targetSessionId: string, sourceSessionId: string) {
  return sessionPreviewUrl(targetSessionId, await droppedSessionPreviewSource(targetSessionId, sourceSessionId));
}

export async function materializeDroppedSessionPreview(targetSessionId: string, sourceSessionId: string) {
  return materializeSessionPreview(targetSessionId, await droppedSessionPreviewSource(targetSessionId, sourceSessionId));
}
