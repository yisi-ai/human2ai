# CopyAction 到 ActionButton 迁移说明

## 生命周期

- 旧 Registry key：`yisiui/copy-action`
- 旧组件与 subpath：`CopyAction`、`./copy-action`
- replacement：`yisiui/action-button`
- 新组件与 subpath：`ActionButton`、`./action-button`
- `deprecatedSince`：`0.11.0`
- `removeAfter`：`0.12.0`
- `removedIn`：`0.12.0`

`CopyAction` 在 `0.12.0` 候选中移除源码、Story、公共类型、总入口和独立 subpath；Registry 保留 removed 记录。旧 import 将不再可用。

## Props 与职责映射

旧组件通过 `content` 或 `loadContent` 取得文字，并通过 `writeText` 写入剪贴板。新组件不拥有剪贴板、文件上传或保存 API；调用方通过 `onAction` 注入动作，并显式提供空闲、执行中、成功和失败文字。

```tsx
<CopyAction
  content={summary}
  label="复制摘要"
  copiedLabel="已复制"
/>
```

迁移为：

```tsx
<ActionButton
  label="复制摘要"
  pendingLabel="复制中"
  successLabel="已复制"
  errorLabel="复制失败"
  onAction={async () => {
    if (!summary.trim()) throw new Error("没有可复制的内容。");
    await navigator.clipboard.writeText(summary);
  }}
/>
```

上传场景由消费项目持有文件、请求、进度和重试，只把一次动作 Promise 交给按钮：

```tsx
<ActionButton
  label="上传文件"
  pendingLabel="上传中"
  successLabel="上传成功"
  errorLabel="上传失败"
  feedbackDurationMs={null}
  onAction={() => uploadFile(file)}
/>
```

`feedbackDurationMs={null}` 表示保持成功或失败反馈；传入毫秒数时，组件会在延时后恢复空闲状态。`motion="none"` 或系统 `prefers-reduced-motion` 会关闭非必要反馈动画，文字状态和 `aria-live` 播报仍然保留。

## 消费验证

消费项目同步 deprecated candidate 后运行 `diff` 获取 `CopyAction` 引用位置，完成迁移后执行类型检查、组件测试、Storybook production build 和产品 production build，再用 `doctor` 确认引用归零。2026-09-06 用户报告组件引用已经清理，并明确授权正式移除。本次以该报告作为消费清理依据；未将其记为独立运行的消费项目验证或视觉基线批准。
