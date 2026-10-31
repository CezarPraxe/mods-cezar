// Painel de agentes adaptado do savvy-progress (github.com/johnnyvizz/claude-kit), MIT, Copyright (c) 2026 johnnyvizz.

export type AgentStatus = 'running' | 'done' | 'failed' | 'stopped'

export type AgentRun = {
  id: string
  agentId?: string
  type: string
  description: string
  model: string
  status: AgentStatus
  startedAt: number
  endedAt?: number
  /** Hora do último passo do agente: sem ela não há como dizer "sem novidade há 6 min". */
  ultimoPasso?: number
  /** Erro já aberto pelo Cezar: desce do topo para os concluídos. */
  erroVisto?: boolean
  costUsd: number
  steps: number
  round: number
}

export type Panel = {
  /** O agente cuja conversa o painel mostra; ausente, a lista. */
  abertoId?: string
  /** A escolha da pessoa; ausente, os concluídos abrem só quando ninguém trabalha. */
  concluidosAbertos?: boolean
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
