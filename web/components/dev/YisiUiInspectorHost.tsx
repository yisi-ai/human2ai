"use client";

import localRegistry from "@human2ai/ui/registry";
import sharedRegistry from "@human2ai/ui/yisiui/registry";
import { YisiUiInspector } from "@human2ai/ui/yisiui/inspector";

export function YisiUiInspectorHost() {
  if (process.env.NODE_ENV !== "development") return null;
  return <YisiUiInspector surface="human2ai-web" registries={[sharedRegistry, localRegistry]} />;
}
