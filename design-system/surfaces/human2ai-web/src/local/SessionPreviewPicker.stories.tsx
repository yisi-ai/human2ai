import { useState } from "react";
import { Switch } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { BasicButton } from "@human2ai/ui/yisiui/basic-button";
import { ConfirmAction } from "@human2ai/ui/yisiui/confirm-action";
import { SessionPreviewPicker } from "./SessionPreviewPicker";
import "./Human2AiCanvasNodeEditor.css";
import zh from "../../../../../locales/zh-CN/common.json";
import en from "../../../../../locales/en/common.json";

const meta: Meta<typeof SessionPreviewPicker> = { title: "human2ai/Components/SessionPreviewPicker", component: SessionPreviewPicker, parameters: { layout: "fullscreen" } };
export default meta;
type Story = StoryObj<typeof meta>;
function Example({ english = false, empty = false, failed = false, edit = false }: { english?: boolean; empty?: boolean; failed?: boolean; edit?: boolean }) {
  const locale = english ? en : zh;
  const labels = locale.sessionPreview;
  const [visible, setVisible] = useState(true);
  const [value, setValue] = useState<string[]>(edit ? ["ungrouped", "ui", "state-1"] : []);
  return <SessionPreviewPicker open mode={edit ? "edit" : "create"} labels={{ ...labels, ...locale.actions }}
    title={edit ? <div className="human2ai-canvas-node-editor__title">
      <span className="human2ai-canvas-node-editor__heading">
        <span className="human2ai-canvas-node-editor__origin">{locale.canvas.node.originUser}</span>
        <span>{labels.label}</span>
      </span>
      <Switch checked={visible} checkedChildren={locale.canvas.nodeVisibility.visible} unCheckedChildren={locale.canvas.nodeVisibility.hidden}
        aria-label={locale.canvas.nodeVisibility.visibility} onChange={setVisible} />
    </div> : undefined}
    selectorLabels={{ ...labels, searchPlaceholder: labels.search,
      level: level => [labels.group, labels.session, labels.output][level - 1],
      descendantMatches: count => labels.descendantMatches.replace("{{count}}", String(count)),
      searchResults: count => labels.searchResults.replace("{{count}}", String(count)) }}
    options={empty ? [] : [{ key: "ungrouped", label: locale.workspaceSidebar.ungroupedSessions, children: [
      { key: "ui", label: "Checkout — 结算界面", children: [{ key: "state-1", label: "Default — 默认状态" }, { key: "state-2", label: "Expanded — 展开状态" }] },
      { key: "space", label: "Product — 产品空间", children: [{ key: "camera-1", label: "Front — 正面摄像机" }] },
    ] }]}
    value={value} onChange={setValue}
    deleteAction={edit ? <ConfirmAction type="text" size="small" icon={<DeleteOutlined aria-hidden="true" />}
      title={locale.confirmations.deleteNode} confirmLabel={locale.actions.deleteNode} cancelLabel={locale.actions.keep}
      onConfirm={() => undefined}>{locale.actions.deleteNode}</ConfirmAction> : undefined}
    previewActions={<><BasicButton disabled={value.length !== 3}>{labels.openSource}</BasicButton>{edit && <BasicButton>{locale.spatial.snapshot}</BasicButton>}</>}
    previewUrl={value.length === 3 ? `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect width="400" height="240" fill="#eee"/><rect x="20" y="20" width="160" height="200" fill="#b4c5d6"/></svg>')}` : undefined}
    error={failed ? labels.failed : undefined} onRetry={() => undefined} onCancel={() => undefined} onInsert={() => undefined} />;
}
export const Default: Story = { name: "选择分组会话与状态", render: () => <Example /> };
export const Editing: Story = { name: "直接编辑预览来源", render: () => <Example edit /> };
export const English: Story = { name: "英文选择器", render: () => <Example english /> };
export const Empty: Story = { name: "没有可用来源", render: () => <Example empty /> };
export const Failed: Story = { name: "读取失败", render: () => <Example failed /> };
