# Changelog

本文件格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [0.2.2] - 2026-10-20

### Fixed

- **装出来的包缺 `cordis.patch.yml`**：`files` 只写了 `["lib"]`，无论走 `dsh plugin add <git>`
  还是 `npm publish`，装进 profile 后 `dsh.bundle.patch` 指向的文件都不存在，bundle 直接加载失败。
  现在 `files` 是 `["lib", "cordis.patch.yml"]`。

### Added

- README 增加「用 DSH 官方的插件入口安装」：侧边栏 **插件 → 添加插件** 填
  `git+https://github.com/528085390/dsh-windows-notify.git`，或 `dsh plugin add` 同款 spec。
- 明确警告不要用裸包名安装：npm 上的 `dsh-windows-notify@1.0.2` 属于另一位作者（Yxkzx），不是本仓库。

## [0.2.1] - 2026-10-20

### Fixed

- 日志里的 `out=` / `err=` 不再显示 `[object Object]`。
  `handle.collected.<stream>.readFrom(0)` 返回的是 `{ text, nextOffset, lossy, spillPath? }` 而不是字符串，
  现在取 `.text`，`lossy` 时会加 `[lossy]` 前缀。

> 宿主模块在 DSH 启动时 `import`，升级后需要重启 DSH。

## [0.2.0] - 2026-10-20

### Added

- **设置页「通知」分区**（`settings.section`，order 16）：启用通知 / 提示音 / 正文摘要 / 摘要长度 /
  标题前缀 / 子代理也通知 / 发送测试通知。
- 客户端半身 `lib/client.js`（浏览器 ESM，无构建步骤），通过 `dsh.client` + `exports["./client"]` 被自动发现。
- 同源 HTTP 桥 `/api/dsh-windows-notify/{state,test}`，零依赖，带同源守卫。
- `cordis.patch.yml` 作为 `dsh.bundle.patch` 随包分发。

### Fixed

- **「有些会话不弹通知」**：`agent/turn-stopping` 的 `turn` 是数字，0.1.0 却按 `turn.id ?? turn.index`
  拼去重键，键恒为 `<sessionId>#`，于是每个会话每个进程只弹第一次。现在去重键是 `<sessionId>#<turn>`。
- 子代理会话默认不再弹（`notifySubagents: false`），判定依次看 `header.origin`、`parentSession`、`delegationDepth`。

## [0.1.0] - 2026-10-19

### Added

- 初始版本：`agent/turn-stopping` → Windows PowerShell 5.1 + WinRT toast。
- 状态文件 `~/.dsh/windows-notify.json` 与命令行开关 `toggle.cmd` / `status.cmd`。
