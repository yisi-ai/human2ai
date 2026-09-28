import {
  DatabaseOutlined,
  FileAddOutlined,
  FileTextOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import type { Meta, StoryContext, StoryObj } from "@storybook/react-webpack5";
import { Button, Space, Typography } from "antd";
import { useState } from "react";

import { AppShellFrame, CompositeButton, TabSwitch } from "@human2ai/ui/yisiui";
import { assertStorySelector, assertStoryText } from "../interactionChecks";

const labels = {
  sidebar: "Workspace sidebar",
  navigation: "Workspace navigation",
  collapseSidebar: "Collapse workspace sidebar",
  expandSidebar: "Expand workspace sidebar",
  rightPanel: "Document details",
  collapseRightPanel: "Collapse document details",
  expandRightPanel: "Expand document details",
  resizeSidebar: "调整左侧栏宽度",
  resizeRightPanel: "调整右侧栏宽度",
};

const meta = {
  id: "layouts-appshellframe",
  title: "yisiui-Layouts/AppShellFrame",
  component: AppShellFrame,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: "左右侧栏支持独立拖动调宽，边缘悬停时显示竖条与调整光标；收起后保留宽度。左右方向键移动边界，Shift 加速，Home / End 到达范围端点，Esc 取消拖动。最小和最大宽度分别配置，中间区域保留 contentMinWidth；空间不足时壳层横向滚动。宽度回调在拖动结束或键盘调整后触发。headerExtra 可在右侧栏开关左边插入业务组件，未提供右侧栏时也可使用。",
      },
    },
  },
  args: {
    sidebar: null,
    children: null,
    collapsible: true,
    defaultSidebarOpen: true,
    sidebarWidth: 280,
    sidebarResizable: true,
    sidebarMinWidth: 180,
    sidebarMaxWidth: 480,
    rightPanel: null,
    rightPanelCollapsible: true,
    defaultRightPanelOpen: true,
    rightPanelWidth: 320,
    rightPanelResizable: true,
    rightPanelMinWidth: 240,
    rightPanelMaxWidth: 560,
    contentMinWidth: 320,
  },
  argTypes: {
    sidebar: { control: false },
    sidebarTitle: { control: false },
    sidebarNavigation: { control: false },
    title: { control: false },
    headerExtra: { control: false, description: "标题栏右侧内容插槽，位于右侧栏开关左边；接收任意 ReactNode，内容和交互由消费项目持有。" },
    backAction: { control: false },
    sidebarCollapsedActions: { control: false },
    rightPanel: { control: false },
    children: { control: false },
    sidebarOpen: { control: false },
    rightPanelOpen: { control: false },
    onSidebarOpenChange: { action: "sidebar visibility changed" },
    onRightPanelOpenChange: { action: "right panel visibility changed" },
    onSidebarWidthChange: { action: "sidebar width committed" },
    onRightPanelWidthChange: { action: "right panel width committed" },
    sidebarMinWidth: { control: { type: "number", min: 0 } },
    sidebarMaxWidth: { control: { type: "number", min: 0 } },
    rightPanelMinWidth: { control: { type: "number", min: 0 } },
    rightPanelMaxWidth: { control: { type: "number", min: 0 } },
    contentMinWidth: { control: { type: "number", min: 0 } },
    labels: { control: false },
    style: { control: false },
  },
} satisfies Meta<typeof AppShellFrame>;
export default meta;
type Story = StoryObj<typeof meta>;

function HeaderReviewActions() {
  const [annotations, setAnnotations] = useState(true);
  const [comparison, setComparison] = useState(false);

  return (
    <Space.Compact size="small" role="group" aria-label="审阅工具">
      <Button
        type={annotations ? "primary" : "default"}
        aria-pressed={annotations}
        onClick={() => setAnnotations((visible) => !visible)}
      >
        批注
      </Button>
      <Button
        type={comparison ? "primary" : "default"}
        aria-pressed={comparison}
        onClick={() => setComparison((visible) => !visible)}
      >
        对照
      </Button>
    </Space.Compact>
  );
}

export const Default: Story = {
  name: "双侧栏拖动调宽",
  render: (args) => (
    <AppShellFrame
      {...args}
      labels={labels}
      sidebarTitle="工作台"
      sidebarNavigation={(
        <>
          <CompositeButton icon={<FileTextOutlined />} label="文档" />
          <CompositeButton icon={<DatabaseOutlined />} label="资料库" />
          <CompositeButton icon={<SettingOutlined />} label="设置" />
        </>
      )}
      sidebar={(
        <div style={{ padding: 20 }}>
          <Typography.Text type="secondary">拖动右边缘调整宽度，也可独立收起。</Typography.Text>
        </div>
      )}
      title="项目概览"
      headerExtra={(
        <TabSwitch
          aria-label="工作区视图"
          compact
          items={[
            { key: "overview", label: "概览", mode: "text-only" },
            { key: "document", label: "正文", mode: "text-only" },
          ]}
        />
      )}
      backAction={{ label: "Back to documents", onClick: () => undefined }}
      sidebarCollapsedActions={(
        <Button type="text" icon={<FileAddOutlined />} aria-label="Create document" />
      )}
      rightPanel={(
        <div style={{ padding: 24 }}>
          <Typography.Text strong>文档详情</Typography.Text>
          <Typography.Paragraph>
            拖动左边缘调整宽度。右上角的侧栏按钮可展开或收起此区域。
          </Typography.Paragraph>
        </div>
      )}
    >
      <article style={{ maxWidth: 760, padding: 32 }}>
        <Typography.Title level={4}>双侧栏工作区</Typography.Title>
        <Typography.Paragraph>
          将鼠标移到侧栏与内容区的边缘，竖条出现后即可左右拖动。也可以用 Tab 聚焦边缘，通过方向键调整宽度。
        </Typography.Paragraph>
        <Typography.Paragraph>
          标题栏右侧的“概览 / 正文”演示消费项目注入的视图切换，位于右侧栏开关左边。
        </Typography.Paragraph>
      </article>
    </AppShellFrame>
  ),
  play: async ({ canvasElement }: StoryContext) => {
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/app-shell-frame"][data-sidebar-state="open"]');
    assertStorySelector(canvasElement, '[aria-label="Workspace navigation"]');
    assertStorySelector(canvasElement, '[aria-label="Document details"]');
    assertStoryText(canvasElement, "项目概览");

    const handles = canvasElement.querySelectorAll<HTMLElement>('[role="separator"]');
    for (const handle of handles) {
      const initial = Number(handle.getAttribute("aria-valuenow"));
      const maximum = Number(handle.getAttribute("aria-valuemax"));
      const expandKey = handle.getAttribute("aria-label") === labels.resizeSidebar ? "ArrowRight" : "ArrowLeft";
      const shrinkKey = expandKey === "ArrowRight" ? "ArrowLeft" : "ArrowRight";
      if (maximum - initial >= 8) {
        handle.dispatchEvent(new KeyboardEvent("keydown", { key: expandKey, bubbles: true }));
        if (Number(handle.getAttribute("aria-valuenow")) !== initial + 8) throw new Error("Keyboard resizing failed");
        handle.dispatchEvent(new KeyboardEvent("keydown", { key: shrinkKey, bubbles: true }));
        if (Number(handle.getAttribute("aria-valuenow")) !== initial) throw new Error("Keyboard resizing failed to restore width");
      }
    }
    const sidebarBeforeCollapse = canvasElement.querySelector(".yisi-app-shell-sidebar")!;
    const sidebarWidthBeforeCollapse = sidebarBeforeCollapse.getBoundingClientRect().width;

    const collapseRightPanel = canvasElement.querySelector<HTMLButtonElement>(
      '[aria-label="Collapse document details"]',
    );
    if (!collapseRightPanel) throw new Error("AppShellFrame right panel collapse control is missing");
    collapseRightPanel.click();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    assertStorySelector(canvasElement, '[data-right-panel-state="closed"]');
    assertStorySelector(canvasElement, '[aria-label="Expand document details"][aria-expanded="false"]');

    canvasElement.querySelector<HTMLButtonElement>('[aria-label="Expand document details"]')?.click();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    assertStorySelector(canvasElement, '[data-right-panel-state="open"]');

    const collapse = canvasElement.querySelector<HTMLButtonElement>('[aria-label="Collapse workspace sidebar"]');
    if (!collapse) throw new Error("AppShellFrame collapse control is missing");
    collapse.click();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/app-shell-frame"][data-sidebar-state="closed"]');
    assertStorySelector(canvasElement, '[aria-label="Expand workspace sidebar"][aria-expanded="false"]');
    assertStorySelector(canvasElement, '[aria-label="Create document"]');
    const contentAfterSidebarCollapse = canvasElement.querySelector<HTMLElement>(
      ".yisi-app-shell-content",
    );
    if (!contentAfterSidebarCollapse || contentAfterSidebarCollapse.getBoundingClientRect().width <= 0) {
      throw new Error("AppShellFrame content collapsed into the hidden sidebar grid column");
    }
    const rightPanelAfterSidebarCollapse = canvasElement.querySelector<HTMLElement>(
      ".yisi-app-shell-right-panel",
    );
    if (!rightPanelAfterSidebarCollapse || rightPanelAfterSidebarCollapse.getBoundingClientRect().width <= 0) {
      throw new Error("AppShellFrame right panel moved out of its grid column");
    }

    canvasElement.querySelector<HTMLButtonElement>('[aria-label="Expand workspace sidebar"]')?.click();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/app-shell-frame"][data-sidebar-state="open"]');
    if (Math.abs(sidebarBeforeCollapse.getBoundingClientRect().width - sidebarWidthBeforeCollapse) > 1) {
      throw new Error("AppShellFrame lost the resized sidebar width after collapse");
    }
  },
};

export const LongContent: Story = {
  name: "长内容边界",
  render: () => (
    <AppShellFrame
      labels={labels}
      sidebarTitle="A very long workspace title that must remain inside the sidebar heading"
      sidebar={<div style={{ padding: 20 }}>Scrollable product content stays inside the sidebar slot.</div>}
      title="A deliberately long global context title that truncates without pushing header actions outside the viewport"
      headerExtra={<Typography.Text type="secondary">共 24 项内容</Typography.Text>}
    >
      <div style={{ padding: 32 }}>
        <Space orientation="vertical" size={16}>
          {Array.from({ length: 24 }, (_, index) => (
            <Typography.Paragraph key={index}>
              Content row {index + 1}: the content region owns vertical scrolling independently from the full-viewport shell.
            </Typography.Paragraph>
          ))}
        </Space>
      </div>
    </AppShellFrame>
  ),
  play: async ({ canvasElement }) => {
    assertStorySelector(canvasElement, '.yisi-app-shell-content-body');
    assertStorySelector(canvasElement, '[data-right-panel-state="absent"]');
    assertStoryText(canvasElement, "Content row 24");

    canvasElement.querySelector<HTMLButtonElement>('[aria-label="Collapse workspace sidebar"]')?.click();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const contentAfterSidebarCollapse = canvasElement.querySelector<HTMLElement>(
      ".yisi-app-shell-content",
    );
    if (!contentAfterSidebarCollapse || contentAfterSidebarCollapse.getBoundingClientRect().width <= 0) {
      throw new Error("AppShellFrame content is not visible when the only sidebar is collapsed");
    }
  },
};

export const RightPanelInitiallyClosed: Story = {
  name: "右侧面板默认收起",
  render: (args) => (
    <AppShellFrame
      {...args}
      labels={labels}
      sidebarTitle="工作台"
      sidebar={<div style={{ padding: 20 }}>项目导航</div>}
      title="审阅工作区"
      headerExtra={<HeaderReviewActions />}
      defaultRightPanelOpen={false}
      rightPanel={(
        <div style={{ padding: 24 }}>
          <Typography.Text>Review tools</Typography.Text>
        </div>
      )}
    >
      <div style={{ padding: 32 }}>右侧栏默认收起，点击标题栏右上角的侧栏图标即可展开。</div>
    </AppShellFrame>
  ),
  play: async ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-right-panel-state="closed"]');
    canvasElement.querySelector<HTMLButtonElement>('[aria-label="Expand document details"]')?.click();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    assertStorySelector(canvasElement, '[data-right-panel-state="open"]');
    assertStoryText(canvasElement, "Review tools");
  },
};
