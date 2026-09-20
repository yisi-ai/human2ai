# 画布图片粘贴

## 复用与边界

- 扩展现有 CompositionCanvas、UiSketchCanvas 和 CanvasImageEditorFields，保持桌面布局与 candidate 状态；不新增视觉方向。
- 两种画布共用 useCanvasImagePaste，编辑器共用 clipboardImage 的首张图片识别。已有 CanvasPlacement 负责手动放置，StyleLibraryView 的多张参考图粘贴拥有不同的列表生命周期，不用于创建画布节点。
- 上传继续调用页面的 onImageUpload，复用会话图片 API 和 asset.image-validation；大小、格式、源码校验与图片存储契约不变。构图归一化中心坐标与 UI 左上角像素坐标分别由原有适配层处理。
- canvas.image-asset-binding 的含义扩展到剪贴板上传；中英文复用既有 uploading / uploadFailed 文案，没有新增 locale key。

## 交互契约

- 在当前聚焦画布粘贴首张图片，上传成功后在粘贴时的视野中心创建并选中新图片节点。保留源图比例，最长边不超过 320 个画布单位，不放大小图。
- 通过原生 copy / paste 事件读取剪贴板，同时处理 SVG 聚焦时浏览器把事件发给 body 的情况；不会处理其他画布、文本框或编辑窗口的事件。
- 构图节点快照继续由当前组件持有，只向系统剪贴板写入随机自定义 MIME 标记。外部图片优先；标记不匹配的文本不会重新粘贴旧节点。composition.item-clipboard 更新到契约版本 2。
- 图片编辑窗口内粘贴复用上传与替换流程，保留节点位置、备注，重置 crop。文本粘贴保持浏览器默认行为；只读禁止上传，上传期间阻止重复提交。
- 上传失败显示既有错误且不创建空节点；完成时使用最新草稿，历史或会话重置后丢弃过期结果。UI 的活动状态切换也取消未完成的画布粘贴。

## 验证证据

- clipboard-image.test.ts：首张图片、混合文本、files 回退、无图片、横竖尺寸与小图。
- CompositionCanvas / UiSketchCanvas 的 ClipboardImage Story：body 目标粘贴、失败重试、防重复、图片比例、编辑备注框粘贴替换、并发备注保留。
- Chrome 原生 Ctrl+C / Ctrl+V：构图复制节点保持 24px 偏移，两个画布粘贴系统 PNG 成功；桌面 1024×800、1280×800 验证图片编辑，1536×960 验证构图工作台回归。
- 类型检查、领域基线检查与契约测试、i18n 检查、YisiUI doctor、Next 生产构建及 Storybook 构建。
