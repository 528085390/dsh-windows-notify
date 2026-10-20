# dsh-windows-notify

给 [DeepSeek Harness](https://github.com/deepseek-ai) 的 **Windows 原生通知**插件：每个回合结束时弹一条 WinRT toast，
开关就在 DSH 设置页里，不用改配置文件。

<p>
  <img alt="license" src="https://img.shields.io/badge/license-MIT-blue">
  <img alt="platform" src="https://img.shields.io/badge/platform-Windows%2010%2F11-0078d4">
  <img alt="dsh" src="https://img.shields.io/badge/dsh-%3E%3D0.1.7--rc.1-6e56cf">
  <img alt="deps" src="https://img.shields.io/badge/dependencies-0-brightgreen">
</p>

> English: a zero-dependency DeepSeek Harness plugin that raises a native Windows toast when an agent turn ends,
> with a settings-page switch. See [English](#english).

## 特性

- **每回合一条**。去重键是 `<sessionId>#<turn>`，同一个会话的第 2、3 回合都会弹（0.1.0 的 bug 见 [CHANGELOG](CHANGELOG.md)）。
- **开关在设置页**。注册 `settings.section`（order 16），位于「插件」与「智能体预设」之间，改完立即生效，不用重启。
- **默认不吵**。子代理会话的回合默认不弹（`notifySubagents: false`）。
- **零依赖**。无构建步骤、无 npm 依赖、无 native 模块：宿主侧是一个 ESM 文件 + 一个 PowerShell 5.1 脚本，客户端侧是一个浏览器 ESM 文件。
- **可诊断**。每回合一行日志（弹了 / 跳过 + 原因 + 真实 turn 号）。

## 安装

**要求**：Windows 10 / 11（需要 `Windows.UI.Notifications` WinRT API）+ DSH `>= 0.1.7-rc.1`。

### 作为 profile bundle 安装（推荐）

1. 把本仓库放到任意目录，例如 `~/.dsh/local-plugins/dsh-windows-notify`。
2. 编辑 profile 的 `package.json`（桌面端是 `~/.dsh/profiles/desktop/package.json`）：

   ```json
   {
     "dependencies": {
       "dsh-windows-notify": "file:../../local-plugins/dsh-windows-notify"
     },
     "dsh": {
       "profile": {
         "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-windows-notify"]
       }
     }
   }
   ```

3. `pnpm install`（或让 DSH 自己装），然后**重启 DSH**。

插件自带的 `cordis.patch.yml`（`package.json` 的 `dsh.bundle.patch`）会插入 loader 行：

```yaml
- insert:
    - id: windows-notify
      name: dsh-windows-notify
      config:
        enabled: true
```

> ⚠️ **不要**再往 profile 的 `cordis.patch.yml` 里手写同 `id` 的行，会双挂。
> 只写手挂行、不进 `dependencies` / `bundles` 的形态，重启后 boot 阶段解析不到包（实测日志里没有 `plugin loaded`）。

### 验证装上了

```powershell
Get-Content "$HOME\.dsh\windows-notify.log" -Tail 5
```

应该能看到：

```
2026-10-20T07:46:11.212Z plugin loaded (config.enabled=true)
2026-10-20T07:46:13.134Z settings bridge ready at /api/dsh-windows-notify
2026-10-20T07:52:23.492Z toast session-bec4c0d4-...#3 exit=0 out=WINRT_OK
```

没有这两行 = 插件没加载，见 [docs/troubleshooting.md](docs/troubleshooting.md)。

## 使用

### 设置页（推荐）

**设置 → 通知**，可以调：

| 选项 | 默认 | 说明 |
|---|---|---|
| 启用通知 | 开 | 总开关，关掉后连测试通知也不弹 |
| 提示音 | 开 | toast 是否带声音 |
| 通知内容包含正文 | 开 | 关掉后正文固定为「本轮回答已完成」 |
| 摘要长度 | 80 | 正文最多取多少个字（20–300） |
| 标题前缀 | `DeepSeek Harness` | 标题格式是 `<前缀> · <会话标题>` |
| 子代理完成也通知 | 关 | 打开后子代理会话的回合也弹 |
| 发送测试通知 | — | 立刻弹一条，用来验证链路 |

### 命令行兜底

GUI 打不开时，插件目录里有 `toggle.cmd`（翻转开关）和 `status.cmd`（看当前值和最近日志）。
`toggle.ps1` 只改 `enabled`，不会冲掉设置页里调过的其它选项。

## 配置

选项的优先级：**状态文件 > cordis 行 `config` > 内置默认**，每个回合现读，所以改完立即生效。

状态文件 `~/.dsh/windows-notify.json`：

```json
{
  "enabled": true,
  "sound": true,
  "includeText": true,
  "notifySubagents": false,
  "titlePrefix": "DeepSeek Harness",
  "maxBodyChars": 80
}
```

字段类型与取值约束见 [docs/bridge-protocol.md](docs/bridge-protocol.md#状态文件)。

## 工作原理

- 宿主侧挂 `agent/turn-stopping`，用 `powershell.exe`（5.1）+ WinRT `ToastNotificationManager` 弹窗，AUMID 复用系统已注册的 PowerShell 快捷方式，不需要自建。
- 设置页通过一个**同源 HTTP 桥**读写选项（`/api/dsh-windows-notify/*`），不走 schemastery Config —— 原因见 [docs/architecture.md](docs/architecture.md#为什么不用-schemastery-config)。
- 客户端半身靠 `package.json` 的 `dsh.client` + `exports["./client"]` 被 DSH 自动发现，**没有构建步骤**。

细节：

- [docs/architecture.md](docs/architecture.md) —— 事件流、去重键、子代理判定、客户端注册、生命周期
- [docs/bridge-protocol.md](docs/bridge-protocol.md) —— HTTP 桥完整协议（路由、schema、状态码、同源守卫）
- [docs/troubleshooting.md](docs/troubleshooting.md) —— 8 个已知的坑与排查流程

## 目录结构

```
.
├── lib/
│   ├── index.js          # 宿主半身：turn-stopping → toast，HTTP 桥
│   ├── client.js         # 客户端半身：设置页「通知」分区
│   └── toast.ps1         # WinRT toast（纯 ASCII，PS 5.1）
├── cordis.patch.yml      # bundle patch：插入 loader 行
├── package.json          # exports + dsh.client + dsh.bundle.patch
├── toggle.cmd/.ps1       # 命令行开关
├── status.cmd/.ps1       # 命令行状态 + 最近日志
└── docs/
```

## 兼容性

| 项 | 要求 |
|---|---|
| 系统 | Windows 10 / 11（WinRT toast） |
| DSH | `>= 0.1.7-rc.1`（`agent/turn-stopping`、`webServer`、`subprocess`） |
| PowerShell | Windows PowerShell **5.1**（`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`），**不支持 pwsh 7** |
| Node | 跟随 DSH |

## 开发

没有构建步骤，改完 `lib/client.js` 刷新页面即可；改 `lib/index.js`（宿主）**必须重启 DSH**（模块在启动时 import，无热重载）。

```powershell
# 语法检查
node --input-type=module -e "import('file:///C:/path/to/dsh-windows-notify/lib/index.js').then(m => console.log(Object.keys(m)))"

# 直接打一条测试通知（DSH 在跑的时候）
curl.exe -s -X POST http://127.0.0.1:<port>/api/dsh-windows-notify/test
```

## License

[MIT](LICENSE) © 2026 528085390

## English

`dsh-windows-notify` raises a native Windows toast whenever a DeepSeek Harness agent turn ends.

- One toast per turn, deduplicated by `<sessionId>#<turn>`.
- Switches live in **Settings → Notifications** (a `settings.section` contribution at order 16); changes apply on the next turn, no restart.
- Subagent sessions are muted by default.
- Zero dependencies: no build step, no npm packages, no native modules — one ESM host file, one browser ESM file and one PowerShell 5.1 script.
- Every decision is logged to `~/.dsh/windows-notify.log`.

Install it as a profile bundle (see [安装](#作为-profile-bundle-安装推荐)) and restart DSH. Options are stored in
`~/.dsh/windows-notify.json`; the settings page talks to the host through a same-origin HTTP bridge documented in
[docs/bridge-protocol.md](docs/bridge-protocol.md).
