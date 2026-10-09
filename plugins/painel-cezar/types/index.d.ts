export type Agente = { id: string; nome: string; modelo: string; desde: number; ultimo: number; fim: number; feito: boolean }

declare module 'claude-code' {
  interface PluginState {
    'painel-cezar': {
      agentes: Agente[]
      contexto: number
      avisou70: boolean
    }
  }
}
