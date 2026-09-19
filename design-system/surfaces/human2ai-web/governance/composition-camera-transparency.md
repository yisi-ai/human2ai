# 构图镜头透明显示与编辑面板

复用现有 CanvasImage、CompositionCanvas、Human2AiCanvasNodeEditor 和同步的 TextMarkEditor，不新增组件或视觉方向。按 canvas-image / canvas-node-editor 查询 Registry 并比较普通图片内容编辑器：镜头节点共用相同 SVG 图片边界和图片双栏布局，问题分别来自边界的浅色填充，以及加宽规则只匹配 CanvasImageEditorFields。

读取实际构图节点的 300×400 PNG，120000 个像素中 114462 个完全透明，画布图片边界却填充 rgb(251,252,254)。因此只修正呈现：已显示图片的边界使用透明填充，空、载入和错误占位保留原样；镜头及另存的 PNG 节点共用该规则。领域渲染、上传、引用刷新、版本和源摄像机背景设置无须改变。

图片种类的公共节点编辑器采用既有 880px 桌面宽度，并限制在视口内。左侧属性按两列排列，容纳景别与视觉权重；右侧继续使用调用方提供的镜头预览和动作。已有 CanvasImageEditorFields 的宽度规则继续服务 UI 图片内容面板。复用 spatial.reference、spatial.cameraView、spatial.openSource 和 spatial.snapshot 的现有语义与中英文文案，没有新增标签或翻译键。

验证覆盖透明图叠放、实际透明 PNG、占位状态、双击打开镜头编辑器、左栏可读性、英文动作、关闭操作，以及 1024×800、1280×800、1536×960 桌面布局。

验证通过：Web 与 Storybook 类型检查、Next 生产构建、Storybook 构建、YisiUI doctor、i18n 检查（493 键、492 语义、1 既有遗留）和 diff 空白检查。CameraReference、CameraReferenceEnglish 与既有 ImageNode 交互在浏览器完成，最终无控制台错误或警告。初始 Story 测量受到模态开场缩放影响，改为等待展开完成再检查真实尺寸。

三个桌面尺寸下模态均为 880px，左右栏各 402px，左侧景别与视觉权重各 189px，无横向溢出。空图片占位仍保持浅色底。将实际渲染的 CanvasImage 节点合成到 #ee8866 色块上，透明角落像素为 [238,136,102,255]，图形内部为 [114,138,161,255]，确认下层内容可透出；当前应用中已有 PNG 节点的边界也已变为 rgba(0,0,0,0)，没有重新上传或修改用户文档。面板截图见 docs/evidence/spatial/composition-camera-editor.png。

关闭动作已验证；浏览器合成事件下未确认焦点返回原 SVG 节点，该既有路径未在本次样式修复中修改。
