# 风格库图片标题卡片迁移

- 范围：`/styles` 的列表项；页面和业务状态仍由 StyleLibraryView 及现有应用层负责。
- 用户已确认：复用 ImageTitleCard、最多三张叠图、3:2 完整图片展示、标题外的分类与来源、无图占位、整项打开详情。
- 迁移映射：本地封面及标题 CSS → YisiUI 0.11.0 的实验态 `image-title-card`；列表网格、元数据和原生按钮 → 页面本地组合。共享资产继续标记为 experimental。
- 未选择 StatusCard：它负责状态灯和运行态，不适用于参考图合集。未选择通用 Card：已有匹配的图片标题资产。
- 保留行为：搜索、分类和来源筛选、全部参考图预览、创建、编辑、删除确认、键盘打开与关闭预览。卡片可访问名称继续复用 styleLibrary.openStyle，分类和来源继续复用既有中英文语义记录；没有新增或修改翻译。
- 删除条件：共享资产接入后删除仅供旧封面裁切、摘要和标题使用的本地样式，不修改 vendor 文件。
- Story 证据：Default、NoReferenceImages、SingleReferenceImage、ManyReferenceImages、LongContent、NarrowViewport，以及既有加载、空库、错误与删除确认状态。ManyReferenceImages 验证列表三图上限不截断详情的四张参考图。
- 检查：Next 生产构建、Storybook 构建及类型检查、i18n 检查、YisiUI doctor、git diff --check 通过。真实 /styles 页面确认共享资产标记、图片加载与 contain、无外框、键盘焦点和 Enter 打开详情。
- 最终窄屏复查：390px iframe 中 NarrowViewport、LongContent、ManyReferenceImages 的 Story play 均 finished；网格无横向溢出，三图叠放留白为 32px，四张参考图仍全部出现在详情。Default、NoReferenceImages、SingleReferenceImage、Empty、Loading、ErrorState 的 Story play 已通过。

- 后续用户调整：列表仅显示图片与标题；分类和来源移至详情标题栏右上角，统一使用小号弱化文字。复用现有中英文分类、来源语义和标签；按用户要求，此次调整未运行测试。

## 设计规范独立滚动

- 用户要求长设计规范在自己的容器内滚动。沿用既有 StyleLibraryView 左图右文预览、Ant Design Modal、参考图切换与底部操作；这是已有长内容状态的修正。
- 已复核同步 Registry：SectionNavigationPanel 带分区导航，TextMarkEditor 负责字段编辑，均不适合替代当前只读图文预览；继续使用本地组合与既有 YisiUI tokens。
- 预览区使用随视口收缩的有界高度，弹窗居中以保留较矮窗口中的底部操作；右侧规范与短句在单一可聚焦区域内滚动，参考图限制在自己的网格行内。窄屏保留上下排列并分配有界行高。复用已有“设计规范”的 region 名称及中英文语义，文案不变。
- 验证：真实页面在 1680×985、390×844、390×568 视口检查长规范、35 字标题、参考图与无图状态；规范扩展为原文 40 倍仍不增加弹窗高度，图片不溢出参考区，底部操作可见，键盘 PageDown 只滚动规范区域。Next 生产构建、Storybook 类型检查、YisiUI doctor、i18n 检查与 diff 空白检查通过。
