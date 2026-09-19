# 构图光源属性

扩展既有 candidate `composition-canvas`，不增加通用图形资产。比较现有 CanvasShape、Human2AiCanvasNodeEditor、Ant Design Switch 及同步资产的 toggle 能力；同步资产没有独立布尔开关，沿用项目已有 Ant Design Switch 与 TextMarkEditorField 组合。

`areaEditorLabels.lightSource` 提供中英文开关名称。仅普通形状显示此属性；缺省关闭，受控更新经 `onDraftChange` 返回，组件不拥有会话存储。禁用状态沿用编辑器，Tab 聚焦、Space 切换由 Switch 提供。光源属性不改变尺寸、位置、旋转、备注或来源。

编辑、只读精修与参考预览共用领域 `renderCompositionLightSourceSvg`，生成导出使用同一实现。局部 SVG 坐标由 CanvasNode 处理位置和旋转；渐变 id 通过 React useId 隔离多画布。编辑与精修保留图形轮廓；矩形内部使用横跨短边的线性渐变形成光带，圆形使用径向渐变；appearance=reference 取消描边并柔化边缘，只保留大致位置与光照类型，和导出 PNG 一致。方向由 Agent 根据场景决定，不将标记形状强制转换为成片光斑；普通形状继续使用现有颜色。文字区域和图片不属于该开关的适用范围。

Story `human2ai-composition-canvas--light-source` 覆盖三种形状的默认关闭、开启、恢复及几何保持。验证桌面画布和约束属性面板，不增加移动端范围。领域契约覆盖序列化、复制、精修保留、导出与双语提示；API 契约覆盖保存及撤销。

Story `human2ai-composition-canvas--light-source-reference` 验证三种图形的参考预览均取消描边并柔化边缘，矩形仍为光带、圆形仍为局部光区，多光源使用独立渐变定义。

光源按普通形状的尺度解释为大致视觉意图：保留照明方位、延展趋势和空间作用，宽窄、长短、连续性、边缘与强弱随场景自由变化，用户指令和备注优先。矩形仍表达带状或延展光照，但成片可断续、转折或融合，不默认要求完整等宽亮条、强对比或精确覆盖。导出提示与公共 Agent 协议按整体大致呼应验收。
