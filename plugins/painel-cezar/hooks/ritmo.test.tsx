import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, SessionUsage } from 'claude-code'

// Sexta 30/10/2026, 22h em Rondônia; a semana vira sábado, 11h: faltam 1h + 4h de sábado a 40% = 2,6h úteis
const AGORA = Date.parse('2026-10-31T02:00:00Z')
const RESET = '2026-10-31T15:00:00.000Z'
const OUTRA_CONTA = '2026-11-02T07:00:00.000Z'
const contaDe = (iso: string) => Math.round(Date.parse(iso) / 60_000) % (7 * 24 * 60)
const balde = (minutosAtras: number) => String(Math.floor((AGORA - minutosAtras * 60_000) / (5 * 60_000)))

const USO = { startedAt: 0, context: { percent: 10 }, cost: { usd: 1 }, rateLimits: [{ kind: 'seven_day', percentUsed: 48, resetsAt: RESET }] }

// Os testes de cálculo leem o terminal, que desenha em texto; o desktop desenha SVG
const FAIXA = {
  plugin: 'painel-cezar',
  component: 'AbovePrompt',
  surface: 'terminal',
  props: { bodyColumns: 120 },
} as const

function preparar(on: On, uso: unknown, loja: Record<string, unknown>) {
  mock.clock(on, { now: AGORA })
  mock.store(on, loja)
  mock.env(on, {})
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: uso as SessionUsage }))
  on('session.id', () => ({ value: 'sessao-teste' }))
  on('settings.read', () => ({ value: {} }))
  on('command.register', () => ({ value: { command: 'agents-info' } }))
  // A faixa desenha o que os mods de baixo devolvem: aqui, uma caixa vazia
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
}

async function faixa($: Engine) {
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(FAIXA as never)
  const textos = (await ui.findAll({ type: 'Text' })).map((t) => t.text).join(' ')
  await ui.unmount()
  return textos
}

test('soma o gasto de todas as sessões da conta e ignora a outra conta', async ($, on) => {
  preparar(on, USO, {
    'gasto:a': { conta: contaDe(RESET), baldes: { [balde(10)]: 60 } },
    'gasto:b': { conta: contaDe(RESET), baldes: { [balde(30)]: 60 } },
    'gasto:c': { conta: contaDe(OUTRA_CONTA), baldes: { [balde(10)]: 999 } },
  })
  const textos = await faixa($)
  // US$ 120 em 1h a US$ 23,5 por ponto ≈ 5,1 %/h; a meta é 52 pontos em 2,6h úteis = 20 %/h
  expect(textos).toMatch(/pouco/)
  expect(textos).toMatch(/5,1 de 20%\/h/)
})

test('gasto no tamanho da meta fica no ritmo', async ($, on) => {
  preparar(on, USO, { 'gasto:a': { conta: contaDe(RESET), baldes: { [balde(10)]: 470 } } })
  expect(await faixa($)).toMatch(/no ritmo/)
})

test('gasto bem acima da meta vira muito', async ($, on) => {
  preparar(on, USO, { 'gasto:a': { conta: contaDe(RESET), baldes: { [balde(10)]: 1000 } } })
  expect(await faixa($)).toMatch(/muito/)
})

test('sem gasto na última hora fica parado, sem alarme', async ($, on) => {
  preparar(on, USO, {})
  expect(await faixa($)).toMatch(/parado/)
})

test('a semana mostra onde vai fechar pela média das horas úteis', async ($, on) => {
  preparar(on, USO, {})
  // 48 pontos em 87h úteis feitas + 2,6h que faltam ≈ 49%
  expect(await faixa($)).toMatch(/48% → 49%/)
})

test('o câmbio salvo da conta manda no cálculo', async ($, on) => {
  preparar(on, USO, {
    ['usdPorPonto:' + contaDe(RESET)]: 10,
    'gasto:a': { conta: contaDe(RESET), baldes: { [balde(10)]: 200 } },
  })
  expect(await faixa($)).toMatch(/no ritmo/)
})

test('sem janela semanal não desenha o ritmo', async ($, on) => {
  preparar(on, { ...USO, rateLimits: [] }, {})
  expect(await faixa($)).not.toMatch(/parado|pouco|muito/)
})

test('no desktop cada medidor é uma pílula de uma linha só', async ($, on) => {
  preparar(on, USO, { 'gasto:a': { conta: contaDe(RESET), baldes: { [balde(10)]: 120 } } })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...FAIXA, surface: 'desktop' } as never)
  for (const key of ['meter-ctx', 'meter-sem', 'meter-ritmo']) expect(await ui.find({ key })).toBeTruthy()
  await ui.unmount()
})
