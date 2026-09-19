import {
  AimOutlined,
  DeleteOutlined,
  LineOutlined,
} from "@ant-design/icons";
import { CompositeButton } from "@human2ai/ui/yisiui/composite-button";
import { ConfirmAction } from "@human2ai/ui/yisiui/confirm-action";
import { SideActionPanel } from "@human2ai/ui/yisiui/side-action-panel";
import { Tooltip } from "antd";
import type { Meta, StoryContext, StoryObj } from "@storybook/react-webpack5";
import type { ReactNode } from "react";
import { useState } from "react";

import {
  assertStorySelector,
  assertStoryText,
} from "../vendor/yisiui/storybook/interactionChecks";
import {
  Human2AiAppShell,
} from "./Human2AiAppShell";

import "./Human2AiAppShell.stories.css";

const labels = {
  productName: "human2ai",
  sidebar: "Human2AI 应用侧栏",
  navigation: "Human2AI 应用导航",
  collapseSidebar: "收起应用侧栏",
  expandSidebar: "展开应用侧栏",
  rightPanel: "构图属性",
  collapseRightPanel: "收起构图属性",
  expandRightPanel: "展开构图属性",
};

function ShellHarness({
  rightPanel,
  title = "工作概览",
  sidebar = <div className="human2ai-app-shell-story-sidebar">侧栏内容</div>,
  children = <div className="human2ai-app-shell-story-content">页面内容</div>,
  rightPanelOpen,
  onRightPanelOpenChange,
}: {
  rightPanel?: ReactNode;
  title?: ReactNode;
  sidebar?: ReactNode;
  children?: ReactNode;
  rightPanelOpen?: boolean;
  onRightPanelOpenChange?: (open: boolean) => void;
}) {
  return (
    <Human2AiAppShell
      title={title}
      brand={(
        <a href="/" className="human2ai-app-shell__brand">
          <img className="human2ai-app-shell__brand-icon" src="/brand/h2a.svg" alt="" width={24} height={24} />
          {labels.productName}
        </a>
      )}
      labels={labels}
      rightPanel={rightPanel}
      rightPanelOpen={rightPanelOpen}
      onRightPanelOpenChange={onRightPanelOpenChange}
      sidebar={sidebar}
    >
      {children}
    </Human2AiAppShell>
  );
}

function CompositionPropertiesHarness() {
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const toolButtons = (
    <>
      <CompositeButton
        className="human2ai-app-shell-story-capacity-tool"
        icon={<AimOutlined aria-hidden="true" />}
        label="焦点"
        description="1/3"
        aria-label="焦点，已放置 1/3"
      />
      <CompositeButton icon={<span aria-hidden="true">○</span>} label="圆形" />
      <CompositeButton icon={<span aria-hidden="true">△</span>} label="三角形" />
      <CompositeButton icon={<span aria-hidden="true">□</span>} label="矩形" />
      <CompositeButton
        className="human2ai-app-shell-story-capacity-tool"
        icon={<LineOutlined rotate={-20} aria-hidden="true" />}
        label="动势线"
        description="0/1"
        aria-label="动势线，已放置 0/1"
      />
    </>
  );

  return (
    <ShellHarness
      title="构图编辑器"
      rightPanelOpen={rightPanelOpen}
      onRightPanelOpenChange={setRightPanelOpen}
      rightPanel={(
        <div className="human2ai-app-shell-story-panel">
          <div className="human2ai-app-shell-story-section-heading">
            <h2>添加元素</h2>
            <Tooltip title="清空画布">
              <span>
                <ConfirmAction
                  type="text"
                  size="small"
                  icon={<DeleteOutlined aria-hidden="true" />}
                  aria-label="清空画布"
                  title="确认清空画布？"
                  description="所有构图内容和设置都会恢复为默认状态，此操作无法撤回。"
                  confirmLabel="清空画布"
                  cancelLabel="取消"
                  onConfirm={() => undefined}
                >
                  {null}
                </ConfirmAction>
              </span>
            </Tooltip>
          </div>
          <div
            className="human2ai-app-shell-story-tool-grid"
            role="group"
            aria-label="操作工具"
          >
            {toolButtons}
          </div>
        </div>
      )}
    >
      <div className="human2ai-app-shell-story-content human2ai-app-shell-story-canvas">
        {!rightPanelOpen ? (
          <SideActionPanel width={180} aria-label="操作工具">
            {toolButtons}
          </SideActionPanel>
        ) : null}
      </div>
    </ShellHarness>
  );
}

const meta = {
  id: "human2ai-app-shell",
  title: "human2ai/Human2AiAppShell",
  component: Human2AiAppShell,
  parameters: { layout: "fullscreen" },
  args: {
    title: "工作概览",
    children: null,
    sidebar: null,
  },
} satisfies Meta<typeof Human2AiAppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "应用壳层",
  render: () => <ShellHarness />,
  play: async ({ canvasElement }: StoryContext) => {
    assertStorySelector(
      canvasElement,
      '[data-yisiui-asset="human2ai/app-shell"]',
    );
    assertStorySelector(
      canvasElement,
      '[data-yisiui-asset="yisiui/app-shell-frame"]',
    );
    assertStoryText(canvasElement, "工作概览");
    assertStoryText(canvasElement, "侧栏内容");
    assertStorySelector(canvasElement, 'a.human2ai-app-shell__brand[href="/"]');
  },
};

export const CollapsedSidebar: Story = {
  name: "侧栏收起与恢复",
  render: () => <ShellHarness />,
  play: async ({ canvasElement }) => {
    findButton(canvasElement, labels.collapseSidebar).click();
    await nextFrame();
    assertStorySelector(canvasElement, '[data-sidebar-state="closed"]');
    findButton(canvasElement, labels.expandSidebar).click();
    await nextFrame();
    assertStorySelector(canvasElement, '[data-sidebar-state="open"]');
  },
};

export const CompositionWithProperties: Story = {
  name: "构图与右侧属性",
  render: () => <CompositionPropertiesHarness />,
  play: async ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-right-panel-state="open"]');
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/composite-button"]');
    assertStorySelector(canvasElement, '[data-icon="line"]');
    assertStoryText(canvasElement, "添加元素");
    assertStoryText(canvasElement, "动势线");
    assertStoryText(canvasElement, "1/3");
    assertStoryText(canvasElement, "0/1");
    for (const label of ["焦点", "动势线"]) {
      const labelElement = [...canvasElement.querySelectorAll<HTMLElement>(
        ".yisi-composite-button-label",
      )].find((element) => element.textContent?.trim() === label);
      if (!labelElement || labelElement.scrollWidth > labelElement.clientWidth) {
        throw new Error(`构图工具名称必须完整显示：${label}`);
      }
    }
    const clearCanvasButton = findButton(canvasElement, "清空画布");
    if (clearCanvasButton.textContent?.trim()) {
      throw new Error("清空画布在操作工具标题右侧必须只显示图标");
    }
    clearCanvasButton.click();
    await nextFrame();
    assertStoryText(document.body, "确认清空画布？");
    assertStoryText(
      document.body,
      "所有构图内容和设置都会恢复为默认状态，此操作无法撤回。",
    );
    findButton(document.body, "取消").click();
    await nextFrame();
    if (canvasElement.querySelector('[data-yisiui-asset="yisiui/side-action-panel"]')) {
      throw new Error("Canvas SideActionPanel must stay hidden while the right panel is open");
    }
    findButton(canvasElement, labels.collapseRightPanel).click();
    await nextFrame();
    assertStorySelector(canvasElement, '[data-right-panel-state="closed"]');
    const sidePanel = canvasElement.querySelector<HTMLElement>(
      '[data-yisiui-asset="yisiui/side-action-panel"]',
    );
    if (!sidePanel || Math.round(sidePanel.getBoundingClientRect().width) !== 180) {
      throw new Error("Canvas SideActionPanel must render at the compact 180px width");
    }
    if (sidePanel.querySelector('button[aria-label="清空画布"]')) {
      throw new Error("清空画布不应出现在画布侧栏");
    }
  },
};

export const LongContent: Story = {
  name: "长标题与长内容",
  render: () => (
    <ShellHarness title="一个很长的页面上下文标题，用于验证标题不会挤压壳层控制按钮">
      <div className="human2ai-app-shell-story-content">
        {Array.from({ length: 24 }, (_, index) => (
          <p key={index}>内容行 {index + 1}</p>
        ))}
      </div>
    </ShellHarness>
  ),
  play: async ({ canvasElement }) => {
    assertStoryText(canvasElement, "内容行 24");
  },
};

export const DesktopMinimum: Story = {
  name: "桌面最小视口",
  parameters: { viewport: { defaultViewport: "desktopMinimum" } },
  render: () => (
    <ShellHarness
      title="构图编辑器"
      rightPanel={<div className="human2ai-app-shell-story-panel">构图属性</div>}
    />
  ),
};

function findButton(root: HTMLElement, label: string): HTMLButtonElement {
  const normalizedLabel = label.replaceAll(" ", "");
  const button = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(
    (item) =>
      item.getAttribute("aria-label") === label
      || item.textContent?.replaceAll(" ", "").trim() === normalizedLabel,
  );
  if (!button) throw new Error(`Story interaction contract missing button: ${label}`);
  return button;
}

async function nextFrame(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}
