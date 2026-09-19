# Human2AI

**简体中文** | [English](README.en.md)

Human2AI 是供人和 AI Agent 协作的本地视觉工作区：用户在桌面浏览器中编辑构图、UI 草图和 3D 空间，Agent 通过 CLI 连接同一会话、读取版本、修改和导出结果。

## 环境要求

- Node.js 22 或更高版本；源码开发使用 npm 11。
- 桌面电脑浏览器。
- SQLite 和图片处理使用原生依赖，安装包需要与本机操作系统、架构和 Node.js 版本匹配。

## 安装与使用

### 交给 Agent 安装

在目标项目中打开 Codex，把下面这句话交给 Agent：

> 帮我在当前项目安装 human2ai，按 npm 包的 README 完成 Human2AI 专用 Skill 接入、启动服务并验证可用，最后告诉我访问地址。

Agent 可以用 `npm view human2ai readme` 读取公开安装说明，安装后也可以读取 `node_modules/human2ai/README.md`。完整流程由 Agent 执行：

1. 确认目标项目目录、Node.js 22+ 和 npm 可用；项目没有 `package.json` 时先执行 `npm init -y`。
2. 检查已有 `.human2ai/integration.json`。已有接入时，按记录的 runner 检查并沿用项目的版本和服务地址；首次接入时执行下方“安装 npm 包”和“安装 Agent Skill”中的命令。
3. 阅读安装后的 `.agents/skills/human2ai/SKILL.md`，运行 `integration doctor` 和 `service status`。接入文件由 CLI 生成；出现同步冲突时保留项目内已有修改。
4. 服务未运行时，在持久终端执行配置中的 `service.start`，等待服务就绪后重试。项目已有明确启动约定时沿用该约定；首次 npm 安装默认使用 `4179` 和 `~/.human2ai/` 数据目录。
5. 确认接入检查与服务检查均返回 `ready`，浏览器地址可访问，按 runner 执行 `session list` 可以读取会话；同时查看安装的安全审计结果，遇到漏洞时报告受影响依赖与修复情况。
6. 向用户报告安装版本、项目路径、Skill 路径、浏览器地址和下次启动命令。用户无需再手动补装 Skill。

当前自动接入命令支持 Codex。用户也可以自行执行下面的相同安装流程。

### 自己按命令安装

#### 1. 安装 npm 包

在需要接入 Human2AI 的消费项目根目录执行。空白目录尚无 `package.json` 时，先运行 `npm init -y`；已有项目保留原配置。

```bash
npm install --save-dev human2ai
```

安装包包含预构建的 Web 页面、CLI、数据库迁移、Schema 和 Human2AI 专用 Skill。`npm install` 将这些文件安装到 `node_modules/human2ai/`；要让 Agent 发现并使用 Skill，还需要执行下一步接入命令。

#### 2. 安装 Agent Skill（Codex）

在同一个消费项目根目录执行；已经安装 npm 包的项目可以直接从这里开始：

```bash
npx --no-install human2ai integration install --agent codex --mode copy
npx --no-install human2ai integration doctor
```

接入命令从当前项目安装的 npm 包复制完整 Skill，并生成以下文件：

| 路径 | 用途 |
| --- | --- |
| `.agents/skills/human2ai/SKILL.md` | Human2AI 专用 Skill，定义 Agent 的连接、读取、编辑与导出流程 |
| `.agents/skills/human2ai/references/` | 构图、UI 草图、3D 空间等操作参考 |
| `.agents/skills/human2ai/agents/openai.yaml` | Codex 中的 Skill 展示信息 |
| `.human2ai/integration.json` | 当前项目的 CLI runner、服务地址和 Skill 同步记录 |

`integration doctor` 返回 `status: "ready"` 表示接入文件检查通过；服务是否已启动由下一步的 `service status` 检查。连接配置包含本机路径，由生成的 `.human2ai/.gitignore` 排除；Skill 可以随消费项目提交。

在消费项目中打开 Codex，使用 Skill 选择器找到 Human2AI；Codex CLI / IDE 扩展也可以通过 `/skills` 或 `$human2ai` 显式调用。Codex 会自动发现新增 Skill，未显示时重启 Codex。详见 [OpenAI 官方 Skill 说明](https://learn.chatgpt.com/docs/build-skills)。

#### 3. 启动与验证

```bash
npx --no-install human2ai web
```

这个命令启动一个同时提供 Web 页面和后端 API 的服务，两者共用 <http://127.0.0.1:4179>。其他消费项目使用默认配置时也连接这一个服务；重复启动会复用已运行的兼容服务。

保持服务终端运行，在浏览器打开上述地址。另开终端，在同一个消费项目中执行：

```bash
npx --no-install human2ai service status
npx --no-install human2ai session list
```

服务检查返回 `status: "ready"`，且会话列表可以读取，即完成基本安装验证；新数据目录返回空列表也是正常结果。Agent 按 `.human2ai/integration.json` 中的 runner 调用 CLI。

### 安装提示与升级检查

如果 npm 提示 `better-sqlite3` 的安装脚本尚未记录到 `allowScripts`，可先查看脚本列表；审核该数据库依赖的原生构建脚本后，记录授权：

```bash
npm install-scripts ls
npm install-scripts approve better-sqlite3
```

这些命令适用于提供 `install-scripts` 功能的 npm 版本。授权记录写入消费项目的 `package.json`；如果原生模块因脚本被跳过而无法加载，授权后再执行 `npm rebuild better-sqlite3`。脚本授权与安全审计是独立的检查，漏洞详情用 `npm audit` 查看。详见 [npm 安装脚本说明](https://docs.npmjs.com/cli/v11/commands/npm-install-scripts/)。

已安装但升级后提示 `update-available` 时，按下方“升级安装版”同步 Skill；同步冲突按命令报告保留消费项目的修改。

### 连接与使用会话

```bash
npx --no-install human2ai session connect --session <session-id>
npx --no-install human2ai session open --session <session-id>
```

`session connect` 返回浏览器地址、最新 Capture 版本和当前会话支持的命令。`capture get` 读取指定版本，`capture save` 保存新版本，`capture undo` 追加恢复版本。不同项目通过项目 ID 和会话 ID 组织在同一本地服务中。

构图和 UI 会话可使用 `/styles/` 中的风格库。Agent 可通过 `style list|get|create|update|add-reference|remove-reference|delete` 操作同一风格库。完整命令和协作方式见 [Human2AI Skill](skills/human2ai/SKILL.md)。

## 数据与产物

| 环境 | API 端口 | 数据库 | 服务图片与风格参考图 |
| --- | --- | --- | --- |
| npm 安装版 | `4179` | `~/.human2ai/human2ai.sqlite` | `~/.human2ai/artifacts/` |
| 源码开发版 | `4180` | `<源码仓库>/.human2ai-data/human2ai.sqlite` | `<源码仓库>/.human2ai-data/artifacts/` |

开发版与安装版分别保存数据。`HUMAN2AI_PORT`、`HUMAN2AI_DATABASE_PATH` 和 `HUMAN2AI_ARTIFACTS_PATH` 可覆盖对应设置；未单独设置图片目录时，它位于数据库同级的 `artifacts/`。服务只监听本机回环地址。

默认环境由正在执行的 Human2AI 包所在位置决定：源码仓库中的服务和 CLI 使用开发默认值，npm 安装包使用正式默认值。启动不会自动复制、合并或清理两边的数据；已有同源会话会保留，后续修改各自保存。

验证升级兼容性时，使用正式版旧数据库和图片的备份副本，在隔离目录运行新版，检查数据库迁移、旧会话读取、图片访问及修改保存。开发数据与正式数据可以来自同一份快照，但使用不同的数据库文件。更新开发测试快照前先保留已有开发数据；运行中的数据库使用 SQLite backup API，或者停服后复制整个数据目录。

在 Human2AI 源码仓库中，导出的图片、提示词记录和临时结果统一放到 `.human2ai-data/output/`；已有构图产物可放到 `.human2ai-data/exports/`，备份放到 `.human2ai-data/backups/`。CLI 的 `--output` 和 `--preview` 按指定路径写入，调用者应选择这个被忽略的目录。

例如，从开发服务中导出一个已保存版本的 UI 草图；输出文件扩展名可选 `.png` 或 `.svg`：

```bash
mkdir -p .human2ai-data/output
npm run cli -- --api-url http://127.0.0.1:4180 ui-layout render --session <session-id> --revision <revision> --output .human2ai-data/output/ui-layout.png
```

内部 `docs/` 和 `.human2ai-data/` 保留在本地，均不提交 Git、不进入 npm 包。数据库及其 WAL/SHM 文件也由忽略规则排除。停服后备份整个数据目录，可同时保留数据库和图片；在线备份数据库应使用 SQLite backup API。

## 源码开发与日常使用

在 Human2AI 源码仓库执行：

```bash
npm ci
npm run dev
```

Web 开发页面为 <http://localhost:3000>，API 为 <http://127.0.0.1:4180>。Web 支持热更新，API 源码变化后自动重启，CLI 构建也会随源码变化自动更新。端口已有兼容服务时会复用它；要运行修改后的后端，先停止该端口上的旧服务。

另开终端，在源码仓库直接运行 CLI 源码：

```bash
npm run cli -- --api-url http://127.0.0.1:4180 --web-url http://localhost:3000 service status
```

从源码仓库将 Skill 接入另一个本地项目：

```bash
npm run build:server
npm run cli -- --api-url http://127.0.0.1:4180 --web-url http://localhost:3000 integration install --agent codex --root /absolute/path/to/consumer --mode copy
```

源码接入默认使用开发 API `4180` 和 Web `3000`；生成的 `service.start` 从源码仓库运行 `npm run dev`。接入配置中的 CLI runner 指向源码仓库的 `dist/cli/main.js`，开发服务运行期间会自动更新这个构建。首次接入前运行一次 `npm run build:server`；未运行开发服务时也可以手动构建。`--mode link` 只链接 Skill 文件。

本机消费项目可以长期固定连接源码开发版，直接测试尚未发布的功能。消费项目按自己的 `.human2ai/integration.json` 调用 CLI；本地联调无需发布 npm，npm 包用于对外发布经过验证的版本。

源码 Skill 更新后运行 `integration sync --check` 检查，再运行 `integration sync` 同步。消费项目修改过的 Skill 出现冲突时会保留其修改。

Storybook 使用 `npm run storybook`，默认地址为 <http://localhost:6006>。已同步的 UI 源码可以独立构建；只有维护者更新上游 YisiUI 时才需要访问私有源。

## 升级安装版

在消费项目执行：

```bash
npm install --save-dev human2ai@latest
npx --no-install human2ai integration sync --check
npx --no-install human2ai integration sync
```

升级前停止服务并备份数据目录，升级后重新运行 `human2ai web`。数据库迁移在启动时执行；软件版本回退时应使用对应版本的数据备份。

## 验证与本地打包

```bash
npm run repository:check
npm run i18n:check
npm run domain-baseline:check
npm run pack:check
npm run domain-baseline:test
npm run typecheck
npm test
```

生成安装包后，在独立消费项目中安装验证：

```bash
mkdir -p .human2ai-data/packages
npm pack --pack-destination .human2ai-data/packages
```

在独立项目中执行 `npm install --save-dev /absolute/path/to/human2ai-0.1.2.tgz`，再按安装步骤接入并启动。安装包检查会验证必需文件和许可证，并拒绝内部文档、数据库及用户产物。

## 许可证

Human2AI 自有代码采用 [MIT](LICENSE)，版权署名为贾思斋。YisiUI 的完整 MIT 许可证随安装包保存在 `licenses/YisiUI-LICENSE`。Quaternius 模型保留其 [CC0 声明](assets/quaternius/License_Standard.txt)；依赖的原始许可声明随包保存在 `licenses/THIRD-PARTY-NOTICES.txt`，继续适用各自的许可证。
