# 贡献

## 结构约定

- **宿主半身** `lib/index.js`：纯 ESM，零依赖。改完**必须重启 DSH** 才生效（启动时 import，无热重载）。
- **客户端半身** `lib/client.js`：浏览器 ESM，用 `h(...)` 而不是 JSX，**不要引入构建步骤**。
- **`lib/toast.ps1`**：保持**纯 ASCII**，连注释也用英文。Windows PowerShell 5.1 按 ANSI 解码无 BOM 脚本，
  中文会变乱码，还可能把下一行代码吞进注释（详见 [docs/troubleshooting.md](docs/troubleshooting.md#7-坑powershell-脚本的编码)）。
- 不新增 npm 依赖。`@deepseek-ai/schemastery` 之类的包在插件目录里解析不到，这是刻意的设计约束。

## 本地验证

```powershell
# 宿主模块能否被 import（语法 + 导出）
node --input-type=module -e "import('file:///C:/path/to/dsh-windows-notify/lib/index.js').then(m => console.log(Object.keys(m)))"
# 期望：OK 风格的输出，包含 apply,inject,name

# 桥自测（DSH 在跑时）
curl.exe -s http://127.0.0.1:<port>/api/dsh-windows-notify/state
curl.exe -s -X POST http://127.0.0.1:<port>/api/dsh-windows-notify/test
```

改完看一眼 `~/.dsh/windows-notify.log`：`toast <sid>#<turn> exit=0 out=WINRT_OK` 才算真的通了。

## 提交

- 一个提交只做一件事，信息用祈使句（`fix:` / `feat:` / `docs:`）。
- 改行为就同步 `CHANGELOG.md` 和受影响的 `docs/`。
