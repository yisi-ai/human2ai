import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { useState } from "react";

import type { CompositionNodeMetadata } from "../../../../../src/domain/composition";
import {
  assertStorySelector,
  assertStoryText,
} from "../vendor/yisiui/storybook/interactionChecks";
import {
  Human2AiCanvasNodeEditor,
  type Human2AiCanvasNodeEditorProps,
} from "./Human2AiCanvasNodeEditor";

import "./Human2AiCanvasNodeEditor.stories.css";

const DEFAULT_METADATA: CompositionNodeMetadata = {
  origin: "user",
  note: "这里承载画面的主要人物",
  annotation: "旧批注仅为数据兼容保留",
  semanticType: "旧类型",
  shotScale: "foreground",
};

function EditorHarness({
  metadata: initialMetadata = DEFAULT_METADATA,
  ...props
}: Omit<
  Human2AiCanvasNodeEditorProps,
  "metadata" | "onMetadataChange" | "onRequestClose"
> & {
  metadata?: CompositionNodeMetadata;
}) {
  const [metadata, setMetadata] = useState(initialMetadata);
  const [open, setOpen] = useState(true);
  const [deleted, setDeleted] = useState(false);
  return (
    <main
      className="human2ai-canvas-node-editor-story"
      data-editor-open={open ? "true" : "false"}
      data-deleted={deleted ? "true" : "false"}
      data-note={metadata.note}
      data-shot-scale={metadata.shotScale}
    >
      <div className="human2ai-canvas-node-editor-story__preview" />
      {open ? (
        <Human2AiCanvasNodeEditor
          {...props}
          metadata={metadata}
          onMetadataChange={(patch) => setMetadata((current) => ({ ...current, ...patch }))}
          onRequestClose={() => setOpen(false)}
          onDelete={() => {
            setDeleted(true);
            setOpen(false);
          }}
        />
      ) : null}
    </main>
  );
}

const meta = {
  id: "human2ai-canvas-node-editor",
  title: "human2ai/Canvas/Human2AiCanvasNodeEditor",
  component: Human2AiCanvasNodeEditor,
  parameters: { layout: "fullscreen" },
  args: {
    nodeKind: "shape",
    metadata: DEFAULT_METADATA,
    onMetadataChange: () => undefined,
    onRequestClose: () => undefined,
  },
} satisfies Meta<typeof Human2AiCanvasNodeEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "自动保存备注与景别",
  render: () => <EditorHarness nodeKind="shape" />,
  play: async ({ canvasElement }) => {
    const editor = requiredEditor();
    assertStorySelector(document.body, '[data-yisiui-asset="human2ai/canvas-node-editor"]');
    assertStoryText(document.body, "编辑节点 · 形状");
    assertStoryText(document.body, "前景");
    if (editor.querySelector('[aria-label="批注"]') || editor.querySelector('[aria-label="类型"]')) {
      throw new Error("构图节点编辑器不应显示批注或类型");
    }
    if (findButtons(editor, "保存").length > 0) {
      throw new Error("自动保存节点编辑器不应显示保存按钮");
    }
    setInputValue(requiredInput(editor, "备注"), "更新后的备注");
    await nextFrame();
    const harness = canvasElement.querySelector<HTMLElement>("[data-editor-open]");
    if (harness?.dataset.note !== "更新后的备注") {
      throw new Error("备注变更没有通过受控契约即时写回");
    }
  },
};

export const Empty: Story = {
  name: "空备注与自动景别",
  render: () => (
    <EditorHarness
      nodeKind="point"
      metadata={{ origin: "user", note: "", annotation: "", semanticType: "", shotScale: "auto" }}
    />
  ),
  play: () => {
    assertStorySelector(
      document.body,
      '[data-empty="true"][data-node-kind="point"]',
    );
    assertStoryText(document.body, "自动");
  },
};

export const EnglishShotScale: Story = {
  name: "英文景别完整显示",
  render: () => (
    <EditorHarness
      nodeKind="shape"
      metadata={{ ...DEFAULT_METADATA, shotScale: "background" }}
      labels={{
        shotScale: "Depth",
        shotScaleAuto: "Auto",
        shotScaleForeground: "Foreground",
        shotScaleMidground: "Midground",
        shotScaleBackground: "Background",
      }}
    />
  ),
  play: () => {
    const select = requiredEditor().querySelector<HTMLElement>(
      ".human2ai-canvas-node-editor__shot-scale-select",
    );
    if (!select || !select.textContent?.includes("Background")) {
      throw new Error("英文景别没有完整进入下拉框");
    }
    if (select.getBoundingClientRect().width < 138) {
      throw new Error("景别下拉框宽度不足以显示英文选项");
    }
  },
};

export const Disabled: Story = {
  name: "只读节点信息",
  render: () => <EditorHarness nodeKind="line" disabled />,
  play: () => {
    const editor = requiredEditor();
    assertStorySelector(document.body, '[aria-disabled="true"]');
    if (!editor.querySelector("textarea:disabled") || !editor.querySelector(".ant-select-disabled")) {
      throw new Error("只读节点编辑器必须禁用备注与景别");
    }
    if (findButtons(editor, "删除节点").length > 0) {
      throw new Error("只读节点编辑器不应提供删除动作");
    }
  },
};

export const AgentAccent: Story = {
  name: "Agent 点缀说明与可编辑备注",
  render: () => <EditorHarness nodeKind="shape" metadata={{ ...DEFAULT_METADATA, origin: "agent", annotation: "细小圆点呼应主体的几何节奏", note: "装饰圆点", shotScale: "auto" }} />,
  play: () => {
    assertStoryText(document.body, "agent");
    assertStoryText(document.body, "细小圆点呼应主体的几何节奏");
    if (requiredInput(requiredEditor(), "备注").disabled) throw new Error("Agent 新增节点必须仍可由用户编辑");
  },
};

export const ImportedRegion: Story = {
  name: "参考画面导入区域说明",
  render: () => (
    <EditorHarness
      nodeKind="shape"
      metadata={{
        ...DEFAULT_METADATA,
        origin: "import",
        annotation: "参考画面右侧的前景人物，与左侧留白形成平衡",
        note: "",
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    const editor = requiredEditor();
    assertStoryText(editor, "import");
    assertStoryText(editor, "参考画面右侧的前景人物，与左侧留白形成平衡");
    const note = requiredInput(editor, "备注");
    if (note.value || note.disabled) throw new Error("导入节点应保留独立的空白可编辑备注");
    setInputValue(note, "向左移动一点");
    await nextFrame();
    if (canvasElement.querySelector<HTMLElement>("[data-note]")?.dataset.note !== "向左移动一点") {
      throw new Error("导入节点的用户备注没有写回");
    }
    assertStoryText(editor, "参考画面右侧的前景人物，与左侧留白形成平衡");
  },
};

export const DeleteNode: Story = {
  name: "底部删除节点确认",
  render: () => <EditorHarness nodeKind="image" />,
  play: async ({ canvasElement }) => {
    const editor = requiredEditor();
    findButton(editor, "删除节点").click();
    await nextFrame();
    assertStoryText(document.body, "确认删除这个节点？");
    const confirm = findButtons(document.body, "删除节点").at(-1);
    if (!confirm) throw new Error("删除节点缺少确认按钮");
    confirm.click();
    await nextFrame();
    const harness = canvasElement.querySelector<HTMLElement>("[data-deleted]");
    if (harness?.dataset.deleted !== "true" || harness.dataset.editorOpen !== "false") {
      throw new Error("确认删除后没有关闭节点编辑器");
    }
  },
};

export const LongContent: Story = {
  name: "长备注",
  render: () => (
    <EditorHarness
      nodeKind="text"
      metadata={{
        ...DEFAULT_METADATA,
        note: "这是一段用于验证节点备注在较长内容下仍然可以完整编辑并保持面板滚动边界的说明。".repeat(8),
      }}
    />
  ),
};

export const NarrowViewport: Story = {
  name: "窄视口编辑",
  render: () => (
    <div className="human2ai-canvas-node-editor-story--narrow">
      <EditorHarness nodeKind="shape" />
    </div>
  ),
};

function requiredEditor(): HTMLElement {
  const editor = document.body.querySelector<HTMLElement>(
    '[data-yisiui-asset="human2ai/canvas-node-editor"]',
  );
  if (!editor) throw new Error("节点编辑器没有打开");
  return editor;
}

function requiredInput(root: HTMLElement, label: string): HTMLInputElement | HTMLTextAreaElement {
  const input = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[aria-label="${label}"]`);
  if (!input) throw new Error(`节点编辑器缺少字段：${label}`);
  return input;
}

function findButton(root: ParentNode, label: string): HTMLButtonElement {
  const button = findButtons(root, label)[0];
  if (!button) throw new Error(`找不到按钮：${label}`);
  return button;
}

function findButtons(root: ParentNode, label: string): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll<HTMLButtonElement>("button")).filter(
    (button) => button.textContent?.trim() === label,
  );
}

function setInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = input instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (!setter) throw new Error("浏览器没有提供输入框 value setter");
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function nextFrame(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}
