import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const FAIXA = { plugin: 'painel-cezar', component: 'AbovePrompt', surface: 'desktop', props: { bodyColumns: 160 } } as const

function preparar(on: On, loja: Record<string, unknown> = {}) {
  const memoria = new Map(Object.entries(loja))
  const chamadas: string[] = []
  on('store.get', (_, e) => ({ value: memoria.get((e as { key: string }).key) }) as never)
  on('store.set', (_, e) => {
    const { key, value } = e as { key: string; value: unknown }
    memoria.set(key, value)
    return { value: undefined } as never
  })
  on('store.delete', (_, e) => {
    memoria.delete((e as { key: string }).key)
    return { value: undefined } as never
  })
  on('store.keys', () => ({ value: [...memoria.keys()] }) as never)
  mock.clock(on, { now: Date.parse('2026-11-16T12:00:00Z') })
  mock.env(on, {})
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { percent: 10 }, cost: { usd: 0 }, rateLimits: [] } as never }))
  on('session.id', () => ({ value: 's' }))
  on('settings.read', () => ({ value: {} }))
  on('command.register', () => ({ value: { command: 'agents-info' } }))
  on('theme.set', () => {
    chamadas.push('set')
    return { value: { isDrawn: true } } as never
  })
  on('theme.clear', () => {
    chamadas.push('clear')
    return { value: { isDrawn: false, reason: 'the theme is cleared' } } as never
  })
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return { memoria, chamadas }
}

const gota = async ($: Engine) => {
  const ui = await $.ui.mount(FAIXA as never)
  const desenho = JSON.stringify(await (ui as unknown as { drawn: () => Promise<unknown> }).drawn())
  await ui.unmount()
  return desenho.includes('tema IMERSÃO ligado: clique') ? 'cheia' : desenho.includes('Claude normal: clique') ? 'vazia' : 'nenhuma'
}

const clicar = (ui: unknown, alvo: unknown) => (ui as { post: (d: unknown, a: unknown) => Promise<void> }).post({}, alvo)

// Um teste só: o estado do tema é do módulo, e testes em paralelo o dividiriam
test('quem escolheu o Claude normal começa sem tema; a gota religa, grava, e desliga de novo', async ($, on) => {
  const { memoria, chamadas } = preparar(on, { tema: 'normal' })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(chamadas).toEqual([])
  expect(await gota($)).toBe('vazia')
  let ui = await $.ui.mount(FAIXA as never)
  await clicar(ui, { in: 'tema' })
  await ui.unmount()
  expect(chamadas).toEqual(['set'])
  expect(memoria.get('tema')).toBe('imersao')
  expect(await gota($)).toBe('cheia')
  ui = await $.ui.mount(FAIXA as never)
  await clicar(ui, { in: 'tema' })
  await ui.unmount()
  expect(chamadas).toEqual(['set', 'clear'])
  expect(memoria.get('tema')).toBe('normal')
  expect(await gota($)).toBe('vazia')
})

test('a cena desenha as seis peças com os dados da sessão e cabe no limite do app', async ($, on) => {
  preparar(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'painel-cezar', component: 'Backdrop', surface: 'desktop', props: { plugin: 'painel-cezar', scene: 'imersao', glass: false } } as never)
  const desenho = JSON.stringify(await (ui as unknown as { drawn: () => Promise<unknown> }).drawn())
  await ui.unmount()
  expect(desenho).toContain('contexto 10%')
  for (const prefixo of ['fu-', 'lu-', 'ag-', 'cl-']) expect(desenho).toContain(prefixo)
  const fonte = /<svg[^]*<\/svg>/.exec(JSON.parse(desenho.replace(/^[^]*?"source":/, '[').replace(/,"alt"[^]*$/, ']'))[0] ?? '')?.[0] ?? ''
  expect(fonte.length).toBeGreaterThan(20000)
  expect(fonte.length).toBeLessThan(131072)
})

test('cena de outro mod não é desenhada por este', async ($, on) => {
  preparar(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'painel-cezar', component: 'Backdrop', surface: 'desktop', props: { plugin: 'outro', scene: 'imersao', glass: false } } as never)
  const desenho = JSON.stringify(await (ui as unknown as { drawn: () => Promise<unknown> }).drawn())
  await ui.unmount()
  expect(desenho).not.toContain('lu-')
})
