// Contrato das peças da cena (v2\CONTRATO.md no estúdio): cada uma recebe os dados em degraus e devolve CSS, defs e desenho
export type DadosCena = {
  ctx: number
  semana: number
  ideal: number
  sup: number
  estado: 'vez' | 'trabalhando' | 'precisa'
  agentes: number
  erros: number
  aviso: null | 'compactar' | 'cache'
}
export type PecaCena = { css?: string; defs?: string; svg?: string; tras?: string; frente?: string }
