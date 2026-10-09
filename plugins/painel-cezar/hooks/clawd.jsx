// Área invisível por cima do desenho do Clawd: só recebe o clique e abre o painel de agentes.
export default function Clawd(props, s) {
  const { Text } = s.elements
  s.onPointer((e) => {
    if (e.type === 'up' && e.button === 'left') s.post({ abrir: 'agentes' })
  })
  return Text({ children: ['   '] })
}
