// Área invisível por cima de um desenho da faixa (Clawd, compactar, salvar): só recebe o clique. O hook ui.message sabe qual foi pelo key.
export default function Clawd(props, s) {
  const { Text } = s.elements
  s.onPointer((e) => {
    if (e.type === 'up' && e.button === 'left') s.post({ abrir: 'agentes' })
  })
  return Text({ children: ['   '] })
}
