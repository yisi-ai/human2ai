import type { Meta, StoryObj } from "@storybook/react-webpack5";

import { ConfirmAction } from "@human2ai/ui/yisiui";

const meta = { id: "buttons-confirmaction", title: "Components/Buttons/ConfirmAction", component: ConfirmAction } satisfies Meta<typeof ConfirmAction>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "默认", args: { title: "确认删除？", description: "此操作无法撤回。", scopeLabel: "当前资料", children: "删除", onConfirm: async () => undefined } };
