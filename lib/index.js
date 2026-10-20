/**
 * dsh-windows-notify — 回合结束时弹一条 Windows 原生 toast。
 *
 * 接缝：agent/turn-stopping（dsh-agent-loop 在 turn/end 之前 serial 派发）。
 *       载荷是 { turn: number, signal, agent }，**turn 是数字**，不是 {id,index} 对象；
 *       早期版本按 turn.id 拼去重键，结果每个会话每个进程只弹第一次。
 * 弹窗：powershell.exe (Windows PowerShell 5.1) 走 WinRT ToastNotificationManager，
 *       AUMID 复用系统已注册的 PowerShell，不需要注册快捷方式。
 * 开关：~/.dsh/windows-notify.json（GUI 设置页 / toggle.cmd 都写它），优先级高于
 *       cordis 行 config；每次触发都重读，改完立即生效，不需要重启。
 * 设置页：宿主侧 HTTP 桥 /api/dsh-windows-notify/*，客户端 lib/client.js 注册
 *       settings.section。桥和客户端都不依赖 schemastery，插件目录可以整体搬走。
 */
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'dsh-windows-notify'
export const inject = ['subprocess']

const HERE = dirname(fileURLToPath(import.meta.url))
const TOAST_PS1 = join(HERE, 'toast.ps1')
const PS_EXE = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'

const DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh')
const STATE_FILE = join(DSH_HOME, 'windows-notify.json')
const LOG_FILE = join(DSH_HOME, 'windows-notify.log')

const BRIDGE_PREFIX = '/api/dsh-windows-notify'
const MAX_JSON_BODY_BYTES = 8 * 1024

/** 状态文件缺字段时的兜底值（config 行可覆盖，状态文件再覆盖 config）。 */
const DEFAULTS = {
  enabled: true,
  sound: true,
  includeText: true,
  notifySubagents: false,
  titlePrefix: 'DeepSeek Harness',
  maxBodyChars: 80,
}

const BOOL_KEYS = ['enabled', 'sound', 'includeText', 'notifySubagents']

const titles = new Map()
const lastText = new Map()
const fired = new Set()
let fallbackSeq = 0

function log(line) {
  try {
    appendFileSync(LOG_FILE, new Date().toISOString() + ' ' + line + '\n')
  } catch {}
}

function sessionIdOf(session) {
  try {
    return String(session?.id ?? session?.header?.id ?? session?.sessionId ?? '')
  } catch {
    return ''
  }
}

/** 子代理会话判据：header.origin === 'subagent'（dsh-session 校验过的字段），
 *  退一步看父会话/委派深度，最后才用 id 前缀（用户会话是 session-<uuid>，
 *  子代理子会话是裸 uuid）。 */
function isSubagentSession(session, sid) {
  try {
    const header = session?.header
    if (header && typeof header === 'object') {
      if (header.origin === 'subagent') return true
      if (typeof header.parentSession === 'string' && header.parentSession.length > 0) return true
      if (Number.isSafeInteger(header.delegationDepth) && header.delegationDepth > 0) return true
      if (header.origin !== undefined) return false
    }
  } catch {}
  return sid.length > 0 && !sid.startsWith('session-')
}

function readState() {
  try {
    const raw = readFileSync(STATE_FILE, 'utf8').replace(/^\uFEFF/, '')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function writeState(next) {
  try {
    writeFileSync(STATE_FILE, JSON.stringify(next, null, 2) + '\n', 'utf8')
    return true
  } catch (err) {
    log('state write failed: ' + (err && err.message ? err.message : String(err)))
    return false
  }
}

/** 只接受已知字段且类型正确，防止桥被塞进任意 JSON。 */
function sanitizePatch(input) {
  const out = {}
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out
  for (const key of BOOL_KEYS) {
    if (typeof input[key] === 'boolean') out[key] = input[key]
  }
  if (typeof input.titlePrefix === 'string') out.titlePrefix = input.titlePrefix.slice(0, 60)
  if (input.maxBodyChars !== undefined) {
    const value = Number(input.maxBodyChars)
    if (Number.isFinite(value)) out.maxBodyChars = Math.min(300, Math.max(20, Math.round(value)))
  }
  return out
}

/** DEFAULTS → cordis 行 config → 状态文件，后写的赢。 */
function resolveOptions(config, state) {
  const merged = Object.assign({}, DEFAULTS, sanitizePatch(config), sanitizePatch(state))
  if (typeof merged.titlePrefix !== 'string' || merged.titlePrefix.length === 0) merged.titlePrefix = DEFAULTS.titlePrefix
  return merged
}

/** 从 assistant/message 事件的 data 里尽量抠出纯文本。 */
function extractText(data) {
  try {
    if (!data) return ''
    if (typeof data.text === 'string') return data.text
    const msg = data.message ?? data
    const content = msg?.content
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (typeof part === 'string') return part
          if (part && typeof part.text === 'string') return part.text
          return ''
        })
        .join('')
    }
    return ''
  } catch {
    return ''
  }
}

function squash(text, max) {
  const flat = String(text || '').replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  return flat.slice(0, Math.max(1, max - 1)) + '…'
}

/** agent/turn-stopping 的 turn 是数字；兼容对象形态，实在拿不到就用进程内序号。 */
function turnNumberOf(turn) {
  if (typeof turn === 'number' && Number.isFinite(turn)) return String(turn)
  if (turn && typeof turn === 'object') {
    const id = turn.id ?? turn.index
    if (id !== undefined && id !== null && String(id).length > 0) return String(id)
  }
  fallbackSeq += 1
  return 'seq' + String(fallbackSeq)
}

export function apply(ctx, config) {
  const baseConfig = config && typeof config === 'object' ? config : {}
  log('plugin loaded (config.enabled=' + (baseConfig.enabled !== false) + ')')

  ctx.on('session/event', (session, event) => {
    try {
      const type = event?.type
      const data = event?.data
      const sid = sessionIdOf(session)
      if (type === 'session/title') {
        const t = data?.title ?? data?.text ?? ''
        if (t) titles.set(sid, String(t))
      } else if (type === 'assistant/message') {
        const text = extractText(data)
        if (text) lastText.set(sid, text)
      } else if (type === 'turn/start') {
        lastText.delete(sid)
      }
    } catch {}
  })

  ctx.on('agent/turn-stopping', (payload) => {
    try {
      const session = payload?.agent?.session
      const sid = sessionIdOf(session)
      const turnKey = sid + '#' + turnNumberOf(payload?.turn)
      const opts = resolveOptions(baseConfig, readState())

      if (opts.enabled !== true) {
        log('skip disabled ' + turnKey)
        return
      }
      if (isSubagentSession(session, sid) && opts.notifySubagents !== true) {
        log('skip subagent ' + turnKey)
        return
      }
      if (fired.has(turnKey)) {
        log('skip duplicate ' + turnKey)
        return
      }
      fired.add(turnKey)
      if (fired.size > 500) fired.clear()

      const name = titles.get(sid) || ''
      const head = name ? opts.titlePrefix + ' · ' + name : opts.titlePrefix
      const body = opts.includeText === true
        ? squash(lastText.get(sid) || '本轮回答已完成', opts.maxBodyChars)
        : '本轮回答已完成'

      void toast(ctx, head, body, opts.sound === true, turnKey)
    } catch (err) {
      log('handler error: ' + (err && err.message ? err.message : String(err)))
    }
  })

  ctx.inject(['webServer'], (sctx) => {
    sctx.effect(() => {
      const disposers = makeRoutes(ctx, baseConfig).map((route) => sctx.webServer.register(route))
      log('settings bridge ready at ' + BRIDGE_PREFIX)
      return () => {
        for (const dispose of disposers) dispose()
        log('settings bridge removed')
      }
    }, 'windows-notify: settings bridge')
  })
}

// ---- 设置页 HTTP 桥 -------------------------------------------------------

function stateView(config) {
  const state = readState()
  return {
    options: resolveOptions(config, state),
    stateFile: STATE_FILE,
    logFile: LOG_FILE,
  }
}

function makeRoutes(ctx, baseConfig) {
  return [
    {
      kind: 'exact',
      path: BRIDGE_PREFIX + '/state',
      handler: async (req, res) => {
        if (!isLocalRequest(req)) return writeJson(res, 403, { ok: false, message: 'local requests only' })
        if (req.method === 'GET') return writeJson(res, 200, { ok: true, value: stateView(baseConfig) })
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, message: 'method not allowed' })
        const body = await readJsonBody(req)
        if (body === undefined) return writeJson(res, 400, { ok: false, message: 'malformed JSON body' })
        const patch = sanitizePatch(body)
        if (Object.keys(patch).length === 0) return writeJson(res, 400, { ok: false, message: 'no known field in body' })
        const next = Object.assign({}, readState(), patch)
        if (!writeState(next)) return writeJson(res, 500, { ok: false, message: 'could not write ' + STATE_FILE })
        log('state updated ' + JSON.stringify(patch))
        return writeJson(res, 200, { ok: true, value: stateView(baseConfig) })
      },
    },
    {
      kind: 'exact',
      path: BRIDGE_PREFIX + '/test',
      handler: async (req, res) => {
        if (!isLocalRequest(req)) return writeJson(res, 403, { ok: false, message: 'local requests only' })
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, message: 'method not allowed' })
        const opts = resolveOptions(baseConfig, readState())
        if (opts.enabled !== true) return writeJson(res, 200, { ok: true, value: { sent: false, reason: 'disabled' } })
        void toast(ctx, opts.titlePrefix, '如果你看到这条通知，说明 Windows 通知链路正常。', opts.sound === true, 'test')
        return writeJson(res, 200, { ok: true, value: { sent: true } })
      },
    },
  ]
}

function isLocalRequest(req) {
  try {
    if (req.headers['sec-fetch-site'] === 'cross-site') return false
    const host = req.headers.host
    if (typeof host !== 'string' || host.length === 0) return false
    const origin = req.headers.origin
    if (typeof origin === 'string' && origin.length > 0) {
      try {
        if (new URL(origin).host !== host) return false
      } catch {
        return false
      }
      return true
    }
    const hostname = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase()
    return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1'
  } catch {
    return false
  }
}

function writeJson(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
  })
  res.end(JSON.stringify(body))
}

async function readJsonBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_JSON_BODY_BYTES) return undefined
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return undefined
  }
}

// ---- toast ---------------------------------------------------------------

// readFrom(fromByte) returns { text, nextOffset, lossy, spillPath } — not a string.
function readCollected(handle, stream) {
  try {
    const chunk = handle?.collected?.[stream]?.readFrom(0)
    if (!chunk) return ''
    const text = typeof chunk === 'string' ? chunk : String(chunk.text ?? '')
    return (chunk.lossy ? '[lossy] ' : '') + text.trim()
  } catch {
    return ''
  }
}

async function toast(ctx, title, body, sound, turnKey) {
  try {
    const argv = [
      PS_EXE,
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      TOAST_PS1,
      '-Title',
      title,
      '-Body',
      body,
    ]
    if (!sound) argv.push('-Silent')

    const handle = ctx.subprocess.spawn({
      argv,
      cwd: HERE,
      stdio: {
        stdin: 'ignore',
        stdout: { maxBytes: 16 * 1024 },
        stderr: { maxBytes: 16 * 1024 },
      },
      graceMs: 5000,
    })
    const { exitCode } = await handle.done
    const out = readCollected(handle, 'stdout')
    const err = readCollected(handle, 'stderr')
    log('toast ' + turnKey + ' exit=' + exitCode + ' out=' + out + (err ? ' err=' + err : ''))
  } catch (err) {
    log('toast failed: ' + (err && err.message ? err.message : String(err)))
  }
}
