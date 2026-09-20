# UI 界面节点拖动性能

复用现有 UiSketchCanvas、CanvasNode、CanvasScene 与 InfiniteCanvasViewport，不新增画布组件或改变桌面视觉方向。区域、图片、文字分别由无业务含义的 SVG g 承载临时位移；React 继续管理内部节点的正式位置，预览层的 transform 由当前指针手势独占。一次动画帧只应用最后一次移动，未移动节点和外围面板不随预览重新渲染。多选节点及整体选择框使用同一位移。

松手时取消待执行帧、清除临时位移，并使用松手坐标对当前草稿调用既有 moveItemsByDelta 与 updateUiSketchStageDraft 一次；预览期间如收到草稿内容更新，提交以当前草稿为基础，保留那些变更。未发生有效移动或移回原位不提交。pointercancel、lostpointercapture、切换活动阶段或组件卸载清理预览，不保存中间位置。键盘微移、编辑面板、界面框交互和范围外节点规则继续沿用原有边界。

领域决策为扩展 local 能力 ui-sketch.layout-intent 的拖动提交约定。复用既有阶段几何更新与 shared capture.draft-versioning 保存边界，API、schema、revision 冲突规则、页面 800ms 防抖和构图领域不变。公开节点容器不承担草稿及保存职责，通用 CanvasNode 和上游 YisiUI 资产不需修改。界面与语义沿用原有中英文控件，未新增产品文案或翻译键；组件和页面继续保持 candidate 与既有视觉审阅状态。

交互证据为 UiSketchCanvas.stories.tsx 的 DragPreview、EndStageDragPreview、MultiSelection 和 NodesOutsideFrame。新增测试先在原实现复现拖动中提交草稿，再验证三类节点的按帧合并、未移动节点位置不变、松手最终坐标、单次提交、已呈现或尚未呈现的取消预览，以及结束阶段不改动开始阶段。性能复测使用先前检查保存的 59 节点布局副本，原会话不参与写入。

2026-09-06 验证：全量 38 个测试文件、423 项测试及 103 项领域契约测试通过；类型检查、生产构建、Storybook 构建、i18n、domain-baseline 和 YisiUI doctor/check 通过。浏览器验证上述四个 Story，以及 Default、NodeDragSelection、TextBoundsAndMove，均无控制台错误。另在 1024 × 800 桌面视口完成 DragPreview 交互与视觉检查，内容不溢出页面。独立生产服务确认预览期间草稿版本不变、松手仅新增一个版本、保存刷新后位置保持；拖动期间另一项备注编辑和保存不会被最终位移覆盖。切换阶段和跳转到构图页均清除预览且不新增草稿版本。

同一 59 节点布局在 1680 × 985 桌面视口复测：开发版连续 90 次移动的帧间隔平均 16.67ms、P95 16.8ms，松手前 React 提交为 0，松手后页面与各节点各更新一次。生产版连续 90 次移动平均 16.67ms；另将浏览器置于前台，对视口内可见区域节点采样 30 次移动，平均 16.67ms、P95 16.8ms，无大于 25ms 的帧或主线程长任务。开发模式松手时仍有一次完整页面同步，持续拖动帧率不包含该次同步。另一次浏览器后台限频到约 1 秒一帧的采样被排除，不用后台调度间隔判断页面性能。
