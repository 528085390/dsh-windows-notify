# dsh-windows-notify

A **native Windows notification** plugin for [DeepSeek Harness](https://github.com/deepseek-ai): one WinRT toast every
time an agent turn finishes, with every switch living in DSH Settings instead of a config file.

<p>
  <img alt="license" src="https://img.shields.io/badge/license-MIT-blue">
  <img alt="platform" src="https://img.shields.io/badge/platform-Windows%2010%2F11-0078d4">
  <img alt="dsh" src="https://img.shields.io/badge/dsh-%3E%3D0.1.7--rc.1-6e56cf">
  <img alt="deps" src="https://img.shields.io/badge/dependencies-0-brightgreen">
</p>

[中文](README.md) | **English**

## Features

- **One toast per turn.** Deduplicated by `<sessionId>#<turn>`, so turns 2 and 3 of the same session fire too (see the 0.1.0 bug in [CHANGELOG](CHANGELOG.md)).
- **Switches in Settings.** A `settings.section` contribution (order 16) sitting between *Plugins* and *Agent presets*; changes apply immediately, no restart.
- **Quiet by default.** Turns from subagent sessions are muted (`notifySubagents: false`).
- **Zero dependencies.** No build step, no npm packages, no native modules: one ESM file plus a PowerShell 5.1 script on the host side, one browser ESM file on the client side.
- **Debuggable.** One log line per turn (fired / skipped, the reason, and the real turn number).
- **Bilingual plugin page.** `locale/en.json` and `locale/zh.json` supply the plugin title and description, and `icon.svg` supplies its icon.

## Installation

**Requirements**: Windows 10 / 11 (needs the `Windows.UI.Notifications` WinRT API) and DSH `>= 0.1.7-rc.1`.

### Let an agent install it

Open a new DSH session and just say:

> Install the plugin at https://github.com/528085390/dsh-windows-notify

It writes that address into the profile's `dependencies` and `dsh.profile.bundles`, runs `pnpm install`,
and asks you to restart DSH. With the DSH CLI available this is the same as:

```powershell
dsh plugin add https://github.com/528085390/dsh-windows-notify
```

### GUI / CLI

Sidebar **Plugins** → **Add plugin**, then paste any of these — they all point at this repository:

```
https://github.com/528085390/dsh-windows-notify
git+https://github.com/528085390/dsh-windows-notify.git
github:528085390/dsh-windows-notify
```

Command line: `dsh plugin add <any of the above>`.

After installing, turn `dsh-windows-notify` on in the **Plugins** page and **restart DSH** — the host half is
imported at startup and has no hot reload. To pin a revision, append `#<commit>`:
`https://github.com/528085390/dsh-windows-notify#<sha>`.

### Why not the bare package name

In `dsh plugin add <spec>` a **bare name resolves through the npm registry**. This repository is not published
there, and the name `dsh-windows-notify` on npm belongs to **another author** (Yxkzx, currently `1.0.2`) — also a
DSH notification plugin, also declaring `dsh.bundle.patch`. Installing the bare name therefore **does not fail**:
it silently installs someone else's code, and the identical package name collides with this repository's dependency.

A package name is not a repository name. Installing by name would require publishing to npm — or publishing under
your own scope (e.g. `@528085390/dsh-windows-notify`), which also means renaming `package.json`'s `name` and
`name:` in `cordis.patch.yml`.

### Manual profile wiring (offline / development)

1. Put this repository anywhere, e.g. `~/.dsh/local-plugins/dsh-windows-notify`.
2. Edit the profile's `package.json` (the desktop profile is `~/.dsh/profiles/desktop/package.json`):

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

3. Run `pnpm install` (or let DSH do it), then **restart DSH**.

The bundled `cordis.patch.yml` (declared as `dsh.bundle.patch`) inserts the loader row:

```yaml
- insert:
    - id: windows-notify
      name: dsh-windows-notify
      config:
        enabled: true
```

> ⚠️ Do **not** add another row with the same `id` to the profile's own `cordis.patch.yml` — that mounts the plugin twice.
> A hand-written row that is not also listed in `dependencies` / `bundles` cannot be resolved during boot
> (the log then has no `plugin loaded` line).

### Verify

```powershell
Get-Content "$HOME\.dsh\windows-notify.log" -Tail 5
```

Expected:

```
2026-10-20T07:46:11.212Z plugin loaded (config.enabled=true)
2026-10-20T07:46:13.134Z settings bridge ready at /api/dsh-windows-notify
2026-10-20T07:52:23.492Z toast session-bec4c0d4-...#3 exit=0 out=WINRT_OK
```

Missing the first two lines means the plugin never loaded — see [docs/troubleshooting.md](docs/troubleshooting.md) (Chinese).

## Usage

### Settings page (recommended)

**Settings → Notifications** offers:

| Option | Default | Meaning |
|---|---|---|
| Enable notifications | on | Master switch; off means even the test toast is suppressed |
| Sound | on | Whether the toast plays a sound |
| Include message text | on | Off replaces the body with a fixed “turn finished” line |
| Body length | 80 | Maximum characters taken from the message (20–300) |
| Title prefix | `DeepSeek Harness` | Title format is `<prefix> · <session title>` |
| Notify for subagents | off | Also toast turns from subagent sessions |
| Send test notification | — | Fires one toast right away to verify the chain |

### Command line fallback

If the GUI is unavailable, the plugin directory ships `toggle.cmd` (flip the switch) and `status.cmd`
(current values plus the tail of the log). `toggle.ps1` only touches `enabled` and never clobbers the
other options set from the settings page.

## Configuration

Precedence: **state file > the cordis row's `config` > built-in defaults**, read on every turn, so edits apply immediately.

State file `~/.dsh/windows-notify.json`:

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

Field types and bounds: [docs/bridge-protocol.md](docs/bridge-protocol.md#状态文件) (Chinese).

## How it works

- The host half hooks `agent/turn-stopping` and raises the toast through `powershell.exe` (5.1) and the WinRT
  `ToastNotificationManager`; the AUMID reuses the shortcut Windows already registered for PowerShell, so no
  custom shortcut is needed.
- The settings page reads and writes options through a **same-origin HTTP bridge** (`/api/dsh-windows-notify/*`)
  rather than a schemastery Config — see [docs/architecture.md](docs/architecture.md#为什么不用-schemastery-config) (Chinese).
- The client half is discovered through `package.json`'s `dsh.client` plus `exports["./client"]`; there is **no build step**.

Details (all currently written in Chinese):

- [docs/architecture.md](docs/architecture.md) — event flow, dedupe key, subagent detection, client registration, lifecycle
- [docs/bridge-protocol.md](docs/bridge-protocol.md) — full HTTP bridge protocol (routes, schemas, status codes, same-origin guard)
- [docs/troubleshooting.md](docs/troubleshooting.md) — nine known pitfalls and the diagnostic flow

## Repository layout

```
.
├── lib/
│   ├── index.js          # host half: turn-stopping → toast, HTTP bridge
│   ├── client.js         # client half: the Settings → Notifications section
│   └── toast.ps1         # WinRT toast (plain ASCII, PowerShell 5.1)
├── locale/
│   ├── en.json           # plugin-page title/description (English)
│   └── zh.json           # plugin-page title/description (Chinese)
├── icon.svg              # plugin-page icon (exported as ./icon, inlined as a data URL)
├── cordis.patch.yml      # bundle patch: inserts the loader row
├── package.json          # exports + dsh.client + dsh.bundle.patch
├── toggle.cmd/.ps1       # command-line switch
├── status.cmd/.ps1       # command-line status + recent log
└── docs/
```

## Compatibility

| Item | Requirement |
|---|---|
| OS | Windows 10 / 11 (WinRT toast) |
| DSH | `>= 0.1.7-rc.1` (`agent/turn-stopping`, `webServer`, `subprocess`) |
| PowerShell | Windows PowerShell **5.1** (`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`); **pwsh 7 is not supported** |
| Node | Whatever DSH ships |

## Development

No build step: editing `lib/client.js` only needs a page refresh, while editing `lib/index.js` (the host half)
**requires restarting DSH** (the module is imported at startup and has no hot reload).

```powershell
# Syntax / import check
node --input-type=module -e "import('file:///C:/path/to/dsh-windows-notify/lib/index.js').then(m => console.log(Object.keys(m)))"

# Fire a test toast while DSH is running
curl.exe -s -X POST http://127.0.0.1:<port>/api/dsh-windows-notify/test
```

## License

[MIT](LICENSE) © 2026 528085390
