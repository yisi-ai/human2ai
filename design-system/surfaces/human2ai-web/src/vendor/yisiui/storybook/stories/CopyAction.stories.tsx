import type { Meta, StoryObj } from "@storybook/react-webpack5";

import { CopyAction } from "@human2ai/ui/yisiui";

const meta = { id: "buttons-copyaction", title: "Components/Buttons/CopyAction", component: CopyAction } satisfies Meta<typeof CopyAction>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "默认", args: { label: "复制摘要", content: "这是一个可复制的摘要。", writeText: async () => undefined } };

export const Disabled: Story = {
  name: "不可复制",
  args: {
    label: "复制草稿",
    content: "草稿尚未生成。",
    disabled: true,
    writeText: async () => undefined,
  },
};

export const LongLabel: Story = {
  name: "完整操作说明",
  args: {
    label: "复制当前版本的文章摘要",
    copiedLabel: "文章摘要已复制",
    content: "这是当前文章版本的摘要。",
    writeText: async () => undefined,
  },
};
