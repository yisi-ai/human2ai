import { describe, expect, it } from "vitest";
import { createAppI18n } from "./createI18n";

describe("createAppI18n", () => {
  it("loads matching Chinese and English message keys", () => {
    const zh = createAppI18n("zh-CN");
    const en = createAppI18n("en");

    expect(zh.t("app.yisiuiReady")).toBe("YisiUI 前端基线已就绪。");
    expect(en.t("app.yisiuiReady")).toBe("The YisiUI frontend baseline is ready.");
  });
});
