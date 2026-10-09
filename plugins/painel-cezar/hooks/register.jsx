import { atom, read, update } from 'claude-code'




// Os botões que abrem estes painéis ficam na faixa do mod "medidor"
const PANE_AG = 'agentes'
const LIMITE = 70
const PARADO_MIN = 10

const agentes = atom({ plugin: 'painel-cezar', key: 'agentes' }, [])
const contexto = atom({ plugin: 'painel-cezar', key: 'contexto' }, 0)
const avisou70 = atom({ plugin: 'painel-cezar', key: 'avisou70' }, false)

const minutos = (ms) => Math.max(0, Math.floor(ms / 60000))
const modeloCurto = (m) => (/opus/i.test(m) ? 'Opus' : /sonnet/i.test(m) ? 'Sonnet' : /haiku/i.test(m) ? 'Haiku' : /fable/i.test(m) ? 'Fable' : m)


// Shows context, 5-hour limit and weekly limit usage in the band above the prompt.

// The latest figures this session has, from $.session.usage() or session.measure
let context = null
let rateLimits = []
// When rateLimits was last measured, in $.clock.now() milliseconds
let measuredAt = 0
// The timer that refreshes the band, kept so a later session.start can stop it
let ticker = null
// This session's own key in the store
let ownKey = null
// Quando começou a última chamada ao modelo da conversa principal: o cache conta a partir dela
// (a documentação da Anthropic conta do início do pedido, não do fim da resposta)
let ultimaResposta = 0
// A chamada anterior ({ comecou, modelo, lido, gravado, novo }), para ver se o cache esfriou
let chamadaAnterior = null
// Abaixo disso regravar o cache sai barato e não vale aviso
const AVISO_MIN_TOKENS = 20_000
// Ligado pelo botão: compacta assim que a resposta do ESTADO.md terminar
let compactarDepois = false
// Quanto o cache dura: 1 hora na assinatura; 5 min quando uma janela estoura e o gasto vai para o uso extra
const CACHE_MS = 60 * 60_000
const CACHE_EXTRA_MS = 5 * 60_000
function cacheMs() {
  return rateLimits.some((l) => (l.kind === 'five_hour' || l.kind === 'seven_day') && l.percentUsed >= 100) ? CACHE_EXTRA_MS : CACHE_MS
}
// O que o botão manda, como se o Cezar tivesse digitado
const PROMPT_ESTADO =
  'Atualize agora o ESTADO.md da pasta deste projeto com o estado desta conversa: o que já foi feito, ' +
  'as decisões tomadas, o que está pendente e qual é o próximo passo. Se o arquivo não existir, crie. ' +
  'Mantenha o que ainda vale e apague o que ficou velho. Não grave nada em memória. ' +
  'No fim, me diga em até 2 linhas o que mudou no arquivo.'

// Rate limits are per account, so sessions share readings through $.store, and each shows the
// newest one. $.store has no atomic update, so each session writes only its own key, and no
// write can overwrite another session's reading.
// The mods API has no account id, so after switching accounts on this machine a new
// session shows the previous account's reading until its own first response.
const KEY_PREFIX = 'reading:'
// Readings older than the longest window say nothing current: they are never shown, and their
// keys are deleted
const STALE_MS = 8 * 24 * 3_600_000
// The session.end reasons after which this module stops; /clear, /resume (which /branch reports)
// and logout leave it running and measuring
const FINAL_REASONS = ['prompt_input_exit', 'other']
// How often to pick up other sessions' readings and refresh the countdowns and time markers
const TICK_MS = 60_000

const HOUR_MS = 3_600_000
const WINDOWS = {
  // showsClock adds the reset time of day, in JST
  // semRotulo: a barra e o horário já dizem qual é (5h vem antes, em horas; a semana, em dias)
  five_hour: { label: '5h', ms: 5 * HOUR_MS, showsClock: true, semRotulo: true },
  seven_day: { label: 'sem', ms: 7 * 24 * HOUR_MS, showsClock: true, semRotulo: true },
  spend_limit: { label: 'Gasto' },
}

// Pace thresholds: margin is the elapsed share of the window minus the used share
const GREEN_MIN_MARGIN = 10
const RED_BELOW_MARGIN = -15
// Usage this low stays green early in a window, when the margin is still small
const GREEN_MAX_USED = 10
// Usage this high is red whatever the pace
const RED_MIN_USED = 90

// JST has no daylight saving time, so a fixed offset gives its clock
const JST_OFFSET_MS = -4 * HOUR_MS // Rondônia (UTC-4), sem horário de verão

const BAR_CELLS = 10
// Columns between two meters, and the band's last column, which the terminal may draw over
const METER_GAP = 4
const BAND_RESERVED_COLUMNS = 2
// Rows between the meters and what later mods draw; the terminal has no rows to spare
const DESKTOP_ROW_GAP = 0
const SVG_BAR = { width: 40, height: 4 }
// Fundo e borda de cada pílula, pelo estado
const CHIP_BG = 'rgba(255,255,255,0.07)'
const PILL = {
  success: { bg: 'rgba(63,182,139,0.12)', border: 'rgba(63,182,139,0.35)' },
  warning: { bg: 'rgba(217,154,43,0.14)', border: 'rgba(217,154,43,0.40)' },
  error: { bg: 'rgba(217,83,79,0.14)', border: 'rgba(217,83,79,0.45)' },
  none: { bg: 'rgba(140,140,150,0.10)', border: 'rgba(140,140,150,0.30)' },
}
const SVG_COLORS = {
  success: ['#3fb68b', '#6fd6a8'],
  warning: ['#d99a2b', '#f2c25b'],
  error: ['#d9534f', '#f08a7e'],
  track: 'rgba(140,140,150,0.18)',
  marker: 'rgba(160,175,255,0.9)',
}
// The terminal draws the time marker in this color
const MARKER_COLOR = 'cyan'

export function register(on) {
  // ---- Painel de subagentes ----
  let relogio
  let quadros

  on('session.start', async ($, e, next) => {
    await inicio($)
    relogio?.cancel()
    relogio = $.clock.every(60000, () => $.ui.invalidate('ui.render'))
    quadros?.cancel()
    quadros = $.clock.every(CLAWD_QUADRO_MS, () => passarQuadroClawd($))
    return next(e)
  })


  // Subagente ativo: marca a última vez que ele chamou ferramenta
  // e o Clawd: pergunta com opções deixa ele em pânico até a resposta;
  // ferramenta que pediu permissão volta a "trabalhando" quando a resposta sai
  on('tool.call', async ($, e, next) => {
    if (e.agentId) {
      const agora = await $.clock.now()
      await update($, agentes, l => l.map(a => (a.id === e.agentId ? { ...a, ultimo: agora } : a)))
    }
    if (e.tool === 'AskUserQuestion' || e.tool === 'ExitPlanMode') mudarClawd($, 'panico')
    try {
      return await next(e)
    } finally {
      if (clawdEstado === 'panico') mudarClawd($, 'trabalhando')
    }
  })

  // Pedido de permissão: o Clawd entra em pânico até a ferramenta rodar ou ser negada
  on('tool.check', async ($, e, next) => {
    const r = await next(e)
    if (e.tool_use_id && r?.decision === 'ask') mudarClawd($, 'panico')
    return r
  })

  // Toda mensagem do Cezar leva, escondida, o dia e a hora de Rondônia:
  // o modelo não sabe que horas são e mandava "bom dia" para lead de tarde
  on('prompt.submit', async ($, e, next) => {
    const agora = await $.clock.now()
    return next({ ...e, context: [...(e.context ?? []), horaRondonia(agora)] })
  })

  on('turn.start', async ($, e, next) => {
    if (!e.agentId) mudarClawd($, 'trabalhando')
    return next(e)
  })

  // Subagentes: quando começam, com qual modelo
  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    if ('agentId' in r && r.agentId) {
      const agora = await $.clock.now()
      const novo = { id: r.agentId, nome: e.description, modelo: modeloCurto(r.model ?? ''), desde: agora, ultimo: agora, fim: 0, feito: false }
      await update($, agentes, l => [...l, novo].slice(-20))
      $.ui.invalidate('ui.render')
    }
    return r
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (!e.agentId) mudarClawd($, 'vez')
    await fimDeTurno($)
    try {
      const pct = (await $.session.usage()).context.percent ?? 0
      await update($, contexto, () => pct)
      if (pct >= LIMITE && !(await read($, avisou70))) {
        await update($, avisou70, () => true)
        $.ui.toast(`Ctx ${pct}% · hora de compactar`)
      }
      if (pct < LIMITE) await update($, avisou70, () => false)
    } catch {}
    await marcarConcluidos($)
    return r
  })


  // Painel de agentes, em cartões
  on('ui.render', { component: 'Pane', requestId: PANE_AG }, async ($, e) => {
    await marcarConcluidos($)
    const { Box, Text } = $.ui.resolve(e)
    const lista = await read($, agentes)
    const agora = await $.clock.now()
    const rodando = lista.filter(a => !a.feito)
    const feitos = lista.filter(a => a.feito).reverse()

    const cartao = (a) => {
      const parado = !a.feito && minutos(agora - a.ultimo) >= PARADO_MIN
      const icone = a.feito ? '✓' : parado ? '⚠' : '●'
      const cor = parado ? 'warning' : 'success'
      const tempo = a.feito ? `${minutos(a.fim - a.desde)}m` : parado ? `parado ${minutos(agora - a.ultimo)}m` : `${minutos(agora - a.desde)}m`
      return (
        <Box key={`ag-${a.id}`} flexDirection="row" columnGap={1} paddingX={1} backgroundColor="rgba(255,255,255,0.05)">
          <Text color={cor} bold>{icone}</Text>
          <Box flexDirection="column" flexGrow={1}>
            <Text bold wrap="truncate">{a.nome}</Text>
            <Text dimColor>{`${a.modelo} · ${tempo}`}</Text>
          </Box>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" rowGap={1}>
        {lista.length === 0 && <Text dimColor>Nenhum agente ainda.</Text>}
        {rodando.length > 0 && <Text dimColor>{`Rodando · ${rodando.length}`}</Text>}
        {rodando.map(cartao)}
        {feitos.length > 0 && <Text dimColor>{`Concluídos · ${feitos.length}`}</Text>}
        {feitos.map(cartao)}
      </Box>
    )
  })

  // ---- Faixa: ctx, 5h, sem, cache e botões ----
  // Fires again on an enable or a worker respawn, which may keep this module's variables

  // Keeps the store from growing by a key per session. A session whose reading is not the newest
  // removes its own key. One that holds the newest marks it ended, so the others may delete it once
  // a newer reading exists: an ended session never writes again, so that delete can't lose a write.
  on('session.end', async ($, e, next) => {
    if (!FINAL_REASONS.includes(e.reason) || !ownKey) return next(e)
    ticker?.cancel()
    await releaseKey($)
    return next(e)
  })

  // /clear, /resume, /branch (fork) and compaction change the context, which session.measure
  // reports only after the next turn. All but compaction also switch to another session id, so
  // this module hands its key over as an ended session would, and writes under the new id.
  on('classic.SessionStart', { source: ['clear', 'resume', 'fork', 'compact'] }, async ($, e, next) => {
    const key = KEY_PREFIX + (await $.session.id())
    if (ownKey && key !== ownKey) {
      await releaseKey($)
      ownKey = key
    }
    context = (await $.session.usage()).context
    $.ui.invalidate('ui.render')
    reler($)
    return next(e)
  })


  // Clique no Clawd da faixa: abre o painel de agentes
  on('ui.message', async ($, e, next) => {
    if (e.element === 'clawd') {
      void $.ui.open({ id: 'savvy-agents', title: 'Agentes' })
      return {}
    }
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    context = e.context
    // A fresh measurement, including an empty one when the account's windows went away
    if (e.changed.includes('rateLimits')) await remember($, e.rateLimits)
    $.ui.invalidate('ui.render')
    return next(e)
  })

  // Cada chamada ao modelo da conversa principal: renova o cache e diz se ele tinha esfriado
  // (ideia do prompt-cache-control, de davila7/claude-code-templates)
  on('turn.step', async function* ($, e, next) {
    if (e.agentId) return yield* next(e)
    const comecou = Date.now()
    const r = yield* next(e)
    const u = r?.usage
    if (u && (u.cache_read_input_tokens || u.cache_creation_input_tokens)) {
      const atual = { comecou, modelo: u.model || e.model, lido: u.cache_read_input_tokens ?? 0, gravado: u.cache_creation_input_tokens ?? 0, novo: u.input_tokens ?? 0 }
      const motivo = porQueEsfriou(chamadaAnterior, atual)
      if (motivo) $.ui.toast(`⏱ Cache frio (${motivo}): regravou ${milhares(atual.gravado)} tokens`)
      chamadaAnterior = atual
      ultimaResposta = comecou
      await $.store.set('cache:' + (await $.session.id()), comecou)
      $.ui.invalidate('ui.render')
    }
    return r
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const elements = $.ui.resolve(e)
    const now = await $.clock.now()
    const meters = [{ label: 'ctx', used: context?.percent, elapsed: null, resetsAt: null }]
    for (const limit of rateLimits) {
      meters.push(readLimit(limit, now))
    }
    for (const m of meters) {
      m.value = valueText(m)
      m.reset = resetText(m, now)
    }
    const cachePill = cacheMeter(elements, e.surface, now)
    const clawdAgora = clawdSvgAgora()
    const gauge = e.surface !== 'terminal' ? 'svg' : barsFit(meters, e.props.bodyColumns ?? 0) ? 'text' : 'none'

    const line = elements.Box({
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: e.surface !== 'terminal' ? 1 : METER_GAP,
      rowGap: e.surface !== 'terminal' ? 1 : 0,
      children: [
        ...meters.map((m) => meter(elements, gauge, m)),
        ...(cachePill ? [cachePill] : []),
        e.surface === 'terminal'
          ? elements.Button({ key: 'agentes', label: 'sub', onPress: () => void $.ui.open({ id: 'savvy-agents', title: 'Agentes' }) })
          : elements.Box({
              key: 'clawd',
              position: 'relative',
              children: [
                elements.Svg({
                  source: clawdAgora.source,
                  alt: clawdEstado === 'panico' ? 'precisa de você' : clawdEstado === 'trabalhando' ? 'trabalhando' : 'sua vez',
                  width: CLAWD_LARGURA,
                  height: clawdAgora.altura,
                }),
                elements.Box({ key: 'clawd-clique', position: 'absolute', top: 0, left: 0, children: [elements.Client({ key: 'clawd', module: './clawd.jsx', width: 3, height: 1 })] }),
              ],
            }),
        elements.Button({
          key: 'salvar',
          label: '💾',
          onPress: () => {
            if (compactarDepois) { $.ui.toast('Já está salvando…'); return }
            compactarDepois = true
            $.ui.toast('Salvando o ESTADO.md… depois compacta sozinho.')
            void $.prompt.submit({ text: PROMPT_ESTADO, asUser: true }).catch(() => {})
          },
        }),
      ],
    })
    // Keep what the mods after this one draw in the band
    const rest = await next(e)
    if (!rest) return line
    const rowGap = e.surface !== 'terminal' ? DESKTOP_ROW_GAP : 0
    return elements.Box({ flexDirection: 'column', rowGap, children: [line, rest] })
  })
}

async function remember($, limits) {
  // Take the time first, so a refresh that runs meanwhile can't pair old limits with it
  const now = await $.clock.now()
  rateLimits = limits
  measuredAt = now
  await $.store.set(ownKey, { at: now, limits })
}

// Takes the newest reading any session saved, unless this session's own is newer still, and
// deletes the keys no session needs: ended sessions' older readings, and any reading too old
async function refresh($) {
  const { entries, newest } = await scan($)
  if (newest && newest.reading.at >= measuredAt) {
    rateLimits = newest.reading.limits
    measuredAt = newest.reading.at
  } else if (!newest && measuredAt < (await $.clock.now()) - STALE_MS) {
    // This session's own reading has gone stale too, as in one left idle for days
    rateLimits = []
    measuredAt = 0
  }
  await prune($, entries, newest?.key)
}

// Stops using this session's key: keeps its reading marked ended if it is the newest, so the
// others may delete it once a newer one exists, and removes it otherwise, since only the newest
// reading is ever shown
async function releaseKey($) {
  const { entries, newest } = await scan($)
  if (newest?.key === ownKey) await $.store.set(ownKey, { ...newest.reading, ended: true })
  else await $.store.delete(ownKey)
  await prune($, entries, newest?.key)
}

async function prune($, entries, newestKey) {
  const cutoff = (await $.clock.now()) - STALE_MS
  for (const { key, reading } of entries) {
    if (key === ownKey || key === newestKey) continue
    if (!isReading(reading) || reading.ended === true || reading.at < cutoff) await $.store.delete(key)
  }
}

// usage() at startup may answer this session's last reading, which can be older than the shared
// one in ways a merge can't tell apart (a window that went away, a spend limit that went down),
// so a shared reading always wins and the snapshot is saved only when there is none
async function publishSnapshot($, snapshot) {
  const { newest } = await scan($)
  if (newest) {
    rateLimits = newest.reading.limits
    measuredAt = newest.reading.at
    return
  }
  await remember($, snapshot)
}

// Every session's key and what it holds, and the newest reading among them. At an equal time the
// later key wins, so every session picks the same one.
async function scan($) {
  const entries = []
  let newest = null
  const cutoff = (await $.clock.now()) - STALE_MS
  for (const key of await $.store.keys()) {
    if (!key.startsWith(KEY_PREFIX)) continue
    const reading = await $.store.get(key)
    entries.push({ key, reading })
    if (!isReading(reading) || reading.at < cutoff) continue
    if (!newest || reading.at > newest.reading.at || (reading.at === newest.reading.at && key > newest.key)) {
      newest = { key, reading }
    }
  }
  return { entries, newest }
}

function isReading(value) {
  return value != null && typeof value.at === 'number' && Array.isArray(value.limits)
}

function readLimit(limit, now) {
  const window = WINDOWS[limit.kind]
  const label = window?.label ?? limit.kind
  const resetsAtMs = limit.resetsAt == null ? null : Date.parse(limit.resetsAt)
  // A window that has reset since the last reading starts again from zero
  if (resetsAtMs != null && resetsAtMs <= now) {
    return { label, semRotulo: window?.semRotulo === true, used: 0, elapsed: window?.ms ? 0 : null, resetsAt: null }
  }
  const elapsed = window?.ms && resetsAtMs != null ? clamp(100 - ((resetsAtMs - now) / window.ms) * 100) : null
  return { label, semRotulo: window?.semRotulo === true, used: limit.percentUsed, elapsed, resetsAt: resetsAtMs, showsClock: window?.showsClock === true }
}

// Green, yellow or red by how far usage runs ahead of the time gone in its window
function statusOf(used, elapsed) {
  if (used >= RED_MIN_USED) return 'error'
  if (elapsed == null) return used >= 80 ? 'error' : used >= 50 ? 'warning' : 'success'
  const margin = elapsed - used
  if (margin < RED_BELOW_MARGIN) return 'error'
  if (margin < GREEN_MIN_MARGIN && used >= GREEN_MAX_USED) return 'warning'
  return 'success'
}

function valueText({ used }) {
  return typeof used === 'number' ? Math.round(used) + '%' : '—'
}

function resetText({ resetsAt, showsClock }, now) {
  if (resetsAt == null) return ''
  const falta = resetsAt - now
  if (showsClock && falta < 20 * HOUR_MS) return jstClock(resetsAt)
  return untilReset(falta)
}

// Whether every meter fits on one line with its text bar; every character drawn is one cell wide
function barsFit(meters, columns) {
  const width = meters.reduce((sum, m) => sum + (m.semRotulo ? 0 : [...m.label].length + 1) + BAR_CELLS + 1 + [...m.value].length + (m.reset ? 1 + [...m.reset].length : 0), 0)
  return width + METER_GAP * (meters.length - 1) <= columns - BAND_RESERVED_COLUMNS
}

function meter({ Box, Text, Svg }, gauge, { label, semRotulo, used, elapsed, value, reset }) {
  const known = typeof used === 'number'
  const status = known ? statusOf(used, elapsed) : null
  const style = known ? { color: status, bold: true } : { dimColor: true }

  if (gauge === 'svg') {
    // Desktop: uma pílula por medidor; o contêiner quebra a linha quando falta espaço
    const partes = [
      ...(semRotulo ? [] : [Text({ key: 'l', dimColor: true, wrap: 'truncate', children: [label] })]),
      Svg({
        source: svgBar(known ? used : 0, elapsed, status),
        alt: label + ' ' + value + (reset ? ', ' + reset : ''),
        width: SVG_BAR.width,
        height: SVG_BAR.height,
      }),
      Text({ key: 'v', ...style, wrap: 'truncate', children: [value] }),
    ]
    if (reset) partes.push(Text({ key: 'r', dimColor: true, wrap: 'truncate', children: [reset] }))
    return Box({
      key: 'meter-' + label,
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: 1,
      flexShrink: 0,
      paddingX: 1,
      backgroundColor: CHIP_BG,
      children: partes,
    })
  }

  const children = semRotulo ? [] : [Text({ dimColor: true, children: [label] })]
  if (gauge === 'text') children.push(...textBar(Text, known ? used : 0, elapsed, status))
  children.push(Text({ ...style, children: [value] }))
  if (reset) children.push(Text({ dimColor: true, children: [reset] }))
  return Box({ key: 'meter-' + label, flexDirection: 'row', columnGap: 1, alignItems: 'center', children })
}

// The bar as runs of cells: used cells in the status color, the rest dim, and the time marker
function textBar(Text, used, elapsed, status) {
  const filled = Math.round((clamp(used) / 100) * BAR_CELLS)
  const marker = elapsed == null ? -1 : Math.min(BAR_CELLS - 1, Math.floor((elapsed / 100) * BAR_CELLS))
  const markerStyle = { color: MARKER_COLOR, bold: true }
  const usedStyle = status ? { color: status } : { dimColor: true }
  const restStyle = { dimColor: true }
  const cells = []
  for (let i = 0; i < BAR_CELLS; i++) {
    if (i === marker) cells.push({ char: '┃', style: markerStyle })
    else if (i < filled) cells.push({ char: '█', style: usedStyle })
    else cells.push({ char: '░', style: restStyle })
  }
  const runs = []
  for (const cell of cells) {
    const last = runs.at(-1)
    if (last && last.style === cell.style) last.text += cell.char
    else runs.push({ text: cell.char, style: cell.style })
  }
  // One Text per run, nested in a Text so the runs stay on one line with no gaps
  return [Text({ children: runs.map((run) => Text({ ...run.style, children: [run.text] })) })]
}


// Rondônia é UTC−4 o ano todo (sem horário de verão)
const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
function horaRondonia(ms) {
  const d = new Date(ms - 4 * HOUR_MS)
  const h = d.getUTCHours()
  const dois = (n) => String(n).padStart(2, '0')
  return `Agora em Rondônia (UTC−4): ${DIAS_SEMANA[d.getUTCDay()]}, ${dois(d.getUTCDate())}/${dois(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}, ${dois(h)}:${dois(d.getUTCMinutes())}.`
}

// O Clawd oficial: grade 12x8 do ClawdMoji (github.com/afspies/ClawdMoji), 2 px por quadrado.
// Três estados, animados trocando o quadro a cada CLAWD_QUADRO_MS (o SVG vai como imagem, de fundo
// transparente; o modo interativo, que roda animação SMIL, abre uma moldura de fundo branco):
//   trabalhando: perninhas andando · vez: parado, pisca de vez em quando · panico: vermelho, olho
//   arregalado, tremendo, erguendo um "!" amarelo (precisa de permissão ou de resposta)
const CLAWD_QUADRO_MS = 400
const CLAWD_PISCA_A_CADA = 10
const CLAWD_PANICO_ALTURA = 28
const CLAWD_LARGURA = 26
let clawdEstado = 'vez'
let clawdQuadro = 0
function mudarClawd($, estado) {
  if (clawdEstado === estado) return
  clawdEstado = estado
  $.ui.invalidate('ui.render')
}
// Chamado pelo relógio da faixa: só redesenha quando o quadro do Clawd muda de fato
function passarQuadroClawd($) {
  clawdQuadro++
  const piscando = clawdQuadro % CLAWD_PISCA_A_CADA < 2
  if (clawdEstado !== 'vez' || piscando) $.ui.invalidate('ui.render')
}
function clawdPixels(art, cor, dy, dx) {
  let r = ''
  art.forEach((linha, y) => [...linha].forEach((c, x) => {
    if (c === '#') r += `<rect x="${x * 2 + dx}" y="${y * 2 + dy}" width="2" height="2" fill="${cor}"/>`
  }))
  return r
}
function clawdOlhos(dy, dx, estilo, cor) {
  return [3, 8].map((x) => {
    const X = x * 2 + dx, Y = 2 + dy
    if (estilo === 'panico') return `<rect x="${X - 1}" y="${Y - 1}" width="4" height="4" fill="#FFFFFF"/><rect x="${X}" y="${Y}" width="2" height="2" fill="#000000"/>`
    if (estilo === 'fechado') return `<rect x="${X}" y="${Y + 1}" width="2" height="1" fill="#000000"/>`
    return `<rect x="${X}" y="${Y}" width="2" height="2" fill="#000000"/>`
  }).join('')
}
const CLAWD_CORPO = ['..########..', '..########..', '############', '############', '..########..', '..########..']
const CLAWD_PERNAS_A = ['', '', '', '', '', '', '..#.#..#.#..', '..#.#..#.#..']
const CLAWD_PERNAS_B = ['', '', '', '', '', '', '...#.#..#.#.', '...#.#..#.#.']
const CLAWD_PANICO_CORPO = ['...........#', '..########.#', '..##########', '############', '############', '..########..', '..########..', '..#.#..#.#..', '..#.#..#.#..']
const clawdCache = {}
function clawdSvgAgora() {
  const q = clawdQuadro
  let chave, altura, miolo
  if (clawdEstado === 'panico') {
    // Treme 1 px para os lados; o "!" pisca. Corpo encostado no chão, mão em y 10, "!" acima dela.
    const dx = [0, 1, 2, 1][q % 4]
    const aceso = q % 2 === 0
    chave = 'p' + dx + aceso
    altura = CLAWD_PANICO_ALTURA
    const dy = altura - CLAWD_PANICO_CORPO.length * 2
    miolo = clawdPixels(CLAWD_PANICO_CORPO, '#E24B4A', dy, dx) + clawdOlhos(dy + 2, dx, 'panico') +
      `<g fill="#FFD60A" opacity="${aceso ? 1 : 0.3}"><rect x="${22 + dx}" y="0" width="2" height="4"/><rect x="${22 + dx}" y="6" width="2" height="2"/></g>`
  } else {
    const andando = clawdEstado === 'trabalhando' && q % 2 === 1
    const piscando = clawdEstado === 'vez' && q % CLAWD_PISCA_A_CADA === 0
    chave = 'n' + andando + piscando
    altura = 16
    miolo = clawdPixels(CLAWD_CORPO, '#DA7758', 0, 1) + clawdPixels(andando ? CLAWD_PERNAS_B : CLAWD_PERNAS_A, '#DA7758', 0, 1) +
      clawdOlhos(0, 1, piscando ? 'fechado' : 'aberto')
  }
  clawdCache[chave] ??= `<svg xmlns="http://www.w3.org/2000/svg" width="${CLAWD_LARGURA}" height="${altura}" viewBox="0 0 ${CLAWD_LARGURA} ${altura}" shape-rendering="crispEdges">${miolo}</svg>`
  return { source: clawdCache[chave], altura }
}

function svgBar(used, elapsed, status) {
  const { width, height } = SVG_BAR
  const r = height / 2
  const pct = clamp(used)
  // Um pouquinho de barra sempre aparece quando há uso, para 1% não sumir
  const fill = pct > 0 ? Math.max(height, Math.round((pct / 100) * width)) : 0
  const [c1, c2] = SVG_COLORS[status ?? 'success']
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>`,
    `<rect width="${width}" height="${height}" rx="${r}" fill="${SVG_COLORS.track}"/>`,
  ]
  if (fill > 0) parts.push(`<rect width="${fill}" height="${height}" rx="${r}" fill="url(#g)"/>`)
  if (elapsed != null) {
    // Onde o tempo da janela está: um ponto discreto em vez de risco
    const x = Math.min(width - r, Math.max(r, Math.round((elapsed / 100) * width)))
    parts.push(`<circle cx="${x}" cy="${r}" r="${r - 0.5}" fill="none" stroke="${SVG_COLORS.marker}" stroke-width="1"/>`)
  }
  parts.push('</svg>')
  return parts.join('')
}

function clamp(percent) {
  return Math.min(Math.max(percent, 0), 100)
}

// The time of day as HH:MM, 24-hour, in JST
function jstClock(ms) {
  const jst = new Date(ms + JST_OFFSET_MS)
  return String(jst.getUTCHours()).padStart(2, '0') + 'h' + String(jst.getUTCMinutes()).padStart(2, '0')
}

function untilReset(ms) {
  const minutes = Math.max(0, Math.ceil(ms / 60_000))
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  if (days > 0) return days + 'd' + hours + 'h'
  if (hours > 0) return hours + 'h' + String(minutes % 60).padStart(2, '0')
  return (minutes % 60) + 'm'
}

// Uma chamada que regravou quase tudo em vez de ler: diz o porquê. Prompt que encolheu (compactar, /clear) não conta.
function porQueEsfriou(antes, agora) {
  if (!antes) return null
  const total = (c) => c.lido + c.gravado + c.novo
  const tamanho = total(antes)
  if (total(agora) < AVISO_MIN_TOKENS || total(agora) < tamanho * 0.7) return null
  if (agora.lido >= tamanho * 0.5 || agora.gravado === 0) return null
  if (agora.modelo !== antes.modelo) return 'trocou o modelo'
  if (agora.comecou - antes.comecou > cacheMs()) return 'passou do tempo'
  return 'mudou esforço, ferramentas ou CLAUDE.md'
}

function milhares(n) {
  return n >= 1000 ? Math.round(n / 1000) + 'k' : String(n)
}

// Pílula do cache: quente (barato), esfriando, ou frio (a próxima mensagem relê tudo a preço cheio)
function cacheMeter({ Box, Text }, surface, now) {
  if (!ultimaResposta) return null
  const resta = ultimaResposta + cacheMs() - now
  const min = Math.max(0, Math.ceil(resta / 60_000))
  let status, texto
  if (resta <= 0) {
    status = 'error'
    texto = 'frio'
  } else if (min <= 10) {
    status = 'warning'
    texto = min + 'm'
  } else {
    status = 'success'
    texto = min + 'm'
  }
  const color = status
  if (surface === 'terminal') return Text({ key: 'cache', color, children: ['⏱ ' + texto] })
  return Box({
    key: 'meter-cache',
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    paddingX: 1,
    columnGap: 1,
    backgroundColor: CHIP_BG,
    children: [
      Text({ key: 'l', dimColor: true, children: ['⏱'] }),
      Text({ key: 'v', color, bold: true, wrap: 'truncate', children: [texto] }),
    ],
  })
}

// Chamado pelo session.start do register.tsx (um evento só pode ter um hook sem filtro por plugin)
async function inicio($) {
  ticker?.cancel()
  rateLimits = []
  measuredAt = 0
  ownKey = KEY_PREFIX + (await $.session.id())
  // A hora da última resposta fica guardada por sessão: reiniciar o app não esquenta o cache.
  ultimaResposta = (await $.store.get('cache:' + (await $.session.id()))) ?? 0
  const usage = await $.session.usage()
  context = usage.context
  if (usage.rateLimits.length > 0) await publishSnapshot($, usage.rateLimits)
  // Also clears keys ended sessions left, which short runs that never tick would not
  await refresh($)
  ticker = $.clock.every(TICK_MS, async () => {
    await refresh($)
    $.ui.invalidate('ui.render')
  })
  $.ui.invalidate('ui.render')
}

// Fires after each turn, and when a rate-limit window moves a whole point
async function fimDeTurno($) {
  if (compactarDepois) {
    compactarDepois = false
    compactar($)
  }
  $.ui.invalidate('ui.render')
}

async function marcarConcluidos($) {
  try {
    const lista = await $.agent.list()
    const status = new Map(lista.map(a => [a.id, a.status]))
    const agora = await $.clock.now()
    await update($, agentes, l =>
      l.map(a => {
        const acabou = !a.feito && status.has(a.id) && status.get(a.id) !== 'running'
        return acabou ? { ...a, feito: true, fim: agora } : a
      }),
    )
  } catch {}
}

// Compacta depois que o turno solta: o app recusa compactar com turno rodando,
// entao tenta a cada 3 s, ate 10 vezes, por fora do hook
function compactar($) {
  let tentativas = 0
  let ocupado = false
  const h = $.clock.every(3000, async () => {
    if (ocupado) return
    ocupado = true
    tentativas++
    try {
      await $.session.compact()
      parar()
      reler($)
    } catch {
      try {
        await $.command.run({ command: 'compact' })
        parar()
        reler($)
      } catch {
        if (tentativas >= 10) {
          parar()
          $.ui.toast('Não consegui compactar. Digite /compact.')
        }
      }
    }
    ocupado = false
  })
  function parar() {
    typeof h === 'function' ? h() : h?.cancel?.()
  }
}

// Depois de compactar, o ctx só chega certo alguns segundos depois: relê 5 vezes, de 2 em 2 s
function reler($) {
  let vezes = 0
  const h = $.clock.every(2000, async () => {
    vezes++
    try {
      context = (await $.session.usage()).context
      $.ui.invalidate('ui.render')
    } catch {}
    if (vezes >= 5) typeof h === 'function' ? h() : h?.cancel?.()
  })
}
