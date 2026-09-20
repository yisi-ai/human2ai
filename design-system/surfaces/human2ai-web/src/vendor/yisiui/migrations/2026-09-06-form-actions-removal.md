# FormActions 移除说明

`yisiui/form-actions` 在 `0.12.0` 候选中按用户明确指令直接退役。源码、样式、Story、`FormActions` / `FormActionsProps` 总入口导出和 `./form-actions` subpath 均已移除，Registry 保留 removed 记录。

这是本次直接退役，未经历先前已发布的 deprecated 版本：`deprecatedSince`、`removeAfter`、`removedIn` 均为 `0.12.0`。没有一对一替代资产，`replacement` 为 `null`。消费项目应自行组合按钮和操作区布局。

```tsx
import { Button, Flex } from "antd";

<Flex justify="end" align="center" wrap gap={8}>
  <Button disabled={saving} onClick={onCancel}>取消</Button>
  <Button type="primary" loading={saving} disabled={saveDisabled} onClick={onSave}>
    保存
  </Button>
</Flex>
```

原 `primaryLabel`、`primaryIcon`、`primaryLoading`、`primaryDisabled` 分别映射到主按钮的 children、icon、loading、disabled；`cancelLabel`、`cancelDisabled`、`onCancel` 映射到取消按钮；`onSubmit` 映射到主按钮 onClick。原 children 由调用方放入操作区。默认保持主操作靠右、取消位于主操作左侧，并按需要保留提交锁定和窄屏换行。

仓库内 `TextMarkEditor` 已改为内部排列 Ant Design 按钮，继续保留保存、取消、保存中锁定和删除确认行为。

本次移除由用户于 2026-09-06 明确授权，未声称完成所有外部消费仓库的验证。消费方同步前运行 `diff`，清除旧组件和类型引用，再运行类型检查、测试、构建和 `doctor`；CLI 会阻断仍引用 removed 资产的更新。
