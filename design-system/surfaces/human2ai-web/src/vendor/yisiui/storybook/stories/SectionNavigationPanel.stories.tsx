import {
  BellOutlined,
  ControlOutlined,
  ExperimentOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Empty, Typography } from "antd";
import { useState } from "react";

import {
  SectionNavigationPanel,
  type SectionNavigationPanelItem,
  type SectionNavigationPanelProps,
} from "@human2ai/ui/yisiui";
import { assertStoryRole, assertStorySelector, assertStoryText } from "../interactionChecks";
import styles from "./SectionNavigationPanel.stories.module.css";

const items = [
  { key: "general", label: "常规", icon: <ControlOutlined /> },
  { key: "notifications", label: "通知", icon: <BellOutlined /> },
  { key: "security", label: "安全", icon: <SafetyCertificateOutlined /> },
] as const satisfies readonly SectionNavigationPanelItem[];

const contentByKey: Record<string, { title: string; description: string }> = {
  general: { title: "常规设置", description: "业务在这里注入常规设置内容。" },
  notifications: { title: "通知设置", description: "通知渠道和规则仍由消费项目管理。" },
  security: { title: "安全设置", description: "共享组件不读取账号、权限或持久化状态。" },
};

function InteractiveExample(props: SectionNavigationPanelProps) {
  const [activeKey, setActiveKey] = useState(props.activeKey);
  const [closeRequested, setCloseRequested] = useState(false);
  const activeContent = activeKey ? contentByKey[activeKey] : undefined;

  return (
    <div className={styles.frame} data-close-requested={closeRequested ? "true" : "false"}>
      <SectionNavigationPanel
        {...props}
        activeKey={activeKey}
        onActiveKeyChange={(key, item) => {
          setActiveKey(key);
          props.onActiveKeyChange(key, item);
        }}
        onClose={() => {
          setCloseRequested(true);
          props.onClose();
        }}
        content={
          activeContent ? (
            <div className={styles.content}>
              <Typography.Title level={4} style={{ margin: 0 }}>
                {activeContent.title}
              </Typography.Title>
              <Typography.Paragraph>{activeContent.description}</Typography.Paragraph>
            </div>
          ) : null
        }
      />
      <span className={styles.status} aria-live="polite">
        {closeRequested ? "已收到关闭请求" : null}
      </span>
    </div>
  );
}

const meta = {
  id: "modules-sectionnavigationpanel",
  title: "Modules/SectionNavigationPanel",
  component: SectionNavigationPanel,
  parameters: { layout: "centered" },
  args: {
    title: "偏好设置",
    items,
    activeKey: "general",
    content: null,
    onActiveKeyChange: () => undefined,
    onClose: () => undefined,
    navigationLabel: "设置分区",
    closeLabel: "关闭设置",
  },
  argTypes: {
    title: { control: false },
    items: { control: false },
    activeKey: { control: false },
    content: { control: false },
    onActiveKeyChange: { action: "active section changed" },
    onClose: { action: "close requested" },
    navigationLabel: { control: "text" },
    contentLabel: { control: "text" },
    closeLabel: { control: "text" },
    "aria-label": { control: "text" },
    className: { control: false },
    style: { control: false },
  },
} satisfies Meta<typeof SectionNavigationPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "双栏分区面板",
  render: (args) => <InteractiveExample {...args} />,
  play: ({ canvasElement }) => {
    assertStorySelector(
      canvasElement,
      '[data-yisiui-asset="yisiui/section-navigation-panel"][data-active-key="general"]',
    );
    assertStoryRole(canvasElement, "navigation");
    assertStorySelector(canvasElement, '[aria-label="设置分区"]');
    assertStorySelector(canvasElement, ".yisi-section-navigation-panel-title");
    assertStorySelector(canvasElement, 'button[aria-current="true"]');
    assertStoryText(canvasElement, "常规设置");

    const securityButton = Array.from(canvasElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("安全"));
    if (!securityButton) {
      throw new Error("SectionNavigationPanel Story 缺少安全分区按钮");
    }
    securityButton.click();
    assertStorySelector(
      canvasElement,
      '[data-yisiui-asset="yisiui/section-navigation-panel"][data-active-key="security"]',
    );
    assertStoryText(canvasElement, "安全设置");

    canvasElement.querySelector<HTMLButtonElement>('button[aria-label="关闭设置"]')?.click();
    assertStorySelector(canvasElement, '[data-close-requested="true"]');
    assertStoryText(canvasElement, "已收到关闭请求");
  },
};

export const LongContent: Story = {
  name: "长菜单与滚动内容",
  render: () => (
    <div className={styles.frame}>
      <SectionNavigationPanel
        title="高级偏好"
        items={[
          { key: "advanced", label: "高级实验功能与兼容性设置", icon: <ExperimentOutlined /> },
          { key: "locked", label: "受策略保护的设置", icon: <SafetyCertificateOutlined />, disabled: true },
        ]}
        activeKey="advanced"
        onActiveKeyChange={() => undefined}
        onClose={() => undefined}
        content={
          <div className={styles.content}>
            <Typography.Title level={4} style={{ margin: 0 }}>
              长内容滚动边界
            </Typography.Title>
            <ol className={styles.longList}>
              {Array.from({ length: 18 }, (_, index) => (
                <li key={index}>第 {index + 1} 项业务内容由消费项目注入。</li>
              ))}
            </ol>
          </div>
        }
      />
    </div>
  ),
  play: ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-section-key="locked"] button[disabled]');
    assertStorySelector(canvasElement, '.yisi-section-navigation-panel-content[role="region"]');
    assertStoryText(canvasElement, "第 18 项业务内容");
  },
};

export const EmptyNavigation: Story = {
  name: "空菜单与空内容",
  render: () => (
    <div className={styles.frame}>
      <SectionNavigationPanel
        title="空面板"
        items={[]}
        activeKey={null}
        onActiveKeyChange={() => undefined}
        onClose={() => undefined}
        contentLabel="空内容"
        content={<Empty description="暂无可用分区" />}
      />
    </div>
  ),
  play: ({ canvasElement }) => {
    assertStorySelector(
      canvasElement,
      '[data-yisiui-asset="yisiui/section-navigation-panel"][data-empty="true"]',
    );
    assertStorySelector(canvasElement, '[role="region"][aria-label="空内容"]');
    assertStoryText(canvasElement, "暂无可用分区");
  },
};
