window.__ModuleLoader__.load({
  id: 'dsh-windows-notify',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement

    const name = 'dsh-windows-notify'
    const inject = ['slots', 'locale']

    const NS = 'settings.windowsNotify'
    const SLOT = 'settings.section'
    const SLOT_ID = 'windows-notify'
    const SLOT_ORDER = 16
    const BRIDGE = '/api/dsh-windows-notify'

    const LOCALE = {
      zh: {
        nav: '通知',
        title: '回合结束通知',
        desc: '主 agent 每完成一个回合，弹一条 Windows 原生通知。下面的开关即时生效，不需要重启。',
        enableLabel: '启用通知',
        enableHint: '总开关；关闭后不再弹任何通知（包括测试通知）。',
        soundLabel: '播放提示音',
        soundHint: '关闭后通知静默出现。',
        textLabel: '正文显示回答摘要',
        textHint: '关闭后正文固定为「本轮回答已完成」。',
        maxLabel: '摘要长度上限',
        maxHint: '20–300 字，超出部分以「…」截断。',
        prefixLabel: '标题前缀',
        prefixHint: '留空则用默认的「DeepSeek Harness」。',
        subagentLabel: '子代理会话也通知',
        subagentHint: '默认关闭：subagent 的回合不再弹窗，只留主会话的通知。',
        test: '发送测试通知',
        testing: '已发送，请看屏幕右下角',
        testSkipped: '通知已关闭，测试通知没有发送',
        saved: '已保存',
        retry: '重试',
        loading: '正在读取设置…',
        stateFile: '配置文件',
        bridgeDown: '读不到插件设置接口（宿主侧桥未就绪）。可先用 toggle.cmd 开关通知，或重启 DSH 后再试。',
        saveFailed: '保存失败',
        loadFailed: '读取失败',
      },
      en: {
        nav: 'Notifications',
        title: 'Turn-finished notifications',
        desc: 'Show a native Windows toast each time the main agent finishes a turn. Changes apply immediately, no restart.',
        enableLabel: 'Enable notifications',
        enableHint: 'Master switch; turning it off silences everything, including the test toast.',
        soundLabel: 'Play a sound',
        soundHint: 'Turn off to show the toast silently.',
        textLabel: 'Show the answer summary in the body',
        textHint: 'When off, the body is always "Turn finished".',
        maxLabel: 'Summary length limit',
        maxHint: '20-300 characters; longer text is truncated with an ellipsis.',
        prefixLabel: 'Title prefix',
        prefixHint: 'Empty falls back to "DeepSeek Harness".',
        subagentLabel: 'Notify for subagent sessions too',
        subagentHint: 'Off by default: subagent turns stay quiet so only the main session pops.',
        test: 'Send a test notification',
        testing: 'Sent - check the bottom-right of your screen',
        testSkipped: 'Notifications are off, so the test toast was not sent',
        saved: 'Saved',
        retry: 'Retry',
        loading: 'Reading settings...',
        stateFile: 'Config file',
        bridgeDown: 'The plugin settings bridge is not reachable (host side not ready). Use toggle.cmd meanwhile, or restart DSH and try again.',
        saveFailed: 'Save failed',
        loadFailed: 'Load failed',
      },
    }

    const CSS = [
      '.dshwn-wrap{display:flex;flex-direction:column;gap:16px;max-width:780px;font-family:-apple-system,"PingFang SC","Segoe UI",system-ui,sans-serif;color:#1d1d1f}',
      '@media (prefers-color-scheme: dark){.dshwn-wrap{color:#f5f5f7}}',
      '.dshwn-title{font-size:17px;font-weight:600;margin:0}',
      '.dshwn-desc{margin:0;font-size:13px;line-height:1.6;color:#6e6e73}',
      '@media (prefers-color-scheme: dark){.dshwn-desc{color:#a1a1a6}}',
      '.dshwn-card{border:1px solid rgba(0,0,0,.08);border-radius:14px;overflow:hidden;background:rgba(255,255,255,.6)}',
      '@media (prefers-color-scheme: dark){.dshwn-card{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.1)}}',
      '.dshwn-row{display:flex;align-items:center;gap:16px;padding:14px 16px;border-top:1px solid rgba(0,0,0,.06)}',
      '.dshwn-row:first-child{border-top:0}',
      '@media (prefers-color-scheme: dark){.dshwn-row{border-color:rgba(255,255,255,.08)}}',
      '.dshwn-label{flex:1 1 auto;min-width:0;font-size:14px}',
      '.dshwn-hint{font-size:12px;color:#6e6e73;margin-top:3px;line-height:1.5}',
      '@media (prefers-color-scheme: dark){.dshwn-hint{color:#a1a1a6}}',
      '.dshwn-control{flex:0 0 auto;display:flex;align-items:center;gap:8px}',
      '.dshwn-switch{width:18px;height:18px;accent-color:#0a84ff;cursor:pointer}',
      '.dshwn-input{width:76px;font:inherit;font-size:13px;padding:5px 8px;border-radius:8px;border:1px solid rgba(0,0,0,.16);background:transparent;color:inherit}',
      '.dshwn-inputWide{width:220px}',
      '@media (prefers-color-scheme: dark){.dshwn-input{border-color:rgba(255,255,255,.18)}}',
      '.dshwn-btn{font:inherit;font-size:13px;padding:7px 14px;border-radius:9px;border:1px solid rgba(0,0,0,.14);background:rgba(0,0,0,.04);color:inherit;cursor:pointer}',
      '.dshwn-btn:hover:not(:disabled){background:rgba(0,0,0,.08)}',
      '.dshwn-btn:disabled{opacity:.5;cursor:default}',
      '@media (prefers-color-scheme: dark){.dshwn-btn{border-color:rgba(255,255,255,.16);background:rgba(255,255,255,.06)}.dshwn-btn:hover:not(:disabled){background:rgba(255,255,255,.12)}}',
      '.dshwn-foot{display:flex;align-items:center;gap:12px;flex-wrap:wrap}',
      '.dshwn-flash{font-size:12px;color:#2a7a3f}',
      '@media (prefers-color-scheme: dark){.dshwn-flash{color:#6fd08c}}',
      '.dshwn-error{font-size:13px;color:#c62828;line-height:1.6}',
      '@media (prefers-color-scheme: dark){.dshwn-error{color:#ff8a80}}',
      '.dshwn-muted{font-size:13px;color:#6e6e73}',
      '@media (prefers-color-scheme: dark){.dshwn-muted{color:#a1a1a6}}',
      '.dshwn-path{font-size:11px;color:#8a8a8e;word-break:break-all}',
    ].join('')

    function messageOf(error) {
      if (error && typeof error.message === 'string' && error.message.length > 0) return error.message
      return String(error)
    }

    async function request(path, init) {
      const response = await fetch(BRIDGE + path, init)
      let body = null
      try {
        body = await response.json()
      } catch {
        body = null
      }
      if (!response.ok || body === null || body.ok !== true) {
        const detail = body && typeof body.message === 'string' ? body.message : 'HTTP ' + String(response.status)
        throw new Error(detail)
      }
      return body.value
    }

    const loadState = () => request('/state', { method: 'GET' })
    const saveState = (patch) =>
      request('/state', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      })
    const sendTest = () => request('/test', { method: 'POST', body: '{}' })

    function Row(props) {
      return h(
        'div',
        { className: 'dshwn-row' },
        h(
          'div',
          { className: 'dshwn-label' },
          props.label,
          props.hint ? h('div', { className: 'dshwn-hint' }, props.hint) : null,
        ),
        h('div', { className: 'dshwn-control' }, props.children),
      )
    }

    function Section(props) {
      const t = props.t
      const [snapshot, setSnapshot] = React.useState(null)
      const [draft, setDraft] = React.useState({ titlePrefix: '', maxBodyChars: '80' })
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState('')
      const [flash, setFlash] = React.useState('')

      const adopt = React.useCallback((value) => {
        setSnapshot(value)
        setDraft({
          titlePrefix: value.options.titlePrefix,
          maxBodyChars: String(value.options.maxBodyChars),
        })
      }, [])

      const reload = React.useCallback(async () => {
        try {
          adopt(await loadState())
          setError('')
        } catch (err) {
          setError(messageOf(err))
        }
      }, [adopt])

      React.useEffect(() => {
        void reload()
      }, [reload])

      React.useEffect(() => {
        if (flash.length === 0) return undefined
        const timer = setTimeout(() => setFlash(''), 2500)
        return () => clearTimeout(timer)
      }, [flash])

      const commit = React.useCallback(
        async (patch) => {
          setBusy(true)
          try {
            adopt(await saveState(patch))
            setError('')
            setFlash(t('saved'))
          } catch (err) {
            setError(t('saveFailed') + ': ' + messageOf(err))
          } finally {
            setBusy(false)
          }
        },
        [adopt, t],
      )

      const runTest = React.useCallback(async () => {
        setBusy(true)
        try {
          const result = await sendTest()
          setError('')
          setFlash(result && result.sent === false ? t('testSkipped') : t('testing'))
        } catch (err) {
          setError(messageOf(err))
        } finally {
          setBusy(false)
        }
      }, [t])

      if (snapshot === null) {
        return h(
          'div',
          { className: 'dshwn-wrap' },
          h('div', { className: 'dshwn-muted' }, error.length > 0 ? t('bridgeDown') + ' (' + error + ')' : t('loading')),
          error.length > 0
            ? h('div', null, h('button', { className: 'dshwn-btn', onClick: () => void reload() }, t('retry')))
            : null,
        )
      }

      const options = snapshot.options
      const toggle = (key) =>
        h('input', {
          type: 'checkbox',
          className: 'dshwn-switch',
          checked: options[key] === true,
          disabled: busy,
          onChange: (event) => void commit({ [key]: event.target.checked }),
        })

      const commitNumber = () => {
        const parsed = Number(draft.maxBodyChars)
        if (!Number.isFinite(parsed)) {
          setDraft({ titlePrefix: draft.titlePrefix, maxBodyChars: String(options.maxBodyChars) })
          return
        }
        const clamped = Math.min(300, Math.max(20, Math.round(parsed)))
        setDraft({ titlePrefix: draft.titlePrefix, maxBodyChars: String(clamped) })
        if (clamped !== options.maxBodyChars) void commit({ maxBodyChars: clamped })
      }

      const commitPrefix = () => {
        const next = draft.titlePrefix.trim()
        if (next === options.titlePrefix) return
        if (next.length === 0) {
          setDraft({ titlePrefix: options.titlePrefix, maxBodyChars: draft.maxBodyChars })
          return
        }
        void commit({ titlePrefix: next })
      }

      return h(
        'div',
        { className: 'dshwn-wrap' },
        h('div', null, h('h2', { className: 'dshwn-title' }, t('title')), h('p', { className: 'dshwn-desc' }, t('desc'))),
        h(
          'div',
          { className: 'dshwn-card' },
          h(Row, { label: t('enableLabel'), hint: t('enableHint') }, toggle('enabled')),
          h(Row, { label: t('soundLabel'), hint: t('soundHint') }, toggle('sound')),
          h(Row, { label: t('textLabel'), hint: t('textHint') }, toggle('includeText')),
          h(
            Row,
            { label: t('subagentLabel'), hint: t('subagentHint') },
            toggle('notifySubagents'),
          ),
          h(
            Row,
            { label: t('maxLabel'), hint: t('maxHint') },
            h('input', {
              className: 'dshwn-input',
              type: 'number',
              min: 20,
              max: 300,
              value: draft.maxBodyChars,
              disabled: busy || options.includeText !== true,
              onChange: (event) => setDraft({ titlePrefix: draft.titlePrefix, maxBodyChars: event.target.value }),
              onBlur: commitNumber,
              onKeyDown: (event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              },
            }),
          ),
          h(
            Row,
            { label: t('prefixLabel'), hint: t('prefixHint') },
            h('input', {
              className: 'dshwn-input dshwn-inputWide',
              type: 'text',
              value: draft.titlePrefix,
              disabled: busy,
              onChange: (event) => setDraft({ titlePrefix: event.target.value, maxBodyChars: draft.maxBodyChars }),
              onBlur: commitPrefix,
              onKeyDown: (event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              },
            }),
          ),
        ),
        h(
          'div',
          { className: 'dshwn-foot' },
          h(
            'button',
            { className: 'dshwn-btn', disabled: busy, onClick: () => void runTest() },
            t('test'),
          ),
          flash.length > 0 ? h('span', { className: 'dshwn-flash' }, flash) : null,
        ),
        error.length > 0 ? h('div', { className: 'dshwn-error' }, error) : null,
        h(
          'div',
          { className: 'dshwn-path' },
          t('stateFile') + ': ' + snapshot.stateFile,
        ),
      )
    }

    function apply(ctx) {
      const slots = ctx.slots
      const locale = ctx.locale
      if (slots === undefined || slots === null) return
      const translate = locale.bind(NS)
      ctx.effect(() => {
        const disposeDictionaries = locale.register(NS, LOCALE)
        return () => disposeDictionaries()
      }, 'windows-notify: locale dictionaries')
      ctx.effect(() => {
        const element = document.createElement('style')
        element.setAttribute('data-dsh-windows-notify', '')
        element.textContent = CSS
        document.head.appendChild(element)
        return () => element.remove()
      }, 'windows-notify: stylesheet')
      slots.inject(SLOT, () =>
        slots.register(
          {
            name: SLOT,
            id: SLOT_ID,
            order: SLOT_ORDER,
            locale: NS,
            label: () => translate('nav'),
          },
          () => h(Section, { t: translate }),
        ),
      )
    }

    const exports = {}
    exports.name = name
    exports.inject = inject
    exports.apply = apply
    return exports
  },
})
