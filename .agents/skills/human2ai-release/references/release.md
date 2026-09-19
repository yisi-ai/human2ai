# 版本准备与手动发布

按当前任务读取相应步骤。准备版本不等于获得合并或发布授权；已有明确授权持续有效。

## 首次准备

- 根据 `package.json` 的环境要求选择 Node.js 和 npm；当前为 Node.js 22+、npm 11。检查 GitHub CLI 登录状态和目标仓库权限。
- `npm whoami` 验证发布身份，`npm owner ls <package-name>` 检查现有包维护者。首次创建包确认名称可用；认证与账号设置在用户环境或服务端完成，不保存到仓库。
- 检查 main 的 PR 和必需检查规则。建议要求现有三个验证工作流成功。规则缺失时报告差异；只有配置规则属于本次授权时才修改 GitHub 设置。
- Fork 发布独立版本使用自己的包名或 scope，调整仓库元数据及相关安装指令。作者署名不决定 npm 发布身份。

## 准备版本 PR

1. 核对当前版本、已发布版本和变更范围。按用户指定版本准备；未指定且选择会影响发布预期时，提出版本建议并确认。
2. 从最新远端 `main` 创建 `release/v<version>` 分支。使用 `npm version <version> --no-git-tag-version` 更新根包版本及锁文件，不提前创建 Git 标签。
3. 检查随源码分发的集成和公开安装示例中固定的版本，保持与本次版本一致。被 Git 忽略的临时任务脚本和本地集成不作为公开构建或 npm 发布的前置条件；市场提交仅在用户明确要求时另行处理。
4. 运行版本变更所需检查，在 PR 中记录变更、升级要求、验证结果、计划使用的 `latest` 或 `next`。
5. 按主 Skill 的规则提交、显式推送并创建 PR；如果用户只要求准备版本，返回可审阅的 PR。若已授权合并，检查满足后继续合并。

## 固定发布来源并验证

1. 确认发布准备已合并。记录远端 `main` 上计划发布的准确提交 SHA，确认该提交的三个 CI 工作流通过。
2. 使用全新的独立 checkout 或 worktree 固定到该 SHA，避免旧构建产物混入。原工作区的无关改动保持原状；后续打包、标签和 Release 都使用同一 SHA。
3. 核对包名、包版本、授权的发布渠道与身份。查询 npm 版本、dist-tags、对应 Git 标签和 GitHub Release。版本已存在时进入“中断恢复”，不要盲目重试；区分包不存在和网络/认证失败。
4. 在固定的发布源码目录执行安装和当前完整验证。现有命令如下；工作流或脚本变更后以源码为准：

   ```bash
   npm ci
   npm run repository:check
   npm run i18n:check
   npm run domain-baseline:check
   npm run domain-baseline:test
   npm run typecheck
   npm test
   npm run pack:check
   npm run storybook:build
   mkdir -p .human2ai-data/output/releases
   npm pack --pack-destination .human2ai-data/output/releases
   ```

5. 记录实际生成的 `.tgz` 路径、包名、版本和 SHA-512 integrity。检查包内容与许可声明；内部资料和运行数据应由现有打包检查拒绝。
6. 在独立消费项目安装该 `.tgz`，按产品 README 验证 Skill 接入、`integration doctor`、服务启动、`service status`、`session list` 和桌面浏览器页面。启动与后续 CLI 检查使用相同的测试服务地址；通过 `HUMAN2AI_PORT`、`HUMAN2AI_DATABASE_PATH`、`HUMAN2AI_ARTIFACTS_PATH` 隔离端口和运行数据。涉及数据迁移时使用旧版数据的备份副本验证升级。
7. 发布前确认源码无待提交改动，包内容仍与已验证的安装包一致；安装包变化后重新验证。授权不足时在此提供具体发布结果供用户确认。

## 执行已授权的发布

以下占位符必须替换成核对过的实际值，命令在固定的发布源码目录执行。

发布同一个已验证的 `.tgz`。稳定版使用 `latest`，预发布版（如 `0.2.0-beta.1`）使用 `next`，不得让预发布版覆盖稳定入口：

```bash
npm publish <tested-tarball-path> --access public --tag <latest-or-next>
```

检查 npm 的精确版本和 dist-tag，将 `dist.integrity` 与已记录的本地安装包 integrity 比对：

```bash
npm view <package-name>@<version> version dist.integrity
npm view <package-name> dist-tags --json
```

在独立消费项目从 npm 安装此精确版本并复查启动。npm 成功且验证一致后，将 PR 中审阅过的版本说明保存到 `.human2ai-data/output/releases/<version>.md`，为相同 SHA 创建 GitHub Release 并附上已验证安装包：

```bash
gh release create v<version> <tested-tarball-path> --repo <owner/repository> --target <commit-sha> --title v<version> --notes-file .human2ai-data/output/releases/<version>.md
```

稳定版补充 `--latest`；预发布版补充 `--prerelease --latest=false`。标签已存在时先核对 SHA，禁止移动标签。完成后报告版本、渠道、提交 SHA、验证结果、npm 页面与 GitHub Release 链接。

## 中断恢复

- npm 命令超时或返回不确定结果时，先查询该精确版本是否已接受，不能假定失败后直接重发。
- npm 已存在且 integrity 与已测试包一致：只完成缺失的安装验证或 GitHub Release。已存在 Release 时核对标签和附件，按授权补齐缺失项，不重复创建。
- 版本、integrity、标签 SHA 或发布目标不一致：停止外部修改并报告冲突。不得覆盖版本、移动标签、自动撤包或通过更换目标绕开权限；需要改代码时走新 PR 和新版本。
- 认证或权限失败时，保留已验证的包并说明需要补齐的账号条件，不尝试其他账号或包名发布。

## 官方参考

仅在命令行为或平台规则需要核实时查阅，账号绑定和自动发布另按明确请求配置：

- [npm version](https://docs.npmjs.com/cli/v11/commands/npm-version/)
- [npm publish](https://docs.npmjs.com/cli/v11/commands/npm-publish/)
- [GitHub Release 创建](https://cli.github.com/manual/gh_release_create)
