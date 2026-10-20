# HTTP 桥协议

设置页（浏览器）与宿主（Node）之间只通过这一组 HTTP 路由通信。桥由宿主侧 `lib/index.js` 在
`ctx.inject(['webServer'], ...)` 里注册，全部是 **exact** 路由（DSH 的 webserver 先匹配 exact、再匹配最长 prefix，
所以它们排在鉴权兜底之前，裸 `curl` 也能打）。

- Base path：`/api/dsh-windows-notify`
- 编码：请求与响应都是 `application/json; charset=utf-8`
- 响应头：`cache-control: no-store`、`referrer-policy: no-referrer`

## 通用信封

成功：

```json
{ "ok": true, "value": { } }
```

失败：

```json
{ "ok": false, "message": "local requests only" }
```

| 状态码 | 何时 |
|---|---|
| 200 | 成功（含 `/test` 因总开关关闭而没弹的情况） |
| 400 | 请求体不是合法 JSON，或没有任何已知字段 |
| 403 | 非本机/非同源请求 |
| 405 | 方法不对 |
| 500 | 状态文件写不进去 |

## `GET /state`

读当前**生效值**（不是文件原文：已经合并了默认值和 cordis 行 config）。

**响应 200**

```json
{
  "ok": true,
  "value": {
    "options": {
      "enabled": true,
      "sound": true,
      "includeText": true,
      "notifySubagents": false,
      "titlePrefix": "DeepSeek Harness",
      "maxBodyChars": 80
    },
    "stateFile": "C:\\Users\\<user>\\.dsh\\windows-notify.json",
    "logFile": "C:\\Users\\<user>\\.dsh\\windows-notify.log"
  }
}
```

```powershell
curl.exe -s http://127.0.0.1:<port>/api/dsh-windows-notify/state
```

## `POST /state`

**局部更新**：只写请求体里出现过的已知字段，其它键原样保留。

**请求体**（所有字段可选，至少给一个）

| 字段 | 类型 | 约束 |
|---|---|---|
| `enabled` | boolean | — |
| `sound` | boolean | — |
| `includeText` | boolean | — |
| `notifySubagents` | boolean | — |
| `titlePrefix` | string | 超过 60 字会被截断；空串会被重置为 `DeepSeek Harness` |
| `maxBodyChars` | number | 取整后夹在 **20–300** |

未知字段被**静默忽略**；如果一个已知字段都没有，返回 400 `no known field in body`。

**响应 200**：与 `GET /state` 相同的结构（写盘后再读一次，客户端拿到的就是新值）。

```powershell
curl.exe -s -X POST -H "content-type: application/json" \
  -d '{"enabled":false}' http://127.0.0.1:<port>/api/dsh-windows-notify/state
```

写入失败（磁盘满、权限）返回 500 `could not write <stateFile>`，此时内存里的值**没有**变。

## `POST /test`

弹一条测试通知。

**响应 200**

```json
{ "ok": true, "value": { "sent": true } }
```

总开关关闭时**不弹也不报错**：

```json
{ "ok": true, "value": { "sent": false, "reason": "disabled" } }
```

测试通知同样受 `sound` 影响，但**不受** `notifySubagents` 影响。

## 同源守卫

每个路由在做事之前先跑 `isLocalRequest(req)`，按顺序：

1. `sec-fetch-site: cross-site` → 拒（挡住跨站请求，即使浏览器发来的也一样）。
2. 没有 `host` 头 → 拒。
3. 有 `origin` 头 → 要求 `new URL(origin).host === host`，否则拒（挡住别的站点用 no-cors 打过来）。
4. 没有 `origin`（命令行、curl）→ 要求 `host` 的主机名是 `127.0.0.1` / `localhost` / `::1`（端口随便）。

被拒时返回 403 `{ "ok": false, "message": "local requests only" }`。

> 这条守卫挡的是**浏览器里的恶意页面**和**局域网内的其它机器**。它不挡本机上以你的身份运行的进程 ——
> 这个插件不是权限边界，别拿它当安全机制用。

## 状态文件

`~/.dsh/windows-notify.json`（`DSH_HOME` 环境变量会改掉 `~/.dsh`）：

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

- 读的时候容忍 BOM（`\uFEFF`）和损坏的 JSON（读不出来就当空对象）。
- 写的时候是整体重写（先合并再落盘），带 2 空格缩进和结尾换行。
- 生效优先级：**状态文件 > cordis 行 `config` > 内置默认**，每回合现读。

## 为什么不是 DSH 的 settings 服务

DSH 的 settings 服务要求插件导出 schemastery `Config`，而 `@deepseek-ai/schemastery` 得从插件目录向上解析。
本插件安装在 `~/.dsh/local-plugins/` 这类目录时，向上没有任何 `node_modules`，`import` 直接失败；
为它单独建 junction 又会把插件绑死在 profile 布局上。HTTP 桥零依赖，整个插件目录搬走也能跑。

代价是设置页要自己画 UI（见 `lib/client.js`），而不是让 DSH 自动生成表单。
