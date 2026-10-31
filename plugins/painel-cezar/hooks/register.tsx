// Painel de agentes adaptado do savvy-progress (github.com/johnnyvizz/claude-kit), MIT, Copyright (c) 2026 johnnyvizz.
// Texto da licença: LICENSE-savvy-progress, na raiz do repositório mods-cezar.
// Parte do módulo register.tsx: o plugin tem um só módulo de hooks.
import { atom, read, update } from 'claude-code'
import type { ElementTable, EngineInterface, PluginOptions, Register, SessionContextUsage, SessionRateLimit, Timer } from 'claude-code'
import type { AgentRun, Panel } from '../types'

// Estado do painel de agentes. Prefixo ag_ para não colidir com os valores da faixa, mais abaixo no arquivo.
const agents = atom({ plugin: 'painel-cezar', key: 'ag_agents' } as const, [])
const panel = atom({ plugin: 'painel-cezar', key: 'ag_panel' } as const, {
  isCompact: false,
  isDoneCollapsed: false,
})
const now = atom({ plugin: 'painel-cezar', key: 'ag_now' } as const, 0)

const PANE = 'agentes-cezar'
// ---------------------------------------------------------------------------
// Language: the `language` option, else Claude Code's `language` setting, else the
// process locale; English when nothing says Russian.

type Lang = 'en' | 'ru' | 'pt'

const STRINGS = {
  en: {
    pane: 'Agents',
    cost: 'Cost',
    tokens: 'Tokens',
    time: 'Time',
    collapse: 'Collapse',
    expand: 'Expand',
    running: 'Running',
    finished: 'Finished',
    planned: 'Planned',
    empty: 'No subagents yet.',
    round: 'round',
    failed: 'error',
    after: 'after',
    tokensWord: 'tokens',
    agentsCount: 'agents',
    isRunning: 'running',
    isFinished: 'finished',
    isPlanned: 'planned',
    opened: 'Agents panel opened.',
    closed: 'Agents panel closed.',
    done: 'Done',
    plan: 'Plan',
    design: 'Design',
    tasks: 'Tasks',
    review: 'Review',
    busy: 'running',
  },
  ru: {
    pane: 'Агенты',
    cost: 'Стоимость',
    tokens: 'Токены',
    time: 'Время',
    collapse: 'Свернуть',
    expand: 'Развернуть',
    running: 'Работают',
    finished: 'Завершены',
    planned: 'Запланированы',
    empty: 'Субагентов пока нет.',
    round: 'раунд',
    failed: 'ошибка',
    after: 'после',
    tokensWord: 'токенов',
    agentsCount: 'агентов',
    isRunning: 'работает',
    isFinished: 'завершён',
    isPlanned: 'запланирована',
    opened: 'Панель агентов открыта.',
    closed: 'Панель агентов закрыта.',
    done: 'Готово',
    plan: 'План',
    design: 'Дизайн',
    tasks: 'Задачи',
    review: 'Ревью',
    busy: 'в работе',
  },
  pt: {
    pane: 'Agentes',
    cost: 'Custo',
    tokens: 'Tokens',
    time: 'Tempo',
    collapse: 'Recolher',
    expand: 'Expandir',
    running: 'Rodando',
    finished: 'Concluído',
    planned: 'Planejado',
    empty: 'Nenhum subagente ainda.',
    round: 'rodada',
    failed: 'erro',
    after: 'após',
    tokensWord: 'tokens',
    agentsCount: 'agentes',
    isRunning: 'rodando',
    isFinished: 'concluído',
    isPlanned: 'planejado',
    opened: 'Painel de agentes aberto.',
    closed: 'Painel de agentes fechado.',
    done: 'Concluído',
    plan: 'Plano',
    design: 'Design',
    tasks: 'Tarefas',
    review: 'Revisão',
    busy: 'rodando',
  },
} as const

// Module scope is fine here: session.start sets it again on every (re)load.
let lang: Lang = 'en'
const tr = () => STRINGS[lang]

const isRussian = (v: unknown): boolean => typeof v === 'string' && /^(ru|russian|рус)/i.test(v.trim())

async function detectLang($: EngineInterface, option: unknown): Promise<Lang> {
  if (option === 'en' || option === 'ru' || option === 'pt') return option
  try {
    const settings = (await $.settings.read()) as Record<string, unknown>
    if (typeof settings.language === 'string' && settings.language.trim()) {
      if (isRussian(settings.language)) return 'ru'
      if (/^(pt|portuguese|português)/i.test(settings.language.trim())) return 'pt'
      return 'en'
    }
  } catch {
    // No settings: fall through to the locale.
  }
  const locale = (await $.env.get('LC_ALL')) || (await $.env.get('LC_MESSAGES')) || (await $.env.get('LANG'))
  if (isRussian(locale)) return 'ru'
  if (/^pt/i.test(locale ?? '')) return 'pt'
  return 'pt'
}

const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif"

const xml = (s: string): string =>
  s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)


// Rough advance of system UI text, in em; good enough to size the title's slot.
const charEm = (ch: string): number =>
  /[\s.,:;'|!il1()[\]]/.test(ch) ? 0.3 : /[A-ZА-ЯЁmwшщжюМШЩЖЮ@%]/.test(ch) ? 0.72 : 0.56

const textWidth = (s: string, size: number): number => [...s].reduce((w, ch) => w + charEm(ch) * size, 0)

// Cuts `s` to fit `maxW` pixels, with an ellipsis when it had to cut.
const fitText = (s: string, size: number, maxW: number): string => {
  if (textWidth(s, size) <= maxW) return s
  let out = ''
  for (const ch of s) {
    if (textWidth(out + ch + '…', size) > maxW) break
    out += ch
  }
  return out + '…'
}
// ---------------------------------------------------------------------------
// Agents panel: every subagent of the session.

const TIER_COLOR: Record<string, string> = {
  fable: '#7F77DD',
  heavy: '#D85A30',
  careful: '#BA7517',
  medium: '#378ADD',
  light: '#1D9E75',
  advogado: '#3B5B92',
  executor: '#BA7517',
  contador: '#2E8B57',
  pesquisador: '#8A6D3B',
  revisor: '#C0392B',
  redator: '#4A4E57',
  cobranca: '#2E7D32',
  atendente: '#25D366',
  obra: '#BA7517',
  pintor: '#7E57C2',
  cientista: '#00897B',
  other: '#888780',
}

const colorOf = (tier: string): string => TIER_COLOR[tier] ?? '#888780'

// USD por milhão de tokens: entrada, saída, leitura de cache, gravação de cache (5 min).
// Conferido em 10/10/2026 em https://platform.claude.com/docs/en/about-claude/pricing
// Ordem importa: o mais específico vem antes. O Haiku 5.5 tem outra tabela acima de 100k (HAIKU55_ACIMA_100K).
const PRICES: [RegExp, [number, number, number, number]][] = [
  [/(fable|mythos)-5-1/, [10, 50, 0.25, 12.5]],
  [/fable|mythos/, [10, 50, 1, 12.5]],
  [/opus-5-5/, [4, 20, 0.2, 5]],
  [/opus/, [5, 25, 0.5, 6.25]],
  [/sonnet-5-5/, [2, 10, 0.1, 2.5]],
  [/sonnet-5/, [2, 10, 0.2, 2.5]],
  [/sonnet/, [3, 15, 0.3, 3.75]],
  [/haiku-5/, [0.1, 0.5, 0.01, 0.125]],
  [/haiku/, [1, 5, 0.1, 1.25]],
]
const HAIKU55_ACIMA_100K: [number, number, number, number] = [0.5, 2.5, 0.05, 0.625]

type Usage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

const priceOf = (model: string): [number, number, number, number] =>
  PRICES.find(([re]) => re.test(model.toLowerCase()))?.[1] ?? [4, 20, 0.2, 5]

const costOf = (model: string, u: Usage): number => {
  const prompt = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0)
  const [i, o, r, w] = /haiku-5/i.test(model) && prompt > 100_000 ? HAIKU55_ACIMA_100K : priceOf(model)
  return (
    ((u.input_tokens || 0) * i +
      (u.output_tokens || 0) * o +
      (u.cache_read_input_tokens || 0) * r +
      (u.cache_creation_input_tokens || 0) * w) /
    1e6
  )
}

// Janela: 1M em todos os modelos atuais; 200k só no Haiku 4.x (conferido em 10/10/2026, models overview).
const windowOf = (model: string): number => (/haiku-4/i.test(model) ? 200_000 : 1_000_000)

// `savvy-careful`, or `savvy-flow:savvy-careful` when the agents ship in a plugin.
const bareSavvy = (type: string): boolean => type.replace(/^[^:]*:/, '').startsWith('savvy-')

const tierOf = (type: string): string => {
  const bare = type.replace(/^[^:]*:/, '')
  const t = bare.replace(/^savvy-/, '').toLowerCase()
  // Agentes da casa: uma fantasia por função (a primeira regra que bate vence)
  const casa: [RegExp, string][] = [
    [/^(relatorio-fatura|advogado-cliente-faturas)/i, 'contador'],
    [/^pesquisador-/i, 'pesquisador'],
    [/^(revisor-|advogado-cliente-conferente)/i, 'revisor'],
    [/^advogado-cliente-ms-redator/i, 'redator'],
    [/^advogado-cliente-cobranca/i, 'cobranca'],
    [/^advogado-cliente-contato-whatsapp/i, 'atendente'],
    [/^advogado-/i, 'advogado'],
    [/^obra-longa-/i, 'obra'],
    [/^executor-/i, 'executor'],
    [/^animador-/i, 'pintor'],
    [/^excecao-/i, 'cientista'],
  ]
  for (const [re, nome] of casa) if (re.test(bare)) return nome
  return t in TIER_COLOR && bare.startsWith('savvy-') ? t : 'other'
}

const modelName = (id: string): string => {
  const m = /(fable|mythos|opus|sonnet|haiku)-(\d+)(?:-(\d{1,2})(?!\d))?/i.exec(id)
  const [, family = '', major = '', minor] = m ?? []
  if (!family) return id.replace(/^claude-/, '').replace(/\[.*\]$/, '') || '—'
  return `${family.charAt(0).toUpperCase()}${family.slice(1).toLowerCase()} ${major}${minor ? '.' + minor : ''}`
}

const norm = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

const fmtTokens = (n: number): string =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${Math.round(n)}`

// Cezar: custo em % da semana, pelo câmbio da seção "Ritmo da semana".
const USD_POR_PONTO = 23.5
let usdPorPonto = USD_POR_PONTO
const fmtCost = (usd: number): string => {
  const p = usd / usdPorPonto
  const texto = p < 0.1 ? p.toFixed(2) : p < 10 ? p.toFixed(1) : String(Math.round(p))
  return `${texto.replace('.', ',')}% sem`
}

const fmtTime = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

const elapsed = (a: AgentRun, at: number): number => (a.endedAt ?? Math.max(at, a.startedAt)) - a.startedAt


const totals = (list: AgentRun[], at: number) => {
  const cost = list.reduce((s, a) => s + a.costUsd, 0)
  const tokens = list.reduce((s, a) => s + a.tokens, 0)
  const start = Math.min(...list.map(a => a.startedAt))
  const end = Math.max(...list.map(a => a.endedAt ?? Math.max(at, a.startedAt)))
  return { cost, tokens, time: list.length ? end - start : 0 }
}

// --- desktop drawings: each row is one SVG, as the band above the prompt is.

const PANE_CSS = `<style>
.t{fill:#1f1f1f}.s{fill:#6b6b68}.m{fill:#9a9a96}.k{fill:#ecebe8}.ln{stroke:#e4e4e1}.tile{fill:#f4f3f0}
@media (prefers-color-scheme: dark){.t{fill:#ececec}.s{fill:#a8a8a4}.m{fill:#7d7d79}.k{fill:#2c2c2b}.ln{stroke:#333331}.tile{fill:#262625}}
.live{animation:p 1.6s ease-in-out infinite}@keyframes p{50%{opacity:.3}}
@media (prefers-reduced-motion: reduce){.live{animation:none}}
</style>`

// Pixel Clawd from DockCrab (Clawdy): a 24×18 crab on a 30×28 grid, one costume per tier.
// The body keeps the brand clay; the tier's color lives in the costume's accent.
const CLAY = '#D97757'
const INK = '#1F1E1D'

// `cls` puts a pixel in a named group: `bd` (the default) is the body and its
// costume, `la`/`lb` the leg pairs, anything else a prop with its own motion.
type Fill = (x: number, y: number, w: number, h: number, c: string, cls?: string) => void

const stamp = (f: Fill, x: number, y: number, rows: string[], map: Record<string, string>, cls?: string): void =>
  rows.forEach((row, dy) => [...row].forEach((ch, dx) => map[ch] && f(x + dx, y + dy, 1, 1, map[ch] ?? '', cls)))

// `armCls` lets a raised claw travel with the prop it holds.
const crabBody = (f: Fill, armFront = 0, armCls?: string): void => {
  f(7, 10, 16, 12, CLAY)
  f(3, 14, 4, 4, CLAY)
  f(23, 14 + armFront, 4, 4, CLAY, armCls)
  f(9, 12, 2, 2, INK)
  f(19, 12, 2, 2, INK)
  f(7, 22, 2, 4, CLAY, 'la')
  f(17, 22, 2, 4, CLAY, 'la')
  f(11, 22, 2, 4, CLAY, 'lb')
  f(21, 22, 2, 4, CLAY, 'lb')
}

// Pure CSS, run by the compositor: no redraws. Periods divide one second, so the
// once-a-second redraw of a running row restarts them in phase. Every crab walks;
// each costume adds its prop's own motion on top.
const CRAB_CSS = `<style>
.run .la{animation:st .5s steps(1) infinite}.run .lb{animation:st .5s steps(1) infinite -.25s}
.run .bd{animation:bob .5s steps(1) infinite -.125s}
.run g{transform-box:fill-box}
@keyframes st{50%{transform:translateY(-1px)}}@keyframes bob{50%{transform:translateY(1px)}}
.c-fable.run{animation:float 1s ease-in-out infinite}
.c-fable.run .la,.c-fable.run .lb,.c-fable.run .bd{animation:none}
.c-fable.run .ant{animation:blink 1s steps(1) infinite}
.c-fable.run .star{animation:blink .5s steps(1) infinite -.25s}
@keyframes float{50%{transform:translateY(-2px)}}@keyframes blink{50%{opacity:.15}}
.c-heavy.run .it{animation:scan 1s steps(1) infinite}
.c-heavy.run .gl{animation:blink 1s steps(1) infinite -.5s}
@keyframes scan{25%{transform:translate(-1px,1px)}50%{transform:translate(-2px,2px)}75%{transform:translate(-1px,1px)}}
.c-careful.run .it{transform-origin:100% 100%;animation:twist .5s ease-in-out infinite}
@keyframes twist{50%{transform:rotate(-35deg)}}
.c-medium.run .pan{transform-origin:0 50%;animation:tilt 1s ease-in-out infinite}
.c-medium.run .egg{animation:flip 1s ease-in-out infinite}
@keyframes tilt{20%,40%{transform:rotate(-12deg)}}@keyframes flip{30%{transform:translateY(-5px) scaleY(-1)}60%{transform:translateY(0)}}
.c-light.run .la{animation-duration:.25s}.c-light.run .lb{animation-duration:.25s;animation-delay:-.125s}
.c-light.run .flag{transform-origin:0 50%;animation:wave .25s steps(1) infinite}
@keyframes wave{50%{transform:skewY(-12deg) scaleX(.85)}}
.c-explore.run .it{transform-origin:50% 100%;animation:fence .5s ease-in-out infinite}
@keyframes fence{50%{transform:rotate(25deg)}}
.c-executor.run .it{transform-origin:100% 100%;animation:twist .5s ease-in-out infinite}
.c-advogado.run .it{transform-origin:50% 0;animation:swing 1s ease-in-out infinite}
@keyframes swing{25%{transform:rotate(8deg)}75%{transform:rotate(-8deg)}}
.c-contador.run .ka{animation:contadorA .5s steps(1) infinite}.c-contador.run .kb{animation:contadorA .5s steps(1) infinite -.25s}@keyframes contadorA{0%{opacity:1}50%{opacity:0}}
.c-pesquisador.run .it{animation:pesquisadorA 1s ease-in-out infinite}@keyframes pesquisadorA{0%,100%{transform:translateX(0)}50%{transform:translateX(-10px)}}
.c-revisor.run .pn{transform-origin:0% 100%;animation:revisorA .5s steps(1) infinite}@keyframes revisorA{0%{transform:translate(0,0)}25%{transform:translate(-1px,1px)}50%{transform:translate(-2px,0)}75%{transform:translate(-1px,-1px)}}
.c-redator.run .pn{transform-origin:0% 100%;animation:redatorA 1s steps(1) infinite}@keyframes redatorA{0%{transform:translate(0,0) rotate(0deg)}25%{transform:translate(-1px,1px) rotate(-5deg)}50%{transform:translate(0,0) rotate(3deg)}75%{transform:translate(1px,1px) rotate(-3deg)}}
.c-cobranca.run .pn{transform-origin:50% 50%;transform-box:fill-box;animation:cobrancaA 1s ease-in-out infinite}@keyframes cobrancaA{0%,100%{transform:scaleX(1)}50%{transform:scaleX(.08)}}
.c-atendente.run .d1,.c-atendente.run .d2,.c-atendente.run .d3{animation:atendenteD 1s steps(1) infinite}.c-atendente.run .d2{animation-delay:-.67s}.c-atendente.run .d3{animation-delay:-.34s}@keyframes atendenteD{0%{opacity:1}34%{opacity:.25}}
.c-obra.run .sh{transform-origin:50% 45%;animation:obraS .6s ease-in-out infinite}@keyframes obraS{0%,100%{transform:rotate(-9deg)}50%{transform:rotate(9deg)}}
.c-pintor.run .pn{transform-origin:50% 100%;animation:pintorA .5s ease-in-out infinite}@keyframes pintorA{0%,100%{transform:rotate(-14deg)}50%{transform:rotate(14deg)}}
.c-cientista.run .bb{animation:cientistaA 1s steps(4) infinite}.c-cientista.run .bc{animation:cientistaA 1s steps(4) infinite -.5s}@keyframes cientistaA{0%{transform:translateY(0);opacity:1}70%{opacity:1}100%{transform:translateY(-5px);opacity:0}}
@media (prefers-reduced-motion: reduce){.run,.run g{animation:none!important}}
</style>`

const COSTUMES: Record<string, (f: Fill, t: string) => void> = {
  // Fable: astronaut in a glass dome; floats instead of walking, the antenna and the star blink.
  fable: (f, t) => {
    crabBody(f)
    f(6, 7, 18, 1, '#E6E8EE'); f(5, 8, 1, 14, '#E6E8EE'); f(24, 8, 1, 14, '#E6E8EE'); f(6, 22, 18, 1, '#C9CCD2')
    f(6, 8, 18, 14, 'rgba(169,214,245,.32)'); f(8, 9, 2, 1, '#fff'); f(8, 10, 1, 2, '#fff')
    f(14, 4, 2, 3, '#C9CCD2'); f(14, 2, 2, 2, t, 'ant'); f(13, 18, 4, 2, t)
    f(27, 3, 1, 3, '#F5C542', 'star'); f(26, 4, 3, 1, '#F5C542', 'star')
  },
  // Heavy: detective with a deerstalker; the magnifier sweeps and glints.
  heavy: (f, t) => {
    crabBody(f, -4, 'it')
    stamp(f, 6, 3, ['......bbbbbb......', '....bbcbbcbbbb....', '...bbbbbbbbbbbb...', '..bcbbcbbcbbcbbb..', '.bbbbbbbbbbbbbbbb.', 'dddddddddddddddddd'], { b: '#7A4A26', c: '#A0703F', d: '#5A3519' })
    f(6, 9, 18, 1, t)
    stamp(f, 23, 1, ['.kkk.', 'k...k', 'k...k', 'k...k', '.kkk.'], { k: '#3A3A3C' }, 'it')
    f(24, 2, 3, 3, 'rgba(169,214,245,.7)', 'it'); f(25, 6, 1, 4, '#7A4A26', 'it'); f(24, 2, 1, 1, '#fff', 'gl')
  },
  // Careful: engineer in a hard hat; the wrench turns a bolt.
  careful: (f, t) => {
    crabBody(f)
    stamp(f, 6, 4, ['.....yyyyyyyy.....', '...yyyyyhhyyyyy...', '..yyyyyyhhyyyyyy..', '..yyyyyyhhyyyyyy..', '.yyyyyyyhhyyyyyyy.', 'dddddddddddddddddd'], { y: '#F5C542', h: '#FBE08A', d: '#C99A1E' })
    f(13, 5, 4, 2, t)
    stamp(f, 0, 10, ['.s.s', 'sss.', '.s..', '.s..'], { s: '#8E929A' }, 'it')
  },
  // Medium: chef, the toque traced from DockCrab's Sprites.chefHat; tosses the omelette.
  medium: (f, t) => {
    crabBody(f, -4, 'pan')
    stamp(f, 6, 0, ['........lll.......', '.......lllll......', '.wwwwgwwwwwwgwwwww', 'wwwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwwww', 'wwwwwgwwwwwggwwwww', '.wwwwgwwwwwggwwwww', '.dddbbbbbbbbbbbbb.', '.dddbbbbbbbbbbbbb.', '.dddbbbbbbbbbbbbb.'], { w: '#F4F3EE', l: '#F7F6F2', g: '#D2D1C8', b: t, d: '#B45F43' })
    f(22, 8, 7, 2, '#4A4A48', 'pan'); f(26, 10, 1, 1, '#4A4A48', 'pan'); f(24, 7, 3, 1, '#F5B731', 'egg')
  },
  // Light: racer in a helmet; runs at double pace, the checkered flag flutters.
  light: (f, t) => {
    crabBody(f, -4)
    stamp(f, 6, 5, ['....rrrrrrrrrr....', '..rrrrrrwwrrrrrr..', '.rrrrrrrwwrrrrrrr.', '.rrrrrrrwwrrrrrrr.', '.rrrrrrrwwrrrrrrr.', '.kkkkkkkkkkkkkkkkr'], { r: t, w: '#F8F6F1', k: INK })
    f(25, 1, 1, 9, '#8E929A')
    stamp(f, 26, 1, ['wkwk', 'kwkw', 'wkwk'], { w: '#F8F6F1', k: INK }, 'flag')
  },
  // Explore: pirate scouting the code; the cutlass fences.
  explore: f => {
    crabBody(f)
    stamp(f, 5, 3, ['.kk..............kk.', '.kkk....kkkk....kkk.', '..kkkkkkkwwkkkkkkk..', '..kkkkkkkkkkkkkkkk..', '.gggggggggggggggggg.'], { k: '#55514C', w: '#F8F6F1', g: '#F5C542' })
    f(7, 11, 11, 1, INK); f(18, 11, 4, 3, INK)
    f(27, 6, 1, 9, '#C9CCD2', 'it'); f(26, 15, 3, 1, '#7A4A26', 'it')
  },
  // Advogado: terno azul-marinho, camisa branca, gravata vermelha; a maleta balança.
  advogado: f => {
    crabBody(f)
    stamp(f, 7, 16, ['nnnnnwwrrwwnnnnn', 'nnnnnnwrrwnnnnnn', 'nnnnnnnrrnnnnnnn', 'nnnnnnnrrnnnnnnn', 'nnnnnnnnnnnnnnnn', 'nnnnnnnnnnnnnnnn'], { n: '#22304F', w: '#F8F6F1', r: '#C0392B' })
    f(3, 14, 4, 2, '#22304F'); f(23, 14, 4, 2, '#22304F')
    f(25, 17, 3, 1, INK, 'it'); f(23, 18, 7, 4, '#6B3E1F', 'it'); f(26, 19, 1, 1, '#F5C542', 'it')
  },
  // Executor: peão de obra de capacete; a chave gira o parafuso.
  executor: (f, t) => {
    crabBody(f)
    stamp(f, 6, 4, ['.....yyyyyyyy.....', '...yyyyyhhyyyyy...', '..yyyyyyhhyyyyyy..', '..yyyyyyhhyyyyyy..', '.yyyyyyyhhyyyyyyy.', 'dddddddddddddddddd'], { y: '#F5C542', h: '#FBE08A', d: '#C99A1E' })
    f(13, 5, 4, 2, t)
    stamp(f, 0, 10, ['.s.s', 'sss.', '.s..', '.s..'], { s: '#8E929A' }, 'it')
  },
  contador: (f, t) => {
  crabBody(f, -4, 'it')
  // viseira: faixa escura, aba verde, sombra da aba
  stamp(f, 7, 6, ['..dddddddddddd..', '.gggggggggggggg.', 'gggggggggggggggg', 'mmmmmmmmmmmmmmmm'], { d: '#1F5E3A', g: '#3FB574', m: '#2E8B57' })
  f(9, 7, 4, 1, '#8FE0B0')
  // calculadora (x23-28, y3-9), na garra que subiu
  stamp(f, 23, 3, ['dddddd', 'dlllld', 'dddddd', 'dwwwwd', 'dwwwwd', 'dwwwwd', 'dddddd'], { d: '#3A3D44', l: '#B8F0C8', w: '#D5D7DC' }, 'it')
  f(24, 4, 1, 1, '#2E8B57', 'it')
  // teclas que piscam, em dois grupos alternados
  f(24, 6, 1, 1, '#F5C542', 'ka'); f(26, 6, 1, 1, '#F5C542', 'ka'); f(25, 7, 1, 1, '#F5C542', 'ka'); f(27, 8, 1, 1, '#F5C542', 'ka')
  f(25, 6, 1, 1, '#E05A4F', 'kb'); f(27, 7, 1, 1, '#E05A4F', 'kb'); f(24, 8, 1, 1, '#E05A4F', 'kb'); f(26, 8, 1, 1, '#E05A4F', 'kb')
},
  pesquisador: (f, t) => {
  crabBody(f, -4, 'it')
  stamp(f, 6, 2, [
    '.....kkkkkkkk.....',
    '....khhkkkkkkk....',
    '...khhkkkkkkkkk...',
    '...kkkkkkkkkkkk...',
    '..bbbbbbbbbbbbbb..',
  ], { k: '#D8C48A', h: '#EFE3B8', b: '#6B4A22' })
  stamp(f, 3, 7, [
    'ssssssssssssssssssssss',
    '.dddddddddddddddddddd.',
  ], { s: '#B89F62', d: '#8A7440' })
  stamp(f, 20, 14, [
    '.rrrr.',
    'rggwgr',
    'rgwggr',
    'rggggr',
    'rggggr',
    '.rrrr.',
  ], { r: '#4A3418', g: '#CDEBF5', w: '#FFFFFF' }, 'it')
  stamp(f, 25, 19, ['r.', 'rr', '.r', '.r'], { r: '#4A3418' }, 'it')
},
  revisor: (f, t) => {
  crabBody(f)
  const F = '#2B2D42', L = '#F4F1E8'
  // armação 6x6 com lente clara; os olhos (9,12) e (19,12) ficam dentro
  stamp(f, 7, 10, ['FFFFFF', 'FLLLLF', 'FLLLLF', 'FLLLLF', 'FLLLLF', 'FFFFFF'], { F, L })
  stamp(f, 17, 10, ['FFFFFF', 'FLLLLF', 'FLLLLF', 'FLLLLF', 'FLLLLF', 'FFFFFF'], { F, L })
  f(9, 12, 2, 2, '#1F1E1D'); f(19, 12, 2, 2, '#1F1E1D')
  f(13, 12, 4, 1, F)
  // caneta na garra direita, ponta para baixo e para a esquerda
  stamp(f, 22, 12, [
    '.....rr.', '....rRr.', '...rRr..', '..rRr...', '.wRr....', '.kw.....', 'k.......'
  ].map(s => s), { r: '#C0392B', R: '#E85D4A', w: '#F4F1E8', k: '#8E929A' }, 'pn')
},
  redator: (f, t) => {
  crabBody(f, -4, 'pn')
  stamp(f, 7, 16, [
    'nnnnnwwrrwwnnnnn',
    'nnnnnnwrrwnnnnnn',
    'nnnnnnnrrnnnnnnn',
    'nnnnnnnrrnnnnnnn',
    'nnnnnnnnnnnnnnnn',
    'nnnnnnnnnnnnnnnn'], { n: '#4A4E57', w: '#F8F6F1', r: '#7B1E3A' })
  f(3, 14, 4, 2, '#4A4E57'); f(23, 10, 4, 2, '#4A4E57', 'pn')
  // pena: haste marrom, barbas creme, ponta de tinta
  stamp(f, 22, 1, [
    '.....ccc',
    '....cccc',
    '...cccke',
    '..ccckce',
    '..ccckce',
    '...cckc.',
    '...cck..',
    '...ck...',
    '...k....',
    '...k....',
    '..k.....',
    '..k.....',
    '.k......',
    'd.......'], { c: '#F6EFD8', e: '#CDBF98', k: '#6B4A2B', d: INK }, 'pn')
},
  cobranca: (f, t) => {
  crabBody(f)
  stamp(f, 7, 16, ['nnnnnwwgggwwnnnnn'.slice(0, 5) + 'wwggwwnnnnn', 'nnnnnnwggwnnnnnn', 'nnnnnnnggnnnnnnn', 'nnnnnnnggnnnnnnn', 'nnnnnnnnnnnnnnnn', 'nnnnnnnnnnnnnnnn'], { n: '#22304F', w: '#F8F6F1', g: '#2E7D32' })
  f(3, 14, 4, 2, '#22304F'); f(23, 14, 4, 2, '#22304F')
  stamp(f, 24, 9, ['.dddd.', 'dhgsgd', 'dgsssd', 'dgsggd', 'dgsssd', 'dgggsd', 'dggsgd', '.dddd.'], { d: '#B8860B', g: '#F5C542', h: '#FBE08A', s: '#8A5A00' }, 'pn')
},
  atendente: (f, t) => {
  crabBody(f)
  const H = '#6B7280', L = '#B8BEC9', D = '#3B4048'
  // arco do headset sobre a cabeca
  stamp(f, 7, 6, ['...llllllll...', '.hh........hh.', 'hh..........hh', 'h............h'].map(r => r.padEnd(16, '.')), { l: L, h: H })
  f(7, 9, 1, 2, H); f(22, 9, 1, 2, H)
  // fones nas laterais
  f(6, 11, 3, 5, H); f(6, 11, 1, 5, D); f(8, 12, 1, 3, L)
  f(21, 11, 3, 5, H); f(23, 11, 1, 5, D); f(21, 12, 1, 3, L)
  // microfone: haste curva ate perto da boca
  f(7, 16, 1, 1, H); f(8, 17, 1, 1, H); f(9, 18, 2, 1, H); f(11, 18, 2, 2, D)
  // balao WhatsApp
  f(20, 0, 9, 1, t); f(19, 1, 11, 4, t); f(20, 5, 9, 1, t); f(22, 6, 2, 1, t); f(22, 7, 1, 1, t)
  f(21, 2, 2, 2, '#FFFFFF', 'd1'); f(24, 2, 2, 2, '#FFFFFF', 'd2'); f(27, 2, 2, 2, '#FFFFFF', 'd3')
},
  obra: (f, t) => {
  crabBody(f)
  stamp(f, 6, 4, ['.....yyyyyyyy.....', '...yyyyyhhyyyyy...', '..yyyyyyhhyyyyyy..', '..yyyyyyhhyyyyyy..', '.yyyyyyyhhyyyyyyy.', 'dddddddddddddddddd'], { y: '#F5C542', h: '#FBE08A', d: '#C99A1E' })
  f(13, 5, 4, 2, t)
  for (let y = 5; y <= 20; y++) { const x = Math.round(27 - (y - 5) * 2 / 16); f(x, y, 2, 1, '#8A5A2B', 'sh'); f(x, y, 1, 1, '#B07A42', 'sh') }
  f(27, 4, 2, 1, '#6B4420', 'sh')
  stamp(f, 23, 20, ['.kGGGk', 'kGGGGk', 'kGGwGk', 'kGGGGk', '.kGGk.', '..kk..'].map(r => r.padEnd(6, '.')), { k: '#5E6168', G: '#A9ADB5', w: '#D8DBE0' }, 'sh')
  f(23, 16, 2, 2, '#D97757', 'sh'); f(27, 16, 1, 2, '#D97757', 'sh')
},
  pintor: (f, t) => {
  crabBody(f, -4, 'pn')
  stamp(f, 4, 4, ['......ss........', '....rrrrrrrr....', '..rrrrrrrrrrrr..', '.rrrrhrrrrrrrrr.', 'rrrrrrrrrrrrrrrr', 'dddddddddddddddd', '.dd.............'], { r: '#B03A48', h: '#D8707A', s: '#5A1A22', d: '#7E2230' })
  stamp(f, 23, 3, ['.mm.', 'mmmm', '.gg.', '.gg.', '.bb.', '.bb.', '.bb.', '.bb.'], { m: '#26C6DA', g: '#B0B4BC', b: '#8B5A2B' }, 'pn')
},
  cientista: (f, t) => {
  crabBody(f)
  // jaleco
  stamp(f, 7, 15, [
    'wwwwwww..wwwwwww',
    'wwwwwwwsswwwwwww',
    'wwbwwwwsswwwwwww',
    'wsssswwsswwwwwww',
    'wswwswwsswwwwwww',
    'wswwswwsswwwwwww',
    'wsssswwsswwwwwww'
  ], { w: '#FFFFFF', s: '#B9C0C9', b: '#3B6FD4' })
  // óculos: armação escura, lente clara translúcida, olho preto visível no meio
  f(12, 12, 6, 2, '#3A3F47')
  const L = ['tttttt', 'tcccct', 'tceect', 'tceect', 'tttttt']
  stamp(f, 7, 10, L, { t: t, c: '#CFEFF5', e: INK }, 'ox')
  stamp(f, 17, 10, L, { t: t, c: '#CFEFF5', e: INK }, 'ox')
  // tubo de ensaio
  stamp(f, 1, 3, [
    'oooo', 'oeeo', 'oeeo', 'oeeo', 'oeeo',
    'olLo', 'ollo', 'ollo', 'ollo', 'ollo', 'ollo', 'oooo'
  ], { o: '#5B8FA3', e: '#DDF1F7', l: '#6FD33F', L: '#B7F58A' })
  // bolhas
  f(2, 11, 1, 1, '#F2FFE8', 'bb'); f(3, 8, 1, 1, '#F2FFE8', 'bb')
  f(3, 10, 1, 1, '#F2FFE8', 'bc'); f(2, 7, 1, 1, '#F2FFE8', 'bc')
},
  other: f => crabBody(f),
}

const costumeOf = (type: string): string => (type === 'Explore' ? 'explore' : tierOf(type))

const CRAB_SCALE = 1.1

// Body and props nest inside `bd` so a prop rides the bob and adds its own motion;
// legs stay outside it and step on their own.
const crab = (x: number, y: number, costume: string, dim = false, isWalking = false, scale = CRAB_SCALE): string => {
  const groups = new Map<string, string[]>([['bd', []]])
  const f: Fill = (cx, cy, w, h, c, cls = 'bd') => {
    if (!groups.has(cls)) groups.set(cls, [])
    groups.get(cls)?.push(`<rect x="${cx}" y="${cy}" width="${w}" height="${h}" fill="${c}"/>`)
  }
  const draw = COSTUMES[costume] ?? ((g: Fill) => crabBody(g))
  draw(f, colorOf(costume))
  const group = (cls: string) => `<g class="${cls}">${(groups.get(cls) ?? []).join('')}</g>`
  const props = [...groups.keys()].filter(k => k !== 'bd' && k !== 'la' && k !== 'lb')
  const body = `<g class="bd">${(groups.get('bd') ?? []).join('')}${props.map(group).join('')}</g>`
  return `<g transform="translate(${x},${y}) scale(${scale})" opacity="${dim ? 0.45 : 1}" shape-rendering="crispEdges"><g class="c-${costume}${isWalking ? ' run' : ''}">${body}${group('la')}${group('lb')}</g></g>`
}

const statusMark = (x: number, y: number, status: string, color: string): string => {
  if (status === 'running') return `<circle class="live" cx="${x}" cy="${y}" r="3.5" fill="${color}"/>`
  if (status === 'done') return `<path d="M${x - 5} ${y}l3.5 3.5 6.5-7" fill="none" stroke="#3B9C5F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
  if (status === 'failed') return `<path d="M${x - 4} ${y - 4}l8 8M${x + 4} ${y - 4}l-8 8" stroke="#D0453F" stroke-width="1.8" stroke-linecap="round"/>`
  return `<circle cx="${x}" cy="${y}" r="5" fill="none" stroke="#9a9a96" stroke-width="1.4"/><path d="M${x} ${y - 2.5}v2.8l1.8 1.2" fill="none" stroke="#9a9a96" stroke-width="1.4" stroke-linecap="round"/>`
}

const svg = (W: number, H: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${PANE_CSS}${CRAB_CSS}${body}</svg>`

const HEADER_H = 44

// The pane's own title already says "Agents": the header is the three totals.
const headerSvg = (W: number, t: ReturnType<typeof totals>): string => {
  const s = tr()
  const gap = 6
  const tw = (W - gap * 2) / 3
  const tile = (i: number, k: string, v: string) =>
    `<rect class="tile" x="${i * (tw + gap)}" y="0" width="${tw}" height="40" rx="8"/>
<text class="s" x="${i * (tw + gap) + 9}" y="16" font-family="${FONT}" font-size="11">${k}</text>
<text class="t" x="${i * (tw + gap) + 9}" y="33" font-family="${FONT}" font-size="15" font-weight="600" font-variant-numeric="tabular-nums">${v}</text>`
  return svg(
    W,
    HEADER_H,
    `${tile(0, s.cost, '≈' + fmtCost(t.cost))}${tile(1, s.tokens, fmtTokens(t.tokens))}${tile(2, s.time, fmtTime(t.time))}`,
  )
}

// The task's own progress when the worker reports steps; a finished run is full.
const progressOf = (a: AgentRun): number | null => {
  if (a.status === 'done') return 1
  if (a.stepTotal) return Math.min(1, (a.stepDone ?? 0) / a.stepTotal)
  return null
}

const ctxOf = (a: AgentRun): number => (a.contextMax ? Math.min(100, Math.round((a.contextTokens / a.contextMax) * 100)) : 0)

const agentSvg = (W: number, a: AgentRun, at: number): string => {
  const s = tr()
  const tier = tierOf(a.type)
  const color = colorOf(tier)
  const ctx = ctxOf(a)
  const textW = W - 42 - 22
  const meta = [a.effort ? `${modelName(a.model)} · ${a.effort}` : modelName(a.model)]
  if (a.round > 1) meta.push(`${s.round} ${a.round}`)
  if (a.status === 'failed') meta.push(s.failed)
  const barW = textW
  const progress = progressOf(a)
  const stats = `ctx ${ctx}% · ${fmtTokens(a.contextTokens)}  ≈${fmtCost(a.costUsd)}  ${fmtTime(elapsed(a, at))}`
  const steps = a.stepTotal ? `${a.stepDone ?? 0}/${a.stepTotal}${a.stepNote ? ' · ' + a.stepNote : ''}` : ''
  const stepsW = Math.max(0, barW - textWidth(stats, 11) - 12)
  // Without reported steps the bar falls back to the context, drawn grey.
  const fillW = Math.round(barW * (progress ?? ctx / 100))
  return svg(
    W,
    66,
    `${crab(0, 14, costumeOf(a.type), false, a.status === 'running')}
<text class="t" x="42" y="18" font-family="${FONT}" font-size="13" font-weight="600">${xml(fitText(a.description || a.type, 13, textW))}</text>
<text x="42" y="34" font-family="${FONT}" font-size="11"><tspan fill="${color}">${xml(tier === 'other' || !bareSavvy(a.type) ? a.type : tier)}</tspan><tspan class="s">  ${xml(meta.join('  ·  '))}</tspan></text>
${steps && stepsW > 30 ? `<text class="t" x="42" y="49" font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums">${xml(fitText(steps, 11, stepsW))}</text>` : ''}
<text class="s" x="${42 + barW}" y="49" text-anchor="end" font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums">${stats}</text>
<rect class="k" x="42" y="55" width="${barW}" height="4" rx="2"/><rect${progress === null ? ' class="m"' : ''} x="42" y="55" width="${fillW}" height="4" rx="2"${progress === null ? '' : ` fill="${color}"`}/>
${statusMark(W - 8, 16, a.status, color)}
<line class="ln" x1="0" y1="65.5" x2="${W}" y2="65.5"/>`,
  )
}

const compactSvg = (W: number, list: AgentRun[], t: ReturnType<typeof totals>): string => {
  const icons = [
    ...list.filter(a => a.status === 'running').map(a => ({ k: costumeOf(a.type), c: colorOf(tierOf(a.type)), s: 'running' })),
    ...list.filter(a => a.status !== 'running').map(a => ({ k: costumeOf(a.type), c: colorOf(tierOf(a.type)), s: a.status })),
  ]
  const fit = Math.max(1, Math.floor((W - 150) / 36))
  const shown = icons.slice(0, fit)
  const more = icons.length - shown.length
  const body = shown
    .map((ic, i) => crab(i * 36, 0, ic.k, false, ic.s === 'running') + (ic.s === 'running' ? `<circle class="live" cx="${i * 36 + 32}" cy="4" r="3" fill="${ic.c}"/>` : ''))
    .join('')
  const x = shown.length * 36 + (more ? 4 : 0)
  return svg(
    W,
    32,
    `${body}${more ? `<text class="s" x="${x}" y="21" font-family="${FONT}" font-size="12">+${more}</text>` : ''}
<text class="s" x="${W}" y="21" text-anchor="end" font-family="${FONT}" font-size="12" font-variant-numeric="tabular-nums">≈${fmtCost(t.cost)} · ${fmtTokens(t.tokens)} · ${fmtTime(t.time)}</text>`,
  )
}

// --- terminal drawing: the same rows in text.

const ctxBar = (pct: number, width: number): string => {
  const filled = Math.round((width * pct) / 100)
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled))
}

const STATUS_GLYPH: Record<string, string> = { running: '●', done: '✓', failed: '✗', planned: '◷' }

// Opens the agents pane, or closes it when it is up; true when it ends up open.
async function togglePane($: EngineInterface): Promise<boolean> {
  const isOpen = (await $.ui.panes()).some(p => p.id === PANE)
  if (isOpen) {
    await $.ui.close({ id: PANE })
    return false
  }
  const at = await $.clock.now()
  await update($, now, () => at)
  await $.ui.open({ id: PANE, title: tr().pane })
  return true
}

// Entradas do painel, chamadas pelos hooks de register, mais abaixo.

async function agentesInicio($: EngineInterface, options: { language?: unknown }): Promise<void> {
  lang = await detectLang($, options.language)
  await $.command.register({
    name: 'agents-info',
    description: 'Show or hide the panel of subagents: running and finished, with model, context, cost and time',
  })

  // Ticks the running agents' clocks; quiet when nothing runs.
  $.clock.every(1000, () => {
    void (async () => {
      const list = await read($, agents)
      if (!list.some(a => a.status === 'running')) return
      const at = await $.clock.now()
      await update($, now, () => at)
    })()
  })
}

async function agentesUso($: EngineInterface, e: any, result: any): Promise<void> {
  const agentId = e.agentId
  const usage = result.usage
  if (!agentId || !usage) return

  const model = usage.model || e.model
  await update($, agents, list =>
    list.map(a =>
      a.agentId !== agentId
        ? a
        : {
            ...a,
            model,
            effort: typeof e.effort === 'string' ? e.effort : a.effort,
            status: 'running',
            endedAt: undefined,
            contextTokens:
              (usage.input_tokens || 0) +
              (usage.cache_read_input_tokens || 0) +
              (usage.cache_creation_input_tokens || 0) +
              (usage.output_tokens || 0),
            contextMax: windowOf(model),
            tokens:
              a.tokens +
              (usage.input_tokens || 0) +
              (usage.output_tokens || 0) +
              (usage.cache_read_input_tokens || 0) +
              (usage.cache_creation_input_tokens || 0),
            costUsd: a.costUsd + costOf(model, usage),
            steps: a.steps + 1,
          },
    ),
  )
}

async function agentesFimTurno($: EngineInterface, e: any): Promise<void> {
  const agentId = e.agentId
  if (agentId) {
    const at = await $.clock.now()
    await update($, agents, list =>
      list.map(a => {
        if (a.agentId !== agentId) return a
        // A run whose steps went unseen still gets the turn's own sum.
        const fallback = a.steps === 0 && e.usage
        return {
          ...a,
          status: e.reason === 'answer' ? 'done' : 'failed',
          endedAt: at,
          ...(fallback && e.usage
            ? {
                model: e.usage.model || a.model,
                tokens:
                  e.usage.input_tokens +
                  e.usage.output_tokens +
                  e.usage.cache_read_input_tokens +
                  e.usage.cache_creation_input_tokens,
                costUsd: costOf(e.usage.model || a.model, e.usage),
              }
            : {}),
        }
      }),
    )
    await update($, now, () => at)
  }
}

// Hooks do painel de agentes (savvy-progress), chamados de dentro do register abaixo.
const registerAgentes = (on: Parameters<Register>[0]) => {
  on('command.run', { command: 'agents-info' }, async $ => {
    const isOpen = await togglePane($)
    return { text: isOpen ? tr().opened : tr().closed }
  })

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (started.deny !== undefined) return started

    const at = await $.clock.now()
    await update($, agents, list => {
      const round = 1 + list.filter(a => norm(a.description) === norm(e.description) && e.description).length
      const run: AgentRun = {
        id: started.agentId ?? e.tool_use_id,
        agentId: started.agentId,
        type: e.subagentType,
        description: e.description,
        model: started.model,
        status: 'running',
        startedAt: at,
        contextTokens: 0,
        contextMax: windowOf(started.model),
        tokens: 0,
        costUsd: 0,
        steps: 0,
        round,
      }
      return [...list.filter(a => a.id !== run.id), run].slice(-200)
    })
    await update($, now, () => at)
    return started
  })
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    try {
    const s = tr()
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const list = await read($, agents)
    const p: Panel = await read($, panel)
    const at = Math.max(await read($, now), ...list.map(a => a.startedAt), 0)

    const running = list.filter(a => a.status === 'running').reverse()
    const finished = list.filter(a => a.status !== 'running').reverse()
    const t = totals(list, at)

    const toggleCompact = (
      <Button
        key="compact"
        label={p.isCompact ? s.expand : s.collapse}
        plain
        onPress={() => update($, panel, prev => ({ ...prev, isCompact: !prev.isCompact }))}
      />
    )
    const toggleDone = (
      <Button
        key="done"
        label={`${p.isDoneCollapsed ? '▸' : '▾'} ${s.finished} · ${finished.length}`}
        plain
        onPress={() => update($, panel, prev => ({ ...prev, isDoneCollapsed: !prev.isDoneCollapsed }))}
      />
    )
    const isEmpty = list.length === 0
    const summary = `≈${fmtCost(t.cost)}, ${fmtTokens(t.tokens)} ${s.tokensWord}, ${fmtTime(t.time)}`

    if (e.surface === 'desktop' && 'Svg' in ui) {
      const { Svg } = ui
      const W = Math.max(240, Math.min(900, (e.props.bodyColumns || 40) * 8 - 8))
      const section = (key: string, text: string) => (
        <Text key={key} dimColor>
          {text}
        </Text>
      )

      if (p.isCompact) {
        return (
          <Box flexDirection="column" gap={1}>
            <Svg source={compactSvg(W, list, t)} alt={`${list.length} ${s.agentsCount}, ${summary}`} width={W} height={32} />
            {toggleCompact}
          </Box>
        )
      }
      return (
        <Box flexDirection="column">
          <Svg source={headerSvg(W, t)} alt={summary} width={W} height={HEADER_H} />
          {ritmo && <Text dimColor>{ritmoTexto()}</Text>}
          {toggleCompact}
          {isEmpty && <Text dimColor>{s.empty}</Text>}
          {running.length > 0 && section('h-run', `${s.running} · ${running.length}`)}
          {running.map(a => (
            <Svg key={a.id} source={agentSvg(W, a, at)} alt={`${a.description}: ${modelName(a.model)}, ${s.isRunning}`} width={W} height={66} />
          ))}
          {finished.length > 0 && toggleDone}
          {!p.isDoneCollapsed &&
            finished.map(a => (
              <Svg key={a.id} source={agentSvg(W, a, at)} alt={`${a.description}: ${modelName(a.model)}, ${s.isFinished}`} width={W} height={66} />
            ))}
        </Box>
      )
    }

    // Terminal: the same content in text rows.
    const cols = Math.max(24, e.props.bodyColumns || 40)
    const barW = Math.max(6, Math.min(20, cols - 34))
    const row = (a: AgentRun) => {
      const tier = tierOf(a.type)
      const color = colorOf(tier)
      const ctx = ctxOf(a)
      const progress = progressOf(a)
      const model = a.effort ? `${modelName(a.model)} · ${a.effort}` : modelName(a.model)
      const steps = a.stepTotal ? `${a.stepDone ?? 0}/${a.stepTotal}${a.stepNote ? ' ' + a.stepNote : ''} · ` : ''
      return (
        <Box key={a.id} flexDirection="column" marginBottom={1}>
          <Box flexDirection="row" gap={1}>
            <Text color={color}>▣</Text>
            <Text bold wrap="truncate-end">
              {a.description || a.type}
            </Text>
            <Text color={a.status === 'failed' ? 'red' : a.status === 'done' ? 'green' : color}>{STATUS_GLYPH[a.status]}</Text>
          </Box>
          <Text dimColor wrap="truncate-end">
            {'  '}
            {tier === 'other' ? a.type : tier} · {model}
            {a.round > 1 ? ` · ${s.round} ${a.round}` : ''}
          </Text>
          <Text wrap="truncate-end">
            {'  '}
            {progress === null ? <Text dimColor>{ctxBar(ctx, barW)}</Text> : <Text color={color}>{ctxBar(progress * 100, barW)}</Text>}
            <Text dimColor>
              {' '}
              {steps}ctx {ctx}% · {fmtTokens(a.contextTokens)} ≈{fmtCost(a.costUsd)} {fmtTime(elapsed(a, at))}
            </Text>
          </Text>
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between">
          <Text dimColor wrap="truncate-end">
            ≈{fmtCost(t.cost)} · {fmtTokens(t.tokens)} {s.tokensWord} · {fmtTime(t.time)}
          </Text>
          {toggleCompact}
        </Box>
        {ritmo && <Text dimColor>{ritmoTexto()}</Text>}
        {p.isCompact ? (
          <Text wrap="truncate-end">
            {[...running, ...finished].map(a => (
              <Text key={a.id} color={colorOf(tierOf(a.type))}>
                {STATUS_GLYPH[a.status]}{' '}
              </Text>
            ))}
          </Text>
        ) : (
          <Box flexDirection="column" marginTop={1}>
            {isEmpty && <Text dimColor>{s.empty}</Text>}
            {running.length > 0 && <Text dimColor>{s.running} · {running.length}</Text>}
            {running.map(row)}
            {finished.length > 0 && toggleDone}
            {!p.isDoneCollapsed && finished.map(row)}
          </Box>
        )}
      </Box>
    )
    } catch (err) {
      // Mostra o erro no próprio painel em vez de deixá-lo vazio ("has not drawn")
      const { Text } = $.ui.resolve(e)
      return <Text color="red">painel de agentes falhou: {String((err as Error)?.stack ?? err).slice(0, 600)}</Text>
    }
  })
}


// ---- Segundo plano: comando, monitor, workflow e agendamento que seguem rodando com o Clawd parado ----
type Fundo = { ids: string[]; tipo: string; desc: string; ate?: number }
let fundo: Fundo[] = []
const FUNDO_TIPO: Record<string, string> = { Bash: 'comando', PowerShell: 'comando', Monitor: 'monitor', Workflow: 'workflow', CronCreate: 'agendado', ScheduleWakeup: 'agendado' }

function textoDe(x: unknown): string {
  try { return typeof x === 'string' ? x : JSON.stringify(x) ?? '' } catch { return '' }
}

// Chamado depois que a ferramenta respondeu: anota o que ficou rodando
function anotarFundo(e: Record<string, any>, r: unknown, agora: number) {
  const tipo = FUNDO_TIPO[e.tool]
  if (e.tool === 'TaskStop' || e.tool === 'CronDelete') {
    const alvo = String(e.task_id ?? e.shell_id ?? e.id ?? '')
    fundo = fundo.filter((f) => !f.ids.includes(alvo))
    return
  }
  if (!tipo) return
  if ((e.tool === 'Bash' || e.tool === 'PowerShell') && !e.run_in_background) return
  if (e.tool === 'ScheduleWakeup' && e.stop) { fundo = fundo.filter((f) => f.tipo !== 'agendado' || f.ate === undefined); return }
  const txt = textoDe((r as { text?: unknown })?.text ?? (r as { result?: unknown })?.result)
  if ((r as { isError?: boolean })?.isError || (r as { deny?: string })?.deny) return
  const ids = [e.tool_use_id, ...[...txt.matchAll(/\b(?:ID|id|task_id|taskId|job_id)["':\s]+([A-Za-z0-9_-]{4,})/g)].map((m) => m[1])].filter(Boolean)
  const desc = String(e.description ?? e.name ?? e.reason ?? e.prompt ?? e.command ?? tipo).replace(/\s+/g, ' ').slice(0, 60)
  const ate = e.tool === 'ScheduleWakeup' ? agora + (Number(e.delaySeconds) || 60) * 1000 + 60_000 : undefined
  fundo.push({ ids, tipo, desc, ate })
}

// Aviso de tarefa terminada entra na conversa como <task-notification>: tira ela da lista
function baixarFundo(msg: unknown) {
  const txt = textoDe(msg)
  if (!txt.includes('task-notification')) return false
  const st = /<status>\s*([a-z_]+)/.exec(txt)?.[1]
  if (st && !['completed', 'failed', 'killed', 'stopped', 'error', 'cancelled'].includes(st)) return false
  const ids = [...txt.matchAll(/<(?:task-id|tool-use-id|task_id|tool_use_id)>\s*([^<\s]+)/g)].map((m) => m[1])
  const antes = fundo.length
  fundo = fundo.filter((f) => !f.ids.some((i) => ids.includes(i)))
  return fundo.length !== antes
}

function fundoAtivo(agora: number) {
  fundo = fundo.filter((f) => f.ate === undefined || f.ate > agora)
  return fundo
}

const LIMITE = 70

const contexto = atom({ plugin: 'painel-cezar', key: 'contexto' }, 0)
const avisou70 = atom({ plugin: 'painel-cezar', key: 'avisou70' }, false)



// Shows context, the rate-limit windows the account reports (only the week on Ultra) and the pace in the band above the prompt.

// The latest figures this session has, from $.session.usage() or session.measure
let context: SessionContextUsage | null = null
let rateLimits: SessionRateLimit[] = []
// When rateLimits was last measured, in $.clock.now() milliseconds
let measuredAt = 0
// The timer that refreshes the band, kept so a later session.start can stop it
let ticker: Timer | null = null
// This session's own key in the store
let ownKey: string | null = null
// Quando começou a última chamada ao modelo da conversa principal: o cache conta a partir dela
// (a documentação da Anthropic conta do início do pedido, não do fim da resposta)
let ultimaResposta = 0
// A chamada anterior ({ comecou, modelo, lido, gravado, novo }), para ver se o cache esfriou
type Chamada = { comecou: number; modelo: string; lido: number; gravado: number; novo: number }
let chamadaAnterior: Chamada | null = null
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
// Elementos de desenho: a tabela do engine não declara key em Text, que as caixas e o resto aceitam
type Els = Omit<ElementTable<'desktop'>, 'Text'> & {
  Text: (props: Parameters<ElementTable<'desktop'>['Text']>[0] & { key?: string }) => ReturnType<ElementTable<'desktop'>['Text']>
}
const WINDOWS: Record<string, { label: string; ms?: number; showsClock?: boolean; semRotulo?: boolean }> = {
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
// Pílulas do desktop: cada uma um SVG, para a linha quebrar sozinha em janela estreita.
// Técnica modelada em dois pins: cluster de pílulas sem borda (pin 350577152266479159) e cápsulas
// com brilho, a célula atual contornada (pin 945967096751896278). Altura de uma linha só.
const PILULA_ALTURA = 24
const CELULAS = 14
const BARRAS_RITMO = 12
const PILULA_FONTE = "'Segoe UI',system-ui,-apple-system,sans-serif"
const PILULA_CSS = `<style>
.fd{fill:#E9E7E1}.tx{fill:#2B2A27}.mu{fill:#6F6C65}.vz{fill:#000;fill-opacity:.11}.success{fill:#2F8F5B}.warning{fill:#B07C1E}.error{fill:#CF4A40}.none{fill:#6F6C65}
.a-vz{stroke:#000;stroke-opacity:.11}.a-tx{stroke:#2B2A27}.a-mu{stroke:#6F6C65}.a-success{stroke:#2F8F5B}.a-warning{stroke:#B07C1E}.a-error{stroke:#CF4A40}
@media (prefers-color-scheme: dark){.fd{fill:#2D2C2A}.tx{fill:#ECEAE3}.mu{fill:#8F8C83}.vz{fill:#fff}.success{fill:#8CC29A}.warning{fill:#E3B566}.error{fill:#E8776C}.none{fill:#8F8C83}
.a-vz{stroke:#fff}.a-tx{stroke:#ECEAE3}.a-mu{stroke:#8F8C83}.a-success{stroke:#8CC29A}.a-warning{stroke:#E3B566}.a-error{stroke:#E8776C}}
</style>`
// The terminal draws the time marker in this color
const MARKER_COLOR = 'cyan'

export function register(on: Parameters<Register>[0], options: PluginOptions) {
  registerAgentes(on)
  // ---- Clawd e relógio ----
  let relogio: Timer | undefined
  let quadros: Timer | undefined

  on('session.start', async ($, e, next) => {
    await inicio($)
    await agentesInicio($, options)
    relogio?.cancel()
    relogio = $.clock.every(60000, () => $.ui.invalidate('ui.render'))
    quadros?.cancel()
    quadros = $.clock.every(CLAWD_QUADRO_MS, () => passarQuadroClawd($))
    return next(e)
  })


  // O Clawd: pergunta com opções deixa ele em pânico até a resposta;
  // ferramenta que pediu permissão volta a "trabalhando" quando a resposta sai
  on('tool.call', async ($, e, next) => {
    if (e.tool === 'AskUserQuestion' || e.tool === 'ExitPlanMode') mudarClawd($, 'panico')
    try {
      const r = await next(e)
      try {
        const antes = fundo.length
        anotarFundo(e as Record<string, any>, r, await $.clock.now())
        if (fundo.length !== antes) $.ui.invalidate('ui.render')
      } catch {}
      return r
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
    if (!(e as { agentId?: string }).agentId) mudarClawd($, 'trabalhando')
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    await agentesFimTurno($, e)
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
    return r
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


  // Tarefa em segundo plano terminou: o aviso entra como linha da conversa
  on('session.append', async ($, e, next) => {
    try {
      if (!e.agentId && baixarFundo(e.message)) $.ui.invalidate('ui.render')
    } catch {}
    return next(e)
  })

  // Clique no Clawd da faixa: abre o painel de agentes
  on('ui.message', async ($, e, next) => {
    if (e.element === 'clawd') {
      void $.ui.open({ id: 'agentes-cezar', title: 'Agentes' })
      return {}
    }
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    context = e.context
    // A fresh measurement, including an empty one when the account's windows went away
    if (e.changed.includes('rateLimits')) await remember($, e.rateLimits)
    await atualizarRitmo($).catch(() => {})
    $.ui.invalidate('ui.render')
    return next(e)
  })

  // Cada chamada ao modelo da conversa principal: renova o cache e diz se ele tinha esfriado
  // (ideia do prompt-cache-control, de davila7/claude-code-templates)
  on('turn.step', async function* ($, e, next) {
    if (e.agentId) {
      const r = yield* next(e)
      await agentesUso($, e, r)
      return r
    }
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
    const elements = $.ui.resolve(e) as Els
    const now = await $.clock.now()
    const meters: Meter[] = [{ label: 'ctx', used: context?.percent, elapsed: null, resetsAt: null }]
    for (const limit of rateLimits) {
      meters.push(readLimit(limit, now))
    }
    for (const m of meters) {
      m.value = valueText(m, e.surface)
      m.reset = resetText(m, now)
    }
    const ritmoPill = ritmoMeter(elements, e.surface)
    const cachePill = cacheMeter(elements, e.surface, now)
    const subRodando = (await read($, agents)).some((a) => a.status === 'running')
    const clawdAgora = clawdSvgAgora(subRodando)
    const gauge = e.surface !== 'terminal' ? 'svg' : barsFit(meters, e.props.bodyColumns ?? 0) ? 'text' : 'none'

    const line = elements.Box({
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: e.surface !== 'terminal' ? 1 : METER_GAP,
      rowGap: e.surface !== 'terminal' ? 1 : 0,
      children: [
        ...meters.map((m) => meter(elements, gauge, m)),
        ...(ritmoPill ? [ritmoPill] : []),
        ...(cachePill ? [cachePill] : []),
        ...(() => {
          const ativos = fundoAtivo(now)
          if (!ativos.length) return []
          return [
            elements.Button({
              key: 'fundo',
              label: '⚙ ' + ativos.length,
              onPress: () => $.ui.toast('Em segundo plano: ' + ativos.map((f) => f.tipo + ' · ' + f.desc).join(' | ')),
            }),
          ]
        })(),
        e.surface === 'terminal'
          ? elements.Button({ key: 'agentes', label: 'sub', onPress: () => void $.ui.open({ id: 'agentes-cezar', title: 'Agentes' }) })
          : elements.Box({
              key: 'clawd',
              position: 'relative',
              children: [
                elements.Svg({
                  source: clawdAgora.source,
                  alt: clawdAgora.alt,
                  width: CLAWD_LARGURA,
                  height: clawdAgora.altura,
                }),
                elements.Box({ key: 'clawd-clique', position: 'absolute', top: 0, left: 0, children: [elements.Client({ key: 'clawd', module: './clawd.jsx', width: 3, height: 1 })] }),
              ],
            }),
        elements.Button({
          key: 'compactar',
          label: '📦',
          onPress: () => {
            $.ui.toast('Compactando…')
            compactar($)
          },
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

async function remember($: EngineInterface, limits: SessionRateLimit[]) {
  // Take the time first, so a refresh that runs meanwhile can't pair old limits with it
  const now = await $.clock.now()
  rateLimits = limits
  measuredAt = now
  await $.store.set(ownKey as string, { at: now, limits })
}

// Takes the newest reading any session saved, unless this session's own is newer still, and
// deletes the keys no session needs: ended sessions' older readings, and any reading too old
async function refresh($: EngineInterface) {
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
async function releaseKey($: EngineInterface) {
  const { entries, newest } = await scan($)
  if (newest?.key === ownKey) await $.store.set(ownKey as string, { ...newest.reading, ended: true })
  else await $.store.delete(ownKey as string)
  await prune($, entries, newest?.key)
}

async function prune($: EngineInterface, entries: Entry[], newestKey: string | undefined) {
  const cutoff = (await $.clock.now()) - STALE_MS
  for (const { key, reading } of entries) {
    if (key === ownKey || key === newestKey) continue
    if (!isReading(reading) || reading.ended === true || reading.at < cutoff) await $.store.delete(key)
  }
}

// usage() at startup may answer this session's last reading, which can be older than the shared
// one in ways a merge can't tell apart (a window that went away, a spend limit that went down),
// so a shared reading always wins and the snapshot is saved only when there is none
async function publishSnapshot($: EngineInterface, snapshot: SessionRateLimit[]) {
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
async function scan($: EngineInterface) {
  const entries: Entry[] = []
  let newest: { key: string; reading: Reading } | null = null
  const cutoff = (await $.clock.now()) - STALE_MS
  const conta = contaDe(rateLimits)
  for (const key of await $.store.keys()) {
    if (!key.startsWith(KEY_PREFIX)) continue
    const reading = await $.store.get(key)
    entries.push({ key, reading })
    if (!isReading(reading) || reading.at < cutoff) continue
    // Só leitura da mesma conta: o CLI e o desktop podem estar em contas diferentes, e a leitura de
    // uma sessão de outra conta mostrava o limite errado
    if (key !== ownKey && (conta == null || contaDe(reading.limits) !== conta)) continue
    if (!newest || reading.at > newest.reading.at || (reading.at === newest.reading.at && key > newest.key)) {
      newest = { key, reading }
    }
  }
  return { entries, newest }
}

type Reading = { at: number; limits: SessionRateLimit[]; ended?: boolean }
type Entry = { key: string; reading: unknown }
function isReading(value: unknown): value is Reading {
  const r = value as Partial<Reading> | null
  return r != null && typeof r.at === 'number' && Array.isArray(r.limits)
}

type Meter = { label: string; semRotulo?: boolean; used?: number; elapsed: number | null; resetsAt?: number | null; showsClock?: boolean; value?: string; reset?: string; fecha?: number | null; ehSemana?: boolean }
function readLimit(limit: SessionRateLimit, now: number): Meter {
  const window = WINDOWS[limit.kind]
  const label = window?.label ?? limit.kind
  const resetsAtMs = limit.resetsAt == null ? null : Date.parse(limit.resetsAt)
  // A window that has reset since the last reading starts again from zero
  if (resetsAtMs != null && resetsAtMs <= now) {
    return { label, semRotulo: window?.semRotulo === true, used: 0, elapsed: window?.ms ? 0 : null, resetsAt: null }
  }
  let elapsed = window?.ms && resetsAtMs != null ? clamp(100 - ((resetsAtMs - now) / window.ms) * 100) : null
  // A semana anda em horas úteis, como a meta; a cor sai de onde ela vai fechar
  const ehSemana = limit.kind === 'seven_day' && resetsAtMs != null
  if (ehSemana) {
    const feitas = horasUteis(resetsAtMs - SEMANA_MS, now)
    elapsed = clamp((feitas / (feitas + horasUteis(now, resetsAtMs))) * 100)
  }
  return { label, semRotulo: window?.semRotulo === true, used: limit.percentUsed, elapsed, resetsAt: resetsAtMs, showsClock: window?.showsClock === true, fecha: ehSemana ? ritmo?.fecha : null, ehSemana }
}

// Green, yellow or red by how far usage runs ahead of the time gone in its window
type Status = 'success' | 'warning' | 'error'
function statusOf(used: number, elapsed: number | null): Status {
  if (used >= RED_MIN_USED) return 'error'
  if (elapsed == null) return used >= 80 ? 'error' : used >= 50 ? 'warning' : 'success'
  const margin = elapsed - used
  if (margin < RED_BELOW_MARGIN) return 'error'
  if (margin < GREEN_MIN_MARGIN && used >= GREEN_MAX_USED) return 'warning'
  return 'success'
}

function valueText({ used, fecha }: Meter, surface: string): string {
  if (typeof used !== 'number') return '—'
  // No desktop a pílula da semana desenha a previsão à parte, em outra cor
  return Math.round(used) + '%' + (fecha == null || surface !== 'terminal' ? '' : ' → ' + Math.round(fecha) + '%')
}

function resetText({ resetsAt, showsClock }: Meter, now: number): string {
  if (resetsAt == null) return ''
  const falta = resetsAt - now
  if (showsClock && falta < 20 * HOUR_MS) return jstClock(resetsAt)
  return untilReset(falta)
}

// Whether every meter fits on one line with its text bar; every character drawn is one cell wide
function barsFit(meters: Meter[], columns: number): boolean {
  const width = meters.reduce((sum, m) => sum + (m.semRotulo ? 0 : [...m.label].length + 1) + BAR_CELLS + 1 + [...m.value!].length + (m.reset ? 1 + [...m.reset].length : 0), 0)
  return width + METER_GAP * (meters.length - 1) <= columns - BAND_RESERVED_COLUMNS
}

function meter(els: Els, gauge: string, { label, semRotulo, used, elapsed, value, reset, fecha, ehSemana }: Meter) {
  const { Box, Text } = els
  const known = typeof used === 'number'
  const status = known ? (fecha == null ? statusOf(used, elapsed) : statusDoFechamento(fecha)) : null
  const style = known ? { color: status as Status, bold: true } : { dimColor: true }

  if (gauge === 'svg') {
    const p = ehSemana ? pilulaSemana(known ? used : 0, elapsed, status, fecha, reset ?? '') : pilulaAnel(label, known ? used : 0, status, value as string, reset ?? '')
    return desenharPilula(els, 'meter-' + label, p)
  }

  const children = semRotulo ? [] : [Text({ dimColor: true, children: [label] })]
  if (gauge === 'text') children.push(...textBar(Text, known ? used : 0, elapsed, status))
  children.push(Text({ ...style, children: [value as string] }))
  if (reset) children.push(Text({ dimColor: true, children: [reset] }))
  return Box({ key: 'meter-' + label, flexDirection: 'row', columnGap: 1, alignItems: 'center', children })
}

// The bar as runs of cells: used cells in the status color, the rest dim, and the time marker
function textBar(Text: Els['Text'], used: number, elapsed: number | null, status: Status | null) {
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
  const runs: { text: string; style: { color?: string; bold?: boolean; dimColor?: boolean } }[] = []
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
function horaRondonia(ms: number): string {
  const d = new Date(ms - 4 * HOUR_MS)
  const h = d.getUTCHours()
  const dois = (n: number) => String(n).padStart(2, '0')
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
function mudarClawd($: EngineInterface, estado: string) {
  if (clawdEstado === estado) return
  clawdEstado = estado
  $.ui.invalidate('ui.render')
}
// Chamado pelo relógio da faixa: só redesenha quando o quadro do Clawd muda de fato
function passarQuadroClawd($: EngineInterface) {
  clawdQuadro++
  const piscando = clawdQuadro % CLAWD_PISCA_A_CADA < 2
  if (clawdEstado === 'panico' || (clawdEstado === 'vez' && piscando)) $.ui.invalidate('ui.render')
}
function clawdPixels(art: string[], cor: string, dy: number, dx: number): string {
  let r = ''
  art.forEach((linha, y) => [...linha].forEach((c, x) => {
    if (c === '#') r += `<rect x="${x * 2 + dx}" y="${y * 2 + dy}" width="2" height="2" fill="${cor}"/>`
  }))
  return r
}
function clawdOlhos(dy: number, dx: number, estilo: string, cor?: string): string {
  return [3, 8].map((x) => {
    const X = x * 2 + dx, Y = 2 + dy
    if (estilo === 'panico') return `<rect x="${X - 1}" y="${Y - 1}" width="4" height="4" fill="#FFFFFF"/><rect x="${X}" y="${Y}" width="2" height="2" fill="#000000"/>`
    if (estilo === 'fechado') return `<rect x="${X}" y="${Y + 1}" width="2" height="1" fill="#000000"/>`
    return `<rect x="${X}" y="${Y}" width="2" height="2" fill="#000000"/>`
  }).join('')
}
const CLAWD_CORPO = ['..########..', '..########..', '############', '############', '..########..', '..########..']
const CLAWD_PERNAS_A = ['', '', '', '', '', '', '..#.#..#.#..', '..#.#..#.#..']
const CLAWD_PANICO_CORPO = ['...........#', '..########.#', '..##########', '############', '############', '..########..', '..########..', '..#.#..#.#..', '..#.#..#.#..']
const clawdCache: Record<string, string> = {}
// Trabalhando (eu ou qualquer subagente): o mesmo Clawd andando do painel de agentes,
// animado por CSS dentro do SVG, sem redesenhar a faixa
const CLAWD_TRABALHANDO_ALTURA = 18
function clawdSvgAgora(subRodando: boolean) {
  const q = clawdQuadro
  let chave, altura, miolo, alt
  if (clawdEstado === 'panico') {
    // Treme 1 px para os lados; o "!" pisca. Corpo encostado no chão, mão em y 10, "!" acima dela.
    const dx = [0, 1, 2, 1][q % 4] as number
    const aceso = q % 2 === 0
    chave = 'p' + dx + aceso
    altura = CLAWD_PANICO_ALTURA
    alt = 'precisa de você'
    const dy = altura - CLAWD_PANICO_CORPO.length * 2
    miolo = clawdPixels(CLAWD_PANICO_CORPO, '#E24B4A', dy, dx) + clawdOlhos(dy + 2, dx, 'panico') +
      `<g fill="#FFD60A" opacity="${aceso ? 1 : 0.3}"><rect x="${22 + dx}" y="0" width="2" height="4"/><rect x="${22 + dx}" y="6" width="2" height="2"/></g>`
  } else if (clawdEstado === 'trabalhando' || subRodando) {
    chave = 't'
    altura = CLAWD_TRABALHANDO_ALTURA
    alt = 'trabalhando'
    clawdCache[chave] ??= `<svg xmlns="http://www.w3.org/2000/svg" width="${CLAWD_LARGURA}" height="${altura}" viewBox="2 9 26 ${altura}">${CRAB_CSS}${crab(0, 0, 'other', false, true, 1)}</svg>`
    return { source: clawdCache[chave] as string, altura, alt }
  } else {
    const piscando = q % CLAWD_PISCA_A_CADA === 0
    chave = 'n' + piscando
    altura = 16
    alt = 'sua vez'
    miolo = clawdPixels(CLAWD_CORPO, '#DA7758', 0, 1) + clawdPixels(CLAWD_PERNAS_A, '#DA7758', 0, 1) +
      clawdOlhos(0, 1, piscando ? 'fechado' : 'aberto')
  }
  clawdCache[chave] ??= `<svg xmlns="http://www.w3.org/2000/svg" width="${CLAWD_LARGURA}" height="${altura}" viewBox="0 0 ${CLAWD_LARGURA} ${altura}" shape-rendering="crispEdges">${miolo}</svg>`
  return { source: clawdCache[chave] as string, altura, alt }
}

type Pilula = { source: string; width: number; height: number; alt: string }

function pilula(largura: number, miolo: string, alt: string): Pilula {
  const width = Math.ceil(largura)
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${PILULA_ALTURA}" viewBox="0 0 ${width} ${PILULA_ALTURA}">${PILULA_CSS}<rect class="fd" width="${width}" height="${PILULA_ALTURA}" rx="${PILULA_ALTURA / 2}"/>${miolo}</svg>`
  return { source, width, height: PILULA_ALTURA, alt }
}

const textoPilula = (x: number, partes: string) =>
  `<text x="${x}" y="16" font-family="${PILULA_FONTE}" font-size="11.5" style="font-variant-numeric:tabular-nums">${partes}</text>`
const trecho = (texto: string, cls: string, dx = 0, peso = 400) =>
  `<tspan class="${cls}"${dx ? ` dx="${dx}"` : ''}${peso !== 400 ? ` font-weight="${peso}"` : ''}>${xml(texto)}</tspan>`

// Contexto e qualquer janela que não seja a semana: anel, rótulo e número
function pilulaAnel(label: string, used: number, status: Status | null, value: string, reset: string): Pilula {
  const r = 5
  const volta = 2 * Math.PI * r
  const anel = `<circle cx="16" cy="12" r="${r}" fill="none" class="a-vz" stroke-width="2.4"/><circle cx="16" cy="12" r="${r}" fill="none" class="a-${status === 'success' || !status ? 'tx' : status}" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="${((clamp(used) / 100) * volta).toFixed(1)} ${volta.toFixed(1)}" transform="rotate(-90 16 12)"/>`
  const largura = 26 + textWidth(label, 11.5) + 5 + textWidth(value, 12) + (reset ? 6 + textWidth(reset, 11.5) : 0) + 11
  const texto = trecho(label, 'mu') + trecho(value, status && status !== 'success' ? status : 'tx', 5, 600) + (reset ? trecho(reset, 'mu', 6) : '')
  return pilula(largura, anel + textoPilula(26, texto), [label, value, reset].filter(Boolean).join(' '))
}

// A semana: cápsulas cheias com brilho, a previsão mais apagada e a célula do tempo contornada
function pilulaSemana(used: number, elapsed: number | null, status: Status | null, fecha: number | null | undefined, reset: string): Pilula {
  const passo = 6
  const cor = status ?? 'none'
  const cheias = Math.round((clamp(used) / 100) * CELULAS)
  const previstas = fecha == null ? cheias : Math.round((clamp(fecha) / 100) * CELULAS)
  const celula = (i: number, cls: string, resto = '') => `<rect class="${cls}" x="${10 + i * passo}" y="6" width="4" height="12" rx="2"${resto}/>`
  let brilho = ''
  let celulas = ''
  for (let i = 0; i < CELULAS; i++) {
    if (i < cheias) brilho += celula(i, cor)
    celulas += i < cheias ? celula(i, cor) : i < previstas ? celula(i, cor, ' fill-opacity=".42"') : celula(i, 'vz')
  }
  const marca = elapsed == null ? '' : `<rect class="a-tx" x="${8.5 + Math.min(CELULAS - 1, Math.floor((elapsed / 100) * CELULAS)) * passo}" y="3.5" width="7" height="17" rx="3" fill="none" stroke-opacity=".85"/>`
  const usado = Math.round(used) + '%'
  const previsao = fecha == null ? '' : '→ ' + Math.round(fecha) + '%'
  const x = 10 + CELULAS * passo + 6
  const largura = x + textWidth(usado, 12) + (previsao ? 5 + textWidth(previsao, 11.5) : 0) + (reset ? 6 + textWidth(reset, 11.5) : 0) + 11
  const texto = trecho(usado, 'tx', 0, 600) + (previsao ? trecho(previsao, cor, 5) : '') + (reset ? trecho(reset, 'mu', 6) : '')
  const defs = `<defs><filter id="b" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="1.6"/></filter></defs>`
  return pilula(largura, `${defs}<g filter="url(#b)" opacity=".5">${brilho}</g>${celulas}${marca}${textoPilula(x, texto)}`, [`semana ${usado}`, previsao, reset].filter(Boolean).join(' '))
}

// O ritmo: gasto de cada 5 minutos da última hora, a palavra e os números
function pilulaRitmo(r: Ritmo): Pilula {
  const maior = Math.max(...r.barras, 0.01)
  const cor = r.status ?? 'none'
  const barras = r.barras
    .map((usd, i) => {
      const h = usd > 0 ? Math.max(2, (usd / maior) * 12) : 1.5
      const ultima = i === r.barras.length - 1
      return `<rect class="${ultima ? cor : 'vz'}" x="${10 + i * 3}" y="${18 - h}" width="2" height="${h.toFixed(1)}" rx="1"${ultima || usd === 0 ? '' : ' style="fill-opacity:.32"'}/>`
    })
    .join('')
  const numeros = r.fala === 'parado' ? 'meta ' + numero(r.meta) + ' %/h' : r.fala === 'esgotou' ? '' : numero(r.agora) + '/' + numero(r.meta) + ' %/h'
  const x = 10 + BARRAS_RITMO * 3 + 5
  const largura = x + textWidth(r.fala, 12) + (numeros ? 6 + textWidth(numeros, 11.5) : 0) + 11
  return pilula(largura, barras + textoPilula(x, trecho(r.fala, cor, 0, 600) + (numeros ? trecho(numeros, 'mu', 6) : '')), `ritmo ${r.fala} ${numeros}`)
}

function pilulaCache(texto: string, status: Status): Pilula {
  const relogio = `<circle cx="14" cy="12" r="4.5" fill="none" class="a-mu" stroke-width="1.2"/><path d="M14 9.5v2.5l1.7 1.2" fill="none" class="a-mu" stroke-width="1.2" stroke-linecap="round"/>`
  return pilula(23 + textWidth(texto, 12) + 11, relogio + textoPilula(23, trecho(texto, status === 'success' ? 'tx' : status, 0, 500)), `cache ${texto}`)
}

// Toda pílula vai numa caixa com key: é a caixa que entra na linha que quebra
function desenharPilula({ Box, Svg }: Els, key: string, p: Pilula) {
  return Box({ key, flexShrink: 0, children: [Svg({ source: p.source, alt: p.alt, width: p.width, height: p.height })] })
}

function clamp(percent: number): number {
  return Math.min(Math.max(percent, 0), 100)
}

// The time of day as HH:MM, 24-hour, in JST
function jstClock(ms: number): string {
  const jst = new Date(ms + JST_OFFSET_MS)
  return String(jst.getUTCHours()).padStart(2, '0') + 'h' + String(jst.getUTCMinutes()).padStart(2, '0')
}

function untilReset(ms: number): string {
  const minutes = Math.max(0, Math.ceil(ms / 60_000))
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  if (days > 0) return days + 'd' + hours + 'h'
  if (hours > 0) return hours + 'h' + String(minutes % 60).padStart(2, '0')
  return (minutes % 60) + 'm'
}

// ---- Ritmo da semana ----
// O app só dá a semana em ponto inteiro, e 1 ponto leva uns US$ 23,5 de gasto: esperar o ponto subir
// não mostra o momento. O ritmo vem do gasto em dólar de todas as sessões da conta, convertido pelo
// câmbio USD_POR_PONTO (medido em 30/10/2026 em cinco trechos, de 23,3 a 24,2, e igual antes e depois
// de virar Ultra). Cada 4 pontos recalibram o câmbio, que se ajusta sozinho se o plano mudar.
const GASTO_PREFIX = 'gasto:'
const MARCOS_PREFIX = 'marcos:'
const CAMBIO_PREFIX = 'usdPorPonto:'
const BALDE_MS = 5 * 60_000
const JANELA_AGORA_MS = 60 * 60_000
// Cada sessão guarda só estas horas de gasto, e o câmbio só mede dentro delas
const HORIZONTE_MS = 6 * HOUR_MS
const PONTOS_POR_MEDIDA = 4
const PESO_MEDIDA = 0.3
const SEMANA_MS = 7 * 24 * HOUR_MS
// Seis semanas de gasto (set–out/2026): 98% fica entre 7h e 23h de Rondônia, e sábado e domingo rendem
// 40% e 20% de um dia de semana. A meta conta só essas horas, com esse peso; janela de 1h e faixas
// abaixo simuladas nessa base: troca de faixa só uma vez a cada 2 horas de trabalho.
const UTIL_INICIO = 7
const UTIL_FIM = 23
const PESO_DIA = [0.2, 1, 1, 1, 1, 1, 0.4] // domingo a sábado
// Abaixo destas horas úteis a média da semana ainda não diz nada
const MIN_HORAS_PREVISAO = 8
// Agora ÷ meta: entre as duas faixas é "no ritmo"
const FAIXA_POUCO = 0.6
const FAIXA_MUITO = 1.6
// Fechar a semana abaixo disto é deixar cota sobrando
const FECHA_BOM = 85

type Gasto = { conta: number; baldes: Record<string, number> }
type Marco = { at: number; pct: number }
type Ritmo = { agora: number; usdHora: number; meta: number; horas: number; fecha: number | null; fechaAgora: number; fala: string; status: Status | null; barras: number[] }

let ritmo: Ritmo | null = null
// O total da sessão na última olhada; null até a primeira, que só marca o ponto de partida
let ultimoUsd: number | null = null
let gastoProprio: Gasto | null = null
let gastoChave: string | null = null

// Horas úteis entre dois instantes
function horasUteis(de: number, ate: number): number {
  const DIA = 24 * HOUR_MS
  let dia = Math.floor((de + JST_OFFSET_MS) / DIA) * DIA - JST_OFFSET_MS
  let soma = 0
  for (; dia < ate; dia += DIA) {
    const a = Math.max(de, dia + UTIL_INICIO * HOUR_MS)
    const b = Math.min(ate, dia + UTIL_FIM * HOUR_MS)
    if (b > a) soma += (b - a) * (PESO_DIA[new Date(dia + JST_OFFSET_MS).getUTCDay()] ?? 1)
  }
  return soma / HOUR_MS
}

// O engine não informa a conta, mas cada uma vira a semana num horário próprio: esse horário,
// reduzido à semana, é o mesmo toda semana e separa as contas
function contaDe(limits: SessionRateLimit[]): number | null {
  const semana = limits.find((l) => l.kind === 'seven_day')
  if (!semana?.resetsAt) return null
  return Math.round(Date.parse(semana.resetsAt) / 60_000) % (SEMANA_MS / 60_000)
}

function calcularRitmo(used: number, resetsAt: number, agoraMs: number, usdJanela: number, janelaMs: number, usdPonto: number, barras: number[]): Ritmo {
  const horas = horasUteis(agoraMs, resetsAt)
  const feitas = horasUteis(resetsAt - SEMANA_MS, agoraMs)
  const usdHora = usdJanela / (janelaMs / HOUR_MS)
  const agora = usdHora / usdPonto
  const resta = Math.max(0, 100 - used)
  const meta = resta / Math.max(horas, 0.5)
  const fecha = feitas >= MIN_HORAS_PREVISAO ? used + (used / feitas) * horas : null
  const fechaAgora = used + agora * horas
  const base = { agora, usdHora, meta, horas, fecha, fechaAgora, barras }
  if (resta === 0) return { ...base, fala: 'esgotou', status: 'error' }
  if (usdJanela === 0) return { ...base, fala: 'parado', status: null }
  const vezes = agora / meta
  if (vezes < FAIXA_POUCO) return { ...base, fala: 'pouco', status: 'warning' }
  if (vezes > FAIXA_MUITO) return { ...base, fala: 'muito', status: 'error' }
  return { ...base, fala: 'no ritmo', status: 'success' }
}

function statusDoFechamento(fecha: number): Status {
  return fecha > 100 ? 'error' : fecha >= FECHA_BOM ? 'success' : 'warning'
}

function somaBaldes(gastos: Gasto[], de: number, ate: number): number {
  let soma = 0
  for (const { baldes } of gastos) {
    for (const [balde, usd] of Object.entries(baldes)) {
      const t = Number(balde) * BALDE_MS
      if (t >= de && t <= ate) soma += usd
    }
  }
  return soma
}

// Soma ao balde desta sessão o que ela gastou desde a última olhada, subagentes inclusive
async function anotarGasto($: EngineInterface, conta: number | null, agoraMs: number) {
  const usd = (await $.session.usage()).cost?.usd
  if (typeof usd !== 'number') return
  if (ultimoUsd == null) ultimoUsd = usd
  if (conta == null || !ownKey) return
  const delta = usd >= ultimoUsd ? usd - ultimoUsd : usd
  ultimoUsd = usd
  if (delta <= 0) return
  const chave = GASTO_PREFIX + ownKey.slice(KEY_PREFIX.length)
  if (chave !== gastoChave) {
    gastoChave = chave
    gastoProprio = ((await $.store.get(chave)) as Gasto | undefined) ?? null
  }
  const corte = Math.floor((agoraMs - HORIZONTE_MS) / BALDE_MS)
  const baldes = Object.fromEntries(Object.entries(gastoProprio?.baldes ?? {}).filter(([b]) => Number(b) >= corte))
  const balde = String(Math.floor(agoraMs / BALDE_MS))
  baldes[balde] = (baldes[balde] ?? 0) + delta
  gastoProprio = { conta, baldes }
  await $.store.set(chave, gastoProprio)
}

// O gasto recente de todas as sessões da conta; apaga o de sessão parada há mais que o horizonte
async function lerGastos($: EngineInterface, conta: number, agoraMs: number): Promise<Gasto[]> {
  const corte = (agoraMs - HORIZONTE_MS) / BALDE_MS
  const gastos: Gasto[] = []
  for (const key of await $.store.keys()) {
    if (!key.startsWith(GASTO_PREFIX)) continue
    const g = (await $.store.get(key)) as Gasto | undefined
    if (!g?.baldes || Object.keys(g.baldes).every((b) => Number(b) < corte)) await $.store.delete(key)
    else if (g.conta === conta) gastos.push(g)
  }
  return gastos
}

// Anota o instante em que o ponto da semana mudou e, a cada 4 pontos, recalibra o câmbio. Entre dois
// pontos virando, a conta é exata: o arredondamento só atrapalha no primeiro marco.
async function marcarPonto($: EngineInterface, pct: number, conta: number, agoraMs: number, gastos: Gasto[]) {
  const chave = MARCOS_PREFIX + conta
  let marcos = (((await $.store.get(chave)) as Marco[] | undefined) ?? []).filter((m) => m.at >= agoraMs - HORIZONTE_MS)
  const ultimo = marcos.at(-1)
  if (ultimo?.pct === pct) return
  // Queda de 1 ou 2 é leitura atrasada de outra sessão; queda maior é a semana zerando
  if (ultimo && pct < ultimo.pct) {
    if (ultimo.pct - pct < 3) return
    marcos = []
  }
  const base = marcos.find((m) => pct - m.pct >= PONTOS_POR_MEDIDA)
  if (base) {
    const usd = somaBaldes(gastos, base.at, agoraMs)
    if (usd > 0) {
      const medido = usd / (pct - base.pct)
      const novo = usdPorPonto * (1 - PESO_MEDIDA) + medido * PESO_MEDIDA
      usdPorPonto = Math.min(USD_POR_PONTO * 3, Math.max(USD_POR_PONTO / 3, novo))
      await $.store.set(CAMBIO_PREFIX + conta, usdPorPonto)
    }
    marcos = []
  }
  await $.store.set(chave, [...marcos, { at: agoraMs, pct }])
}

async function atualizarRitmo($: EngineInterface) {
  const agoraMs = await $.clock.now()
  const conta = contaDe(rateLimits)
  await anotarGasto($, conta, agoraMs)
  const semana = rateLimits.find((l) => l.kind === 'seven_day')
  const resetsAt = semana?.resetsAt ? Date.parse(semana.resetsAt) : 0
  if (!semana || conta == null || resetsAt <= agoraMs) {
    ritmo = null
    return
  }
  usdPorPonto = ((await $.store.get(CAMBIO_PREFIX + conta)) as number | undefined) ?? USD_POR_PONTO
  const gastos = await lerGastos($, conta, agoraMs)
  await marcarPonto($, semana.percentUsed, conta, agoraMs, gastos)
  const desde = Math.floor((agoraMs - JANELA_AGORA_MS) / BALDE_MS) * BALDE_MS
  const baldeAtual = Math.floor(agoraMs / BALDE_MS)
  const barras = Array.from({ length: BARRAS_RITMO }, (_, i) => {
    const t = (baldeAtual - BARRAS_RITMO + 1 + i) * BALDE_MS
    return somaBaldes(gastos, t, t)
  })
  ritmo = calcularRitmo(semana.percentUsed, resetsAt, agoraMs, somaBaldes(gastos, desde, agoraMs), agoraMs - desde, usdPorPonto, barras)
}

// Tira o que as versões antigas deixaram na loja, aos poucos: cada sessão que abre limpa um lote
async function faxinaLoja($: EngineInterface) {
  const corte = (await $.clock.now()) - 2 * 24 * HOUR_MS
  let apagadas = 0
  for (const key of await $.store.keys()) {
    if (apagadas >= 60) break
    const velha = key.startsWith('cambio:') || (key.startsWith('cache:') && Number(await $.store.get(key)) < corte)
    if (!velha) continue
    await $.store.delete(key)
    apagadas++
  }
}

function numero(n: number): string {
  return (n >= 10 ? String(Math.round(n)) : n.toFixed(1)).replace('.', ',')
}

function ritmoMeter(els: Els, surface: string) {
  if (!ritmo) return null
  if (surface !== 'terminal') return desenharPilula(els, 'meter-ritmo', pilulaRitmo(ritmo))
  const { Box, Text } = els
  const { fala, status, agora, meta } = ritmo
  const numeros = fala === 'parado' || fala === 'esgotou' ? (fala === 'parado' ? 'meta ' + numero(meta) + '%/h' : '') : numero(agora) + ' de ' + numero(meta) + '%/h'
  const estilo = status ? { color: status, bold: true } : { dimColor: true }
  return Box({
    key: 'ritmo',
    flexDirection: 'row',
    columnGap: 1,
    children: [Text({ dimColor: true, children: ['⚡'] }), Text({ ...estilo, children: [fala] }), Text({ dimColor: true, children: [numeros] })],
  })
}

// A conta inteira do ritmo, no topo do painel de agentes
function ritmoTexto(): string {
  if (!ritmo) return ''
  const { agora, usdHora, meta, horas, fecha, fechaAgora } = ritmo
  return [
    `Agora ${numero(agora)}%/h (US$ ${Math.round(usdHora)}/h, todas as sessões) · meta ${numero(meta)}%/h nas ${numero(horas)}h úteis que faltam`,
    `Nesta hora fecha a semana em ${Math.round(fechaAgora)}%${fecha == null ? '' : `, na média da semana em ${Math.round(fecha)}%`} · 1 ponto ≈ US$ ${numero(usdPorPonto)}`,
  ].join('\n')
}

// Uma chamada que regravou quase tudo em vez de ler: diz o porquê. Prompt que encolheu (compactar, /clear) não conta.
function porQueEsfriou(antes: Chamada | null, agora: Chamada): string | null {
  if (!antes) return null
  const total = (c: Chamada) => c.lido + c.gravado + c.novo
  const tamanho = total(antes)
  if (total(agora) < AVISO_MIN_TOKENS || total(agora) < tamanho * 0.7) return null
  if (agora.lido >= tamanho * 0.5 || agora.gravado === 0) return null
  if (agora.modelo !== antes.modelo) return 'trocou o modelo'
  if (agora.comecou - antes.comecou > cacheMs()) return 'passou do tempo'
  return 'mudou esforço, ferramentas ou CLAUDE.md'
}

function milhares(n: number): string {
  return n >= 1000 ? Math.round(n / 1000) + 'k' : String(n)
}

// Pílula do cache: quente (barato), esfriando, ou frio (a próxima mensagem relê tudo a preço cheio)
function cacheMeter(els: Els, surface: string, now: number) {
  if (!ultimaResposta) return null
  const { Text } = els
  const resta = ultimaResposta + cacheMs() - now
  const min = Math.max(0, Math.ceil(resta / 60_000))
  let status: Status, texto
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
  if (surface === 'terminal') return Text({ key: 'cache', color: status, children: ['⏱ ' + texto] })
  return desenharPilula(els, 'meter-cache', pilulaCache(texto, status))
}

// Chamado pelo session.start do register.tsx (um evento só pode ter um hook sem filtro por plugin)
async function inicio($: EngineInterface) {
  ticker?.cancel()
  fundo = []
  rateLimits = []
  measuredAt = 0
  ritmo = null
  ultimoUsd = null
  gastoChave = null
  ownKey = KEY_PREFIX + (await $.session.id())
  // A hora da última resposta fica guardada por sessão: reiniciar o app não esquenta o cache.
  ultimaResposta = ((await $.store.get('cache:' + (await $.session.id()))) as number | undefined) ?? 0
  const usage = await $.session.usage()
  context = usage.context
  if (usage.rateLimits.length > 0) await publishSnapshot($, usage.rateLimits)
  // Also clears keys ended sessions left, which short runs that never tick would not
  await refresh($)
  await atualizarRitmo($).catch(() => {})
  await faxinaLoja($).catch(() => {})
  ticker = $.clock.every(TICK_MS, async () => {
    await refresh($)
    await atualizarRitmo($).catch(() => {})
    $.ui.invalidate('ui.render')
  })
  $.ui.invalidate('ui.render')
}

// Fires after each turn, and when a rate-limit window moves a whole point
async function fimDeTurno($: EngineInterface) {
  if (compactarDepois) {
    compactarDepois = false
    compactar($)
  }
  $.ui.invalidate('ui.render')
}

// Compacta depois que o turno solta: o app recusa compactar com turno rodando,
// entao tenta a cada 3 s, ate 10 vezes, por fora do hook
function compactar($: EngineInterface) {
  let tentativas = 0
  let ocupado = false
  const h: Timer | (() => void) = $.clock.every(3000, async () => {
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
function reler($: EngineInterface) {
  let vezes = 0
  const h: Timer | (() => void) = $.clock.every(2000, async () => {
    vezes++
    try {
      context = (await $.session.usage()).context
      $.ui.invalidate('ui.render')
    } catch {}
    if (vezes >= 5) typeof h === 'function' ? h() : h?.cancel?.()
  })
}
