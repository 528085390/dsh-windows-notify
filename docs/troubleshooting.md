# 排错

先看日志：`~/.dsh/windows-notify.log`（每行一个 ISO 时间戳 + 事件）。

| 日志行 | 含义 |
|---|---|
| `plugin loaded (config.enabled=true)` | 宿主半身加载成功（每次启动一行） |
| `settings bridge ready at /api/dsh-windows-notify` | HTTP 桥注册成功 |
| `toast <sid>#<turn> exit=0 out=WINRT_OK` | 弹窗成功 |
| `skip disabled <sid>#<turn>` | 总开关关着 |
| `skip subagent <sid>#<turn>` | 子代理会话，默认不弹 |
| `skip duplicate <sid>#<turn>` | 同一回合重复触发（已被去重） |
| `toast failed: ...` | 弹窗链路异常，看后面的错误 |
| `state updated {...}` | 设置页改过选项 |

## 排查流程

```
没有新日志 ──► 插件没加载 ──► 检查 dependencies / bundles / 重启
有 plugin loaded 但没有 toast 行
        └─► 有 skip 行？──► 按 skip 原因处理
        └─► 连 skip 都没有 ──► 回合根本没结束（还在跑），或者监听没挂上
有 toast 行但没看到弹窗 ──► 系统通知被静音 / 专注助手 / toast.ps1 出错
```

## 1. 设置页里没有「通知」分区

按顺序查：

1. `package.json` 里 `dsh.client` 和 `exports["./client"]` 还在吗？
2. profile 的 `dsh.profile.bundles` 里有 `dsh-windows-notify` 吗？
3. 日志里有 `settings bridge ready` 吗？
   - 有 → 宿主正常，是客户端模块没进 bundle 图。**重启 DSH**：客户端模块清单在启动时组装，
     而且 `@deepseek-ai/dsh-client-modules` 会把「有没有 `dsh.client`」的结果缓存进 `pkgMeta`
     （键是 `baseUrl + '\0' + loaderName`，全文件没有任何地方清空它），刷新页面救不回来。
   - 没有 → 插件根本没加载，见下一节。

## 2. 插件没加载（没有 `plugin loaded`）

- **安装形态不对**：只在 profile 的 `cordis.patch.yml` 里手写了 `- id: windows-notify` 行，
  但没进 `dependencies` / `bundles` → boot 阶段解析不到包。改成
  [bundle 通道](../README.md#作为-profile-bundle-安装推荐)。
- **重复挂载**：bundle patch 和手写行都有同一个 `id` → 可能报重复 id，也可能双挂（弹两条）。
  删掉手写的那行。
- **目录联接被 `pnpm install` 清掉**：重建：

  ```powershell
  cmd /c mklink /J "$HOME\.dsh\profiles\desktop\node_modules\dsh-windows-notify" "$HOME\.dsh\local-plugins\dsh-windows-notify"
  ```

## 3. 有 `skip` 行

- `skip disabled` → 设置页把总开关关了，或者 `~/.dsh/windows-notify.json` 里 `enabled: false`。
- `skip subagent` → 正常行为。想让子代理也弹，打开「子代理完成也通知」。
- `skip duplicate` → 同一 `<sessionId>#<turn>` 触发了两次，说明有东西重复 dispatch，一般无害。

## 4. 有 toast 行但屏幕没反应

1. Windows 通知总开关：设置 → 系统 → 通知。
2. 专注助手 / 免打扰模式。
3. 通知被折叠进通知中心而不是弹横幅（Windows 11 的「通知横幅」设置）。
4. 手动验证链路：

   ```powershell
   curl.exe -s -X POST http://127.0.0.1:<port>/api/dsh-windows-notify/test
   ```

   返回 `{"ok":true,"value":{"sent":true}}` 说明宿主认为发出去了。

## 5. 「有些会话弹、有些不弹」

0.1.0 的 bug：去重键取的是 `turn.id ?? turn.index`，而 `turn` 是数字 → 键恒为 `sid#` →
**每个会话每进程只弹第一次**。0.2.0 起用 turn 数字。确认日志里的 turn 号是真实数字（`#1`、`#2`、`#3`），
如果还是空的或 `#seq1`，说明跑的是旧代码 → 重启。

## 6. 改了代码不生效

| 改的文件 | 生效方式 |
|---|---|
| `lib/client.js` | 刷新页面 |
| `lib/index.js`（宿主） | **重启 DSH**（启动时 import，没有热重载） |
| `package.json` 的 `dsh.client` | **重启 DSH**（会被缓存） |
| `cordis.patch.yml` | 改 mtime 不一定触发重载，最稳的是重启 |

## 7. 坑：PowerShell 脚本的编码

`lib/toast.ps1` 和 `toggle.ps1` / `status.ps1` **一律保持纯 ASCII**（连注释也用英文）。

Windows PowerShell 5.1 把无 BOM 的 `.ps1` 按 ANSI 解码，中文字节会变乱码；更阴的是某行注释的最后一个字节
可能被解码成反引号（续行符），**把下一行代码吞进注释**——症状是状态文件被写成 0 字节、开关静默失效。
ASCII 源码对编码免疫。

同理，`toggle.ps1` 写回 JSON 必须用 `UTF8Encoding($false)`：PS 5.1 的 `Set-Content -Encoding UTF8`
会加 BOM，而 Node 的 `JSON.parse` 遇到 BOM 直接抛错。

## 8. 坑：WinRT 类型与 AUMID

- `New-Object Windows.UI.Notifications.ToastNotification $doc` 会报「找不到类型」。必须先预热：

  ```powershell
  [Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
  $toast = [Windows.UI.Notifications.ToastNotification]::new($doc)
  ```

- AUMID 里是**单个反斜杠**：`{1AC14E77-...}\WindowsPowerShell\v1.0\powershell.exe`。
  写成 `\\WindowsPowerShell` 会报 applicationId 参数错误。
- 别用 pwsh 7 跑 `toast.ps1`，WinRT 类型解析会失败。

## 9. 桥返回 401

`dsh web authentication required; reopen the URL printed by dsh web.`

这条**不是本插件返回的**，是 DSH 的鉴权兜底（`@deepseek-ai/dsh-client-connection`）。
本插件的路由是 exact 路由，匹配在兜底之前；如果连本插件的不存在路径都返回同样的 401，
说明**插件没加载**（路由没注册），不是鉴权问题。
