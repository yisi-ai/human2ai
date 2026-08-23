import {
  CopyOutlined,
  DatabaseOutlined,
  EditOutlined,
  FileAddOutlined,
  FileTextOutlined,
  MoreOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import type { Meta, StoryObj } from "@storybook/react-webpack5";

import { BasicButton } from "@human2ai/ui/yisiui";
import { CompositeButton } from "@human2ai/ui/yisiui";
import { SideActionPanel } from "@human2ai/ui/yisiui";
import { assertStorySelector, assertStoryText } from "../interactionChecks";

const meta = {
  id: "modules-sideactionpanel",
  title: "Modules/SideActionPanel",
  component: SideActionPanel,
  parameters: { layout: "centered" },
  argTypes: {
    tools: { control: false },
    children: { control: false },
    collapsed: { control: false },
    defaultCollapsed: { control: "boolean" },
    width: { control: { type: "number", min: 160, max: 420, step: 4 } },
    onCollapsedChange: { action: "collapsed changed" },
    style: { control: false },
  },
} satisfies Meta<typeof SideActionPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "侧边操作面板",
  render: (args) => (
    <div className="yisi-side-action-panel-story-frame">
      <SideActionPanel
        {...args}
        tools={
          <>
            <BasicButton
              mode="icon-only"
              type="text"
              icon={<FileAddOutlined />}
              iconLabel="新建项目"
              title="新建项目"
            />
            <BasicButton
              mode="icon-only"
              type="text"
              icon={<MoreOutlined />}
              iconLabel="更多工具"
              title="更多工具"
            />
          </>
        }
      >
        <CompositeButton icon={<FileTextOutlined />} label="文章列表" onClick={() => undefined} />
        <CompositeButton
          icon={<DatabaseOutlined />}
          label="内容库"
          description="12 个待处理项目"
          actions={[{ key: "edit", icon: <EditOutlined />, label: "编辑内容库", onClick: () => undefined }]}
          onClick={() => undefined}
        />
        <CompositeButton
          icon={<SettingOutlined />}
          label="设置"
          description="3 项需要确认"
          actions={[{ key: "copy", icon: <CopyOutlined />, label: "复制设置", onClick: () => undefined }]}
          onClick={() => undefined}
        />
      </SideActionPanel>
    </div>
  ),
  args: { defaultCollapsed: false, width: 220 },
  play: async ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/side-action-panel"]');
    assertStorySelector(canvasElement, '[role="group"][aria-label="面板工具"]');
    assertStorySelector(canvasElement, '[aria-label="收起侧边面板"][aria-expanded="true"]');
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/composite-button"]');
    assertStoryText(canvasElement, "12 个待处理项目");

    const panel = canvasElement.querySelector<HTMLElement>('[data-yisiui-asset="yisiui/side-action-panel"]');
    const toggle = canvasElement.querySelector<HTMLButtonElement>('[aria-label="收起侧边面板"]');
    if (!panel || !toggle) {
      throw new Error("SideActionPanel interaction contract missing panel or collapse control");
    }
    const expandedHeight = panel.getBoundingClientRect().height;
    toggle.click();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/side-action-panel"][data-collapsed="true"]');
    assertStorySelector(canvasElement, '[aria-label="展开侧边面板"][aria-expanded="false"]');
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/composite-button"][data-collapsed="true"]');
    assertStorySelector(canvasElement, 'button[aria-label="文章列表"]');
    const collapsedHeight = panel.getBoundingClientRect().height;
    if (Math.abs(collapsedHeight - expandedHeight) > 0.5) {
      throw new Error(`SideActionPanel height changed after collapse: ${expandedHeight} -> ${collapsedHeight}`);
    }

    canvasElement.querySelector<HTMLButtonElement>('[aria-label="展开侧边面板"]')?.click();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/side-action-panel"][data-collapsed="false"]');
  },
};

export const Collapsed: Story = {
  name: "已收起",
  render: () => (
    <div className="yisi-side-action-panel-story-frame">
      <SideActionPanel width={220} defaultCollapsed tools={<BasicButton mode="icon-only" icon={<FileAddOutlined />} iconLabel="新建项目" />}>
        <CompositeButton icon={<FileTextOutlined />} label="文章列表" />
      </SideActionPanel>
    </div>
  ),
  play: ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/side-action-panel"][data-collapsed="true"]');
    assertStorySelector(canvasElement, '[aria-label="展开侧边面板"][aria-expanded="false"]');
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/composite-button"][data-collapsed="true"]');
    assertStorySelector(canvasElement, 'button[aria-label="文章列表"]');
  },
};
