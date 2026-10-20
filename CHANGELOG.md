# Changelog

本文件格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Changed

- **README 拆成中英两份**：`README.md`（中文，默认）与 `README.en.md`（英文），章节一一对应、顶部互相切换，
  不再把英文摘要塞在中文 README 末尾。
- **安装章节重排**：新增「让 agent 帮你装」（直接把仓库地址丢给 DSH 会话）；
  图形界面 / 命令行统一列出三种等价写法（`https://`、`git+https://`、`github:`），三种都实测装出 0.3.0。
- **新增「为什么不能用包名安装」**：解释 `dsh plugin add <spec>` 里纯包名走 npm registry，
  而 `dsh-windows-notify` 在 npm 上属于另一位作者。

## [0.3.0] - 2026-10-20

### Added

- **插件页中英双语标题 / 描述**：新增 `locale/en.json`、`locale/zh.json`，内容为
  `{"meta":{"title":"…","description":"…"}}`。DSH 的 `readPluginMeta()`（`@deepseek-ai/dsh-app-boot`）
  会解析 `<包名>/locale/en.json`，再用 `readdir` 把同目录下其它语言文件一并读入，
  最后交给 `resolveText()` 按当前界面语言取值（缺语言时回落 `en`）。
- **插件页图标**：新增 `icon.svg`（64×64，<256 KiB），通过 `exports["./icon"]` 暴露。
- `package.json` 补 `exports["./locale/*.json"]`、`exports["./icon"]`，并把 `locale/*.json`、
  `icon.svg` 加进 `files`——缺 `exports` 时 `readPluginMeta()` 会当作「没有本地化资源」静默跳过。

> 纯元数据改动，不影响通知行为；装完后重启 DSH（或重装插件）才会重新读取。

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
