import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { useState } from "react";
import zh from "../../../../../locales/zh-CN/common.json";
import en from "../../../../../locales/en/common.json";
import { Human2AiSettingsPanel, type Human2AiSettingsPanelProps } from "./Human2AiSettingsPanel";

function Fixture(props: Human2AiSettingsPanelProps) {
  const [values, setValues] = useState(props.values);
  const [sessions, setSessions] = useState(props.sessions);
  return <Human2AiSettingsPanel {...props} values={values} sessions={sessions}
    onChange={(key, value) => setValues(current => ({ ...current, [key]: value }))}
    onReset={() => setValues(current => ({ ...current, imageRetentionDays: "1", historyRetentionDays: "7" }))}
    onRestore={id => setSessions(current => current.filter(session => session.id !== id))}
    onDelete={id => setSessions(current => current.filter(session => session.id !== id))} onClearTrash={() => setSessions([])} />;
}
const meta = {
  id: "human2ai-settings-panel",
  title: "human2ai/Workspace/Settings",
  component: Human2AiSettingsPanel,
  render: args => <div style={{ width: 840, maxWidth: "100%", padding: 16 }}><Fixture {...args} /></div>,
  args: { labels: { ...zh.settings, deleteNowConfirm: title => zh.settings.deleteNowConfirm.replace("{{title}}", title),
    cancel: zh.actions.cancel, daysUnit: () => zh.settings.daysUnit_other, retry: zh.actions.retry }, values: { imageRetentionDays: "1", historyRetentionDays: "7", trashRetentionDays: "7" },
    sessions: [], onChange: () => undefined, onReset: () => undefined,
    onRestore: () => undefined, onDelete: () => undefined, onClearTrash: () => undefined, onRetry: () => undefined, onClose: () => undefined },
} satisfies Meta<typeof Human2AiSettingsPanel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { name: "自动释放" };
export const Trash: Story = { name: "回收站与长内容", args: { initialSection: "trash", sessions: Array.from({ length: 24 }, (_, index) => ({
  id: String(index), title: `已删除会话 ${index + 1} — ${"需要恢复的界面版本".repeat(8)}`, deletedAt: "2026/10/01 10:00",
})) } };
export const EmptyTrash: Story = { name: "空回收站", args: { initialSection: "trash" } };
export const Loading: Story = { name: "加载设置", args: { loading: true } };
export const Error: Story = { name: "加载失败与重试", args: { unavailable: true, error: zh.errors.operationFailed } };
export const Saving: Story = { name: "重置中", args: { busy: "reset" } };
export const English: Story = { name: "英文设置", args: { labels: { ...en.settings,
  deleteNowConfirm: title => en.settings.deleteNowConfirm.replace("{{title}}", title), cancel: en.actions.cancel,
  daysUnit: value => Number(value) === 1 ? en.settings.daysUnit_one : en.settings.daysUnit_other, retry: en.actions.retry } } };
