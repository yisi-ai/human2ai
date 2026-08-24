import {
  DatabaseOutlined,
  FileAddOutlined,
  FileTextOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import type { Meta, StoryContext, StoryObj } from "@storybook/react-webpack5";
import { Button, Space, Typography } from "antd";

import { AppShellFrame, CompositeButton } from "@human2ai/ui/yisiui";
import { assertStorySelector, assertStoryText } from "../interactionChecks";

const labels = {
  sidebar: "Workspace sidebar",
  navigation: "Workspace navigation",
  collapseSidebar: "Collapse workspace sidebar",
  expandSidebar: "Expand workspace sidebar",
  rightPanel: "Document details",
  collapseRightPanel: "Collapse document details",
  expandRightPanel: "Expand document details",
};

const meta = {
  id: "layouts-appshellframe",
  title: "Layouts/AppShellFrame",
  component: AppShellFrame,
  parameters: { layout: "fullscreen" },
  args: {
    sidebar: null,
    children: null,
    collapsible: true,
    defaultSidebarOpen: true,
    sidebarWidth: 280,
    rightPanel: null,
    rightPanelCollapsible: true,
    defaultRightPanelOpen: true,
    rightPanelWidth: 320,
  },
  argTypes: {
    sidebar: { control: false },
    sidebarTitle: { control: false },
    sidebarNavigation: { control: false },
    title: { control: false },
    backAction: { control: false },
    sidebarCollapsedActions: { control: false },
    rightPanel: { control: false },
    children: { control: false },
    sidebarOpen: { control: false },
    rightPanelOpen: { control: false },
    onSidebarOpenChange: { action: "sidebar visibility changed" },
    onRightPanelOpenChange: { action: "right panel visibility changed" },
    labels: { control: false },
    style: { control: false },
  },
} satisfies Meta<typeof AppShellFrame>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "应用壳层",
  render: (args) => (
    <AppShellFrame
      {...args}
      labels={labels}
      sidebarTitle="Research Desk"
      sidebarNavigation={(
        <>
          <CompositeButton icon={<FileTextOutlined />} label="Documents" />
          <CompositeButton icon={<DatabaseOutlined />} label="Library" />
          <CompositeButton icon={<SettingOutlined />} label="Settings" />
        </>
      )}
      sidebar={(
        <div style={{ padding: 20 }}>
          <Typography.Text>Recent work and navigation are injected by the product.</Typography.Text>
        </div>
      )}
      title="Design system migration notes"
      backAction={{ label: "Back to documents", onClick: () => undefined }}
      sidebarCollapsedActions={(
        <Button type="text" icon={<FileAddOutlined />} aria-label="Create document" />
      )}
      rightPanel={(
        <div style={{ padding: 24 }}>
          <Typography.Title level={3}>Document details</Typography.Title>
          <Typography.Paragraph>
            Product-owned metadata, tools or secondary context can be placed in this container.
          </Typography.Paragraph>
        </div>
      )}
    >
      <article style={{ maxWidth: 760, padding: 32 }}>
        <Typography.Title level={2}>Full-viewport application structure</Typography.Title>
        <Typography.Paragraph>
          The shell owns sidebar, header and scrolling boundaries while navigation data and product actions remain injected.
        </Typography.Paragraph>
      </article>
    </AppShellFrame>
  ),
  play: async ({ canvasElement }: StoryContext) => {
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/app-shell-frame"][data-sidebar-state="open"]');
    assertStorySelector(canvasElement, '[aria-label="Workspace navigation"]');
    assertStorySelector(canvasElement, '[aria-label="Document details"]');
    assertStoryText(canvasElement, "Design system migration notes");

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
      sidebar={<div style={{ padding: 20 }}>Workspace navigation</div>}
      title="Review workspace"
      defaultRightPanelOpen={false}
      rightPanel={(
        <div style={{ padding: 24 }}>
          <Typography.Text>Review tools</Typography.Text>
        </div>
      )}
    >
      <div style={{ padding: 32 }}>The product decides whether the optional right panel exists.</div>
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
