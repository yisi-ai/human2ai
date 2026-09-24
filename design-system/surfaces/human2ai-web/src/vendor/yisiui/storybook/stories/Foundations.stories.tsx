import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { useState } from "react";
import { Card, Checkbox, Col, Divider, Input, Row, Select, Space, Typography } from "antd";

import { BasicButton, StatusBadge, TabSwitch } from "@human2ai/ui/yisiui";
import { tokens, type TokenName } from "@human2ai/ui/yisiui/tokens";
import styles from "./Foundations.stories.module.css";
import { FoundationsColorComparison } from "./FoundationsColorComparison";

const meta = { id: "foundations-tokens", title: "yisiui-Foundations/Tokens" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const PrimaryColorComparison: Story = {
  name: "主色对比",
  render: () => <FoundationsColorComparison />,
};

type ColorTokenName = Extract<TokenName, `color.${string}`>;

const colorTokenLabels: Record<ColorTokenName, string> = {
  "color.brand.primary": "品牌主色",
  "color.brand.primaryHover": "品牌悬停色",
  "color.brand.primaryActive": "品牌按下色",
  "color.brand.primaryBg": "主色浅背景",
  "color.brand.primaryBgHover": "主色浅背景悬停态",
  "color.brand.primaryText": "主色文字与焦点",
  "color.brand.onPrimary": "主色前景文字",
  "color.neutral.0": "中性 0（纯白）",
  "color.neutral.25": "中性 25（极浅背景）",
  "color.neutral.50": "中性 50（柔和背景）",
  "color.neutral.100": "中性 100（页面背景）",
  "color.neutral.200": "中性 200（弱边框）",
  "color.neutral.300": "中性 300（默认边框）",
  "color.neutral.400": "中性 400（悬停边框）",
  "color.neutral.500": "中性 500（禁用文字）",
  "color.neutral.600": "中性 600（弱化文字）",
  "color.neutral.700": "中性 700（次要文字）",
  "color.neutral.800": "中性 800（高对比文字）",
  "color.neutral.900": "中性 900（主文字）",
  "color.paper.natural": "纸色·原纸",
  "color.paper.sage": "纸色·鼠尾草",
  "color.paper.amber": "纸色·琥珀",
  "color.paper.rose": "纸色·陶红",
  "color.paper.slate": "纸色·石板",
  "color.paper.sky": "纸色·雾青",
  "color.paper.lavender": "纸色·藤紫",
  "color.paper.clay": "纸色·陶土",
  "color.status.success": "成功色",
  "color.status.successBg": "成功背景色",
  "color.status.warning": "提醒色",
  "color.status.warningBg": "提醒背景色",
  "color.status.danger": "危险操作色",
  "color.status.dangerBg": "危险操作背景色",
  "color.status.info": "信息色",
  "color.status.infoBg": "信息背景色",
  "color.status.processing": "处理中颜色",
  "color.status.processingBg": "处理中背景色",
  "color.text.primary": "主文字色",
  "color.text.secondary": "次要文字色",
  "color.text.muted": "弱化文字色",
  "color.text.hint": "提示文字色",
  "color.text.placeholder": "占位文字色",
  "color.text.disabled": "禁用文字色",
  "color.text.inverse": "反色文字色",
  "color.text.onPrimary": "主色上的文字色",
  "color.border.default": "默认边框色",
  "color.border.subtle": "弱边框色",
  "color.border.control": "控件识别边框色",
  "color.border.interactive": "交互边框色",
  "color.border.hover": "悬停边框色",
  "color.border.focus": "聚焦边框色",
  "color.border.disabled": "禁用边框色",
  "color.border.error": "错误边框色",
  "color.border.warning": "提醒边框色",
  "color.border.success": "成功边框色",
  "color.surface.page": "页面底色",
  "color.surface.panel": "面板底色",
  "color.surface.soft": "柔和底色",
  "color.surface.code": "代码区域底色",
  "color.surface.hover": "划过底色",
  "color.surface.selected": "选中底色",
  "color.surface.active": "激活底色",
  "color.surface.disabled": "禁用底色",
  "color.surface.overlay": "浮层遮罩色",
  "color.action.primary": "主操作色",
  "color.action.primaryHover": "主操作悬停色",
  "color.action.primaryActive": "主操作按下色",
  "color.action.secondaryHover": "次要操作悬停底色",
  "color.action.secondaryActive": "次要操作按下底色",
  "color.action.link": "链接色",
  "color.action.linkHover": "链接悬停色",
  "color.action.linkActive": "链接按下色",
  "color.feedback.success": "成功反馈色",
  "color.feedback.successBg": "成功反馈背景色",
  "color.feedback.warning": "提醒反馈色",
  "color.feedback.warningBg": "提醒反馈背景色",
  "color.feedback.danger": "危险反馈色",
  "color.feedback.dangerBg": "危险反馈背景色",
  "color.feedback.error": "错误反馈色",
  "color.feedback.errorBg": "错误反馈背景色",
  "color.feedback.info": "信息反馈色",
  "color.feedback.infoBg": "信息反馈背景色",
  "color.feedback.processing": "处理中反馈色",
  "color.feedback.processingBg": "处理中反馈背景色",
  "color.selection.background": "选中区域底色",
  "color.selection.text": "选中文字色",
};

const colorTokenNames = (Object.keys(tokens) as TokenName[]).filter((name): name is ColorTokenName => name.startsWith("color."));

const colorTokenGroups: readonly {
  id: string;
  label: string;
  prefixes: readonly string[];
}[] = [
  { id: "brand-neutral", label: "品牌与中性色", prefixes: ["color.brand.", "color.neutral."] },
  { id: "status", label: "状态色", prefixes: ["color.status."] },
  { id: "text", label: "文字色", prefixes: ["color.text."] },
  { id: "border", label: "边框色", prefixes: ["color.border."] },
  { id: "surface", label: "表面与底色", prefixes: ["color.surface."] },
  { id: "action", label: "操作色", prefixes: ["color.action."] },
  { id: "feedback", label: "反馈色", prefixes: ["color.feedback."] },
  { id: "selection", label: "选中色", prefixes: ["color.selection."] },
  { id: "paper", label: "纸张色", prefixes: ["color.paper."] },
];

function ColorTokenCard({ name }: { name: ColorTokenName }) {
  return (
    <Col key={name} xs={24} sm={12} lg={6}>
      <Card size="small">
        <Space orientation="vertical" size={8} style={{ width: "100%" }}>
          <Typography.Text strong>{colorTokenLabels[name]}</Typography.Text>
          <Typography.Text code style={{ wordBreak: "break-all" }}>{name}</Typography.Text>
          <div
            role="img"
            aria-label={`${colorTokenLabels[name]}色板`}
            style={{
              height: 48,
              background: String(tokens[name]),
              border: "1px solid var(--yisiui-color-border-default)",
              borderRadius: String(tokens["radius.md"]),
            }}
          />
          <Typography.Text type="secondary">{String(tokens[name])}</Typography.Text>
        </Space>
      </Card>
    </Col>
  );
}

function ThemeApplicationPreview() {
  const [saved, setSaved] = useState(false);
  const [view, setView] = useState("all");
  const [selected, setSelected] = useState(true);
  return (
    <section aria-labelledby="theme-preview-title" className={styles.preview}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>YisiUI · 默认主题</p>
          <h1 id="theme-preview-title">青灰与鲜绿</h1>
          <p className={styles.description}>用真实控件比较内容层级、主操作、选中态与键盘焦点。下方交互仅用于本页预览。</p>
        </div>
        <div className={styles.palette} role="group" aria-label="主题主色状态">
          {([
            ["默认", "color.brand.primary"],
            ["悬停", "color.brand.primaryHover"],
            ["按下", "color.brand.primaryActive"],
          ] as const).map(([label, name]) => (
            <div key={name} className={styles.paletteItem} style={{ background: String(tokens[name]) }}>
              <span>{label}</span><code>{tokens[name]}</code>
            </div>
          ))}
        </div>
      </header>
      <div className={styles.applications}>
        <form className={styles.panel} onChange={() => setSaved(false)} onSubmit={(event) => { event.preventDefault(); setSaved(true); }}>
          <h2>工作区偏好</h2>
          <p className={styles.description}>输入边界清晰可见，辅助说明保留足够的阅读对比度。</p>
          <div className={styles.fields}>
            <label htmlFor="theme-workspace-name">工作区名称</label>
            <Input id="theme-workspace-name" defaultValue="创作空间" />
            <label htmlFor="theme-workspace-description">说明</label>
            <Input id="theme-workspace-description" placeholder="添加一句简短说明" />
            <label htmlFor="theme-workspace-view">默认视图</label>
            <Select id="theme-workspace-view" defaultValue="list" onChange={() => setSaved(false)} options={[
              { value: "list", label: "列表视图" }, { value: "cards", label: "卡片视图" },
            ]} />
            <Checkbox defaultChecked>打开时恢复上次内容</Checkbox>
          </div>
          <div className={styles.formActions}>
            <span className={styles.feedback} role="status">{saved ? "已保存本页预览设置" : "设置仅保留在当前预览"}</span>
            <BasicButton htmlType="submit" type="primary">保存设置</BasicButton>
          </div>
        </form>
        <section className={styles.panel} aria-labelledby="theme-state-title">
          <h2 id="theme-state-title">操作与状态</h2>
          <p className={styles.description}>主操作用鲜绿，信息提示用青灰，成功与警告保留各自语义。</p>
          <TabSwitch aria-label="示例项目筛选" value={view} onChange={setView} items={[
            { key: "all", label: "全部项目", mode: "text-only" },
            { key: "recent", label: "最近编辑", mode: "text-only" },
          ]} />
          <div className={styles.projectRow}>
            <div><strong>{view === "all" ? "设计资料库" : "今日工作笔记"}</strong><p className={styles.description}>最近更新 · 5 分钟前</p></div>
            <StatusBadge tone="success" label="已同步" />
          </div>
          <div className={styles.selection} data-selected={selected}>
            <Checkbox checked={selected} onChange={(event) => setSelected(event.target.checked)}>{selected ? "已选中 1 个项目" : "选择此项目"}</Checkbox>
            <Typography.Link href="#theme-color-catalog">查看颜色用途</Typography.Link>
          </div>
          <Space wrap className={styles.stateRow}>
            <StatusBadge tone="info" label="待处理" />
            <StatusBadge tone="processing" label="同步中" />
            <StatusBadge tone="warning" label="需要检查" />
            <StatusBadge tone="danger" label="同步失败" />
          </Space>
          <Space wrap className={styles.stateRow}>
            <BasicButton>次要操作</BasicButton>
            <BasicButton type="primary" loading>保存中</BasicButton>
            <BasicButton type="primary" disabled>暂不可用</BasicButton>
          </Space>
        </section>
      </div>
    </section>
  );
}

export const Colors: Story = {
  name: "颜色",
  render: () => (
    <main className={styles.page}>
      <div className={styles.content}>
      <ThemeApplicationPreview />
      <h2 id="theme-color-catalog" className={styles.catalogTitle}>颜色用途与 Token</h2>
      <Space orientation="vertical" size={24} style={{ width: "100%" }}>
        {colorTokenGroups.map(({ id, label, prefixes }) => {
          const names = colorTokenNames.filter((name) => prefixes.some((prefix) => name.startsWith(prefix)));
          return (
            <section key={id} aria-labelledby={`color-group-${id}`}>
              <Divider titlePlacement="start" plain>
                <span id={`color-group-${id}`}>{label}</span>
              </Divider>
              <Row gutter={[16, 16]}>{names.map((name) => <ColorTokenCard key={name} name={name} />)}</Row>
            </section>
          );
        })}
      </Space>
      </div>
    </main>
  ),
  play: ({ canvasElement }) => {
    if (!canvasElement.querySelector('button[type="submit"]') || !canvasElement.querySelector('input[placeholder="添加一句简短说明"]')) {
      throw new Error("颜色预览必须包含真实的主操作与输入控件。");
    }
    colorTokenNames.filter((name) => name.startsWith("color.paper.")).forEach((name) => {
      if (!canvasElement.textContent?.includes(name)) {
        throw new Error(`Foundations light theme must expose the ${name} token.`);
      }
    });
  },
};
