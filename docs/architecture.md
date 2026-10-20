# 架构与实现细节

插件是**两个半身**：

| 半身 | 文件 | 运行环境 | 职责 |
|---|---|---|---|
| 宿主 | `lib/index.js`（ESM） | DSH 主进程（Node） | 监听回合结束、弹 toast、提供 HTTP 桥 |
| 客户端 | `lib/client.js`（浏览器 ESM） | DSH Web GUI | 在设置页注册「通知」分区 |

两者之间**没有共享代码**，只通过 [HTTP 桥](bridge-protocol.md) 和一个 JSON 文件通信。

```
agent/turn-stopping ──► lib/index.js ──► powershell.exe + toast.ps1 ──► WinRT toast
                              │
                              ▼
                     ~/.dsh/windows-notify.json  ◄── HTTP 桥 ◄── lib/client.js（设置页）
```

## 宿主半身

### 事件流

`apply(ctx, config)` 里挂两类监听：

1. `ctx.on('session/event', ...)` —— 缓存弹窗要用的上下文：
   - `session/title` → 记会话标题（`titles` Map，键是 sessionId）
   - `assistant/message` → 记本轮最后一条助手消息的纯文本（`lastText`）
   - `turn/start` → 清掉上一轮的文本，避免把旧回答当成新回答
2. `ctx.on('agent/turn-stopping', ...)` —— 真正的触发点。`@deepseek-ai/dsh-agent-loop` 在 `turn/end` 之前
   `dispatch.serial("agent/turn-stopping")`，每回合一次，载荷是 `{ turn: number, signal, agent }`。

### 去重键

```js
const turnKey = sid + '#' + turnNumberOf(payload?.turn)
```

`turnNumberOf` 接受数字（正常情况），也兼容 `{ id }` / `{ index }` 形态，都拿不到才退回进程内序号 `seqN`。

> **0.1.0 的 bug**：当时写成 `turn?.id ?? turn?.index`，而 `turn` 是数字，两个属性都取不到 →
> 键恒为 `sid#` → 每个会话每进程只弹第一次，看起来就是「有些会话不弹」。

`fired` 是个 Set，超过 500 条整体清空（够用且不会无限增长）。

### 子代理判定

按顺序，命中即返回：

1. `session.header.origin === 'subagent'`
2. `session.header.parentSession` 是非空字符串
3. `session.header.delegationDepth > 0`
4. `header` 存在但 `origin` 是别的值 → **不是**子代理（明确否定，不再往下猜）
5. 没有 header 时兜底：sessionId 不以 `session-` 开头的当子代理（用户会话是 `session-<uuid>`，子代理是裸 uuid）

默认 `notifySubagents: false`，命中就写一行 `skip subagent <turnKey>` 然后返回。

### 弹窗

```js
ctx.subprocess.spawn({
  argv: [PS_EXE, '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', TOAST_PS1, '-Title', title, '-Body', body],
  stdio: { stdin: 'ignore', stdout: { maxBytes: 16 * 1024 }, stderr: { maxBytes: 16 * 1024 } },
  graceMs: 5000,
})
```

- 用的是 **Windows PowerShell 5.1**（`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`），
  pwsh 7 解析不了 WinRT 类型。
- `toast.ps1` 里的 AUMID 复用系统已注册的
  `{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe`，所以**不需要**自建开始菜单快捷方式。
- 子进程是 fire-and-forget：`void toast(...)`，不阻塞回合结束。
- 结果靠 `handle.done` + `handle.collected.<stream>.readFrom(0)` 记录。注意 `readFrom` 返回的是
  `{ text, nextOffset, lossy, spillPath? }`，**不是字符串**（0.2.0 直接把对象塞进模板串，日志里是 `[object Object]`，0.2.1 修）。

### 选项解析

```js
resolveOptions(config, state) = DEFAULTS → sanitizePatch(config) → sanitizePatch(state)
```

后写的赢，所以优先级是 **状态文件 > cordis 行 config > 内置默认**。`sanitizePatch` 只认白名单字段：
布尔字段必须是 boolean，`titlePrefix` 截 60 字，`maxBodyChars` 取整后夹在 20–300。
每个回合都重新读一次状态文件，所以设置页改完下一回合就生效。

### 生命周期

```js
ctx.inject(['webServer'], (sctx) => {
  sctx.effect(() => {
    const disposers = makeRoutes(ctx, baseConfig).map((route) => sctx.webServer.register(route))
    log('settings bridge ready at /api/dsh-windows-notify')
    return () => { for (const dispose of disposers) dispose(); log('settings bridge removed') }
  }, 'windows-notify: settings bridge')
})
```

`webServer` 是可选服务（没有 Web 表面时不存在），所以用 `ctx.inject` 而不是写在 `inject` 导出里 ——
后者会让整个插件在没有 web 的环境里不加载，通知也就没了。注册返回 disposer，交给 `effect` 管，
插件重载时不会残留路由（重复 path 会抛 `webserver: duplicate ... route`）。

## 客户端半身

### 加载方式

DSH 的客户端 bundle 由 `@deepseek-ai/dsh-client-modules` 在启动时扫描 profile 里每个包的
`package.json`：有 `dsh.client` 就当成客户端插件，入口取 `exports["./client"]`，然后注入到页面。
本插件的入口文件必须自己调 `window.__ModuleLoader__.load`：

```js
window.__ModuleLoader__.load({
  id: 'dsh-windows-notify',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement
    const exports = {}
    exports.name = 'dsh-windows-notify'
    exports.inject = ['slots', 'locale']
    exports.apply = apply
    return exports
  },
})
```

`require('react')` 是平台 seed 词，官方 bundle 里大量使用；`react/jsx-runtime` 同理。
所以客户端半身可以用 JSX 之外的写法（`h(...)`）而不需要任何构建工具。

### 注册设置分区

```js
ctx.effect(() => { const dispose = ctx.locale.register(NS, { zh, en }); return () => dispose() }, 'windows-notify: locale')
ctx.slots.inject('settings.section', () => ctx.slots.register({
  name: 'settings.section',
  id: 'windows-notify',
  order: 16,
  label: () => t('nav'),
  locale: 'settings.windowsNotify',
}, Section))
```

- `settings.section` 是 **list 槽**（`kind: "list", scope: "root"`），官方顺序是 general 0 / models 10 /
  plugins 15 / agent-presets 20，本插件插在 16。
- 导航行由 `ctx.slots.entries('settings.section')` 自动生成，label 用 `locale` 命名空间翻译。
- 组件只收到 `{ close }` 一个 prop（父组件渲染时传的），所以不要依赖其它 props。
- `locale.register` 返回 disposer，同一个命名空间重复注册同一语言会抛错，所以必须用 `ctx.effect` 收尾。

### 状态与请求

组件挂载时 `GET /state` 拉一次快照；每个控件改动后 `POST /state` 提交**单个字段**（局部更新）；
数字输入在 blur / Enter 时提交并夹到 20–300；保存成功闪一下「已保存」。

桥不可达时（比如宿主没起来）显示 `bridgeDown` 文案 + 重试按钮，而不是白屏。

样式通过 `ctx.effect` 注入一个 `<style data-dsh-windows-notify>`，类名前缀 `dshwn-`，带
`prefers-color-scheme` 的明暗两套变量。

## 为什么不用 schemastery Config

见 [bridge-protocol.md#为什么不是-dsh-的-settings-服务](bridge-protocol.md#为什么不是-dsh-的-settings-服务)。
一句话：`@deepseek-ai/schemastery` 从插件目录向上解析不到，而为了它去建 junction 会把插件绑死在某个 profile 布局上。

## 已知的取舍

- 只支持 Windows（WinRT toast）。
- 一次回合只弹一条，不合并、不排队。
- 会话标题和最后一条回答缓存在内存里，DSH 重启后第一回合可能拿不到标题（正文仍然正常）。
- 设置页的 UI 是自己画的，没有复用 DSH 的表单组件。
