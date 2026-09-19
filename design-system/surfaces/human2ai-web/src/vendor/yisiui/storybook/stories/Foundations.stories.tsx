import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Card, Col, Divider, Row, Space, Typography } from "antd";

import { tokens, type TokenName } from "@human2ai/ui/yisiui/tokens";

const meta = { id: "foundations-tokens", title: "yisiui-Foundations/Tokens" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

type ColorTokenName = Extract<TokenName, `color.${string}`>;

const colorTokenLabels: Record<ColorTokenName, string> = {
  "color.brand.primary": "品牌主色",
  "color.brand.primaryHover": "品牌悬停色",
  "color.brand.primaryActive": "品牌按下色",
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
  { id: "paper", label: "纸张色", prefixes: ["color.paper."] },
  { id: "brand-neutral", label: "品牌与中性色", prefixes: ["color.brand.", "color.neutral."] },
  { id: "status", label: "状态色", prefixes: ["color.status."] },
  { id: "text", label: "文字色", prefixes: ["color.text."] },
  { id: "border", label: "边框色", prefixes: ["color.border."] },
  { id: "surface", label: "表面与底色", prefixes: ["color.surface."] },
  { id: "action", label: "操作色", prefixes: ["color.action."] },
  { id: "feedback", label: "反馈色", prefixes: ["color.feedback."] },
  { id: "selection", label: "选中色", prefixes: ["color.selection."] },
];

function ColorTokenCard({ name }: { name: ColorTokenName }) {
  return (
    <Col key={name} span={6}>
      <Card size="small">
        <Space orientation="vertical" size={8} style={{ width: "100%" }}>
          <Typography.Text strong>{colorTokenLabels[name]}</Typography.Text>
          <Typography.Text code style={{ wordBreak: "break-all" }}>{name}</Typography.Text>
          <div
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

export const Colors: Story = {
  name: "颜色",
  render: () => (
    <div
      style={{
        maxHeight: "calc(100vh - 32px)",
        overflowX: "hidden",
        overflowY: "auto",
        padding: "4px 8px 16px 4px",
        scrollbarGutter: "stable",
      }}
    >
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
  ),
  play: ({ canvasElement }) => {
    colorTokenNames.filter((name) => name.startsWith("color.paper.")).forEach((name) => {
      if (!canvasElement.textContent?.includes(name)) {
        throw new Error(`Foundations light theme must expose the ${name} token.`);
      }
    });
  },
};
