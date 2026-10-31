// Painel de agentes adaptado do savvy-progress (github.com/johnnyvizz/claude-kit), MIT, Copyright (c) 2026 johnnyvizz.
// Texto da licença: LICENSE-savvy-progress, na raiz do repositório mods-cezar.
// Parte do módulo register.tsx: o plugin tem um só módulo de hooks.
import { atom, read, update } from 'claude-code'
import type { ElementTable, EngineInterface, PluginOptions, Register, SessionContextUsage, SessionMessage, SessionRateLimit, Timer } from 'claude-code'
import type { AgentRun, AgentStatus, Panel } from '../types'

// Estado do painel de agentes. Prefixo ag_ para não colidir com os valores da faixa, mais abaixo no arquivo.
const agents = atom({ plugin: 'painel-cezar', key: 'ag_agents' } as const, [])
const panel = atom({ plugin: 'painel-cezar', key: 'ag_panel' } as const, {} as Panel)
const now = atom({ plugin: 'painel-cezar', key: 'ag_now' } as const, 0)

const PANE = 'agentes-cezar'
// Prefixo da área invisível de cada linha: `agente:<id>`
const AREA_AGENTE = 'agente:'
// ---------------------------------------------------------------------------
// Language: the `language` option, else Claude Code's `language` setting, else the
// process locale; English when nothing says Russian.

type Lang = 'en' | 'ru' | 'pt'

const STRINGS = {
  en: {
    pane: 'Agents',
    collapse: 'Collapse',
    expand: 'Expand',
    empty: 'Nobody working right now',
    working: 'working',
    workingFor: 'working for',
    finishedWord: (n: number) => (n === 1 ? 'finished' : 'finished'),
    doneWord: 'finished',
    stopped: 'interrupted',
    failedAgo: (t: string) => `failed ${t === 'now' ? 'just now' : t + ' ago'}`,
    quiet: (t: string) => `nothing new for ${t}`,
    retry: (n: number) => `attempt ${n}`,
    justNow: 'now',
    costAbout: (p: string) => `about ${p}% of the week`,
    costUnder: 'under 0.1% of the week',
    openChat: 'Open conversation',
    asked: 'Asked',
    noMessages: 'No messages yet.',
    noConversation: 'This conversation cannot be read.',
    omitted: (n: number) => `${n} earlier entries hidden`,
    opened: 'Agents panel opened.',
    closed: 'Agents panel closed.',
  },
  ru: {
    pane: 'Агенты',
    collapse: 'Свернуть',
    expand: 'Развернуть',
    empty: 'Сейчас никто не работает',
    working: 'в работе',
    workingFor: 'в работе',
    finishedWord: (_n: number) => 'завершено',
    doneWord: 'завершён',
    stopped: 'прерван',
    failedAgo: (t: string) => `ошибка ${t === 'сейчас' ? 'только что' : t + ' назад'}`,
    quiet: (t: string) => `без новостей ${t}`,
    retry: (n: number) => `попытка ${n}`,
    justNow: 'сейчас',
    costAbout: (p: string) => `около ${p}% недели`,
    costUnder: 'меньше 0,1% недели',
    openChat: 'Открыть диалог',
    asked: 'Задание',
    noMessages: 'Сообщений пока нет.',
    noConversation: 'Этот диалог нельзя прочитать.',
    omitted: (n: number) => `скрыто записей: ${n}`,
    opened: 'Панель агентов открыта.',
    closed: 'Панель агентов закрыта.',
  },
  pt: {
    pane: 'Agentes',
    collapse: 'Recolher',
    expand: 'Expandir',
    empty: 'Ninguém trabalhando agora',
    working: 'trabalhando',
    workingFor: 'trabalhando há',
    finishedWord: (n: number) => (n === 1 ? 'concluído' : 'concluídos'),
    doneWord: 'concluído',
    stopped: 'interrompido',
    failedAgo: (t: string) => `parou com erro ${t === 'agora' ? 'agora' : 'há ' + t}`,
    quiet: (t: string) => `sem novidade há ${t}`,
    retry: (n: number) => `${n}ª tentativa`,
    justNow: 'agora',
    costAbout: (p: string) => `cerca de ${p}% da semana`,
    costUnder: 'menos de 0,1% da semana',
    openChat: 'Abrir conversa',
    asked: 'Pedido',
    noMessages: 'Ainda sem mensagens.',
    noConversation: 'Esta conversa não pode ser lida.',
    omitted: (n: number) => `${n} registros anteriores ocultos`,
    opened: 'Painel de agentes aberto.',
    closed: 'Painel de agentes fechado.',
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

const xml = (s: string): string =>
  s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)


// Largura aproximada de texto de interface, em em; basta para dimensionar a pílula.
const charEm = (ch: string): number =>
  /[\s.,:;'|!il1()[\]]/.test(ch) ? 0.3 : /[A-ZА-ЯЁmwшщжюМШЩЖЮ@%]/.test(ch) ? 0.72 : 0.56

// ---------------------------------------------------------------------------
// Painel de agentes (desenho A, Fila, aprovado em 31/10/2026): erro no topo, quem trabalha do mais antigo
// ao mais novo, concluídos numa linha só. Três cores: barro = rodando, verde = concluído, vermelho = erro.

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

// Função do agente: uma fantasia por função (a primeira regra que bate vence)
const FUNCOES: [RegExp, string][] = [
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

const funcaoDe = (type: string): string => {
  if (type === 'Explore') return 'explore'
  const bare = type.replace(/^[^:]*:/, '')
  return FUNCOES.find(([re]) => re.test(bare))?.[1] ?? 'other'
}

const NOME_FUNCAO: Record<string, string> = {
  executor: 'Executor', obra: 'Obra longa', contador: 'Contador', pesquisador: 'Pesquisador', revisor: 'Revisor',
  redator: 'Redator', advogado: 'Advogado', cobranca: 'Cobrança', atendente: 'Atendente', pintor: 'Animador',
  cientista: 'Exceção', explore: 'Explorador', other: 'Geral',
}
const nomeFuncao = (a: AgentRun): string => NOME_FUNCAO[funcaoDe(a.type)] ?? 'Geral'

const modeloCurto = (id: string): string => {
  const m = /(fable|mythos|opus|sonnet|haiku)/i.exec(id)?.[1]
  return m ? m.charAt(0).toUpperCase() + m.slice(1).toLowerCase() : id.replace(/^claude-/, '').replace(/\[.*\]$/, '') || '—'
}

const norm = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

// Câmbio do custo, pela seção "Semana": 1 ponto da semana em dólares.
const USD_POR_PONTO = 23.5
let usdPorPonto = USD_POR_PONTO
// O custo aparece uma vez só: o total da sessão, na linha dos concluídos.
const custoTotal = (list: AgentRun[]): string => {
  const p = list.reduce((soma, a) => soma + a.costUsd, 0) / usdPorPonto
  return p < 0.1 ? tr().costUnder : tr().costAbout(p < 10 ? p.toFixed(1).replace('.', ',') : String(Math.round(p)))
}

// Tempo em palavras e sem segundos: a imagem da linha só muda de minuto em minuto, e a animação corre sem reiniciar.
const tempoDe = (ms: number): string => {
  const min = Math.floor(ms / 60_000)
  if (min < 1) return tr().justNow
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`
}
const duracao = (a: AgentRun): string =>
  (a.endedAt ?? a.startedAt) - a.startedAt < 60_000 ? '<1 min' : tempoDe((a.endedAt ?? a.startedAt) - a.startedAt)

// Agente rodando que não anda há mais que isto ganha o aviso. Obra longa esperando build também cai aqui: é aviso, não erro.
const QUIETO_MS = 5 * 60_000
const quietoHa = (a: AgentRun, at: number): string | null =>
  a.status === 'running' && at - (a.ultimoPasso ?? a.startedAt) >= QUIETO_MS ? tr().quiet(tempoDe(at - (a.ultimoPasso ?? a.startedAt))) : null

const tentativa = (a: AgentRun): string => (a.round > 1 ? ` · ${tr().retry(a.round)}` : '')
const quemEh = (a: AgentRun): string => `${nomeFuncao(a)} · ${modeloCurto(a.model)}${tentativa(a)}`

const separar = (list: AgentRun[]) => ({
  rodando: list.filter(a => a.status === 'running').sort((x, y) => x.startedAt - y.startedAt),
  erros: list.filter(a => a.status === 'failed' && !a.erroVisto).sort((x, y) => (y.endedAt ?? 0) - (x.endedAt ?? 0)),
  fim: list
    .filter(a => a.status === 'done' || a.status === 'stopped' || (a.status === 'failed' && a.erroVisto))
    .sort((x, y) => (y.endedAt ?? 0) - (x.endedAt ?? 0)),
})

// --- desenho no desktop: cada linha é um SVG, como a faixa.

// Os tokens da pílula, mais um só: barro, a cor do Clawd
const PANE_CSS = `<style>
.fd{fill:#E9E7E1}.tx{fill:#2B2A27}.mu{fill:#6F6C65}.ok{fill:#2F8F5B}.at{fill:#B07C1E}.er{fill:#CF4A40}.br{fill:#BF5F40}
.s-er{stroke:#CF4A40}.s-mu{stroke:#6F6C65}.s-ok{stroke:#2F8F5B}
@media (prefers-color-scheme: dark){.fd{fill:#2D2C2A}.tx{fill:#ECEAE3}.mu{fill:#8F8C83}.ok{fill:#8CC29A}.at{fill:#E3B566}.er{fill:#E8776C}.br{fill:#E59A7D}
.s-er{stroke:#E8776C}.s-mu{stroke:#8F8C83}.s-ok{stroke:#8CC29A}}
.rp{animation:rp 4.8s ease-in-out infinite}@keyframes rp{0%,100%{opacity:.62}45%{opacity:1}}
@media (prefers-reduced-motion:reduce){.rp{animation:none}}
</style>`
const DESFOQUE = '<defs><filter id="b" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="1.6"/></filter></defs>'

type Desenho = { source: string; width: number; height: number; alt: string }
const desenho = (w: number, h: number, alt: string, corpo: string, comBrilho = false): Desenho => ({
  source: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${PANE_CSS}${comBrilho ? DESFOQUE : ''}${corpo}</svg>`,
  width: w,
  height: h,
  alt,
})

// Largura de texto na Segoe, estimada. A do `charEm` é folgada de propósito e cortaria a tarefa antes da hora.
const emLinha = (ch: string): number => (/[\s.,:;'|!il1()[\]jtfr]/.test(ch) ? 0.3 : /[A-ZÀ-Ümw@%]/.test(ch) ? 0.68 : 0.53)
const largura = (s: string, size: number): number => [...s].reduce((w, ch) => w + emLinha(ch) * size, 0)
const caber = (s: string, size: number, max: number): string => {
  if (largura(s, size) <= max) return s
  let out = ''
  for (const ch of s) {
    if (largura(out + ch + '…', size) > max) break
    out += ch
  }
  return out.trimEnd() + '…'
}
const rotulo = (x: number, y: number, s: string, cls: string, size = 12, peso = 400, ancora = ''): string =>
  `<text x="${x}" y="${y}" class="${cls}" font-family="${PILULA_FONTE}" font-size="${size}"${peso !== 400 ? ` font-weight="${peso}"` : ''}${ancora ? ` text-anchor="${ancora}"` : ''} style="font-variant-numeric:tabular-nums">${xml(s)}</text>`

// As fantasias, em cima da grade do Clawd aprovado: corpo x6-22 y6-18, braços x2-6 e x22-26 y10-14, olhos em x8 e x18.
// Sem garra e sem pinça: nada segura nada. O objeto fica encostado no braço ou apoiado no chão.
const retangulo = (x: number, y: number, w: number, h: number, c: string, extra = ''): string =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"${extra}/>`
const carimbo = (x0: number, y0: number, linhas: string[], cores: Record<string, string>): string => {
  let s = ''
  linhas.forEach((l, dy) => {
    let dx = 0
    while (dx < l.length) {
      const ch = l.charAt(dx)
      let fim = dx + 1
      while (fim < l.length && l.charAt(fim) === ch) fim++
      const cor = cores[ch]
      if (cor) s += retangulo(x0 + dx, y0 + dy, fim - dx, 1, cor)
      dx = fim
    }
  })
  return s
}

const capacete = (): string =>
  carimbo(6, -1, ['.....llllll.....', '...llhhmmmmmm...', '..lhhhhmmmmmmd..', '.lhhhhhmmmmmmdd.', '.mmmmmmmmmmmddd.', '.mmmmmmmmmmdddd.'], { l: '#F6DC93', h: '#EFC766', m: '#E3B566', d: '#C4933F' }) +
  retangulo(4, 5, 20, 1, '#A87A2E')
const chapeu = (): string =>
  carimbo(7, 0, ['...lllllllll..', '..lhhhhhhhmmm.', '..hhhhhhhmmmm.', '..hhhhhhmmmmm.', '..ffffffffffff'], { l: '#E7D9B0', h: '#D9C795', m: '#C7B37F', f: '#6E5430' }) +
  retangulo(3, 5, 22, 1, '#A8935F')
const pirata = (): string =>
  carimbo(5, 0, ['.kk............kk.', '.kkk...kkkk...kkk.', '..kkkkkkwwkkkkkk..', '..kkkkkkkkkkkkkk..', '..kkkkkkkkkkkkkk..', 'gggggggggggggggggg'], { k: '#47433E', w: '#ECEAE3', g: '#E3B566' }) +
  retangulo(7, 9, 15, 1, '#1F1E1D') + retangulo(18, 8, 3, 4, '#1F1E1D')
const viseira = (): string =>
  carimbo(6, 3, ['..ddddddddddddd.', '.ggggggggggggggg', 'ggggggggggggggggg'], { d: '#2C6B49', g: '#58A97B' }) +
  retangulo(5, 6, 18, 1, '#2C6B49') + retangulo(8, 4, 5, 1, '#9FD3B1')
const boina = (): string =>
  carimbo(5, 0, ['.........ss.......', '.....llllllll.....', '...lhhhhhhhhhmm...', '..hhhhhhhhhhmmmmm.', '.hhhhhhhhhhmmmmmmm', '.ddddddddddddddd..'], { s: '#5A1A22', l: '#C96A72', h: '#B04654', m: '#963645', d: '#7A2733' })
const oculos = (f: string, l: string): string =>
  retangulo(7, 7, 6, 1, f) + retangulo(7, 11, 6, 1, f) + retangulo(7, 7, 1, 5, f) + retangulo(12, 7, 1, 5, f) +
  retangulo(16, 7, 6, 1, f) + retangulo(16, 11, 6, 1, f) + retangulo(16, 7, 1, 5, f) + retangulo(21, 7, 1, 5, f) + retangulo(13, 9, 3, 1, f) +
  retangulo(8, 8, 4, 3, l, ' fill-opacity=".22"') + retangulo(17, 8, 4, 3, l, ' fill-opacity=".22"')
const terno = (n: string, nl: string, g: string): string =>
  retangulo(6, 13, 16, 5, n) + retangulo(22, 12, 4, 2, n) + retangulo(2, 12, 4, 2, n) + retangulo(6, 13, 16, 1, nl) +
  carimbo(11, 13, ['wwwwww', '.wggw.', '..gg..', '..gg..', '..gg..'], { w: '#F1EFE8', g })
const jaleco = (): string =>
  retangulo(6, 13, 16, 5, '#E9E7E1') + retangulo(6, 13, 16, 1, '#F7F6F2') + retangulo(13, 14, 2, 4, '#B9BFC6') +
  retangulo(2, 12, 4, 2, '#E9E7E1') + retangulo(22, 12, 4, 2, '#E9E7E1') + retangulo(8, 15, 3, 2, '#B9BFC6')
const headset = (): string =>
  carimbo(5, 1, ['.....llllll.....', '...ll......ll...', '..h..........h..'], { l: '#C9CCD2', h: '#8E929A' }) +
  retangulo(5, 8, 2, 5, '#6F737B') + retangulo(21, 8, 2, 5, '#6F737B') + retangulo(6, 3, 1, 5, '#8E929A') + retangulo(21, 3, 1, 5, '#8E929A') +
  retangulo(7, 12, 1, 3, '#6F737B') + retangulo(8, 14, 3, 1, '#6F737B')
const balao = (): string =>
  retangulo(22, 0, 9, 6, '#58A97B', ' rx="1"') + retangulo(24, 6, 2, 2, '#58A97B') + retangulo(24, 2, 1, 2, '#fff') + retangulo(26, 2, 1, 2, '#fff') + retangulo(28, 2, 1, 2, '#fff')
const moeda = (): string =>
  carimbo(26, 8, ['.dddd.', 'dhhmmd', 'dhmmmd', 'dhmmmd', 'dhmmmd', '.dddd.'], { d: '#A87A2E', h: '#F6DC93', m: '#E3B566' }) + retangulo(28, 10, 2, 2, '#A87A2E')
const pa = (): string =>
  retangulo(28, -1, 2, 18, '#9A6C3C') + retangulo(28, -1, 1, 18, '#B98B57') + retangulo(26, -2, 6, 2, '#7A5229') +
  carimbo(26, 17, ['gggggg', 'gggggg', 'hggggd', '.ggdd.', '..dd..'], { g: '#A9ADB5', h: '#D8DBE0', d: '#7B7F87' })
const pena = (): string =>
  carimbo(25, -1, ['....cc', '...ccc', '..cccc', '..ccck', '.ccckc', '.cckc.', '.ckc..', '.kc...', '.k....', 'k.....', 'k.....'], { c: '#EFE7CF', k: '#7A5229' })
const lupa = (): string =>
  carimbo(25, 5, ['.rrrr..', 'rvvvvr.', 'rvwvvr.', 'rvvvvr.', 'rvvvvr.', '.rrrr..', '....rr.', '.....rr'], { r: '#6E5430', v: '#BFDDE8', w: '#FFFFFF' })
const pincel = (): string =>
  retangulo(28, 3, 2, 12, '#9A6C3C') + retangulo(28, 1, 2, 2, '#B0B4BC') + carimbo(27, -3, ['.mm.', 'mmmm', 'mmmm', '.mm.'], { m: '#7FB6C4' })
const tubo = (): string =>
  carimbo(26, 1, ['oooooo', '.oeeo.', '.oeeo.', '.oeeo.', '.olLo.', '.ollo.', '.ollo.', '.ollo.', '.ollo.', '..oo..'], { o: '#7F97A3', e: '#DDEAEE', l: '#8CC29A', L: '#CDE9D5' })
const prancheta = (): string =>
  carimbo(26, 7, ['..kk..', 'mmmmmm', 'mppppm', 'mplppm', 'mppppm', 'mplppm', 'mppppm', 'mmmmmm'], { k: '#6F6C65', m: '#8A6A42', p: '#F1EFE8', l: '#8F8C83' })
const calculadora = (): string =>
  carimbo(26, 8, ['dddddd', 'dlllld', 'dddddd', 'dwdwdd', 'dddddd', 'dwdwdd', 'dddddd'], { d: '#3A3D44', l: '#BFE3CB', w: '#C9CCD2' })
const maleta = (): string =>
  retangulo(27, 12, 3, 1, '#3A2412') + carimbo(25, 13, ['bbbbbbb', 'bbbbbbb', 'bbbgbbb', 'bbbbbbb', 'ddddddd'], { b: '#7A5229', g: '#E3B566', d: '#5A3B1C' })

const FANTASIAS: Record<string, () => string> = {
  executor: capacete,
  obra: () => capacete() + pa(),
  contador: () => viseira() + calculadora(),
  pesquisador: () => chapeu() + lupa(),
  revisor: () => oculos('#2B2D42', '#F1EFE8') + prancheta(),
  redator: () => terno('#4A4E57', '#5B606A', '#7B2438') + pena(),
  advogado: () => terno('#27365A', '#34476F', '#B8453A') + maleta(),
  cobranca: () => terno('#27365A', '#34476F', '#3C8A5D') + moeda(),
  atendente: () => headset() + balao(),
  pintor: () => boina() + pincel(),
  cientista: () => jaleco() + oculos('#2F6F73', '#CFEFF5') + tubo(),
  explore: pirata,
}

// A caixa do Clawd cresce para caber chapéu e objeto, com o corpo no mesmo pixel de 2 px da faixa
const CLAWD_ROW = 32
const caixaClawd = (svg: string, x: number, y: number): string =>
  svg.replace(/<svg [^>]*>/, `<svg x="${x}" y="${y}" width="${CLAWD_ROW}" height="31" viewBox="-1 -7 32 31" shape-rendering="crispEdges">`)
const vestir = (svg: string, roupa: string): string => svg.replace(/<\/g><\/svg>$/, `${roupa}</g></svg>`)

// Andar na metade da velocidade da faixa e cada agente na sua fase: doze não marcham juntos.
// A fase vem do id, para o agente não pular de passo quando outro termina.
const devagar = (svg: string, fase: number): string =>
  svg.replace(/<style>(.*?)<\/style>/s, (_, css: string) =>
    '<style>' +
    css.replace(/(\d*\.?\d+)s (steps\(1\)|ease-in-out|ease-out) infinite(?: (-?\d*\.?\d+)s)?/g, (_m, d: string, curva: string, atraso?: string) =>
      `${(parseFloat(d) * 2).toFixed(2)}s ${curva} infinite ${(parseFloat(atraso ?? '0') * 2 - fase).toFixed(2)}s`) +
    '</style>')
const faseDe = (id: string): number => ([...id].reduce((h, ch) => (h * 31 + (ch.codePointAt(0) ?? 0)) % 997, 7) % 200) / 100

const clawdAndando = (a: AgentRun): string =>
  vestir(devagar(CLAWD_TRABALHANDO, faseDe(a.id)), FANTASIAS[funcaoDe(a.type)]?.() ?? '')
const clawdParado = (a: AgentRun): string =>
  vestir(CLAWD_VEZ.replace(/<style>.*?<\/style>/s, '<style>.vm,.vf{opacity:0}</style>'), FANTASIAS[funcaoDe(a.type)]?.() ?? '')
// Erro: o Clawd vermelho sem o tremor, só o "!" piscando devagar
const clawdCaido = (): string =>
  CLAWD_PANICO.replace(/\.ps\{[^}]*\}/, '').replace(/\.pe\{[^}]*\}/, '').replace(/\.pd\{[^}]*\}/, '').replace(/\.pu\{[^}]*\}/, '')
    .replace(/\.pg\{[^}]*\}/, '.pg{opacity:.5}').replace(/\.px\{animation:px 1s/, '.px{animation:px 3s')

const capsula = (x: number, y: number, cls: string): string => `<rect class="${cls}" x="${x}" y="${y}" width="4" height="12" rx="2"/>`
const seta = (x: number, y: number, aberto: boolean): string =>
  `<path d="${aberto ? `M${x - 3.5} ${y - 2}l3.5 3.5 3.5-3.5` : `M${x - 2} ${y - 3.5}l3.5 3.5-3.5 3.5`}" fill="none" class="s-mu" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`

// A única pílula do topo: o erro já tem cartão e os concluídos já têm linha, repetir seria ruído
const placarSvg = (W: number, n: number): Desenho => {
  const palavra = tr().working
  const w = Math.ceil(22 + largura(String(n), 12) + 5 + largura(palavra, 11.5) + 12)
  return desenho(W, 34, `${n} ${palavra}`,
    `<rect class="fd" y="1" width="${w}" height="24" rx="12"/><g filter="url(#b)" opacity=".5">${capsula(11, 7, 'br')}</g>${capsula(11, 7, 'br rp')}` +
    rotulo(22, 17, String(n), 'tx', 12, 600) + rotulo(22 + largura(String(n), 12) + 5, 17, palavra, 'mu', 11.5), true)
}

const erroSvg = (W: number, a: AgentRun, at: number): Desenho => {
  const moldura = (extra: string) => `<rect x=".5" y=".5" width="${W - 1}" height="55" rx="13" fill="none" class="s-er" ${extra}/>`
  const fala = tr().failedAgo(tempoDe(at - (a.endedAt ?? at)))
  return desenho(W, 62, `${a.description}: ${fala}`,
    `<rect class="fd" x=".5" y=".5" width="${W - 1}" height="55" rx="13"/>${moldura('stroke-opacity=".55" stroke-width="1.5" filter="url(#b)"')}${moldura('stroke-opacity=".85"')}` +
    caixaClawd(clawdCaido(), 8, 13) + rotulo(46, 24, caber(a.description || a.type, 12.5, W - 60), 'tx', 12.5, 500) +
    rotulo(46, 41, fala, 'er', 11.5) + (W >= 300 ? rotulo(W - 14, 41, quemEh(a), 'mu', 11.5, 400, 'end') : ''), true)
}

const rodandoSvg = (W: number, a: AgentRun, at: number): Desenho => {
  const quieto = quietoHa(a, at)
  const tempo = tempoDe(at - a.startedAt)
  return desenho(W, 46, `${a.description}: ${quemEh(a)}, ${tempo}`,
    caixaClawd(clawdAndando(a), 0, 8) + rotulo(40, 19, caber(a.description || a.type, 12.5, W - 42), 'tx', 12.5, 500) +
    rotulo(40, 36, caber(quieto ?? quemEh(a), 11.5, W - 96), quieto ? 'at' : 'mu', 11.5) + rotulo(W - 2, 36, tempo, 'mu', 11.5, 400, 'end'))
}

const concluidosSvg = (W: number, n: number, custo: string, aberto: boolean): Desenho =>
  desenho(W, 36, `${n} ${tr().finishedWord(n)}, ${custo}`,
    `<rect class="fd" y="3" width="${W}" height="30" rx="15"/>` + seta(16, 18, aberto) +
    rotulo(30, 22, `${n} ${tr().finishedWord(n)}`, 'tx', 12, 500) + (W >= 300 ? rotulo(W - 14, 22, custo, 'mu', 11.5, 400, 'end') : ''))

const feitoSvg = (W: number, a: AgentRun): Desenho => {
  const marca =
    a.status === 'failed'
      ? '<path d="M6 10l6 8M12 10l-6 8" class="s-er" stroke-width="1.5" stroke-linecap="round"/>'
      : a.status === 'stopped'
        ? '<path d="M6 14h7" class="s-mu" stroke-width="1.5" stroke-linecap="round"/>'
        : '<path d="M5 14l2.8 2.8 5.2-5.6" fill="none" class="s-ok" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
  const lado = a.status === 'stopped' ? tr().stopped : `${modeloCurto(a.model)} · ${duracao(a)}`
  const ladoW = Math.ceil(largura(lado, 11.5)) + 8
  return desenho(W, 28, `${a.description}: ${lado}`,
    marca + rotulo(24, 18, caber(a.description || a.type, 12, W - 28 - ladoW), 'tx', 12) + rotulo(W - 4, 18, lado, 'mu', 11.5, 400, 'end'))
}

const vazioSvg = (W: number): Desenho =>
  desenho(W, 104, tr().empty, caixaClawd(CLAWD_VEZ, Math.round(W / 2 - 16), 22) + rotulo(W / 2, 76, tr().empty, 'mu', 12.5, 400, 'middle'))

const cabecaConversaSvg = (W: number, a: AgentRun, at: number): Desenho => {
  const estado =
    a.status === 'running'
      ? quietoHa(a, at) ?? `${tr().workingFor} ${tempoDe(at - a.startedAt)}`
      : a.status === 'failed'
        ? tr().failedAgo(tempoDe(at - (a.endedAt ?? at)))
        : a.status === 'stopped'
          ? tr().stopped
          : `${tr().doneWord} · ${duracao(a)}`
  const clawd = a.status === 'running' ? clawdAndando(a) : a.status === 'failed' ? clawdCaido() : clawdParado(a)
  return desenho(W, 46, `${a.description}: ${estado}`,
    caixaClawd(clawd, 0, 8) + rotulo(40, 19, caber(a.description || a.type, 12.5, W - 42), 'tx', 12.5, 500) +
    rotulo(40, 36, caber(estado, 11.5, W - 40 - 136), a.status === 'failed' ? 'er' : 'mu', 11.5) + rotulo(W - 2, 36, caber(`${nomeFuncao(a)} · ${modeloCurto(a.model)}`, 11.5, 132), 'mu', 11.5, 400, 'end'))
}

// --- a conversa do agente, dentro do painel. Serve ao desktop, onde $.ui.view não existe: o app roda em
// stream-json, sem visão principal, e a resposta é sempre "no main view here" (sondado em 31/10/2026 no binário
// do app). $.session.messages({ agentId }) lê a conversa nesse modo, inclusive depois de o agente terminar.

const MAX_MENSAGENS = 60
const MAX_TEXTO = 6000

// O que uma chamada de ferramenta fez, numa linha
const resumoFerramenta = (tool: string, input: Record<string, unknown>): string => {
  const valor = ['description', 'file_path', 'path', 'pattern', 'query', 'url', 'command', 'prompt'].map(k => input[k]).find(v => typeof v === 'string') as string | undefined
  const nome = tool.replace(/^mcp__[^_]+(?:_[^_]+)*__/, '')
  return valor ? `${nome} · ${valor.replace(/\s+/g, ' ').slice(0, 90)}` : nome
}

type LinhaConversa = { papel: 'pedido' | 'resposta' | 'ferramenta'; texto: string }

const linhasDaConversa = (msgs: SessionMessage[]): { linhas: LinhaConversa[]; omitidas: number } => {
  const todas: LinhaConversa[] = []
  for (const m of msgs) {
    const texto = m.text.trim()
    if (texto) todas.push({ papel: m.role === 'user' ? 'pedido' : 'resposta', texto: texto.length > MAX_TEXTO ? texto.slice(0, MAX_TEXTO) + '…' : texto })
    for (const u of m.toolUses) todas.push({ papel: 'ferramenta', texto: resumoFerramenta(u.tool, u.input) })
  }
  if (todas.length <= MAX_MENSAGENS) return { linhas: todas, omitidas: 0 }
  // O pedido fica, porque diz o que o agente foi fazer; o resto é o final da conversa
  return { linhas: [...todas.slice(0, 1), ...todas.slice(-(MAX_MENSAGENS - 1))], omitidas: todas.length - MAX_MENSAGENS }
}

// --- terminal: as mesmas linhas, em texto.

const COR_BARRO = '#D97757'

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
    description: 'Show or hide the panel of subagents: who failed, who is working and on what, what is finished',
  })

  // A tela só muda de minuto em minuto; um toque a cada 20 s basta e fica quieto quando nada roda.
  $.clock.every(20_000, () => {
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
  const at = await $.clock.now()
  await update($, agents, list =>
    list.map(a =>
      a.agentId !== agentId
        ? a
        : {
            ...a,
            model,
            status: 'running',
            endedAt: undefined,
            erroVisto: undefined,
            ultimoPasso: at,
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
    // Interromper é decisão de quem manda, não falha: `aborted` tem estado próprio
    const status: AgentStatus = e.reason === 'answer' ? 'done' : e.reason === 'aborted' ? 'stopped' : 'failed'
    await update($, agents, list =>
      list.map(a => {
        if (a.agentId !== agentId) return a
        // A run whose steps went unseen still gets the turn's own sum.
        const fallback = a.steps === 0 && e.usage
        return {
          ...a,
          status,
          endedAt: at,
          ...(fallback && e.usage ? { model: e.usage.model || a.model, costUsd: costOf(e.usage.model || a.model, e.usage) } : {}),
        }
      }),
    )
    await update($, now, () => at)
  }
}

// Abre a conversa do agente dentro do painel. Erro aberto foi visto: desce para os concluídos.
async function abrirConversa($: EngineInterface, id: string): Promise<void> {
  await marcarVisto($, id)
  await update($, panel, p => ({ ...p, abertoId: id }))
  // O que importa numa conversa é o fim dela. Fora do gesto vale: o painel é do próprio mod.
  $.clock.after(350, () => {
    void $.ui.scroll({ in: PANE, to: 'end' }).catch(() => {})
  })
}

async function marcarVisto($: EngineInterface, id: string): Promise<void> {
  await update($, agents, list => list.map(a => (a.id === id && a.status === 'failed' ? { ...a, erroVisto: true } : a)))
}

// Botão da linha, onde não há área invisível (terminal, editor, celular). É aqui que existe gesto da pessoa, e
// no terminal $.ui.view troca a conversa principal de verdade; se recusar, a conversa abre no próprio painel.
async function verAgente($: EngineInterface, a: AgentRun): Promise<void> {
  if (a.agentId) {
    // Os tipos instalados na pasta do mod são da 2.1.286, anteriores a $.ui.view
    const shown = await ($.ui as unknown as { view: (v: { agentId: string }) => Promise<{ deny?: string }> }).view({ agentId: a.agentId })
    if (!shown.deny) {
      await marcarVisto($, a.id)
      return
    }
  }
  await abrirConversa($, a.id)
}

async function alternarConcluidos($: EngineInterface): Promise<void> {
  const algumRodando = (await read($, agents)).some(a => a.status === 'running')
  await update($, panel, p => ({ ...p, concluidosAbertos: !(p.concluidosAbertos ?? !algumRodando) }))
}

// A área invisível do painel: área sobre cada linha, key `agente:<id>`, e sobre a linha dos concluídos.
// Devolve true quando o clique era daqui.
async function cliqueNoPainel($: EngineInterface, elemento: string): Promise<boolean> {
  if (elemento === 'concluidos') {
    await alternarConcluidos($)
    return true
  }
  if (!elemento.startsWith(AREA_AGENTE)) return false
  await abrirConversa($, elemento.slice(AREA_AGENTE.length))
  return true
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
        ultimoPasso: at,
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
    const { Box, Text, Button, Markdown } = ui
    const list = await read($, agents)
    const p: Panel = await read($, panel)
    const at = Math.max(await read($, now), ...list.map(a => a.startedAt), 0)
    const temSvg = e.surface !== 'terminal' && 'Svg' in ui
    const W = Math.max(240, Math.min(900, (e.props.bodyColumns || 40) * 8 - 8))

    // A conversa de um agente, dentro do painel
    const aberto = p.abertoId === undefined ? undefined : list.find(a => a.id === p.abertoId)
    if (aberto) {
      const lidas = aberto.agentId
        ? await $.session.messages({ agentId: aberto.agentId }).catch(() => ({ deny: s.noConversation }))
        : { deny: s.noConversation }
      const { linhas, omitidas } = Array.isArray(lidas) ? linhasDaConversa(lidas) : { linhas: [], omitidas: 0 }
      const { Svg } = ui as { Svg?: Els['Svg'] }
      const cabeca = cabecaConversaSvg(W, aberto, at)
      return (
        <Box flexDirection="column" gap={1}>
          <Button key="voltar" label={`‹ ${s.pane}`} plain dimColor onPress={() => update($, panel, q => ({ ...q, abertoId: undefined }))} />
          {temSvg && Svg ? (
            <Svg source={cabeca.source} alt={cabeca.alt} width={cabeca.width} height={cabeca.height} />
          ) : (
            <Box flexDirection="column">
              <Text bold wrap="truncate-end">{aberto.description || aberto.type}</Text>
              <Text dimColor wrap="truncate-end">{quemEh(aberto)}</Text>
            </Box>
          )}
          {!Array.isArray(lidas) && <Text dimColor>{'deny' in lidas ? lidas.deny : s.noConversation}</Text>}
          {Array.isArray(lidas) && linhas.length === 0 && <Text dimColor>{s.noMessages}</Text>}
          {linhas.map((l, i) => (
            <Box key={`m${i}`} flexDirection="column">
              {l.papel === 'pedido' && <Text dimColor>{s.asked}</Text>}
              {l.papel === 'ferramenta' ? <Text dimColor wrap="truncate-end">{l.texto}</Text> : <Markdown text={l.texto} dimColor={l.papel === 'pedido'} />}
              {i === 0 && omitidas > 0 && <Text dimColor>{s.omitted(omitidas)}</Text>}
            </Box>
          ))}
        </Box>
      )
    }

    const { rodando, erros, fim } = separar(list)
    const abertos = p.concluidosAbertos ?? rodando.length === 0
    const custo = custoTotal(list)
    const nFim = fim.length

    if (temSvg) {
      const { Svg } = ui as { Svg: Els['Svg'] }
      const pinta = (d: Desenho) => <Svg source={d.source} alt={d.alt} width={d.width} height={d.height} />
      // Linha clicável: a área invisível cobre o desenho, e sem Client (editor, celular) entra um botão de texto
      const elements = ui as unknown as Els
      const temArea = e.surface === 'desktop' && 'Client' in ui
      const clicavel = (chave: string, d: Desenho, a?: AgentRun) =>
        temArea ? (
          <Box key={`l:${chave}`} position="relative" flexShrink={0} width={d.width}>
            {pinta(d)}
            <Box position="absolute" top={0} left={0} right={0} bottom={0}>
              {elements.Client({ key: chave, module: './clawd.jsx', width: '100%', height: '100%' })}
            </Box>
          </Box>
        ) : (
          <Box key={`l:${chave}`} flexDirection="column" flexShrink={0}>
            {pinta(d)}
            {a ? (
              <Button key={`b:${chave}`} label={s.openChat} plain dimColor onPress={() => verAgente($, a)} />
            ) : (
              <Button key={`b:${chave}`} label={abertos ? s.collapse : s.expand} plain dimColor onPress={() => alternarConcluidos($)} />
            )}
          </Box>
        )
      if (list.length === 0) return <Box flexDirection="column">{pinta(vazioSvg(W))}</Box>
      return (
        <Box flexDirection="column">
          {rodando.length > 0 && pinta(placarSvg(W, rodando.length))}
          {erros.map(a => clicavel(AREA_AGENTE + a.id, erroSvg(W, a, at), a))}
          {rodando.map(a => clicavel(AREA_AGENTE + a.id, rodandoSvg(W, a, at), a))}
          {nFim > 0 && clicavel('concluidos', concluidosSvg(W, nFim, custo, abertos))}
          {abertos && fim.map(a => clicavel(AREA_AGENTE + a.id, feitoSvg(W, a), a))}
        </Box>
      )
    }

    // Terminal: a mesma ordem, em texto. O botão é a linha inteira.
    const linha = (a: AgentRun, glifo: string, cor: string, lado: string, nota?: string) => (
      <Box key={a.id} flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between" gap={1}>
          <Button key={`ver:${a.id}`} plain onPress={() => verAgente($, a)}>
            <Text color={cor}>{glifo}</Text> {a.description || a.type}
          </Button>
          <Text dimColor>{lado}</Text>
        </Box>
        {nota !== undefined && <Text dimColor wrap="truncate-end">{'  '}{nota}</Text>}
      </Box>
    )
    const placar = [rodando.length ? `${rodando.length} ${s.working}` : '', nFim ? `${nFim} ${s.finishedWord(nFim)}` : '', list.length ? custo : ''].filter(Boolean).join(' · ')
    return (
      <Box flexDirection="column">
        {list.length === 0 && <Text dimColor>{s.empty}</Text>}
        {erros.map(a => linha(a, '✗', 'red', s.failedAgo(tempoDe(at - (a.endedAt ?? at)))))}
        {placar !== '' && <Text dimColor wrap="truncate-end">{placar}</Text>}
        {rodando.map(a => linha(a, '●', COR_BARRO, tempoDe(at - a.startedAt), quietoHa(a, at) ?? quemEh(a)))}
        {nFim > 0 && (
          <Button key="concluidos" label={`${abertos ? '▾' : '▸'} ${nFim} ${s.finishedWord(nFim)}`} plain dimColor onPress={() => alternarConcluidos($)} />
        )}
        {abertos && fim.map(a => linha(a, a.status === 'failed' ? '✗' : a.status === 'stopped' ? '–' : '✓', a.status === 'failed' ? 'red' : a.status === 'stopped' ? 'gray' : 'green', a.status === 'stopped' ? s.stopped : duracao(a)))}
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
// A onda: px por segundo e quadros por segundo (animação por passos, como cinema)
const ONDA_VELOCIDADE = 9
const ONDA_FPS = 24
// Cor da luz por tema: [crista clara, brasa] no claro e no escuro. Nunca branco puro: cada luz puxa o tom da cápsula
const ONDA_TONS: Record<string, [string, string, string, string]> = {
  success: ['#A6EBC3', '#58C088', '#EEF9F1', '#BCE8C8'],
  warning: ['#F8D388', '#DCA33C', '#FFF4DE', '#F8D695'],
  error: ['#FFB9AD', '#EE7468', '#FFE9E4', '#FFAA9E'],
  none: ['#CFCBC2', '#94918A', '#F1EFE9', '#BDBAB1'],
}
type OndaPecas = { halo: string; luz: string; contorno: string }
const ondaGuardada = new Map<string, OndaPecas>()
// Cada cápsula responde um pouco diferente, como filamentos de verdade; a diferença é pequena para não virar padrão
const ONDA_GRAOS = [0.97, 1, 0.91, 1.04, 0.95, 1.02, 0.9, 1.03, 0.96, 1, 0.92, 1.05, 0.94, 1]
// Quanto o contorno do tempo sente a luz, pela distância em células da última cápsula cheia
const ONDA_ALCANCE_CONTORNO = [1, 0.5, 0.26, 0.12]
const PILULA_FONTE = "'Segoe UI',system-ui,-apple-system,sans-serif"
const PILULA_CSS = `<style>
.fd{fill:#E9E7E1}.tx{fill:#2B2A27}.mu{fill:#6F6C65}.vz{fill:#000;fill-opacity:.11}.success{fill:#2F8F5B}.warning{fill:#B07C1E}.error{fill:#CF4A40}.none{fill:#6F6C65}
.a-vz{stroke:#000;stroke-opacity:.11}.a-tx{stroke:#2B2A27}.a-mu{stroke:#6F6C65}.a-success{stroke:#2F8F5B}.a-warning{stroke:#B07C1E}.a-error{stroke:#CF4A40}
.p-success{stop-color:#2F8F5B}.p-warning{stop-color:#B07C1E}.p-error{stop-color:#CF4A40}.p-none{stop-color:#6F6C65}
@media (prefers-color-scheme: dark){.fd{fill:#2D2C2A}.tx{fill:#ECEAE3}.mu{fill:#8F8C83}.vz{fill:#fff}.success{fill:#8CC29A}.warning{fill:#E3B566}.error{fill:#E8776C}.none{fill:#8F8C83}
.a-vz{stroke:#fff}.a-tx{stroke:#ECEAE3}.a-mu{stroke:#8F8C83}.a-success{stroke:#8CC29A}.a-warning{stroke:#E3B566}.a-error{stroke:#E8776C}
.p-success{stop-color:#8CC29A}.p-warning{stop-color:#E3B566}.p-error{stop-color:#E8776C}.p-none{stop-color:#8F8C83}}
</style>`
// The terminal draws the time marker in this color
const MARKER_COLOR = 'cyan'

export function register(on: Parameters<Register>[0], options: PluginOptions) {
  registerAgentes(on)
  // ---- Clawd e relógio ----
  let relogio: Timer | undefined

  on('session.start', async ($, e, next) => {
    await inicio($)
    await agentesInicio($, options)
    relogio?.cancel()
    relogio = $.clock.every(60000, () => $.ui.invalidate('ui.render'))
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

  // Clique numa área invisível: Clawd da faixa, botões e linhas do painel de agentes
  on('ui.message', async ($, e, next) => {
    if (e.element === 'clawd') {
      void $.ui.open({ id: 'agentes-cezar', title: 'Agentes' })
      return {}
    }
    if (e.element === 'compactar') {
      pedirCompactar($)
      return {}
    }
    if (e.element === 'salvar') {
      pedirSalvar($)
      return {}
    }
    if (await cliqueNoPainel($, e.element)) return {}
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    context = e.context
    // A fresh measurement, including an empty one when the account's windows went away
    if (e.changed.includes('rateLimits')) await remember($, e.rateLimits)
    await atualizarSemana($).catch(() => {})
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
      m.value = valueText(m)
      m.reset = resetText(m, now)
    }
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
        ...(e.surface === 'desktop'
          ? [
              iconeClicavel(elements, 'clawd', clawdAgora.source, clawdAgora.alt, CLAWD_LARGURA, CLAWD_ALTURA),
              iconeClicavel(elements, 'compactar', ICONE_COMPACTAR, 'compactar', 24, 24),
              iconeClicavel(elements, 'salvar', ICONE_SALVAR, 'salvar o estado e compactar', 24, 24),
            ]
          : [
              elements.Button({ key: 'agentes', label: 'sub', onPress: () => void $.ui.open({ id: 'agentes-cezar', title: 'Agentes' }) }),
              elements.Button({ key: 'compactar', label: '📦', onPress: () => pedirCompactar($) }),
              elements.Button({ key: 'salvar', label: '💾', onPress: () => pedirSalvar($) }),
            ]),
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
  return { label, semRotulo: window?.semRotulo === true, used: limit.percentUsed, elapsed, resetsAt: resetsAtMs, showsClock: window?.showsClock === true, fecha: ehSemana ? previsaoSemana(limit.percentUsed, resetsAtMs, now) : null, ehSemana }
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

function valueText({ used }: Meter): string {
  return typeof used === 'number' ? Math.round(used) + '%' : '—'
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
    const p = ehSemana ? pilulaSemana(known ? used : 0, elapsed, status, reset ?? '') : pilulaAnel(label, known ? used : 0, status, value as string, reset ?? '')
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

// O Clawd oficial: grade 12x8 do ClawdMoji (github.com/afspies/ClawdMoji), sem garra, com luz, olho e sombra
// refeitos em 30/10/2026. Cada estado anima sozinho por CSS dentro do SVG, sem redesenhar a faixa:
//   vez: parado, respira, olha e pisca · trabalhando: anda · panico: vermelho, treme e ergue um "!"
//   (precisa de permissão ou de resposta). Não usar Svg isInteractive: a moldura tem fundo branco.
const CLAWD_LARGURA = 28
const CLAWD_ALTURA = 24
const CLAWD_VEZ = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="24" viewBox="0 0 28 24" shape-rendering="crispEdges"><style>.vc{animation:vc 4s steps(1) infinite}@keyframes vc{55%{transform:translateY(1px)}}.vg{animation:vg 4s ease-in-out infinite}@keyframes vg{0%,100%{opacity:.56}55%{opacity:.42}}.vo{animation:vo 8s steps(1) infinite}@keyframes vo{0%{opacity:1}20.000%{opacity:0}23.500%{opacity:1}70.000%{opacity:0}73.000%{opacity:1}74.500%{opacity:0}77.500%{opacity:1}}.vm{opacity:0;animation:vm 8s steps(1) infinite}@keyframes vm{0%{opacity:0}20.000%{opacity:1}21.000%{opacity:0}22.500%{opacity:1}23.500%{opacity:0}70.000%{opacity:1}71.000%{opacity:0}72.000%{opacity:1}73.000%{opacity:0}74.500%{opacity:1}75.500%{opacity:0}76.500%{opacity:1}77.500%{opacity:0}}.vf{opacity:0;animation:vf 8s steps(1) infinite}@keyframes vf{0%{opacity:0}21.000%{opacity:1}22.500%{opacity:0}71.000%{opacity:1}72.000%{opacity:0}75.500%{opacity:1}76.500%{opacity:0}}.vl{animation:vl 8s steps(1) infinite}@keyframes vl{0%{transform:none}40.000%{transform:translateX(1px)}55.000%{transform:none}}@media (prefers-reduced-motion:reduce){.vc,.vg,.vo,.vm,.vf,.vl{animation:none}}</style><defs><linearGradient id="cvv" gradientUnits="userSpaceOnUse" x1="0" y1="6" x2="0" y2="18"><stop offset="0" stop-color="#EC9A7E"/><stop offset=".2" stop-color="#E28669"/><stop offset=".52" stop-color="#DA7758"/><stop offset=".84" stop-color="#CF6C4F"/><stop offset="1" stop-color="#BC5D43"/></linearGradient><linearGradient id="cvh" gradientUnits="userSpaceOnUse" x1="2" y1="0" x2="26" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".06"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient><linearGradient id="cvr" gradientUnits="userSpaceOnUse" x1="7" y1="0" x2="21" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset=".55" stop-color="#fff" stop-opacity=".14"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><linearGradient id="cvl" gradientUnits="userSpaceOnUse" x1="0" y1="18" x2="0" y2="22"><stop offset="0" stop-color="#A44F38"/><stop offset=".45" stop-color="#BE6146"/><stop offset="1" stop-color="#CC7053"/></linearGradient><filter id="cvb" filterUnits="userSpaceOnUse" x="-4" y="-4" width="36" height="32"><feGaussianBlur stdDeviation="1.6"/></filter><filter id="cvm" filterUnits="userSpaceOnUse" x="-4" y="-4" width="36" height="32"><feGaussianBlur stdDeviation=".7"/></filter><filter id="cvn" filterUnits="userSpaceOnUse" x="-4" y="14" width="36" height="14"><feGaussianBlur stdDeviation="1"/></filter><filter id="cvs" filterUnits="userSpaceOnUse" x="0" y="0" width="28" height="24"><feGaussianBlur stdDeviation="1.3"/></filter><clipPath id="cvc"><path d="M6 6h16v12H6z"/></clipPath></defs><g filter="url(#cvb)" class="vg"><path fill="#DA7758" d="M6 6h16v12H6zM2 10h4v4H2zM22 10h4v4h-4zM6 18h2v4h-2zM10 18h2v4h-2zM16 18h2v4h-2zM20 18h2v4h-2z"/></g><g filter="url(#cvn)" fill="#000" fill-opacity=".3" shape-rendering="auto"><g><ellipse cx="10" cy="22.3" rx="7" ry="1.3"/></g><g><ellipse cx="18" cy="22.3" rx="7" ry="1.3"/></g></g><rect x="6" y="18" width="2" height="4" fill="url(#cvl)"/><rect x="10" y="18" width="2" height="4" fill="url(#cvl)"/><rect x="16" y="18" width="2" height="4" fill="url(#cvl)"/><rect x="16" y="18" width="2" height="4" fill="#000" fill-opacity=".09"/><rect x="20" y="18" width="2" height="4" fill="url(#cvl)"/><rect x="20" y="18" width="2" height="4" fill="#000" fill-opacity=".09"/><g class="vc"><path d="M2 10h4v4H2z" fill="url(#cvv)"/><path d="M2 10h4v4H2z" fill="url(#cvh)"/><rect x="2" y="10" width="4" height="1" fill="#fff" fill-opacity=".2"/><rect x="2" y="13" width="4" height="1" fill="#000" fill-opacity=".1"/><path d="M22 10h4v4h-4z" fill="url(#cvv)"/><path d="M22 10h4v4h-4z" fill="url(#cvh)"/><rect x="22" y="10" width="4" height="1" fill="#fff" fill-opacity=".1"/><rect x="22" y="13" width="4" height="1" fill="#000" fill-opacity=".1"/><path d="M6 6h16v12H6z" fill="url(#cvv)"/><path d="M6 6h16v12H6z" fill="url(#cvh)"/><g clip-path="url(#cvc)"><ellipse cx="10.5" cy="7.5" rx="5.5" ry="2.6" fill="#fff" opacity=".15" filter="url(#cvs)"/></g><rect x="7" y="6" width="14" height="1" fill="url(#cvr)"/><rect x="6" y="10" width="1" height="4" fill="#000" fill-opacity=".06"/><rect x="21" y="10" width="1" height="4" fill="#000" fill-opacity=".08"/><g class="vo"><g class="vl"><rect x="8" y="8" width="2" height="3" fill="#1F1E1D"/><rect x="8" y="8" width="1" height="1" fill="#fff"/><rect x="18" y="8" width="2" height="3" fill="#1F1E1D"/><rect x="18" y="8" width="1" height="1" fill="#fff"/></g></g><g class="vm"><rect x="8" y="8" width="2" height="3" fill="#1F1E1D"/><rect x="8" y="8" width="1" height="1" fill="#fff"/><rect x="18" y="8" width="2" height="3" fill="#1F1E1D"/><rect x="18" y="8" width="1" height="1" fill="#fff"/><rect x="8.0" y="8" width="2" height="1" fill="#E38F72"/><rect x="8" y="9" width="2" height="1" fill="#5B2A1E"/><rect x="18.0" y="8" width="2" height="1" fill="#E38F72"/><rect x="18" y="9" width="2" height="1" fill="#5B2A1E"/></g><g class="vf"><rect x="8" y="8" width="2" height="2" fill="#E38F72"/><rect x="7" y="10" width="4" height="1" fill="#5B2A1E"/><rect x="18" y="8" width="2" height="2" fill="#E38F72"/><rect x="17" y="10" width="4" height="1" fill="#5B2A1E"/></g></g></svg>`
const CLAWD_TRABALHANDO = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="24" viewBox="0 0 28 24" shape-rendering="crispEdges"><style>.tg{animation:tg 2s ease-in-out infinite}@keyframes tg{0%,100%{opacity:.4}50%{opacity:.62}}.te{animation:tp 1s steps(1) infinite}.td{animation:tq 1s steps(1) infinite -.5s}@keyframes tp{0%{transform:translateY(-1px)}12.5%{transform:translate(1px,-2px)}25%{transform:translateY(-1px)}37.5%{transform:none}}@keyframes tq{0%{transform:translateY(-1px)}12.5%{transform:translate(-1px,-2px)}25%{transform:translateY(-1px)}37.5%{transform:none}}.se{animation:ts 1s steps(1) infinite}.sd{animation:ts 1s steps(1) infinite -.5s}@keyframes ts{0%{opacity:.7}12.5%{opacity:.45}25%{opacity:.7}37.5%{opacity:1}}.tb{animation:tb 1s steps(1) infinite}@keyframes tb{0%{transform:none}12.5%{transform:translate(1px,-1px)}25%{transform:none}37.5%{transform:translateY(1px)}50%{transform:none}62.5%{transform:translate(-1px,-1px)}75%{transform:none}87.5%{transform:translateY(1px)}}.ta{animation:ta .5s steps(1) infinite}@keyframes ta{0%{transform:none}25%{transform:translateY(1px)}50%{transform:none}75%{transform:translateY(-1px)}}.to{animation:to 3s steps(1) infinite}@keyframes to{0%{transform:translateX(1px)}50%{transform:translateX(-1px)}}@media (prefers-reduced-motion:reduce){.tg,.te,.td,.se,.sd,.tb,.ta,.to{animation:none}}</style><defs><linearGradient id="ctv" gradientUnits="userSpaceOnUse" x1="0" y1="6" x2="0" y2="18"><stop offset="0" stop-color="#EC9A7E"/><stop offset=".2" stop-color="#E28669"/><stop offset=".52" stop-color="#DA7758"/><stop offset=".84" stop-color="#CF6C4F"/><stop offset="1" stop-color="#BC5D43"/></linearGradient><linearGradient id="cth" gradientUnits="userSpaceOnUse" x1="2" y1="0" x2="26" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".06"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient><linearGradient id="ctr" gradientUnits="userSpaceOnUse" x1="7" y1="0" x2="21" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset=".55" stop-color="#fff" stop-opacity=".14"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><linearGradient id="ctl" gradientUnits="userSpaceOnUse" x1="0" y1="18" x2="0" y2="22"><stop offset="0" stop-color="#A44F38"/><stop offset=".45" stop-color="#BE6146"/><stop offset="1" stop-color="#CC7053"/></linearGradient><filter id="ctb" filterUnits="userSpaceOnUse" x="-4" y="-4" width="36" height="32"><feGaussianBlur stdDeviation="1.6"/></filter><filter id="ctm" filterUnits="userSpaceOnUse" x="-4" y="-4" width="36" height="32"><feGaussianBlur stdDeviation=".7"/></filter><filter id="ctn" filterUnits="userSpaceOnUse" x="-4" y="14" width="36" height="14"><feGaussianBlur stdDeviation="1"/></filter><filter id="cts" filterUnits="userSpaceOnUse" x="0" y="0" width="28" height="24"><feGaussianBlur stdDeviation="1.3"/></filter><clipPath id="ctc"><path d="M6 6h16v12H6z"/></clipPath></defs><g filter="url(#ctb)" class="tg"><path fill="#DA7758" d="M6 6h16v12H6zM2 10h4v4H2zM22 10h4v4h-4zM6 18h2v4h-2zM10 18h2v4h-2zM16 18h2v4h-2zM20 18h2v4h-2z"/></g><g filter="url(#ctn)" fill="#000" fill-opacity=".3" shape-rendering="auto"><g class="se"><ellipse cx="10" cy="22.3" rx="7" ry="1.3"/></g><g class="sd"><ellipse cx="18" cy="22.3" rx="7" ry="1.3"/></g></g><g class="te"><rect x="6" y="18" width="2" height="4" fill="url(#ctl)"/><rect x="10" y="18" width="2" height="4" fill="url(#ctl)"/></g><g class="td"><rect x="16" y="18" width="2" height="4" fill="url(#ctl)"/><rect x="16" y="18" width="2" height="4" fill="#000" fill-opacity=".09"/><rect x="20" y="18" width="2" height="4" fill="url(#ctl)"/><rect x="20" y="18" width="2" height="4" fill="#000" fill-opacity=".09"/></g><g class="tb"><g class="ta"><path d="M2 10h4v4H2z" fill="url(#ctv)"/><path d="M2 10h4v4H2z" fill="url(#cth)"/><rect x="2" y="10" width="4" height="1" fill="#fff" fill-opacity=".2"/><rect x="2" y="13" width="4" height="1" fill="#000" fill-opacity=".1"/><path d="M22 10h4v4h-4z" fill="url(#ctv)"/><path d="M22 10h4v4h-4z" fill="url(#cth)"/><rect x="22" y="10" width="4" height="1" fill="#fff" fill-opacity=".1"/><rect x="22" y="13" width="4" height="1" fill="#000" fill-opacity=".1"/></g><path d="M6 6h16v12H6z" fill="url(#ctv)"/><path d="M6 6h16v12H6z" fill="url(#cth)"/><g clip-path="url(#ctc)"><ellipse cx="10.5" cy="7.5" rx="5.5" ry="2.6" fill="#fff" opacity=".15" filter="url(#cts)"/></g><rect x="7" y="6" width="14" height="1" fill="url(#ctr)"/><rect x="6" y="10" width="1" height="4" fill="#000" fill-opacity=".06"/><rect x="21" y="10" width="1" height="4" fill="#000" fill-opacity=".08"/><g class="to"><rect x="8" y="8" width="2" height="3" fill="#1F1E1D"/><rect x="8" y="8" width="2" height="1" fill="url(#ctv)"/><rect x="8" y="9" width="1" height="1" fill="#fff"/><rect x="18" y="8" width="2" height="3" fill="#1F1E1D"/><rect x="18" y="8" width="2" height="1" fill="url(#ctv)"/><rect x="18" y="9" width="1" height="1" fill="#fff"/></g></g></svg>`
const CLAWD_PANICO = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="24" viewBox="0 0 28 24" shape-rendering="crispEdges"><style>.ps{animation:ps 1s steps(1) infinite}@keyframes ps{0%{transform:translateX(2px)}8%{transform:none}16%{transform:translateX(-2px)}24%{transform:translateX(2px)}32%{transform:none}40%{transform:translateX(-2px)}48%{transform:none}}.pe{animation:pb .5s steps(1) infinite}.pd{animation:pb .5s steps(1) infinite -.25s}@keyframes pb{50%{transform:translateY(2px)}}.pg{animation:pg 1s ease-out infinite}@keyframes pg{0%{opacity:.85}60%,100%{opacity:.45}}.pu{animation:pu 1s steps(1) infinite}@keyframes pu{0%{transform:translateY(1px)}48%{transform:none}}.px{animation:px 1s steps(1) infinite}@keyframes px{60%{opacity:.3}}@media (prefers-reduced-motion:reduce){.ps,.pe,.pd,.pg,.pu,.px{animation:none}}</style><defs><linearGradient id="cpv" gradientUnits="userSpaceOnUse" x1="0" y1="6" x2="0" y2="18"><stop offset="0" stop-color="#F28580"/><stop offset=".2" stop-color="#EA615F"/><stop offset=".52" stop-color="#E24B4A"/><stop offset=".84" stop-color="#CC3E3E"/><stop offset="1" stop-color="#A83032"/></linearGradient><linearGradient id="cph" gradientUnits="userSpaceOnUse" x1="2" y1="0" x2="26" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".06"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient><linearGradient id="cpr" gradientUnits="userSpaceOnUse" x1="7" y1="0" x2="21" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset=".55" stop-color="#fff" stop-opacity=".14"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><linearGradient id="cpl" gradientUnits="userSpaceOnUse" x1="0" y1="18" x2="0" y2="22"><stop offset="0" stop-color="#7A2224"/><stop offset=".45" stop-color="#B23638"/><stop offset="1" stop-color="#C4403F"/></linearGradient><filter id="cpb" filterUnits="userSpaceOnUse" x="-4" y="-4" width="36" height="32"><feGaussianBlur stdDeviation="1.6"/></filter><filter id="cpm" filterUnits="userSpaceOnUse" x="-4" y="-4" width="36" height="32"><feGaussianBlur stdDeviation=".7"/></filter><filter id="cpn" filterUnits="userSpaceOnUse" x="-4" y="14" width="36" height="14"><feGaussianBlur stdDeviation="1"/></filter><filter id="cps" filterUnits="userSpaceOnUse" x="0" y="0" width="28" height="24"><feGaussianBlur stdDeviation="1.3"/></filter><clipPath id="cpc"><path d="M6 6h16v12H6z"/></clipPath></defs><defs><linearGradient id="cpy" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="6"><stop offset="0" stop-color="#FFE75A"/><stop offset="1" stop-color="#FFC400"/></linearGradient><filter id="cpx" filterUnits="userSpaceOnUse" x="14" y="-6" width="20" height="20"><feGaussianBlur stdDeviation="1.2"/></filter></defs><g filter="url(#cpn)" fill="#000" fill-opacity=".3" shape-rendering="auto"><g><ellipse cx="10" cy="22.3" rx="7" ry="1.3"/></g><g><ellipse cx="18" cy="22.3" rx="7" ry="1.3"/></g></g><g class="ps"><g filter="url(#cpb)" class="pg"><path fill="#E24B4A" d="M6 6h16v12H6zM2 8h4v4H2zM22 8h4v4h-4zM6 18h2v4h-2zM10 18h2v4h-2zM16 18h2v4h-2zM20 18h2v4h-2z"/></g><rect x="6" y="18" width="2" height="4" fill="url(#cpl)"/><rect x="10" y="18" width="2" height="4" fill="url(#cpl)"/><rect x="16" y="18" width="2" height="4" fill="url(#cpl)"/><rect x="16" y="18" width="2" height="4" fill="#000" fill-opacity=".09"/><rect x="20" y="18" width="2" height="4" fill="url(#cpl)"/><rect x="20" y="18" width="2" height="4" fill="#000" fill-opacity=".09"/><g class="pe"><path d="M2 8h4v4H2z" fill="url(#cpv)"/><path d="M2 8h4v4H2z" fill="url(#cph)"/><rect x="2" y="8" width="4" height="1" fill="#fff" fill-opacity=".2"/><rect x="2" y="11" width="4" height="1" fill="#000" fill-opacity=".1"/></g><g class="pd"><path d="M22 8h4v4h-4z" fill="url(#cpv)"/><path d="M22 8h4v4h-4z" fill="url(#cph)"/><rect x="22" y="8" width="4" height="1" fill="#fff" fill-opacity=".1"/><rect x="22" y="11" width="4" height="1" fill="#000" fill-opacity=".1"/></g><path d="M6 6h16v12H6z" fill="url(#cpv)"/><path d="M6 6h16v12H6z" fill="url(#cph)"/><g clip-path="url(#cpc)"><ellipse cx="10.5" cy="7.5" rx="5.5" ry="2.6" fill="#fff" opacity=".15" filter="url(#cps)"/></g><rect x="7" y="6" width="14" height="1" fill="url(#cpr)"/><rect x="6" y="10" width="1" height="4" fill="#000" fill-opacity=".06"/><rect x="21" y="10" width="1" height="4" fill="#000" fill-opacity=".08"/><rect x="6" y="8" width="4" height="4" fill="#fff"/><rect x="6" y="11" width="4" height="1" fill="#D9D4D2"/><rect x="18" y="8" width="4" height="4" fill="#fff"/><rect x="18" y="11" width="4" height="1" fill="#D9D4D2"/><g class="pu"><rect x="7" y="9" width="2" height="2" fill="#1F1E1D"/><rect x="19" y="9" width="2" height="2" fill="#1F1E1D"/></g><g class="px"><g filter="url(#cpx)" opacity=".6"><rect x="24" y="0" width="2" height="3" fill="url(#cpy)"/><rect x="24" y="4" width="2" height="2" fill="url(#cpy)"/></g><rect x="24" y="0" width="2" height="3" fill="url(#cpy)"/><rect x="24" y="4" width="2" height="2" fill="url(#cpy)"/></g></g></svg>`
// Ícones dos botões do desktop, na família das pílulas (Prensa A e disquete com check)
const ICONE_COMPACTAR = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" role="img" aria-label="Compactar"><title>Compactar</title><style>
.fd{fill:#E9E7E1}.tx{fill:#2B2A27}.mu{fill:#6F6C65}.vz{fill:#000;fill-opacity:.11}.success{fill:#2F8F5B}.warning{fill:#B07C1E}.error{fill:#CF4A40}.none{fill:#6F6C65}
.a-vz{stroke:#000;stroke-opacity:.11}.a-tx{stroke:#2B2A27}.a-mu{stroke:#6F6C65}.a-success{stroke:#2F8F5B}.a-warning{stroke:#B07C1E}.a-error{stroke:#CF4A40}
@media (prefers-color-scheme: dark){.fd{fill:#2D2C2A}.tx{fill:#ECEAE3}.mu{fill:#8F8C83}.vz{fill:#fff}.success{fill:#8CC29A}.warning{fill:#E3B566}.error{fill:#E8776C}.none{fill:#8F8C83}
.a-vz{stroke:#fff}.a-tx{stroke:#ECEAE3}.a-mu{stroke:#8F8C83}.a-success{stroke:#8CC29A}.a-warning{stroke:#E3B566}.a-error{stroke:#E8776C}}
</style><rect class="fd" width="24" height="24" rx="12"/><defs><filter id="b" x="-30%" y="-150%" width="160%" height="400%"><feGaussianBlur stdDeviation="1.6"/></filter></defs><g filter="url(#b)" opacity=".5"><rect class="warning" x="6" y="10" width="12" height="4" rx="2"/></g><rect class="warning" x="6" y="10" width="12" height="4" rx="2"/><path d="M9 4.8 12 7.2l3-2.4M9 19.2l3-2.4 3 2.4" fill="none" class="a-tx" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const ICONE_SALVAR = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" role="img" aria-label="Salvar"><title>Salvar</title><style>.fd{fill:#E9E7E1}.tx{fill:#2B2A27}.vz{fill:#000;fill-opacity:.11}.success{fill:#2F8F5B}.a-tx{stroke:#2B2A27}.a-success{stroke:#2F8F5B}@media (prefers-color-scheme: dark){.fd{fill:#2D2C2A}.tx{fill:#ECEAE3}.vz{fill:#fff}.success{fill:#8CC29A}.a-tx{stroke:#ECEAE3}.a-success{stroke:#8CC29A}}</style><defs><filter id="bs" filterUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><feGaussianBlur stdDeviation="1.6"/></filter></defs><rect class="fd" width="24" height="24" rx="12"/><path class="vz" d="M7 5.5H15.5L18.5 8.5V17A1.5 1.5 0 0 1 17 18.5H7A1.5 1.5 0 0 1 5.5 17V7A1.5 1.5 0 0 1 7 5.5Z"/><path class="a-tx" fill="none" stroke-width="1.25" stroke-opacity=".85" d="M7 5.5H15.5L18.5 8.5V17A1.5 1.5 0 0 1 17 18.5H7A1.5 1.5 0 0 1 5.5 17V7A1.5 1.5 0 0 1 7 5.5Z"/><path class="tx" d="M8.5 5.5h6v3.25c0 .41-.34.75-.75.75h-4.5a.75.75 0 0 1-.75-.75Z"/><rect class="fd" x="12" y="6.25" width="1.25" height="2.25" rx=".5"/><g filter="url(#bs)" opacity=".5"><path class="a-success" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M9.25 14l1.9 1.9 3.6-3.9"/></g><path class="a-success" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M9.25 14l1.9 1.9 3.6-3.9"/></svg>`
let clawdEstado = 'vez'
function mudarClawd($: EngineInterface, estado: string) {
  if (clawdEstado === estado) return
  clawdEstado = estado
  $.ui.invalidate('ui.render')
}
function clawdSvgAgora(subRodando: boolean) {
  if (clawdEstado === 'panico') return { source: CLAWD_PANICO, alt: 'precisa de você' }
  if (clawdEstado === 'trabalhando' || subRodando) return { source: CLAWD_TRABALHANDO, alt: 'trabalhando' }
  return { source: CLAWD_VEZ, alt: 'sua vez' }
}

// Desenho com uma área invisível por cima, que recebe o clique: botão do app só aceita texto
function iconeClicavel(elements: Els, key: string, source: string, alt: string, width: number, height: number) {
  return elements.Box({
    key,
    position: 'relative',
    flexShrink: 0,
    children: [
      elements.Svg({ source, alt, width, height }),
      elements.Box({ key: key + '-clique', position: 'absolute', top: 0, left: 0, children: [elements.Client({ key, module: './clawd.jsx', width: 3, height: 1 })] }),
    ],
  })
}

function pedirCompactar($: EngineInterface) {
  $.ui.toast('Compactando…')
  compactar($)
}

function pedirSalvar($: EngineInterface) {
  if (compactarDepois) {
    $.ui.toast('Já está salvando…')
    return
  }
  compactarDepois = true
  $.ui.toast('Salvando o ESTADO.md… depois compacta sozinho.')
  void $.prompt.submit({ text: PROMPT_ESTADO, asUser: true }).catch(() => {})
}

type Pilula = { source: string; width: number; height: number; alt: string }

function pilula(largura: number, miolo: string, alt: string): Pilula {
  const width = Math.ceil(largura)
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${PILULA_ALTURA}" viewBox="0 0 ${width} ${PILULA_ALTURA}">${PILULA_CSS}<rect class="fd" width="${width}" height="${PILULA_ALTURA}" rx="${PILULA_ALTURA / 2}"/>${miolo}</svg>`
  return { source, width, height: PILULA_ALTURA, alt }
}

// Número em tabular tem largura fixa; a estimativa de `textWidth` conta o 1 como fino e fazia texto vazar
const larguraPilula = (s: string, size: number) =>
  [...s].reduce((w, ch) => w + (/\d/.test(ch) ? 0.56 : ch === '%' ? 0.85 : charEm(ch)) * size, 0)

const textoPilula = (x: number, partes: string) =>
  `<text x="${x}" y="16" font-family="${PILULA_FONTE}" font-size="11.5" style="font-variant-numeric:tabular-nums">${partes}</text>`
const trecho = (texto: string, cls: string, dx = 0, peso = 400) =>
  `<tspan class="${cls}"${dx ? ` dx="${dx}"` : ''}${peso !== 400 ? ` font-weight="${peso}"` : ''}>${xml(texto)}</tspan>`

// Contexto e qualquer janela que não seja a semana: anel, rótulo e número
function pilulaAnel(label: string, used: number, status: Status | null, value: string, reset: string): Pilula {
  const r = 5
  const volta = 2 * Math.PI * r
  const anel = `<circle cx="16" cy="12" r="${r}" fill="none" class="a-vz" stroke-width="2.4"/><circle cx="16" cy="12" r="${r}" fill="none" class="a-${status === 'success' || !status ? 'tx' : status}" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="${((clamp(used) / 100) * volta).toFixed(1)} ${volta.toFixed(1)}" transform="rotate(-90 16 12)"/>`
  const largura = 26 + larguraPilula(label, 11.5) + 5 + larguraPilula(value, 12) + (reset ? 6 + larguraPilula(reset, 11.5) : 0) + 12
  const texto = trecho(label, 'mu') + trecho(value, status && status !== 'success' ? status : 'tx', 5, 600) + (reset ? trecho(reset, 'mu', 6) : '')
  return pilula(largura, anel + textoPilula(26, texto), [label, value, reset].filter(Boolean).join(' '))
}

// A semana: cápsulas cheias com brilho e a célula do tempo contornada
function pilulaSemana(used: number, elapsed: number | null, status: Status | null, reset: string): Pilula {
  const passo = 6
  const cor = status ?? 'none'
  const cheias = Math.round((clamp(used) / 100) * CELULAS)
  const celula = (i: number, cls: string) => `<rect class="${cls}" x="${10 + i * passo}" y="6" width="4" height="12" rx="2"/>`
  let brilho = ''
  let celulas = ''
  for (let i = 0; i < CELULAS; i++) {
    if (i < cheias) brilho += celula(i, cor)
    celulas += celula(i, i < cheias ? cor : 'vz')
  }
  const tempo = elapsed == null ? null : Math.min(CELULAS - 1, Math.floor((elapsed / 100) * CELULAS))
  const contorno = (resto: string) => `<rect class="a-tx" x="${8.5 + (tempo ?? 0) * passo}" y="3.5" width="7" height="17" rx="3" fill="none" ${resto}/>`
  const usado = Math.round(used) + '%'
  const x = 10 + CELULAS * passo + 6
  const largura = x + larguraPilula(usado, 12) + (reset ? 6 + larguraPilula(reset, 11.5) : 0) + 12
  const texto = trecho(usado, 'tx', 0, 600) + (reset ? trecho(reset, 'mu', 6) : '')
  const defs = `<defs><filter id="b" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="1.6"/></filter><filter id="m" x="-80%" y="-30%" width="260%" height="160%"><feGaussianBlur stdDeviation="1.2"/></filter></defs>`
  const onda = ondaSemana(cheias, passo, cor, brilho, tempo, `${cheias}|${cor}|${tempo}|${usado}|${reset}`)
  // As duas linhas do contorno ficam como estão; o respiro e a resposta à luz vêm por cima, em onda.contorno
  const marca = elapsed == null ? '' : contorno('stroke-opacity=".55" stroke-width="1.5" filter="url(#m)"') + contorno('stroke-opacity=".85"') + onda.contorno
  return pilula(largura, `${defs}<g filter="url(#b)" opacity=".5">${brilho}</g>${onda.halo}${celulas}${onda.luz}${marca}${textoPilula(x, texto)}`, [`semana ${usado}`, reset].filter(Boolean).join(' '))
}

const suave = (t: number) => {
  const u = Math.min(1, Math.max(0, t))
  return u * u * (3 - 2 * u)
}

// A curva de luz de uma cápsula: `sobe` segundos para acender, cai em exponencial e chega a zero em `some`
function envelope(t: number, sobe: number, tau: number, some: number) {
  if (t <= 0) return 0
  if (t < sobe) return suave(t / sobe)
  const piso = Math.exp(-(some - sobe) / tau)
  return Math.max(0, (Math.exp(-(t - sobe) / tau) - piso) / (1 - piso))
}

// Quantos passos um trecho de `quadros` quadros precisa. Sempre um divisor: passo fora da grade de 24 fps
// faria cada cápsula repintar num instante próprio, e a soma sairia mais cara que o quadro cheio.
function passos(quadros: number, mudanca: number) {
  for (let k = 1; k < quadros; k++) if (quadros % k === 0 && k >= mudanca) return k
  return quadros
}

// Vira uma curva em @keyframes. Cada trecho reto ganha seus steps() e a curva não precisa de um keyframe por quadro.
// O teto é um passo por quadro de 24 fps. `niveis` baixa isso onde a mudança é menor que um tom da tela: o fim
// lento do rastro repinta poucas vezes por segundo em vez de 24, e a diferença não se vê.
function quadrosCss(nome: string, total: number, valor: (f: number) => number, propriedade: (v: number) => string, folga: number, niveis = Infinity) {
  let css = ''
  let a = 0
  while (a < total) {
    let b = a + 1
    for (let c = a + 2; c <= total; c++) {
      let reta = true
      for (let f = a + 1; f < c && reta; f++) reta = Math.abs(valor(a) + ((valor(c) - valor(a)) * (f - a)) / (c - a) - valor(f)) <= folga
      if (!reta) break
      b = c
    }
    css += `${((a / total) * 100).toFixed(3)}%{${propriedade(valor(a))};animation-timing-function:steps(${passos(b - a, Math.abs(valor(b) - valor(a)) * niveis)})}`
    a = b
  }
  return `@keyframes ${nome}{${css}100%{${propriedade(valor(total))}}}`
}

// A luz que caminha das primeiras cápsulas até onde o uso está. Peças, de baixo para cima:
// halo na cor da cápsula, por baixo, atrasado; brasa de cada cápsula, que acende depois da crista e apaga
// devagar (é ela o rastro); crista clara, recortada nas cápsulas; névoa clarinha por cima, sem recorte.
// Tudo é gradiente e opacidade, porque o SVG inteiro repinta a cada quadro. Nenhum filtro novo.
function ondaSemana(cheias: number, passo: number, cor: string, formas: string, tempo: number | null, chave: string) {
  // A imagem renasce quando o texto muda (o % sobe, o relógio vira). A fase vem do relógio do PC, para a onda
  // continuar de onde estava em vez de voltar ao começo. A guarda faz a mesma pílula dar sempre a mesma string.
  if (!ondaGuardada.has(chave)) {
    if (ondaGuardada.size > 8) ondaGuardada.clear()
    ondaGuardada.set(chave, montarOnda(cheias, passo, cor, formas, tempo))
  }
  return ondaGuardada.get(chave) as OndaPecas
}

function montarOnda(cheias: number, passo: number, cor: string, formas: string, tempo: number | null): OndaPecas {
  const tons = (ONDA_TONS[cor] ?? ONDA_TONS.none) as [string, string, string, string]
  const F = ONDA_FPS
  // Sem uso não há onda, e a pílula fica parada: nada repinta
  if (!cheias) return { halo: '', luz: '', contorno: '' }

  // O caminho da crista, quadro a quadro: sai devagar, cruza, e freia ao chegar na última cápsula
  const partida = 9
  const fim = 10 + (cheias - 1) * passo + 2
  const pos = [partida]
  for (let x = partida; x < fim - 0.01; pos.push(x)) {
    const v = ONDA_VELOCIDADE * Math.min(0.45 + 0.55 * suave((x - partida) / 8), 0.14 + 0.86 * suave((fim - x) / 14))
    x = Math.min(fim, x + v / F)
  }
  const andar = pos.length - 1
  const total = andar + Math.round(3.4 * F)
  const periodo = total / F
  const chega = (i: number) => {
    const alvo = Math.min(fim, 12 + i * passo)
    const f = pos.findIndex((x) => x >= alvo)
    return f < 0 ? andar : f
  }
  const fase = Math.round(((Date.now() / 1000) % periodo) * F)
  // Todas as peças usam atraso negativo: a imagem já abre no meio do ciclo, sem tela preta
  const atraso = (quadro: number) => `animation-delay:${((((((quadro - fase) % total) + total) % total) - total) / F).toFixed(3)}s`
  const dur = `${periodo.toFixed(4)}s infinite`

  // Brasa comum: acende antes de a crista sair da cápsula e passa do pico depois dela
  const antes = Math.round(0.42 * F)
  const brasa = (f: number) => envelope(f / F, 0.8, 2, 4.6)
  // A última cápsula recebe a luz inteira: sobe mais devagar e guarda mais tempo
  const sobeFim = Math.round(0.75 * F)
  const brasaFim = (f: number) => envelope(f / F, 1.35, 1.25, 3.95)
  const opac = (v: number) => `opacity:${v.toFixed(3)}`
  const crista = (f: number) => suave(f / (2 * F)) * (1 - suave((f - (andar - 1.1 * F)) / (1.6 * F)))
  // O halo chega depois da luz e sai antes dela: não pode virar nuvem na ponta esquerda nem sobre as vazias
  const halo = (f: number) => suave(f / (2.6 * F)) * (1 - suave((f - (andar - 3 * F)) / (1.9 * F)))
  const css = `<style>.o-a,.o-n,.o-e,.o-f,.o-v,.o-q,.o-k,.o-r{opacity:0}
.o-a{animation:o-x ${dur},o-a ${dur}}.o-n{animation:o-x ${dur},o-n ${dur}}.o-e{animation:o-e ${dur}}.o-f{animation:o-f ${dur}}.o-v{animation:o-v ${dur}}.o-k{animation:o-k ${dur}}.o-r{animation:o-r ${dur}}
${quadrosCss('o-x', total, (f) => pos[Math.min(f, andar)] ?? fim, (v) => `transform:translateX(${v.toFixed(2)}px)`, 0.03)}
${quadrosCss('o-a', total, crista, opac, 0.012, 190)}
${quadrosCss('o-n', total, halo, opac, 0.012, 90)}
${quadrosCss('o-e', total, brasa, opac, 0.012, 140)}
${quadrosCss('o-f', total, brasaFim, opac, 0.012, 150)}
${quadrosCss('o-v', total, (f) => envelope(f / F, 0.8, 0.8, 2.6), opac, 0.015, 40)}
${quadrosCss('o-k', total, (f) => envelope(f / F, 0.7, 0.75, 2.5), opac, 0.015, 90)}
${quadrosCss('o-r', total, (f) => 0.3 + 0.7 * Math.sin((Math.PI * f) / total) ** 2, opac, 0.01, 40)}
.o-l{stop-color:${tons[0]}}.o-b{stop-color:${tons[1]}}.o-h{stop-opacity:.28}.o-y{fill-opacity:.4}
@media (prefers-color-scheme: dark){.o-l{stop-color:${tons[2]}}.o-b{stop-color:${tons[3]}}.o-h{stop-opacity:.34}.o-y{fill-opacity:1}}
@media (prefers-reduced-motion: reduce){.o-r{animation:none;opacity:.5}.o-a,.o-n,.o-e,.o-v,.o-k{animation:none}.o-f{animation:none;opacity:.42}.o-q{opacity:1}}</style>`

  const degrade = (id: string, classe: string, pontos: [number, number][], extra: string) =>
    `<radialGradient id="${id}" ${extra}>${pontos.map(([o, a]) => `<stop offset="${o}" class="${classe}" stop-opacity="${a}"/>`).join('')}</radialGradient>`
  const defs = `<defs>${degrade('ol', 'o-l', [[0, 0.74], [0.22, 0.6], [0.48, 0.27], [0.74, 0.07], [1, 0]], 'cx=".46" cy=".44" r=".5" fx=".62" fy=".42"')}
${degrade('oz', 'o-l', [[0, 0.17], [0.4, 0.09], [0.75, 0.02], [1, 0]], 'cx=".5" cy=".46" r=".5"')}
<radialGradient id="oh"><stop offset="0" class="p-${cor} o-h"/><stop offset=".45" class="p-${cor}" stop-opacity=".12"/><stop offset=".78" class="p-${cor}" stop-opacity=".03"/><stop offset="1" class="p-${cor}" stop-opacity="0"/></radialGradient>
<linearGradient id="og" gradientUnits="userSpaceOnUse" x1="0" y1="6" x2="0" y2="18"><stop offset="0" class="o-b"/><stop offset=".55" class="o-b" stop-opacity=".86"/><stop offset="1" class="o-b" stop-opacity=".5"/></linearGradient>
<linearGradient id="oq" gradientUnits="userSpaceOnUse" x1="${Math.max(10, fim - 42)}" y1="0" x2="${fim + 2}" y2="0"><stop offset="0" class="o-b" stop-opacity="0"/><stop offset="1" class="o-b" stop-opacity=".3"/></linearGradient>
<clipPath id="oc">${formas.replace(/ class="[^"]*"/g, '')}</clipPath></defs>`

  // A onda junta força nas primeiras cápsulas, em vez de já nascer inteira
  const forca = (i: number) => Math.min(1, 0.5 + i * 0.22) * (ONDA_GRAOS[i] ?? 1) * 0.7
  const capsula = (classe: string, i: number, opacidade: number, quadro: number, tinta = 'url(#og)') =>
    `<rect class="${classe}" x="${10 + i * passo}" y="6" width="4" height="12" rx="2" fill="${tinta}" fill-opacity="${opacidade.toFixed(3)}" style="${atraso(quadro)}"/>`
  let brasas = ''
  for (let i = 0; i < cheias - 1; i++) brasas += capsula('o-e', i, forca(i), chega(i) - antes)
  // A última guarda a luz que chegou. É a única que sobe acima das outras, e pouco
  brasas += capsula('o-f', cheias - 1, Math.min(1, forca(cheias - 1) * 1.2), andar - sobeFim)
  // Refluxo: duas cápsulas antes da última sentem um retorno bem fraco, como água voltando da areia
  for (let k = 1; k <= 2 && cheias - 1 - k >= 0; k++) brasas += capsula('o-v', cheias - 1 - k, 0.15 / k, andar + Math.round((0.55 + k * 0.34) * F))
  // O que sobra passa para as vazias só como reflexo, e para na segunda
  for (let k = 0; k < 2 && cheias + k < CELULAS; k++) brasas += capsula('o-v', cheias + k, k ? 0.035 : 0.09, andar + Math.round((0.3 + k * 0.42) * F))

  // O contorno sente a luz quando ela passa por baixo; fora da parte cheia sente menos, e de longe nada
  const distancia = tempo == null ? -1 : Math.max(0, tempo - (cheias - 1))
  const alcance = ONDA_ALCANCE_CONTORNO[distancia] ?? 0
  // O respiro do contorno acompanha a onda e não usa o filtro: animar o brilho filtrado custava mais que as brasas todas
  const respira = tempo == null ? '' : `<rect class="o-r a-tx" x="${8.5 + tempo * passo}" y="3.5" width="7" height="17" rx="3" fill="none" stroke-width="2.6" stroke-opacity=".1" style="${atraso(0)}"/>`
  const resposta = tempo != null && alcance > 0
    ? `<rect class="o-k a-tx" x="${8.5 + tempo * passo}" y="3.5" width="7" height="17" rx="3" fill="none" stroke-width="1.1" stroke-opacity="${(alcance * 0.62).toFixed(3)}" style="${atraso(distancia ? andar + Math.round(0.28 * distancia * F) : chega(tempo) - Math.round(0.3 * F))}"/>`
    : ''

  const peca = (rx: number, largura: number, tinta: string, quadro: number, classe = 'o-a') =>
    `<rect class="${classe}" x="${rx}" y="0" width="${largura}" height="${PILULA_ALTURA}" fill="url(#${tinta})" style="${atraso(quadro)}"/>`
  const calma = `<g clip-path="url(#oc)"><rect class="o-q" x="0" y="0" width="${fim + 4}" height="${PILULA_ALTURA}" fill="url(#oq)"/></g>`
  return {
    halo: `${css}${defs}${peca(-18, 36, 'oh', Math.round(0.42 * F), 'o-n')}`,
    luz: `${brasas}${calma}<g clip-path="url(#oc)">${peca(-13, 26, 'ol', 0)}</g>${peca(-12, 24, 'oz', 0, 'o-a o-y')}`,
    contorno: respira + resposta,
  }
}

function pilulaCache(texto: string, status: Status): Pilula {
  const relogio = `<circle cx="14" cy="12" r="4.5" fill="none" class="a-mu" stroke-width="1.2"/><path d="M14 9.5v2.5l1.7 1.2" fill="none" class="a-mu" stroke-width="1.2" stroke-linecap="round"/>`
  return pilula(23 + larguraPilula(texto, 12) + 12, relogio + textoPilula(23, trecho(texto, status === 'success' ? 'tx' : status, 0, 500)), `cache ${texto}`)
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

// ---- Semana ----
// A faixa mostra a semana: uso em cápsulas e um contorno marcando onde o tempo está. Cápsula antes do
// contorno = você está atrás do tempo e vai sobrar cota. O medidor de ritmo (palavra, barrinhas e
// %/h) foi tirado em 30/10/2026: o Cezar viu que o contorno já diz isso. O que ficou de fora dali é o
// câmbio de `custoTotal`: dólar por ponto, medido em 30/10/2026 em cinco trechos (23,3 a 24,2, igual antes
// e depois de virar Ultra). Soma o gasto de todas as sessões da conta, e a cada 4 pontos se recalibra.
const GASTO_PREFIX = 'gasto:'
const MARCOS_PREFIX = 'marcos:'
const CAMBIO_PREFIX = 'usdPorPonto:'
const BALDE_MS = 5 * 60_000
// Cada sessão guarda só estas horas de gasto, e o câmbio só mede dentro delas
const HORIZONTE_MS = 6 * HOUR_MS
const PONTOS_POR_MEDIDA = 4
const PESO_MEDIDA = 0.3
const SEMANA_MS = 7 * 24 * HOUR_MS
// Seis semanas de gasto (set–out/2026): 98% fica entre 7h e 23h de Rondônia, e sábado e domingo rendem
// 40% e 20% de um dia de semana. O contorno e a cor contam só essas horas, com esse peso.
const UTIL_INICIO = 7
const UTIL_FIM = 23
const PESO_DIA = [0.2, 1, 1, 1, 1, 1, 0.4] // domingo a sábado
// Abaixo destas horas úteis a média da semana ainda não diz nada
const MIN_HORAS_PREVISAO = 8
// Fechar a semana abaixo disto é deixar cota sobrando
const FECHA_BOM = 85

type Gasto = { conta: number; baldes: Record<string, number> }
type Marco = { at: number; pct: number }
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

// Onde a semana fecha mantendo a média por hora útil; só depois de horas suficientes para dizer algo
function previsaoSemana(used: number, resetsAt: number, agoraMs: number): number | null {
  const feitas = horasUteis(resetsAt - SEMANA_MS, agoraMs)
  return feitas >= MIN_HORAS_PREVISAO ? used + (used / feitas) * horasUteis(agoraMs, resetsAt) : null
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

async function atualizarSemana($: EngineInterface) {
  const agoraMs = await $.clock.now()
  const conta = contaDe(rateLimits)
  await anotarGasto($, conta, agoraMs)
  const semana = rateLimits.find((l) => l.kind === 'seven_day')
  if (!semana || conta == null) return
  usdPorPonto = ((await $.store.get(CAMBIO_PREFIX + conta)) as number | undefined) ?? USD_POR_PONTO
  await marcarPonto($, semana.percentUsed, conta, agoraMs, await lerGastos($, conta, agoraMs))
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
  await atualizarSemana($).catch(() => {})
  await faxinaLoja($).catch(() => {})
  ticker = $.clock.every(TICK_MS, async () => {
    await refresh($)
    await atualizarSemana($).catch(() => {})
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
