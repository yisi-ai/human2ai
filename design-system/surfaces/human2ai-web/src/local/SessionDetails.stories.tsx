import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { LayoutOutlined, PictureOutlined } from "@ant-design/icons";
import { ExpandingSwitch } from "@human2ai/ui/yisiui/expanding-switch";
import zh from "../../../../../locales/zh-CN/common.json";
import en from "../../../../../locales/en/common.json";

import {
  assertStorySelector,
  assertStoryText,
} from "../vendor/yisiui/storybook/interactionChecks";
import { SessionDetails, type SessionDetailsLabels } from "./SessionDetails";

import "./SessionDetails.stories.css";

const zhLabels: SessionDetailsLabels = {
  title: "基本信息",
  created: "创建时间",
  updated: "修改时间",
  nodes: "节点数",
  agent: "Agent",
  copyCommand: "复制命令",
  copying: "复制中",
  copied: "复制成功",
  copyFailed: "复制失败",
  emptyValue: "—",
};

const enLabels: SessionDetailsLabels = {
  title: "Session details",
  created: "Created",
  updated: "Last updated",
  nodes: "Nodes",
  agent: "Agent",
  copyCommand: "Copy command",
  copying: "Copying",
  copied: "Copied",
  copyFailed: "Copy failed",
  emptyValue: "—",
};

const agentCommand = [
  "请使用以下 CLI 命令连接当前会话：",
  "",
  "human2ai session connect --session session-123",
  "",
  "连接完成后，请停止并等待下一步命令。",
].join("\n");

let copiedContent = "";

function modeItem(labels: typeof zh.composition.mode) {
  return {
    label: labels.label,
    value: (
      <ExpandingSwitch
        aria-label={labels.label}
        defaultValue="scene-composition"
        colors={{ mode: "multicolor" }}
        items={[
          { key: "scene-composition", label: labels.scene, icon: <PictureOutlined aria-hidden="true" /> },
          { key: "editorial-layout", label: labels.editorial, icon: <LayoutOutlined aria-hidden="true" /> },
        ]}
      />
    ),
  };
}

const meta = {
  id: "human2ai-session-details",
  title: "human2ai/SessionDetails",
  component: SessionDetails,
  parameters: { layout: "centered" },
  args: {
    primaryItem: modeItem(zh.composition.mode),
    createdAt: "2026-08-26T09:30:00.000Z",
    updatedAt: "2026-08-26T10:45:00.000Z",
    nodeCount: 12,
    agentCommand,
    locale: "zh-CN",
    labels: zhLabels,
  },
  decorators: [
    (Story) => (
      <aside className="human2ai-session-details-story">
        <Story />
      </aside>
    ),
  ],
} satisfies Meta<typeof SessionDetails>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "基本信息与 Agent 命令复制",
  args: {
    writeText: async (content) => {
      copiedContent = content;
    },
  },
  play: async ({ canvasElement }) => {
    copiedContent = "";
    assertStorySelector(
      canvasElement,
      '[data-yisiui-asset="human2ai/session-details"]',
    );
    assertStorySelector(
      canvasElement,
      '[data-yisiui-asset="yisiui/action-button"]',
    );
    const firstLabel = canvasElement.querySelector("dt");
    if (firstLabel?.textContent !== "构图模式") {
      throw new Error("SessionDetails must render the primary item first");
    }
    assertStoryText(canvasElement, "基本信息");
    assertStoryText(canvasElement, "节点数");
    assertStoryText(canvasElement, "12");
    assertStorySelector(canvasElement, '[role="radio"][data-palette="natural"][aria-checked="true"]');
    const editorial = canvasElement.querySelector<HTMLButtonElement>('[role="radio"][data-palette="sage"]');
    if (!editorial) throw new Error("Editorial mode must use its own palette color");
    editorial.click();
    await nextFrame();
    if (editorial.getAttribute("aria-checked") !== "true") {
      throw new Error("Mode selection must switch to Editorial");
    }
    findButton(canvasElement, "复制命令").click();
    await nextFrame();
    if (copiedContent !== agentCommand) {
      throw new Error("SessionDetails must copy the complete Agent command template");
    }
    assertStoryText(canvasElement, "复制成功");
  },
};

export const RuntimeCommand: Story = {
  name: "点击时生成 Agent 命令",
  args: {
    agentCommand: async () => agentCommand,
    writeText: async (content) => {
      copiedContent = content;
    },
  },
  play: async ({ canvasElement }) => {
    copiedContent = "";
    findButton(canvasElement, "复制命令").click();
    await nextFrame();
    if (copiedContent !== agentCommand) {
      throw new Error("SessionDetails must load the current Agent command on click");
    }
    assertStoryText(canvasElement, "复制成功");
  },
};

export const Copying: Story = {
  name: "正在生成并复制 Agent 命令",
  args: {
    agentCommand: () => new Promise<string>(() => undefined),
  },
  play: async ({ canvasElement }) => {
    findButton(canvasElement, "复制命令").click();
    await nextFrame();
    assertStorySelector(canvasElement, '[data-action-status="pending"]');
    assertStoryText(canvasElement, "复制中");
  },
};

export const English: Story = {
  name: "英文信息",
  args: {
    locale: "en",
    labels: enLabels,
    primaryItem: modeItem(en.composition.mode),
  },
  play: ({ canvasElement }) => {
    assertStoryText(canvasElement, "Session details");
    assertStoryText(canvasElement, "Copy command");
  },
};

export const NoSession: Story = {
  name: "尚未创建会话",
  args: {
    createdAt: null,
    updatedAt: null,
    agentCommand: null,
    nodeCount: 0,
  },
  play: ({ canvasElement }) => {
    assertStorySelector(canvasElement, "button:disabled");
    assertStoryText(canvasElement, "—");
  },
};

export const CopyError: Story = {
  name: "复制失败",
  args: {
    writeText: async () => {
      throw new Error("Clipboard unavailable");
    },
  },
  play: async ({ canvasElement }) => {
    findButton(canvasElement, "复制命令").click();
    await nextFrame();
    assertStorySelector(canvasElement, '[data-action-status="error"]');
    assertStorySelector(canvasElement, '[role="alert"]');
    assertStoryText(canvasElement, "复制失败");
  },
};

export const Narrow: Story = {
  name: "窄侧栏",
  decorators: [
    (Story) => (
      <div className="human2ai-session-details-story human2ai-session-details-story--narrow">
        <Story />
      </div>
    ),
  ],
};

function findButton(root: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(
    (candidate) => candidate.textContent?.includes(label),
  );
  if (!button) throw new Error(`SessionDetails story is missing button: ${label}`);
  return button;
}

async function nextFrame(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}
