import { describe, expect, it } from "vitest";

import { promptTranslationKey } from "../../locales/promptKeys.ts";
import { createAppI18n } from "../../web/i18n/createI18n.ts";

describe("semantic migration reuse boundaries", () => {
  it.each([
    ["app.title", "以形塑形", "human2ai"],
    ["navigation.composition", "构图", "Composition"],
    ["uiSketch.title", "UI 界面", "Interface"],
    ["canvas.viewport.help", "画布操作说明", "Canvas controls"],
    ["canvas.viewport.instructions", "选择节点工具后，单击放置；形状和图片可拖动确定尺寸，动线可拖动确定方向；Esc 取消。滚轮缩放；按住右键，或空格键加左键拖动画布。", "Select a node tool, then click to place. Drag to size shapes and images or set a flow direction; Esc cancels. Use the wheel to zoom; drag with the secondary button, or hold Space and drag with the primary button."],
    ["composition.frameRatio", "画框比例", "Frame ratio"],
    ["composition.aspectRatioTitle", "比例", "Ratio"],
    ["composition.planning.showAll", "显示构图线", "Show composition guides"],
    ["composition.planning.hideAll", "隐藏构图线", "Hide composition guides"],
    ["canvasNodeEditor.title", "编辑节点信息", "Edit node details"],
    ["canvasNodeEditor.shapeKind", "形状", "Shape"],
    ["canvasNodeEditor.pointKind", "点", "Point"],
    ["uiSketch.canvasLabels.noSelection", "未选择元素", "No items selected"],
    ["uiSketch.canvasLabels.selectedItemsPrefix", "已选择 ", "Selected "],
    ["uiSketch.canvasLabels.selectedItemsSuffix", " 个元素", " items"],
    ["composition.toolNames.circle", "圆形", "Circle"],
    ["composition.toolNames.triangle", "三角形", "Triangle"],
    ["composition.toolNames.quadrilateral", "矩形", "Rectangle"],
    ["composition.toolNames.focus", "焦点", "Focus"],
    ["composition.toolNames.textRegion", "文字区域", "Text region"],
    ["composition.prompt.focusHeading", "视觉焦点：", "Visual focal points:"],
    ["composition.prompt.areaHeading", "主要内容分布：", "Main content distribution:"],
    ["uiSketch.views.switch", "界面状态", "Interface states"],
    ["uiSketch.views.start", "状态 1", "State 1"],
    ["uiSketch.views.end", "状态 2", "State 2"],
    ["uiSketch.views.enableMotion", "添加状态", "Add state"],
    ["uiSketch.motion.copyPrompt", "动效", "Motion"],
    ["uiSketch.prompt.startState", "- 状态 1：", "- State 1:"],
    ["uiSketch.prompt.endState", "- 状态 2：", "- State 2:"],
    ["composition.session.loading", "正在加载构图", "Loading composition"],
    ["uiSketch.session.loading", "正在加载 UI 界面", "Loading interface"],
    ["composition.session.new", "新构图会话", "New composition session"],
    ["uiSketch.session.new", "新 UI 界面会话", "New interface session"],
    ["composition.session.untitled", "未命名构图", "Untitled composition"],
    ["uiSketch.session.untitled", "未命名 UI 界面", "Untitled interface"],
    ["composition.session.typeMismatch", "该会话不是构图会话，无法在构图编辑器中打开。", "This is not a composition session and cannot be opened in the composition editor."],
    ["uiSketch.session.typeMismatch", "该会话不是 UI 界面会话，无法在 UI 界面编辑器中打开。", "This is not an interface session and cannot be opened in the interface editor."],
    ["composition.canvasZoom", "当前缩放", "Current zoom"],
    ["composition.zoomIn", "放大画布", "Zoom in"],
    ["composition.zoomOut", "缩小画布", "Zoom out"],
    ["composition.fitAll", "适应全部", "Fit all"],
    ["uiSketch.canvasLabels.fitFrame", "适应界面范围", "Fit interface frame"],
    ["composition.lockFrame", "锁定画框", "Lock frame"],
    ["composition.unlockFrame", "解锁画框", "Unlock frame"],
    ["uiSketch.canvasLabels.lockFrame", "锁定范围", "Lock frame"],
    ["uiSketch.canvasLabels.unlockFrame", "解锁范围", "Unlock frame"],
    ["shell.sidebar", "Human2AI 应用侧栏", "Human2AI application sidebar"],
    ["shell.navigation", "Human2AI 应用导航", "Human2AI application navigation"],
    ["shell.collapseSidebar", "收起应用侧栏", "Collapse application sidebar"],
    ["shell.expandSidebar", "展开应用侧栏", "Expand application sidebar"],
    ["shell.rightPanel", "操作面板", "Action panel"],
    ["shell.collapseRightPanel", "收起操作面板", "Collapse action panel"],
    ["shell.expandRightPanel", "展开操作面板", "Expand action panel"],
    ["language.selectorLabel", "界面语言", "Interface language"],
    ["actions.start", "开始", "Start"],
    ["errors.operationFailed", "操作失败，请重试。", "The action failed. Try again."],
    ["workspaceSidebar.deleteProjectDescription", "删除后无法恢复。", "This action cannot be undone."],
    ["workspaceSidebar.deleteSessionDescription", "删除后，该会话的草图和加工记录也会被删除。", "Deleting this session also removes its drafts and refinement records."],
    ["sessionDetails.created", "创建时间", "Created"],
    ["sessionDetails.updated", "修改时间", "Last updated"],
    ["sessionDetails.nodes", "节点数", "Nodes"],
    ["sessionDetails.emptyValue", "—", "—"],
    ["canvas.tools.label", "操作工具", "Tools"],
    ["uiSketch.canvas", "UI 界面画布", "Interface canvas"],
    ["uiSketch.canvasLabels.visible", "显示", "Visible"],
    ["uiSketch.canvasLabels.hidden", "隐藏", "Hidden"],
    ["uiSketch.canvasLabels.fontSize", "字号", "Font size"],
    ["composition.depth.label", "景别", "Depth"],
    ["composition.depth.auto", "自动", "Auto"],
    ["composition.mode.label", "构图模式", "Mode"],
    ["composition.occupied", "画面占用", "Occupied"],
    ["composition.negativeSpace", "负空间", "Negative space"],
  ] as const)("preserves both locales for %s", (key, zh, en) => {
    expect(createAppI18n("zh-CN").t(key)).toBe(zh);
    expect(createAppI18n("en").t(key)).toBe(en);
  });

  it.each([
    ["composition", "foreground", "composition.depth.foreground", "前景", "Foreground"],
    ["composition", "midground", "composition.depth.midground", "中景", "Midground"],
    ["composition", "background", "composition.depth.background", "背景", "Background"],
    ["composition", "sceneComposition", "composition.mode.scene", "场景构图", "Scene"],
    ["composition", "editorialLayout", "composition.mode.editorial", "版式编排", "Editorial"],
    ["uiSketch", "visible", "uiSketch.canvasLabels.visible", "显示", "Visible"],
    ["uiSketch", "hidden", "uiSketch.canvasLabels.hidden", "隐藏", "Hidden"],
  ] as const)("reuses %s prompt value %s", (domain, role, key, zh, en) => {
    expect(promptTranslationKey(domain, role)).toBe(key);
    expect(createAppI18n("zh-CN").t(key)).toBe(zh);
    expect(createAppI18n("en").t(key)).toBe(en);
  });

  it.each([
    ["composition", "草图已由其他操作更新到版本 7。请重新打开该会话后再修改。", "Another operation updated this draft to revision 7. Reopen the session before editing it again."],
    ["uiSketch", "UI 界面已由其他操作更新到版本 7。请重新打开该会话后再修改。", "Another operation updated this interface to revision 7. Reopen the session before editing it again."],
  ] as const)("preserves %s revision-conflict recovery copy", (domain, zh, en) => {
    const key = `${domain}.session.revisionConflict`;
    expect(createAppI18n("zh-CN").t(key, { revision: 7 })).toBe(zh);
    expect(createAppI18n("en").t(key, { revision: 7 })).toBe(en);
  });

  it.each([
    ["focusNumber", "焦点#2", "Focus #2"],
    ["areaNumber", "内容区域#2", "Content region #2"],
    ["textRegionNumber", "文字区域#2", "Text region #2"],
  ] as const)("preserves numbered composition heading %s", (role, zh, en) => {
    const key = promptTranslationKey("composition", role);
    expect(createAppI18n("zh-CN").t(key, { index: 2 })).toBe(zh);
    expect(createAppI18n("en").t(key, { index: 2 })).toBe(en);
  });

  it("keeps state transitions and parameterized prompt lines contextual", () => {
    for (const locale of ["zh-CN", "en"] as const) {
      const i18n = createAppI18n(locale);
      expect(promptTranslationKey("uiSketch", "changeVisible")).toBe("uiSketch.prompt.changeVisible");
      expect(i18n.t("uiSketch.prompt.changeVisible")).not.toBe(i18n.t("uiSketch.canvasLabels.visible"));
      expect(i18n.t(promptTranslationKey("composition", "shotScale"), {
        shotScale: i18n.t("composition.depth.foreground"),
      })).toBe(locale === "zh-CN" ? "- 景别：前景" : "- Depth: Foreground");
      expect(i18n.t(promptTranslationKey("composition", "processingSemantic"), {
        semantic: i18n.t("composition.mode.scene"),
      })).toBe(locale === "zh-CN" ? "构图模式：场景构图" : "Mode: Scene");
      expect(i18n.t(promptTranslationKey("uiSketch", "referenceFontSize"), {
        fontSize: 18,
      })).toBe(locale === "zh-CN" ? "参考字号：18px" : "Reference font size: 18px");
    }
  });

  it("removes superseded runtime keys instead of retaining aliases", () => {
    for (const locale of ["zh-CN", "en"] as const) {
      const i18n = createAppI18n(locale);
      for (const key of [
        "navigation.uiSketch",
        "composition.canvasHelp",
        "composition.canvasHelpInstructions",
        "uiSketch.canvasLabels.interactionHelp",
        "uiSketch.canvasLabels.copyAllStages",
        "workspaceSidebar.actionFailed",
        "styleLibrary.operationFailed",
        "composition.tools",
        "uiSketch.tools",
        "uiSketch.canvasLabels.canvas",
        "uiSketch.prompt.visible",
        "uiSketch.prompt.hidden",
        "canvasNodeEditor.shotScale",
        "composition.prompt.foreground",
        "composition.processingSemantic",
        "composition.prompt.sceneComposition",
        "composition.prompt.editorialLayout",
      ]) {
        expect(i18n.exists(key), `${locale}: ${key}`).toBe(false);
      }
    }
  });
});
