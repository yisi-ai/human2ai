import type { CSSProperties, ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Card, Divider, Space, Typography } from "antd";

import { tokens, type TokenName } from "@human2ai/ui/yisiui/tokens";
import { assertStoryText } from "../interactionChecks";
import styles from "./FoundationsTokenScales.stories.module.css";

const meta = { id: "foundations-tokens", title: "yisiui-Foundations/Tokens" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const tokenValue = (name: TokenName): string => String(tokens[name]);

function tokenStyle(values: Record<string, string>): CSSProperties {
  return values as CSSProperties;
}

function Scene({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main className={styles.scene}>
      <Space orientation="vertical" size={24} className={styles.sceneStack}>
        <Card className={styles.intro}>
          <Typography.Title level={2} style={{ marginTop: 0 }}>{title}</Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>{description}</Typography.Paragraph>
        </Card>
        {children}
      </Space>
    </main>
  );
}

function TokenHeader({ label, name }: { label: string; name: TokenName }) {
  return (
    <div className={styles.specimenHeader}>
      <Typography.Text strong>{label}</Typography.Text>
      <Typography.Text code className={styles.tokenPath}>{name}</Typography.Text>
      <Typography.Text type="secondary">{tokenValue(name)}</Typography.Text>
    </div>
  );
}

const spacingTokens = [
  ["零间距", "space.0"],
  ["极小间距", "space.1"],
  ["小间距", "space.2"],
  ["紧凑间距", "space.3"],
  ["默认间距", "space.4"],
  ["舒展间距", "space.5"],
  ["区块间距", "space.6"],
  ["大间距", "space.8"],
  ["超大间距", "space.10"],
] as const satisfies readonly (readonly [string, TokenName])[];

const radiusTokens = [
  ["小圆角", "radius.sm"],
  ["默认圆角", "radius.md"],
  ["大圆角", "radius.lg"],
  ["半圆圆角", "radius.full"],
] as const satisfies readonly (readonly [string, TokenName])[];

const shadowTokens = [
  ["面板阴影", "shadow.panel"],
  ["卡片阴影", "shadow.card"],
  ["浮层阴影", "shadow.raised"],
] as const satisfies readonly (readonly [string, TokenName])[];

const motionTokens = [
  ["快速反馈", "motion.fast"],
  ["默认过渡", "motion.normal"],
  ["舒缓过渡", "motion.slow"],
] as const satisfies readonly (readonly [string, TokenName])[];

const textSpeedTokens = [
  ["慢速", "motion.textSpeed.slow"],
  ["中速", "motion.textSpeed.medium"],
  ["快速", "motion.textSpeed.fast"],
] as const satisfies readonly (readonly [string, TokenName])[];

export const Spacing: Story = {
  name: "间距",
  render: () => (
    <Scene title="间距刻度" description="两个相同块之间使用真实 space Token，直接比较从无间距到超大间距的视觉节奏。">
      <div className={styles.specimenGrid}>
        {spacingTokens.map(([label, name]) => (
          <article className={styles.specimenCard} key={name}>
            <TokenHeader label={label} name={name} />
            <div className={styles.spacingPreview} style={{ gap: tokenValue(name) }}>
              <span className={styles.spacingBlock} />
              <span className={styles.spacingBlock} />
            </div>
          </article>
        ))}
      </div>
    </Scene>
  ),
  play: ({ canvasElement }) => assertStoryText(canvasElement, "space.10"),
};

export const Radius: Story = {
  name: "圆角",
  render: () => (
    <Scene title="圆角刻度" description="所有样本保持相同尺寸，只改变 radius Token；半圆级别让样本左右两端形成完整半圆。">
      <div className={styles.specimenGrid}>
        {radiusTokens.map(([label, name]) => (
          <article className={styles.specimenCard} key={name}>
            <TokenHeader label={label} name={name} />
            <div className={styles.radiusPreview} style={{ borderRadius: tokenValue(name) }}>
              <span className={styles.radiusShape} style={{ borderRadius: tokenValue(name) }} />
            </div>
          </article>
        ))}
      </div>
    </Scene>
  ),
  play: ({ canvasElement }) => assertStoryText(canvasElement, "radius.full"),
};

export const Shadows: Story = {
  name: "阴影",
  render: () => (
    <Scene title="阴影层级" description="统一尺寸和背景下比较面板、卡片与浮层三种深度，不把阴影作为装饰性强调。">
      <div className={styles.specimenGrid}>
        {shadowTokens.map(([label, name]) => (
          <article className={styles.specimenCard} key={name}>
            <TokenHeader label={label} name={name} />
            <div className={styles.shadowStage}>
              <div className={styles.shadowSample} style={{ boxShadow: tokenValue(name) }}>
                <Typography.Text>{label}</Typography.Text>
              </div>
            </div>
          </article>
        ))}
      </div>
    </Scene>
  ),
  play: ({ canvasElement }) => assertStoryText(canvasElement, "shadow.raised"),
};

export const Motion: Story = {
  name: "动效",
  render: () => (
    <Scene title="动效速度" description="悬停或聚焦样本可比较三档过渡时长；文字动效倍率单独列出，动效不承担唯一信息。">
      <div className={styles.specimenGrid}>
        {motionTokens.map(([label, name]) => (
          <article className={styles.specimenCard} key={name}>
            <TokenHeader label={label} name={name} />
            <div
              className={styles.motionSample}
              style={tokenStyle({ "--foundation-motion-duration": tokenValue(name) })}
              tabIndex={0}
              aria-label={`${label}，悬停或聚焦查看 ${tokenValue(name)} 过渡`}
            >
              <div className={styles.motionTrack}><span className={styles.motionDot} /></div>
              <Typography.Text type="secondary">悬停或使用 Tab 聚焦</Typography.Text>
            </div>
          </article>
        ))}
      </div>
      <Divider titlePlacement="start" plain>文字动效倍率</Divider>
      <div className={styles.speedList}>
        {textSpeedTokens.map(([label, name]) => (
          <div className={styles.speedItem} key={name}>
            <Typography.Text strong>{label}</Typography.Text>
            <Typography.Text code>{name}</Typography.Text>
            <Typography.Text type="secondary">{tokenValue(name)}×</Typography.Text>
          </div>
        ))}
      </div>
    </Scene>
  ),
  play: ({ canvasElement }) => assertStoryText(canvasElement, "motion.textSpeed.fast"),
};

const layoutMetrics = [
  ["持久侧栏宽度", "surface.desktopWeb.sidebarWidth"],
  ["内容最大宽度", "surface.desktopWeb.contentMaxWidth"],
  ["页面内边距", "surface.desktopWeb.pagePadding"],
  ["区段间距", "surface.desktopWeb.sectionGap"],
  ["面板内边距", "surface.desktopWeb.panelPadding"],
] as const satisfies readonly (readonly [string, TokenName])[];

export const LayoutMetrics: Story = {
  name: "布局尺寸",
  render: () => (
    <Scene title="桌面布局尺寸" description="缩略工作区使用真实页面 padding、区段 gap 和面板 padding；侧栏与内容宽度同时标注正式值。">
      <div
        className={styles.layoutFrame}
        style={tokenStyle({
          "--foundation-sidebar-width": tokenValue("surface.desktopWeb.sidebarWidth"),
          "--foundation-page-padding": tokenValue("surface.desktopWeb.pagePadding"),
          "--foundation-section-gap": tokenValue("surface.desktopWeb.sectionGap"),
          "--foundation-panel-padding": tokenValue("surface.desktopWeb.panelPadding"),
        })}
      >
        <aside className={styles.layoutSidebar}>
          <Typography.Text strong>持久侧栏</Typography.Text>
          <Typography.Text code>surface.desktopWeb.sidebarWidth</Typography.Text>
          <Typography.Text type="secondary">{tokenValue("surface.desktopWeb.sidebarWidth")}</Typography.Text>
        </aside>
        <div className={styles.layoutContent}>
          <div className={styles.layoutPanel}>
            <Typography.Text strong>工作面板 A</Typography.Text>
            <Typography.Paragraph type="secondary">面板内容使用正式 panelPadding。</Typography.Paragraph>
          </div>
          <div className={styles.layoutPanel}>
            <Typography.Text strong>工作面板 B</Typography.Text>
            <Typography.Paragraph type="secondary">两个面板之间使用正式 sectionGap。</Typography.Paragraph>
          </div>
        </div>
      </div>
      <div className={styles.metricGrid}>
        {layoutMetrics.map(([label, name]) => (
          <div className={styles.metricItem} key={name}>
            <Typography.Text strong>{label}</Typography.Text>
            <Typography.Text code>{name}</Typography.Text>
            <Typography.Text type="secondary">{tokenValue(name)}</Typography.Text>
          </div>
        ))}
      </div>
    </Scene>
  ),
  play: ({ canvasElement }) => assertStoryText(canvasElement, "surface.desktopWeb.contentMaxWidth"),
};

export const ComponentGeometry: Story = {
  name: "组件尺寸",
  render: () => (
    <Scene title="基础组件尺寸" description="按钮、输入框和卡片使用 component Token 的真实高度、内边距、圆角与阴影。">
      <div
        className={styles.componentStage}
        style={tokenStyle({
          "--foundation-button-height": tokenValue("component.button.height"),
          "--foundation-button-radius": tokenValue("component.button.radius"),
          "--foundation-button-padding": tokenValue("component.button.horizontalPadding"),
          "--foundation-input-height": tokenValue("component.input.height"),
          "--foundation-input-radius": tokenValue("component.input.radius"),
          "--foundation-card-padding": tokenValue("component.card.padding"),
          "--foundation-card-radius": tokenValue("component.card.radius"),
          "--foundation-card-shadow": tokenValue("component.card.shadow"),
        })}
      >
        <article className={styles.specimenCard}>
          <TokenHeader label="按钮几何" name="component.button.height" />
          <div className={styles.componentSpecimen}>
            <span className={styles.buttonSpecimen}>主要操作</span>
            <Typography.Text code>radius {tokenValue("component.button.radius")} · padding {tokenValue("component.button.horizontalPadding")}</Typography.Text>
          </div>
        </article>
        <article className={styles.specimenCard}>
          <TokenHeader label="输入框几何" name="component.input.height" />
          <div className={styles.componentSpecimen}>
            <span className={styles.inputSpecimen}>输入内容</span>
            <Typography.Text code>radius {tokenValue("component.input.radius")}</Typography.Text>
          </div>
        </article>
        <article className={styles.specimenCard}>
          <TokenHeader label="卡片几何" name="component.card.padding" />
          <div className={styles.cardSpecimen}>
            <Typography.Text strong>卡片内容</Typography.Text>
            <Typography.Paragraph type="secondary">圆角、内边距和阴影全部来自 component.card。</Typography.Paragraph>
          </div>
        </article>
      </div>
    </Scene>
  ),
  play: ({ canvasElement }) => assertStoryText(canvasElement, "component.card.padding"),
};
