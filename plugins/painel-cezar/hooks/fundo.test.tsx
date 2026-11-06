import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const FAIXA = { plugin: 'painel-cezar', component: 'AbovePrompt', surface: 'terminal', props: { bodyColumns: 160 } } as const

function preparar(on: On) {
  mock.store(on)
  mock.clock(on, { now: Date.parse('2026-11-06T22:00:00Z') })
  mock.env(on, {})
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { percent: 10 }, cost: { usd: 0 }, rateLimits: [] } as never }))
  on('session.id', () => ({ value: 'sessao-teste' }))
  on('settings.read', () => ({ value: {} }))
  on('command.register', () => ({ value: { command: 'agents-info' } }))
  on('classic.Stop', () => ({}) as never)
  on('tool.call', () => ({ result: { text: 'Command running in background with ID: b123abc' } }) as never)
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
}

async function chip($: Engine) {
  const ui = await $.ui.mount(FAIXA as never)
  const b = await ui.find({ key: 'fundo' })
  const label = (b as { props?: { label?: string } } | undefined)?.props?.label
  await ui.unmount()
  return label
}

test('comando em segundo plano de subagente não acende o ⚙', async ($, on) => {
  preparar(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'npm test', run_in_background: true, agentId: 'a1' } as never)
  expect(await chip($)).toBeUndefined()
  await $.tool.call({ tool: 'Bash', command: 'npm test', run_in_background: true } as never)
  expect(await chip($)).toBe('⚙ 1')
})

test('fim de turno troca a lista pela do engine: sem tarefa, o ⚙ some', async ($, on) => {
  preparar(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'a', run_in_background: true } as never)
  await $.tool.call({ tool: 'Bash', command: 'b', run_in_background: true } as never)
  expect(await chip($)).toBe('⚙ 2')
  await $.classic.Stop({ stop_hook_active: false, background_tasks: [], session_crons: [] } as never)
  expect(await chip($)).toBeUndefined()
  await $.classic.Stop({ stop_hook_active: false, background_tasks: [{ id: 'x', type: 'shell', status: 'running', description: 'build' }, { id: 'y', type: 'subagent', status: 'running', description: 'agente' }], session_crons: [] } as never)
  expect(await chip($)).toBe('⚙ 1')
})

test('no desktop o ⚙ é pílula desenhada', async ($, on) => {
  preparar(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.classic.Stop({ stop_hook_active: false, background_tasks: [{ id: 'x', type: 'shell', status: 'running', description: 'build' }], session_crons: [] } as never)
  const ui = await $.ui.mount({ ...FAIXA, surface: 'desktop' } as never)
  expect(await ui.find({ key: 'fundo' })).toBeTruthy()
  expect(await ui.find({ type: 'Svg', alt: '1 em segundo plano' } as never)).toBeTruthy()
  await ui.unmount()
})
