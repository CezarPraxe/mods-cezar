// Painel de agentes adaptado do savvy-progress (github.com/johnnyvizz/claude-kit), MIT, Copyright (c) 2026 johnnyvizz.

export type AgentStatus = 'running' | 'done' | 'failed'

export type AgentRun = {
  id: string
  agentId?: string
  type: string
  description: string
  model: string
  effort?: string
  status: AgentStatus
  startedAt: number
  endedAt?: number
  contextTokens: number
  contextMax: number
  tokens: number
  costUsd: number
  steps: number
  round: number
  /** Campos de passos reportados pelo agente (ferramenta step do savvy). Nada os preenche aqui: o painel os mostra vazios. */
  stepDone?: number
  stepTotal?: number
  stepNote?: string
}

export type Panel = {
  isCompact: boolean
  isDoneCollapsed: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'painel-cezar': {
      contexto: number
      avisou70: boolean
      ag_agents: AgentRun[]
      ag_panel: Panel
      ag_now: number
    }
  }
}
