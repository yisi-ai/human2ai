# 构图与 UI 画布层级

用户批准在两套画布右键菜单提供置于顶层、上移一层、下移一层、置于底层，UI 同时保留建组与解组；沿用现有桌面视觉方向与 candidate 状态。查询共享 context-menu 能力没有匹配资产，复用 Ant Design Dropdown、InfiniteCanvasViewport 和现有本地画布。未采用 CompactDropdownSelect，它属于单值选择而不是节点动作菜单。菜单开关沿用已验证的松手请求与新一次外部 pointerdown 关闭，共享 useCanvasContextMenu，避免原生 contextmenu 导致立即关闭。

层级表示节点前后遮挡，不是景别或视觉权重。中文与英文菜单共用 shared 语义分片中的四个 canvasLayers 键。四项操作作用于全部内容类型；多选时保持所选和未选节点各自相对顺序，前移/后移跨越相邻的一个未选节点。右键未选节点先选择，已选节点保留多选，空白处保留选择；无选择、画框选择、只读和不可继续移动的边界动作禁用。菜单键和 Shift+F10 打开，Escape 及外部点击关闭并归还焦点，右键拖动继续平移且不请求菜单。

领域比较了构图与 UI 的分类型数组、UI 单层组及阶段几何、共享 Capture 保存与撤销。新增 shared capture.layer-order，核心只负责 ID 排序和不可变多选移动；领域适配器负责旧草稿的节点顺序及 UI 组选择扩展。可选 layerOrder 从底到顶记录顺序，节点数组、编号、内容和几何保持不变。旧稿缺少字段时沿用原绘制顺序；显式顺序中的已删引用在规范化时清理，未记录的新节点追加至顶部，重复及非字符串 ID 由 Schema 拒绝。UI 顺序跨状态共享，克隆隔离数组；构图指纹纳入层级。保存和撤销复用现有 Capture，不新增存储流程。

编辑画布、构图预览及两种 SVG/PNG 导出按同一顺序绘制。显式调整层级后 CanvasNode 使用 controlsHost 将选中外框、缩放和旋转控件放在独立顶层宿主，事件仍操作原节点，拖动预览期间隐藏临时不跟随的控件；辅助线与画框不参与内容排序。

验证入口：两套画布 LayerOrder、ReadOnlyLayerOrder；UiSketchCanvas PersistentGroups；canvas-layer-order 与 canvas-layer-adapters 单元测试，以及 draft-version-contract 保存/读取/撤销集成测试。LayerOrder Story 关闭装饰性菜单动画以保证交互断言确定，覆盖全部动作、跨类型、多选、原生右键事件、边界、键盘、外部点击、平移及底层节点缩放。浏览器使用 DESIGN.md 桌面参考视口。

2026-09-09 验证：构图与 UI 的 LayerOrder、ReadOnlyLayerOrder 以及 UI PersistentGroups 浏览器交互通过；覆盖 1024×800 和 1280×800 桌面参考尺寸，菜单 axe 无违规。共享领域契约 121 项通过，前后端及 Storybook 类型检查、生产构建、i18n 与 YisiUI doctor/check 通过。全量 482 项测试中 480 项通过；已有 composition-cli 方法数量断言（5 对当前 9）及 createI18n 的“加工”对当前“精修”断言失败，这两项不属于本次层级变更。
