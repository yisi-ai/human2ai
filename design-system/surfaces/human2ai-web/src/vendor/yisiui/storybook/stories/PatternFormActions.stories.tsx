import type { Meta, StoryObj } from "@storybook/react-webpack5";

import { FormActions } from "@human2ai/ui/yisiui";

const meta = { id: "buttons-formactions", title: "Components/Buttons/FormActions", component: FormActions } satisfies Meta<typeof FormActions>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "默认", render: () => <FormActions onCancel={() => undefined} onSubmit={() => undefined} /> };

export const Saving: Story = {
  name: "正在保存",
  args: {
    primaryLabel: "保存修改",
    primaryLoading: true,
    onCancel: () => undefined,
    onSubmit: () => undefined,
  },
};

export const Disabled: Story = {
  name: "等待必填信息",
  args: {
    primaryLabel: "创建文章",
    primaryDisabled: true,
    onCancel: () => undefined,
    onSubmit: () => undefined,
  },
};
