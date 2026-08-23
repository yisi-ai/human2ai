import type { CSSProperties } from "react";
import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Card, Col, Divider, Row, Space, Typography as AntTypography } from "antd";

import { tokens, type TokenName } from "@human2ai/ui/yisiui/tokens";
import { assertStoryText } from "../interactionChecks";

const meta = { title: "Foundations/Tokens" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const tokenValue = (name: string): string => String(tokens[name as TokenName]);
const tokenNumber = (name: string): number => Number(tokenValue(name));

type FoundationKind = "size" | "weight" | "lineHeight" | "letterSpacing";
type FoundationItem = { label: string; token: string; sample: string };
type FoundationGroup = {
  id: string;
  label: string;
  kind: FoundationKind;
  items: readonly FoundationItem[];
};

const foundationGroups: readonly FoundationGroup[] = [
  {
    id: "size",
    label: "字号刻度",
    kind: "size",
    items: [
      { label: "极小字号", token: "font.size.2xs", sample: "辅助标签" },
      { label: "小号", token: "font.size.xs", sample: "元数据 / 12px" },
      { label: "次要正文", token: "font.size.sm", sample: "次要正文" },
      { label: "默认正文", token: "font.size.md", sample: "默认正文" },
      { label: "卡片标题", token: "font.size.lg", sample: "卡片标题" },
      { label: "区块标题", token: "font.size.xl", sample: "区块标题" },
      { label: "大标题", token: "font.size.2xl", sample: "大标题" },
      { label: "阅读字号", token: "font.size.reading", sample: "长文阅读" },
      { label: "页面标题", token: "font.size.display", sample: "页面标题" },
    ],
  },
  {
    id: "weight",
    label: "字重刻度",
    kind: "weight",
    items: [
      { label: "常规", token: "font.weight.regular", sample: "常规 Regular / 中文" },
      { label: "中等", token: "font.weight.medium", sample: "中等 Medium / 中文" },
      { label: "半粗", token: "font.weight.semibold", sample: "半粗 Semibold / 中文" },
      { label: "粗体", token: "font.weight.bold", sample: "粗体 Bold / 中文" },
    ],
  },
  {
    id: "line-height",
    label: "行高刻度",
    kind: "lineHeight",
    items: [
      { label: "标题紧凑", token: "font.lineHeight.tight", sample: "标题第一行\n标题第二行\n标题第三行" },
      { label: "界面紧凑", token: "font.lineHeight.compact", sample: "标签第一行\n标签第二行\n标签第三行" },
      { label: "正文", token: "font.lineHeight.normal", sample: "正文第一行\n正文第二行\n正文第三行" },
      { label: "阅读舒展", token: "font.lineHeight.reading", sample: "阅读第一行\n阅读第二行\n阅读第三行" },
    ],
  },
  {
    id: "letter-spacing",
    label: "字距刻度",
    kind: "letterSpacing",
    items: [
      { label: "常规字距", token: "font.letterSpacing.normal", sample: "中文 English 123" },
      { label: "标签字距", token: "font.letterSpacing.label", sample: "KICKER 标签 / 导航" },
    ],
  },
];

type SemanticRole = {
  id: string;
  label: string;
  description: string;
  sample: string;
};
type SemanticGroup = { id: string; label: string; roles: readonly SemanticRole[] };

const semanticGroups: readonly SemanticGroup[] = [
  {
    id: "headings",
    label: "标题层级",
    roles: [
      { id: "pageTitle", label: "页面标题", description: "页面唯一主标题", sample: "YisiUI" },
      { id: "sectionTitle", label: "区块标题", description: "页面内主要分区标题", sample: "写作运行" },
      { id: "cardTitle", label: "卡片标题", description: "面板或卡片的标题", sample: "最近的文章资料" },
    ],
  },
  {
    id: "body",
    label: "正文与阅读",
    roles: [
      { id: "body", label: "正文", description: "默认界面正文", sample: "这是默认正文，用于解释内容和操作。" },
      { id: "bodyStrong", label: "强调正文", description: "正文中的重要信息", sample: "这是需要优先关注的内容。" },
      { id: "bodySmall", label: "次要正文", description: "较短的辅助说明", sample: "补充说明和轻量描述。" },
      { id: "reading", label: "阅读正文", description: "长文阅读与编辑区域", sample: "阅读正文使用更舒展的字号与行高，降低连续阅读的疲劳。" },
    ],
  },
  {
    id: "interface",
    label: "界面与状态",
    roles: [
      { id: "label", label: "字段标签", description: "表单字段与控件标签", sample: "文章标题" },
      { id: "kicker", label: "Kicker 标签", description: "区块上方的短标签", sample: "CONTENT WORKSPACE" },
      { id: "meta", label: "元数据", description: "时间、来源和轻量上下文", sample: "刚刚更新 · 由系统生成" },
      { id: "status", label: "状态文字", description: "运行、成功和提醒状态", sample: "等待处理" },
      { id: "button", label: "按钮文字", description: "按钮与主要操作", sample: "开始写作" },
    ],
  },
  {
    id: "data",
    label: "代码与数据",
    roles: [
      { id: "code", label: "代码文字", description: "代码片段与 Token 路径", sample: "typography.pageTitle.fontSize" },
      { id: "numeric", label: "数字强调", description: "统计数字与表格关键数值", sample: "1,284" },
    ],
  },
];

function hasToken(name: string): name is TokenName {
  return name in tokens;
}

function FoundationTokenCard({ item, kind }: { item: FoundationItem; kind: FoundationKind }) {
  const style: CSSProperties = {
    minHeight: kind === "lineHeight" ? 88 : 42,
    display: "flex",
    alignItems: "center",
    fontFamily: tokenValue("font.family.sans"),
    fontSize: kind === "size" ? tokenValue(item.token) : "16px",
    fontWeight: kind === "weight" ? tokenNumber(item.token) : 400,
    lineHeight: kind === "lineHeight" ? tokenNumber(item.token) : 1.4,
    letterSpacing: kind === "letterSpacing" ? tokenValue(item.token) : "0em",
    whiteSpace: kind === "lineHeight" ? "pre-line" : "normal",
  };

  return (
    <Col key={item.token} span={6}>
      <Card size="small">
        <Space orientation="vertical" size={8} style={{ width: "100%" }}>
          <AntTypography.Text strong>{item.label}</AntTypography.Text>
          <AntTypography.Text code style={{ wordBreak: "break-all" }}>{item.token}</AntTypography.Text>
          <div style={style}>{item.sample}</div>
          <AntTypography.Text type="secondary">{tokenValue(item.token)}</AntTypography.Text>
        </Space>
      </Card>
    </Col>
  );
}

function semanticTypographyStyle(id: string): CSSProperties {
  const prefix = `typography.${id}`;
  const style: CSSProperties = {
    fontFamily: tokenValue(`${prefix}.fontFamily`),
    fontSize: tokenValue(`${prefix}.fontSize`),
    fontWeight: tokenNumber(`${prefix}.fontWeight`),
    lineHeight: tokenNumber(`${prefix}.lineHeight`),
    letterSpacing: tokenValue(`${prefix}.letterSpacing`),
  };
  const variantNumericToken = `${prefix}.fontVariantNumeric`;
  if (hasToken(variantNumericToken)) {
    style.fontVariantNumeric = tokenValue(variantNumericToken);
  }
  return style;
}

function SemanticTypographyCard({ role }: { role: SemanticRole }) {
  const prefix = `typography.${role.id}`;
  const style: CSSProperties = {
    ...semanticTypographyStyle(role.id),
    minHeight: 52,
    display: "flex",
    alignItems: "center",
  };

  return (
    <Col key={role.id} span={8}>
      <Card size="small">
        <Space orientation="vertical" size={8} style={{ width: "100%" }}>
          <AntTypography.Text strong>{role.label}</AntTypography.Text>
          <AntTypography.Text type="secondary">{role.description}</AntTypography.Text>
          <div style={style}>{role.sample}</div>
          <AntTypography.Text code style={{ wordBreak: "break-all" }}>{prefix}</AntTypography.Text>
          <AntTypography.Text type="secondary">
            {tokenValue(`${prefix}.fontSize`)} · {tokenValue(`${prefix}.fontWeight`)} · {tokenValue(`${prefix}.lineHeight`)}
          </AntTypography.Text>
        </Space>
      </Card>
    </Col>
  );
}

export const Typography: Story = {
  name: "字体",
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
        <Card>
          <AntTypography.Title level={3} style={{ marginTop: 0 }}>字体层级</AntTypography.Title>
          <AntTypography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            基础刻度负责可复用的字号、字重、行高和字距；语义层级负责把这些刻度分配到具体界面角色。
          </AntTypography.Paragraph>
        </Card>

        {foundationGroups.map((group) => (
          <section key={group.id} aria-labelledby={`typography-foundation-${group.id}`}>
            <Divider orientation="left" plain>
              <span id={`typography-foundation-${group.id}`}>{group.label}</span>
            </Divider>
            <Row gutter={[16, 16]}>
              {group.items.map((item) => <FoundationTokenCard key={item.token} item={item} kind={group.kind} />)}
            </Row>
          </section>
        ))}

        {semanticGroups.map((group) => (
          <section key={group.id} aria-labelledby={`typography-semantic-${group.id}`}>
            <Divider orientation="left" plain>
              <span id={`typography-semantic-${group.id}`}>{group.label}</span>
            </Divider>
            <Row gutter={[16, 16]}>
              {group.roles.map((role) => <SemanticTypographyCard key={role.id} role={role} />)}
            </Row>
          </section>
        ))}
      </Space>
    </div>
  ),
  play: ({ canvasElement }) => assertStoryText(canvasElement, "typography.numeric"),
};
