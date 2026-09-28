export const WORKSPACE_SESSION_DRAG_TYPE = "application/x-human2ai-workspace-session";

// Native drag data is protected between dragstart and drop. Keep the same-page
// source available to the canvas without publishing gesture state to React.
let draggedSessionId: string | null = null;
let dragImage: HTMLCanvasElement | null = null;

export function setDraggedWorkspaceSession(sessionId: string | null, dataTransfer?: DataTransfer): void {
  draggedSessionId = sessionId;
  dragImage?.remove();
  dragImage = null;
  if (sessionId && dataTransfer) {
    dragImage = document.createElement("canvas");
    dragImage.width = dragImage.height = 1;
    dragImage.setAttribute("aria-hidden", "true");
    dragImage.style.cssText = "position:fixed;left:0;top:0;pointer-events:none";
    document.body.appendChild(dragImage);
    dataTransfer.setDragImage(dragImage, 0, 0);
  }
}

export function draggedWorkspaceSession(dataTransfer: DataTransfer): string | null {
  return dataTransfer.getData(WORKSPACE_SESSION_DRAG_TYPE) || draggedSessionId;
}
