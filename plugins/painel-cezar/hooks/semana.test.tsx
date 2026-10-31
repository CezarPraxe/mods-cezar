import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, SessionUsage } from 'claude-code'

// Sexta 30/10/2026, 22h em Rondônia; a semana vira sábado, 11h: faltam 1h + 4h de sábado a 40% = 2,6h úteis
const AGORA = Date.parse('2026-10-31T02:00:00Z')
const RESET = '2026-10-31T15:00:00.000Z'
const OUTRA_CONTA = '2026-11-02T07:00:00.000Z'
const contaDe = (iso: string) => Math.round(Date.parse(iso) / 60_000) % (7 * 24 * 60)
const balde = (minutosAtras: number) => String(Math.floor((AGORA - minutosAtras * 60_000) / (5 * 60_000)))

const uso = (percentUsed: number, resetsAt = RESET) => ({
  startedAt: 0,
  context: { percent: 10 },
  cost: { usd: 1 },
  rateLimits: [{ kind: 'seven_day', percentUsed, resetsAt }],
})

// O terminal desenha em texto, o que dá para ler; o desktop desenha SVG
const FAIXA = {
  plugin: 'painel-cezar',
  component: 'AbovePrompt',
  surface: 'terminal',
  props: { bodyColumns: 120 },
} as const

function preparar(on: On, valor: unknown, loja: Record<string, unknown> = {}, agora = AGORA) {
  // Loja própria, em vez de mock.store: o teste precisa ver o que o mod grava
  const gravado: Record<string, unknown> = {}
  const memoria = new Map(Object.entries(loja))
  on('store.get', (_, e) => ({ value: memoria.get(e.key) }))
  on('store.keys', () => ({ value: [...memoria.keys()] }))
  on('store.delete', (_, e) => {
    memoria.delete(e.key)
    return { value: undefined }
  })
  on('store.set', (_, e) => {
    memoria.set(e.key, e.value)
    gravado[e.key] = e.value
    return { value: undefined }
  })
  mock.clock(on, { now: agora })
  mock.env(on, {})
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: valor as SessionUsage }))
  on('session.id', () => ({ value: 'sessao-teste' }))
  on('settings.read', () => ({ value: {} }))
  on('command.register', () => ({ value: { command: 'agents-info' } }))
  // A faixa desenha o que os mods de baixo devolvem: aqui, uma caixa vazia
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return gravado
}

async function corDaSemana($: Engine, pct: number) {
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(FAIXA as never)
  const texto = await ui.find({ type: 'Text', text: pct + '%' })
  await ui.unmount()
  return (texto as { props?: { color?: string } } | undefined)?.props?.color
}

test('a semana mostra só o uso, sem previsão nem ritmo', async ($, on) => {
  preparar(on, uso(48))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(FAIXA as never)
  const textos = (await ui.findAll({ type: 'Text' })).map((t) => t.text).join(' ')
  await ui.unmount()
  expect(textos).toMatch(/48%/)
  expect(textos).not.toMatch(/→|pouco|muito|%\/h/)
})

test('fim de semana com sobra fica amarelo', async ($, on) => {
  preparar(on, uso(48))
  expect(await corDaSemana($, 48)).toBe('warning')
})

test('fim de semana quase no limite fica verde', async ($, on) => {
  preparar(on, uso(96))
  expect(await corDaSemana($, 96)).toBe('success')
})

test('gasto que estoura antes da virada fica vermelho', async ($, on) => {
  // Quinta 13h: 78 pontos em ~66h úteis fecham acima de 100
  preparar(on, uso(78), {}, Date.parse('2026-10-29T17:00:00Z'))
  expect(await corDaSemana($, 78)).toBe('error')
})

test('no desktop são pílulas de uma linha, sem a de ritmo', async ($, on) => {
  preparar(on, uso(48))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...FAIXA, surface: 'desktop' } as never)
  for (const key of ['meter-ctx', 'meter-sem']) expect(await ui.find({ key })).toBeTruthy()
  expect(await ui.find({ key: 'meter-ritmo' })).toBeFalsy()
  await ui.unmount()
})

test('quatro pontos recalibram o câmbio, só com o gasto da mesma conta', async ($, on) => {
  const conta = contaDe(RESET)
  const gravado = preparar(on, uso(48), {
    ['marcos:' + conta]: [{ at: AGORA - 60 * 60_000, pct: 44 }],
    'gasto:a': { conta, baldes: { [balde(30)]: 240 } },
    'gasto:b': { conta: contaDe(OUTRA_CONTA), baldes: { [balde(30)]: 9999 } },
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  // US$ 240 em 4 pontos = 60; pesa 30% sobre os 23,5 iniciais
  expect(Math.round(Number(gravado['usdPorPonto:' + conta]) * 100)).toBe(3445)
})

test('queda de 1 ponto é leitura atrasada e não apaga os marcos', async ($, on) => {
  const conta = contaDe(RESET)
  const marcos = [{ at: AGORA - 10 * 60_000, pct: 48 }]
  const gravado = preparar(on, uso(47), { ['marcos:' + conta]: marcos })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(gravado['marcos:' + conta]).toBeUndefined()
})
