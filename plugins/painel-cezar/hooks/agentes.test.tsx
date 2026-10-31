import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { AgentRun, Panel } from '../types'

// Sábado 31/10/2026, 11h em Rondônia
const AGORA = Date.parse('2026-10-31T15:00:00Z')
const MIN = 60_000

const agente = (id: string, extra: Partial<AgentRun> = {}): AgentRun => ({
  id,
  agentId: id,
  type: 'executor-haiku-medio',
  description: 'Tarefa ' + id,
  model: 'claude-haiku-5-5',
  status: 'running',
  startedAt: AGORA - 11 * MIN,
  ultimoPasso: AGORA - MIN,
  costUsd: 0.01,
  steps: 3,
  round: 1,
  ...extra,
})
const feito = (id: string, extra: Partial<AgentRun> = {}) => agente(id, { status: 'done', endedAt: AGORA - 3 * MIN, ...extra })
const caido = (id: string, minAtras = 1) => agente(id, { status: 'failed', endedAt: AGORA - minAtras * MIN })

type Cena = { lista?: AgentRun[]; painel?: Panel }

// Estado guardado pelo teste, como o engine o guardaria. O kit não redesenha por aqui: quem precisa da tela nova remonta.
let estado: Record<string, unknown> = {}
function preparar(on: On, { lista = [], painel = {} }: Cena) {
  estado = { ag_agents: lista, ag_panel: painel, ag_now: AGORA }
  const versao: Record<string, number> = {}
  on('state.get', (_, e) => (e.key in estado ? { value: { value: estado[e.key], version: versao[e.key] ?? 1 } } : { value: undefined }) as never)
  on('state.set', (_, e) => {
    estado[e.key] = e.value
    versao[e.key] = (versao[e.key] ?? 1) + 1
    return { value: { isSet: true, version: versao[e.key] } } as never
  })
  mock.clock(on, { now: AGORA })
  mock.env(on, {})
  on('store.get', () => ({ value: undefined }))
  on('store.keys', () => ({ value: [] }))
  on('store.set', () => ({ value: undefined }))
  on('store.delete', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { percent: 10 }, cost: { usd: 1 }, rateLimits: [] } as never }))
  on('session.id', () => ({ value: 'teste' }))
  on('settings.read', () => ({ value: { language: 'portuguese' } }))
  on('command.register', () => ({ value: { command: 'agents-info' } }))
}

const lerLista = () => estado.ag_agents as AgentRun[]

const PAINEL = (surface: string, cols: number) =>
  ({
    plugin: 'painel-cezar',
    surface,
    component: 'Pane',
    requestId: 'agentes-cezar',
    props: { title: 'Agentes', isFocused: false, bodyColumns: cols, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
  }) as never

async function montar($: Engine, surface = 'desktop', cols = 46) {
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  return $.ui.mount(PAINEL(surface, cols))
}

type Montado = Awaited<ReturnType<typeof montar>>
const desenhos = async (ui: Montado) =>
  (await ui.findAll({ type: 'Svg' })).map(s => s.props as { source: string; alt: string; width: number; height: number })
const areas = async (ui: Montado) => (await ui.findAll({ type: 'Client' })).map(c => c.key)
// `post` existe no kit do engine; os tipos instalados na pasta do mod são mais velhos que ele
const clicar = (ui: Montado, dados: unknown, alvo: unknown) => (ui as unknown as { post: (d: unknown, a: unknown) => Promise<void> }).post(dados, alvo)
const naVisao = (on: On, f: unknown) => (on as unknown as (nome: string, g: unknown) => void)('ui.view', f)
const tudo = async (ui: Montado) => JSON.stringify(await ui.drawn())
const remontar = async ($: Engine, ui: Montado, surface = 'desktop', cols = 46) => {
  await ui.unmount()
  return $.ui.mount(PAINEL(surface, cols))
}

test('cada linha, rodando, concluída ou com erro, tem a área do seu próprio agente', async ($, on) => {
  preparar(on, { lista: [agente('r1'), agente('r2'), feito('f1'), caido('e1')], painel: { concluidosAbertos: true } })
  const ui = await montar($)
  expect(await areas(ui)).toEqual(['agente:e1', 'agente:r1', 'agente:r2', 'concluidos', 'agente:f1'])
  await ui.unmount()
})

test('clicar na linha abre a conversa daquele agente, com o id certo, nos três estados', async ($, on) => {
  const lidos: unknown[] = []
  preparar(on, { lista: [agente('r1'), feito('f1'), caido('e1')], painel: { concluidosAbertos: true } })
  on('session.messages', (_, e) => {
    const id = (e as { agentId?: string }).agentId
    lidos.push(id)
    return { value: [{ role: 'user', text: 'Faça isto', toolUses: [] }, { role: 'assistant', text: 'Feito por ' + id, toolUses: [{ tool_use_id: 't', tool: 'Read', input: { file_path: 'a.md' } }] }] } as never
  })
  let ui = await montar($)
  for (const id of ['r1', 'f1', 'e1']) {
    await clicar(ui, { abrir: 'agentes' }, { in: 'agente:' + id } as never)
    ui = await remontar($, ui)
    const texto = await tudo(ui)
    expect(texto).toContain('Feito por ' + id)
    expect(texto).toContain('Read · a.md')
    await ui.press({ key: 'voltar' })
    ui = await remontar($, ui)
    expect(await ui.find({ type: 'Client' })).toBeDefined()
  }
  expect(lidos).toEqual(expect.arrayContaining(['r1', 'f1', 'e1']))
  await ui.unmount()
})

test('clique de verdade na área: o clawd.jsx avisa o hook e abre o agente daquela linha', async ($, on) => {
  const lidos: unknown[] = []
  preparar(on, { lista: [agente('r1'), agente('r2')] })
  on('session.messages', (_, e) => {
    lidos.push((e as { agentId?: string }).agentId)
    return { value: [] } as never
  })
  let ui = await montar($)
  const clique = { x: 1, y: 0, button: 'left', in: 'agente:r2' } as never
  await (ui as unknown as { pointer: (ev: unknown) => Promise<void> }).pointer({ ...(clique as object), type: 'up' })
  expect((estado.ag_panel as Panel).abertoId).toBe('r2')
  ui = await remontar($, ui)
  expect(lidos).toEqual(['r2'])
  await ui.unmount()
})

test('conversa que o engine recusa diz o motivo, sem quebrar o painel', async ($, on) => {
  preparar(on, { lista: [feito('f1')], painel: { abertoId: 'f1' } })
  on('session.messages', () => ({ value: { deny: 'no conversation for f1' } }) as never)
  const ui = await montar($)
  expect(await ui.find({ type: 'Text', text: /no conversation for f1/ })).toBeDefined()
  await ui.unmount()
})

test('erro fica no topo até ser aberto; aberto, desce para os concluídos', async ($, on) => {
  preparar(on, { lista: [agente('r1'), caido('e1', 135)], painel: { concluidosAbertos: true } })
  on('session.messages', () => ({ value: [] }) as never)
  let ui = await montar($)
  expect((await desenhos(ui))[1]?.alt).toContain('parou com erro há 2h15')
  await clicar(ui, {}, { in: 'agente:e1' } as never)
  expect(lerLista().find(a => a.id === 'e1')?.erroVisto).toBe(true)
  ui = await remontar($, ui)
  await ui.press({ key: 'voltar' })
  ui = await remontar($, ui)
  expect(await areas(ui)).toEqual(['agente:r1', 'concluidos', 'agente:e1'])
  await ui.unmount()
})

test('interrupção não vira erro; recusa e falha viram, e resposta conclui', async ($, on) => {
  preparar(on, { lista: [agente('a'), agente('b'), agente('c'), agente('d')] })
  on('turn.complete', () => ({ text: '' }) as never)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const [agentId, reason] of [['a', 'aborted'], ['b', 'refusal'], ['c', 'error'], ['d', 'answer']] as const) {
    await $.turn.complete({ agentId, reason, answer: 'ok', durationMs: 1, isAborted: reason === 'aborted', turnId: 't', text: '' } as never)
  }
  expect(Object.fromEntries(lerLista().map(a => [a.id, a.status]))).toEqual({ a: 'stopped', b: 'failed', c: 'failed', d: 'done' })
})

test('agente parado há 5 min ou mais ganha o aviso; antes disso, não', async ($, on) => {
  preparar(on, { lista: [agente('q', { ultimoPasso: AGORA - 6 * MIN }), agente('v', { ultimoPasso: AGORA - 4 * MIN })] })
  const ui = await montar($)
  const [, q, v] = await desenhos(ui)
  expect(q?.source).toContain('sem novidade há 6 min')
  expect(v?.source).not.toContain('sem novidade')
  await ui.unmount()
})

test('tarefa repetida diz a tentativa, e os números técnicos sumiram', async ($, on) => {
  preparar(on, { lista: [agente('t', { round: 2 })] })
  const ui = await montar($)
  const fonte = (await desenhos(ui))[1]?.source ?? ''
  expect(fonte).toContain('Executor · Haiku · 2ª tentativa')
  expect(fonte).toContain('11 min')
  for (const velho of ['ctx', '% sem', '≈', 'tokens']) expect(fonte).not.toContain(velho)
  await ui.unmount()
})

test('custo só no total, nunca por agente, e sem 0,00%', async ($, on) => {
  preparar(on, { lista: [agente('r1'), feito('f1', { costUsd: 23.5 }), feito('f2', { costUsd: 0.001 })], painel: { concluidosAbertos: true } })
  const ui = await montar($)
  const lista = await desenhos(ui)
  const comCusto = lista.filter(s => s.source.includes('% da semana'))
  expect(comCusto).toHaveLength(1)
  expect(comCusto[0]?.source).toContain('cerca de 1,0% da semana')
  expect(JSON.stringify(lista)).not.toContain('0,00')
  await ui.unmount()
})

test('concluídos: fechados com alguém rodando, e o clique alterna', async ($, on) => {
  preparar(on, { lista: [agente('r1'), feito('f1')] })
  let ui = await montar($)
  expect(await areas(ui)).toEqual(['agente:r1', 'concluidos'])
  await clicar(ui, {}, { in: 'concluidos' } as never)
  ui = await remontar($, ui)
  expect(await areas(ui)).toEqual(['agente:r1', 'concluidos', 'agente:f1'])
  await ui.unmount()
})

test('ninguém rodando abre os concluídos sozinho', async ($, on) => {
  preparar(on, { lista: [feito('f1')] })
  const ui = await montar($)
  expect(await areas(ui)).toEqual(['concluidos', 'agente:f1'])
  await ui.unmount()
})

test('vazio: uma frase e o Clawd, sem zeros', async ($, on) => {
  preparar(on, {})
  const ui = await montar($)
  const lista = await desenhos(ui)
  expect(lista).toHaveLength(1)
  expect(lista[0]?.source).toContain('Ninguém trabalhando agora')
  await ui.unmount()
})

test('a imagem da linha não muda dentro do minuto: é o que deixa a animação correr', async ($, on) => {
  preparar(on, { lista: [agente('r1')] })
  const ui = await montar($)
  const antes = (await desenhos(ui))[1]?.source
  await ui.unmount()
  estado.ag_now = AGORA + 40_000
  const ui2 = await $.ui.mount(PAINEL('desktop', 46))
  expect((await desenhos(ui2))[1]?.source).toBe(antes)
  await ui2.unmount()
})

test('painel estreito: tudo cabe nos 240 px mínimos', async ($, on) => {
  preparar(on, { lista: [agente('longa', { description: 'Levantar julgados sobre TUSD fio B na Turma Recursal do Tribunal de Justiça de Rondônia' }), feito('f1'), caido('e1')], painel: { concluidosAbertos: true } })
  const ui = await montar($, 'desktop', 31)
  const lista = await desenhos(ui)
  expect(lista.length).toBeGreaterThan(3)
  for (const s of lista) expect(s.width).toBe(240)
  expect(JSON.stringify(lista)).toContain('…')
  await ui.unmount()
})

test('peso: 12 rodando e 30 concluídos custam menos de 130 mil caracteres por redesenho', async ($, on) => {
  const lista = [...Array.from({ length: 30 }, (_, i) => feito('f' + i)), ...Array.from({ length: 12 }, (_, i) => agente('r' + i))]
  preparar(on, { lista })
  const ui = await montar($)
  const total = (await desenhos(ui)).reduce((s, f) => s + f.source.length, 0)
  expect(total).toBeLessThan(130_000)
  await ui.unmount()
})

test('terminal: texto puro, e o botão de cada linha abre aquele agente na visão principal', async ($, on) => {
  const vistos: unknown[] = []
  preparar(on, { lista: [agente('r1'), feito('f1'), caido('e1')], painel: { concluidosAbertos: true } })
  naVisao(on, (_: unknown, e: unknown) => {
    vistos.push((e as { agentId?: string }).agentId)
    return { value: {} }
  })
  const ui = await montar($, 'terminal', 80)
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  expect(await ui.find({ type: 'Client' })).toBeUndefined()
  await ui.press({ key: 'ver:r1' })
  await ui.press({ key: 'ver:f1' })
  await ui.press({ key: 'ver:e1' })
  expect(vistos).toEqual(['r1', 'f1', 'e1'])
  await ui.unmount()
})

test('sem visão principal, o botão cai na conversa dentro do painel', async ($, on) => {
  preparar(on, { lista: [agente('r1')] })
  naVisao(on, () => ({ value: { deny: 'no main view here' } }))
  on('session.messages', () => ({ value: [{ role: 'assistant', text: 'Oi do r1', toolUses: [] }] }) as never)
  let ui = await montar($, 'terminal', 80)
  await ui.press({ key: 'ver:r1' })
  ui = await remontar($, ui, 'terminal', 80)
  expect(await tudo(ui)).toContain('Oi do r1')
  await ui.unmount()
})

test('editor, sem Client: cada linha traz um botão de texto', async ($, on) => {
  preparar(on, { lista: [agente('r1')] })
  const ui = await montar($, 'vscode')
  expect(await ui.find({ type: 'Client' })).toBeUndefined()
  expect(await ui.find({ key: 'b:agente:r1' })).toBeDefined()
  await ui.unmount()
})
