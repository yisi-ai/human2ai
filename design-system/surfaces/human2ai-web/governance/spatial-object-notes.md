# 空间物件备注与双击编辑

用户确认复用构图/UI 的名称与备注编辑习惯：单击保持参数选择，双击在物件附近打开紧凑编辑面板，字段自动保存，点击外部或 Escape 关闭。双击人物表面编辑整个人物；关节和骨段继续负责姿态。此次只增加对象备注，覆盖人物、基础物体、摄像机、观察盒，不增加空间总备注。

领域比较：构图与 UI 的 canvas-node-metadata 还拥有 origin、annotation、semanticType 以及旧草图补齐生命周期；空间对象不使用这些字段。备注作为空间领域的可选 note 字符串保留在当前 v2 数据中，旧草图不补写。复用现有 put-character / put-object / put-camera / put-camera-box、SpatialEditQueue、DraftVersionStore 和 CanvasHistory；不新增存储、路由或操作。JSON Schema 和类型同步；inspect 返回完整草稿，消费项目读取 note 与几何和镜头共同理解意图。名称/备注的渲染排除规则由空间领域的小函数统一提供给编辑场景缓存和 Web 预览版本判断，不影响文档指纹及历史。

语义：复用 shared notes.element.label（用户对单个元素的含义或要求），明确扩展至空间对象和 inspect 数据；名称复用 spatial.name，关闭动作复用 actions.cancel 已有自动保存编辑器语义。增加 spatial.editObject 作为物件元数据编辑标题，中英文同步，不增加提示段落。

UI 查询：选择现有空间页面、AppShellFrame、BasicButton、Tooltip，字段复用 TextMarkEditorField / TextMarkEditorTextArea。TextMarkEditor 整体为固定位置的 520px 模态框，不开放锚点；Human2AiCanvasNodeEditor 还绑定二维景别和来源字段，不适合直接复用。沿用项目已使用的 Ant Design Modal 组合共享字段，在双击位置附近展示 360px 面板并限制在桌面视口内，保留模态焦点、外部关闭及 Escape；不修改 vendor，不新建通用弹层。共享资产保持 0.14.0 experimental，已有构图/UI 字段与 Modal 使用记录为复用证据，空间资产继续 candidate。

空备注、多行长备注、中文/英文、失效对象、只读、取消拖动和历史恢复纳入现有空间 Story。验证真实 WebGL 双击目标、人物部位归属、辅助线选择及拖动不误开；验证自动保存、旧版本读取、撤销恢复、CLI inspect 与参考 PNG 不含备注。支持桌面 1024×800、1280×800、1536×960，长文本内部滚动。运行领域、预览、场景缓存、集成测试，类型检查、i18n、领域基线、YisiUI doctor 和两套生产构建。

验证记录（2026-09-19）：

- ObjectNotes play 通过，验证已有备注读取、名称与长备注即时更新、几何不变、关闭重开保留；CameraGallery 和 CameraGalleryPending play 通过，只读参数里的备注不可编辑。英文弹层显示 Object name / Note，1024×800、1280×800、1536×960 均不溢出，新增弹层 axe 无违规。
- 真实 WebGL 双击人物打开整个人物备注；物体、观察盒及可见摄像机辅助线按稳定 ID 打开。新增近裁面与屏幕距离判断，避免观察视角与摄像机重合时辅助线截获所有双击，物体表面优先。原生鼠标间隔 100ms 的连续双击在右栏展开和收起两种状态均命中同一物体；第一次按下时保留命中目标，避免右栏展开造成第二次命中偏移。原生拖动后的双击未打开面板，点击遮罩和 Escape 均能关闭。
- 32 项空间备注、场景缓存、预览及会话集成测试通过，覆盖可选字段兼容、四类对象备注、清空、类型校验、姿态与取景修改保留备注、CLI apply/inspect、不可变历史、撤销与恢复、PNG 字节相同。缓存比较复用 canonicalJson，消除 HTTP 序列化和历史恢复中的字段顺序差异；两项回归测试先复现误失效，再验证修复。
- 独立实际空间通过原生输入验证保存 revision 2、撤销 revision 3、重做 revision 4，备注分别为新内容、旧内容、新内容。三次过程中全部人物/物体网格与预览图 DOM 实例保持不变，镜头 URL 始终使用 revision 1，新增 PNG 请求为零。测试数据库、原生事件脚本和结果保存在忽略的 .human2ai-data/，不进入分发。
- Server/Web/Storybook 类型、i18n（571 keys）、领域基线结构检查、领域基线测试（181 通过、1 个既有跳过）、YisiUI doctor、diff 检查及 Storybook/Next 生产构建通过。领域更新限定 spatial.scene-authoring（contractVersion 25），继续复用共享版本与历史；空间保留自身对象模型，未引入二维节点来源或景别字段。
