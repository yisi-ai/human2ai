import { describe, expect, it } from "vitest";
import {
  createAppI18n,
  isAppLocale,
  resolveAppLocale,
} from "./createI18n";

describe("createAppI18n", () => {
  it.each([
    ["actions.create", "创建", "Create"],
    ["actions.rename", "重命名", "Rename"],
    ["actions.move", "移动", "Move"],
    ["actions.retry", "重试", "Retry"],
    ["workspaceSidebar.newProject", "新建项目", "New project"],
    ["workspaceSidebar.confirmRename", "确认", "Confirm"],
    ["workspaceSidebar.renameProjectTitle", "重命名项目", "Rename project"],
    ["workspaceSidebar.renameSessionTitle", "重命名会话", "Rename session"],
    ["workspaceSidebar.moveSessionTitle", "移动会话", "Move session"],
    ["workspaceSidebar.selectProject", "选择项目", "Select project"],
    ["workspaceSidebar.moveUnavailable", "没有可移动的项目", "No other project available"],
    ["workspaceSidebar.projectNamePlaceholder", "输入项目名称", "Enter project name"],
    ["workspaceSidebar.projectNameConflict", "项目名称不能重复", "Project names must be unique"],
    ["workspaceSidebar.renameSessionPlaceholder", "输入会话名称", "Enter session name"],
  ] as const)("preserves workspace action and context copy for %s", (key, zh, en) => {
    expect(createAppI18n("zh-CN").t(key)).toBe(zh);
    expect(createAppI18n("en").t(key)).toBe(en);
  });

  it("loads matching Chinese and English message keys", () => {
    const zh = createAppI18n("zh-CN");
    const en = createAppI18n("en");

    expect(zh.t("app.title")).toBe("以形塑形");
    expect(en.t("app.title")).toBe("human2ai");
    expect(zh.t("workspaceSidebar.newUiSketch")).toBe("新建 UI 界面");
    expect(en.t("workspaceSidebar.newUiSketch")).toBe("New interface");
    expect(
      zh.t("workspaceSidebar.newCompositionInProject", { project: "品牌升级" }),
    ).toBe("在“品牌升级”中新建构图");
    expect(
      en.t("workspaceSidebar.newUiSketchInProject", { project: "Brand refresh" }),
    ).toBe("New interface in “Brand refresh”");
    expect(zh.t("actions.create")).toBe("创建");
    expect(en.t("actions.create")).toBe("Create");
    expect(zh.t("workspaceSidebar.confirmRename")).toBe("确认");
    expect(en.t("workspaceSidebar.confirmRename")).toBe("Confirm");
    expect(zh.t("actions.delete")).toBe("删除");
    expect(en.t("actions.delete")).toBe("Delete");
    expect(zh.t("actions.move")).toBe("移动");
    expect(en.t("actions.move")).toBe("Move");
    expect(zh.t("workspaceSidebar.selectProject")).toBe("选择项目");
    expect(en.t("workspaceSidebar.selectProject")).toBe("Select project");
    expect(zh.t("uiSketch.session.untitled")).toBe("未命名 UI 界面");
    expect(en.t("uiSketch.session.untitled")).toBe("Untitled interface");
    expect(zh.t("uiSketch.views.start")).toBe("状态 1");
    expect(en.t("uiSketch.views.end")).toBe("State 2");
    expect(zh.t("uiSketch.views.enableMotion")).toBe("添加状态");
    expect(zh.t("uiSketch.canvasLabels.increaseFontSize")).toBe("增大字号");
    expect(zh.t("uiSketch.canvasLabels.emptyText")).toBe("---文字未输入---");
    expect(en.t("clipboard.copyPrompt")).toBe("Copy prompt");
    expect(zh.t("clipboard.copyPreview")).toBe("复制预览图");
    expect(en.t("clipboard.copyPreview")).toBe("Copy preview");
    expect(zh.t("uiSketch.motion.copyPrompt")).toBe("动效");
    expect(en.t("uiSketch.motion.copyPrompt")).toBe("Motion");
    expect(en.t("notes.element.label")).toBe("Note");
    expect(zh.t("canvas.node.nodeDescription")).toBe("节点说明");
    expect(en.t("canvas.node.nodeDescription")).toBe("Node description");
    expect(zh.t("canvas.node.originUser")).toBe("user");
    expect(en.t("canvas.node.originAgent")).toBe("agent");
    expect(zh.t("canvas.node.originImport")).toBe("import");
    expect(en.t("canvas.node.originImport")).toBe("import");
    expect(zh.t("actions.deleteRegion")).toBe("删除区域");
    expect(en.t("actions.keep")).toBe("Keep");
    expect(zh.t("uiSketch.prompt.regionNumber", { index: 2 })).toBe("区域#2");
    expect(en.t("uiSketch.prompt.regionNumber", { index: 2 })).toBe("Region #2");
    expect(zh.t("uiSketch.prompt.referencePosition", { x: 12, y: 34 })).toBe(
      "参考位置：x=12px，y=34px",
    );
    expect(en.t("uiSketch.prompt.referencePosition", { x: 12, y: 34 })).toBe(
      "Reference position: x=12px, y=34px",
    );
    expect(zh.t("uiSketch.prompt.perceptibleElementGuidance")).toContain(
      "不是组件树节点",
    );
    expect(en.t("uiSketch.prompt.perceptibleElementGuidance")).toContain(
      "not a component-tree node",
    );
    expect(zh.t("uiSketch.prompt.motionTitle")).toContain("状态过渡");
    expect(en.t("uiSketch.prompt.motionTitle")).toContain("state transitions");
    expect(zh.t("composition.aspectRatioTitle")).toBe("比例");
    expect(en.t("composition.aspectRatioTitle")).toBe("Ratio");
    expect(zh.t("dimensions.width")).toBe("宽");
    expect(en.t("dimensions.height")).toBe("Height");
    expect(zh.t("notes.global.label")).toBe("全局备注");
    expect(en.t("notes.global.label")).toBe("Global note");
    expect(zh.t("composition.globalNote.title")).toBe("对整个画面的要求");
    expect(en.t("uiSketch.globalNote.title")).toBe(
      "Direction for the entire interface",
    );
    expect(zh.t("canvas.tools.label")).toBe("操作工具");
    expect(en.t("canvas.tools.label")).toBe("Tools");
    expect(zh.t("clipboard.copyPreview")).toBe("复制预览图");
    expect(en.t("clipboard.copyPreview")).toBe("Copy preview");
    expect(zh.t("clipboard.copied")).toBe("复制成功");
    expect(en.t("clipboard.copied")).toBe("Copied");
    expect(zh.t("sessionDetails.title")).toBe("基本信息");
    expect(en.t("sessionDetails.title")).toBe("Session details");
    expect(zh.t("sessionDetails.copyCommand")).toBe("复制命令");
    expect(en.t("sessionDetails.copyCommand")).toBe("Copy command");
    expect(zh.t("sessionDetails.copying")).toBe("复制中");
    expect(en.t("sessionDetails.copying")).toBe("Copying");
    expect(zh.t("sessionDetails.agentCommand", { command: "CLI" })).toContain(
      "CLI",
    );
    expect(zh.t("composition.views.draft")).toBe("构图");
    expect(zh.t("composition.views.refined")).toBe("精修");
    expect(zh.t("composition.views.reference")).toBe("预览");
    expect(en.t("composition.views.draft")).toBe("Composition");
    expect(en.t("composition.views.refined")).toBe("Refined");
    expect(en.t("composition.views.reference")).toBe("Preview");
    expect(zh.t("composition.session.loading")).toBe("正在加载构图");
    expect(en.t("composition.session.loading")).toBe("Loading composition");
    expect(zh.t("composition.depth.auto")).toBe("自动");
    expect(en.t("composition.depth.background")).toBe("Background");
    expect(zh.t("composition.prompt.areaNumber", { index: 2 })).toBe("内容区域#2");
    expect(en.t("composition.prompt.focusNumber", { index: 2 })).toBe("Focus #2");
    expect(zh.t("shell.rightPanel")).toBe("操作面板");
    expect(en.t("shell.rightPanel")).toBe("Action panel");
    expect(zh.t("uiSketch.session.serviceOutdated")).toContain("重新启动");
    expect(en.t("uiSketch.session.serviceOutdated")).toContain("Restart");
  });

  it("resolves project locales and rejects unsupported values", () => {
    expect(resolveAppLocale("en-US")).toBe("en");
    expect(resolveAppLocale("zh-CN")).toBe("zh-CN");
    expect(isAppLocale("en")).toBe(true);
    expect(isAppLocale("fr")).toBe(false);
  });
});
