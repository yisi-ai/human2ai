# MIT 许可证接入与 npm 分发

## 授权范围

YisiUI 自有代码及文档采用 MIT，版权声明为 `Copyright (c) 2026 贾思斋`。授权包括 source-sync 分发的自有组件、Tokens、样式、Contracts、Registry、Stories、工具（包括 Inspector 与启动器）和消费端 Skills，即使文件分别安装在 vendor、`.yisiui` 和 `.agents/skills/yisiui` 下也适用。

消费项目可以依据 MIT 使用、公开、修改和再分发已同步代码，包括在 GitHub 开源、发布 npm 包、商业使用和随产品分发编译或压缩产物。分发 YisiUI 代码或其实质部分时，保留版权声明及完整许可文本。第三方代码、依赖和素材继续适用各自许可证，保留原有版权与许可声明；YisiUI 的 MIT 不替代这些声明。

YisiUI 仓库及内部 package 继续私有维护，所有现有 `private: true` 保持不变。同步冲突保护和 `experimental` 状态属于维护及质量约定，不改变 MIT 的授权范围。消费项目自己的代码和 package 许可证由该项目决定，不能用产品许可证覆盖 YisiUI 或第三方声明。

当前 Storybook 10.6.0 的[官方许可证为 MIT](https://github.com/storybookjs/storybook/blob/v10.6.0/LICENSE)，允许上述使用。若分发 Storybook 本身或其静态构建资源，同样保留 Storybook 与所含第三方声明。

## Human2AI 同步

许可补充最初在 `0.14.0` 开发工作区验证，现随 `0.15.0` 本地 source-sync 版本分发；`v0.14.0` 标签中的历史清单保持不变。已同步过该工作区快照的消费项目也应执行 diff/update 升至 `0.15.0`，以同步正式版本入口及完整清单。

由有私有 YisiUI 访问权限的维护者在 **Human2AI 项目根目录**执行：

```bash
node .yisiui/launcher.mjs diff
# 处理预览报告中的受管文件冲突后再更新
node .yisiui/launcher.mjs update
node .yisiui/launcher.mjs doctor
```

启动器会发现同级或祖先目录下的 YisiUI 仓库；需要指定来源时，为上述命令设置 `YISIUI_SOURCE_ROOT=/path/to/yisiui`，不要把私有绝对路径提交到产品仓库。同步使用已有 `.yisiui/config.json` 中的目录和包管理器；若提示 `installRequired`，执行其给出的安装命令。

许可证实际路径为 `.yisiui/config.json` 的 `vendorRoot` 加 `/LICENSE`，也就是 `<surfaceRoot>/src/vendor/yisiui/LICENSE`。例如默认 Surface 为 `human2ai-web` 时，路径是 `design-system/surfaces/human2ai-web/src/vendor/yisiui/LICENSE`；自定义 monorepo 布局可能是 `packages/web-ui/src/vendor/yisiui/LICENSE`，以配置为准。

确认该文件包含完整 MIT 文本和上述版权行，提交它及本次同步的其他受管变更。LICENSE 通过 source-sync 原样复制并纳入 SHA-256 校验和同步锁；重复同步和后续清单生成继续保留该文件。本说明同步到 `<vendorRoot>/migrations/2026-09-14-mit-license.md`。公开仓库读者可以直接阅读本地 LICENSE，无需访问私有上游。

## 最终 npm 包保留许可证

每个包含 YisiUI 代码或其编译产物的发布包都应携带完整许可文本。只设置 `"license": "MIT"`、链接私有仓库或只写一行致谢，不能替代完整许可证。尤其当 npm 包的 `files` 只包含 `dist` 时，不要依赖深层 vendor 许可证被自动收录；npm 的文件收录规则见[官方 package.json 文档](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#files)。

推荐在 Human2AI 的打包流程中，从**已同步的本地副本**复制 LICENSE。以下命令从消费项目根目录运行，参数 `packages/human2ai` 替换为实际待发布 package 目录（若发布根 package 则使用 `.`）：

```bash
node --input-type=module - packages/human2ai <<'NODE'
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
const config = JSON.parse(readFileSync('.yisiui/config.json', 'utf8'));
const packageRoot = path.resolve(process.argv[2]);
const licenses = path.join(packageRoot, 'licenses');
mkdirSync(licenses, { recursive: true });
copyFileSync(path.join(config.vendorRoot, 'LICENSE'), path.join(licenses, 'YisiUI-LICENSE'));
NODE
```

将复制动作接入产品现有打包流程，安排在清理构建目录之后、`npm pack` / publish 之前执行（例如现有 `prepack` 流程）。保留产品自己的根 LICENSE 与其他第三方声明。在待发布包的现有 `files` 数组中追加 `licenses`，示例：

```json
{
  "files": ["dist", "licenses"]
}
```

在**待发布 npm 包目录**中执行：

```bash
npm pack --dry-run --json
npm pack --json
```

确认文件列表包含 `licenses/YisiUI-LICENSE`；再用 `tar -xOf <实际生成的包名.tgz> package/licenses/YisiUI-LICENSE` 读取实际压缩包，核对全文与 `<vendorRoot>/LICENSE` 一致。发布多个含 YisiUI 的包时逐包检查；单独发布 Web、CLI 或 Storybook 构建目录时，也将许可文件随该分发单元保留。

这套复制过程仅依赖已同步的本地文件，因此公开 CI 或 npm 包使用者无需访问私有 YisiUI 仓库。本次仅完成 YisiUI 内的许可、分发与验证；Human2AI 的实际同步、打包脚本修改及发布由 Human2AI 项目另行执行。
