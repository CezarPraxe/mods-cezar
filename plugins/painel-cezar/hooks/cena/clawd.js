// Clawd (prefixo cl-): o mascote em pixel art do painel do dono, ampliado 6x e posto na água.
// Desenhos fiéis aos aprovados em v2\_clawd\original-*.svg (28x24 px, sem garras).
// 'vez' boia na superfície numa boinha pixel, 'trabalhando' pedala mergulhado, 'precisa' salta da água em vermelho.
// Entradas: d.estado, d.sup. Sem aleatório: mesma entrada, mesma saída.

const S = 6 // escala do pixel
const CX = 1330 // centro horizontal do bicho
const X0 = CX - 14 * S // canto esquerdo da caixa 28x24
const f = (v) => String(Math.round(v * 10) / 10)

const LARANJA = {
  v: [['0', '#EC9A7E'], ['.2', '#E28669'], ['.52', '#DA7758'], ['.84', '#CF6C4F'], ['1', '#BC5D43']],
  l: [['0', '#A44F38'], ['.45', '#BE6146'], ['1', '#CC7053']],
  g: '#DA7758', arm: 10,
}
const VERMELHO = {
  v: [['0', '#F28580'], ['.2', '#EA615F'], ['.52', '#E24B4A'], ['.84', '#CC3E3E'], ['1', '#A83032']],
  l: [['0', '#7A2224'], ['.45', '#B23638'], ['1', '#C4403F']],
  g: '#E24B4A', arm: 8,
}

const stops = (a) => a.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')

// definições do bicho (as mesmas dos originais; só o que cada pose usa)
function defsBicho(P, panico) {
  return (
    `<linearGradient id="cl-v" gradientUnits="userSpaceOnUse" x1="0" y1="6" x2="0" y2="18">${stops(P.v)}</linearGradient>` +
    `<linearGradient id="cl-h" gradientUnits="userSpaceOnUse" x1="2" y1="0" x2="26" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".06"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient>` +
    `<linearGradient id="cl-r" gradientUnits="userSpaceOnUse" x1="7" y1="0" x2="21" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset=".55" stop-color="#fff" stop-opacity=".14"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="cl-l" gradientUnits="userSpaceOnUse" x1="0" y1="18" x2="0" y2="22">${stops(P.l)}</linearGradient>` +
    `<filter id="cl-b" filterUnits="userSpaceOnUse" x="-4" y="-4" width="36" height="32"><feGaussianBlur stdDeviation="1.6"/></filter>` +
    `<filter id="cl-s" filterUnits="userSpaceOnUse" x="0" y="0" width="28" height="24"><feGaussianBlur stdDeviation="1.3"/></filter>` +
    `<clipPath id="cl-c"><path d="M6 6h16v12H6z"/></clipPath>` +
    (panico
      ? `<linearGradient id="cl-y" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="6"><stop offset="0" stop-color="#FFE75A"/><stop offset="1" stop-color="#FFC400"/></linearGradient><filter id="cl-x" filterUnits="userSpaceOnUse" x="14" y="-6" width="20" height="20"><feGaussianBlur stdDeviation="1.2"/></filter>`
      : '')
  )
}

const CORPO = 'M6 6h16v12H6z'
const GLOW = (y) => `M6 6h16v12H6zM2 ${y}h4v4H2zM22 ${y}h4v4h-4zM6 18h2v4h-2zM10 18h2v4h-2zM16 18h2v4h-2zM20 18h2v4h-2z`

const rect = (x, y, w, h, fill, o) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${o ? ` fill-opacity="${o}"` : ''}/>`
const perna = (x, extra) => rect(x, 18, 2, 4, 'url(#cl-l)') + (extra ? rect(x, 18, 2, 4, '#000', '.09') : '')
const bracoE = (y) => `<path d="M2 ${y}h4v4H2z" fill="url(#cl-v)"/><path d="M2 ${y}h4v4H2z" fill="url(#cl-h)"/>` + rect(2, y, 4, 1, '#fff', '.2') + rect(2, y + 3, 4, 1, '#000', '.1')
const bracoD = (y) => `<path d="M22 ${y}h4v4h-4z" fill="url(#cl-v)"/><path d="M22 ${y}h4v4h-4z" fill="url(#cl-h)"/>` + rect(22, y, 4, 1, '#fff', '.1') + rect(22, y + 3, 4, 1, '#000', '.1')
const tronco =
  `<path d="${CORPO}" fill="url(#cl-v)"/><path d="${CORPO}" fill="url(#cl-h)"/>` +
  `<g clip-path="url(#cl-c)"><ellipse cx="10.5" cy="7.5" rx="5.5" ry="2.6" fill="#fff" opacity=".15" filter="url(#cl-s)"/></g>` +
  rect(7, 6, 14, 1, 'url(#cl-r)') + rect(6, 10, 1, 4, '#000', '.06') + rect(21, 10, 1, 4, '#000', '.08')
const olhoAberto = (x) => rect(x, 8, 2, 3, '#1F1E1D') + rect(x, 8, 1, 1, '#fff')
const olhos = olhoAberto(8) + olhoAberto(18)
const meio = olhos + rect(8, 8, 2, 1, '#E38F72') + rect(8, 9, 2, 1, '#5B2A1E') + rect(18, 8, 2, 1, '#E38F72') + rect(18, 9, 2, 1, '#5B2A1E')
const fechado = rect(8, 8, 2, 2, '#E38F72') + rect(7, 10, 4, 1, '#5B2A1E') + rect(18, 8, 2, 2, '#E38F72') + rect(17, 10, 4, 1, '#5B2A1E')

// ---------------------------------------------------------------- poses (coordenadas locais 28x24)
function poseVez() {
  return (
    `<g filter="url(#cl-b)" class="cl-gl"><path fill="${LARANJA.g}" d="${GLOW(10)}"/></g>` +
    `<g class="cl-pa">${perna(6)}${perna(10)}</g><g class="cl-pb">${perna(16, 1)}${perna(20, 1)}</g>` +
    `<g class="cl-sq">${bracoE(10)}${bracoD(10)}${tronco}` +
    `<g class="cl-eo"><g class="cl-lk">${olhos}</g></g><g class="cl-em">${meio}</g><g class="cl-ef">${fechado}</g></g>` +
    // boinha pixel na cintura: faixas creme e azul, contorno marinho
    boia()
  )
}
function boia() {
  const faixas = []
  for (let x = 1; x < 27; x += 4) {
    const cor = ((x - 1) / 4) % 2 ? '#0685F3' : '#F3EAD3'
    faixas.push(rect(x, 14, Math.min(4, 27 - x), 4, cor))
  }
  return (
    `<g>` +
    // contorno
    rect(3, 13, 22, 1, '#0B1C3D') + rect(3, 18, 22, 1, '#0B1C3D') + rect(0, 15, 1, 2, '#0B1C3D') + rect(27, 15, 1, 2, '#0B1C3D') +
    rect(1, 14, 2, 1, '#0B1C3D') + rect(25, 14, 2, 1, '#0B1C3D') + rect(1, 17, 2, 1, '#0B1C3D') + rect(25, 17, 2, 1, '#0B1C3D') +
    // miolo recortado nos cantos
    `<g>${faixas.join('')}</g>` +
    rect(1, 14, 1, 1, '#0B1C3D') + rect(26, 14, 1, 1, '#0B1C3D') + rect(1, 17, 1, 1, '#0B1C3D') + rect(26, 17, 1, 1, '#0B1C3D') +
    rect(3, 14, 22, 1, '#fff', '.28') + rect(3, 17, 22, 1, '#000', '.2') +
    `</g>`
  )
}

function poseTrab() {
  return (
    `<g filter="url(#cl-b)" class="cl-gl2"><path fill="${LARANJA.g}" d="${GLOW(10)}"/></g>` +
    `<g class="cl-te">${perna(6)}${perna(10)}</g><g class="cl-td">${perna(16, 1)}${perna(20, 1)}</g>` +
    `<g class="cl-tb"><g class="cl-ta">${bracoE(10)}${bracoD(10)}</g>${tronco}` +
    `<g class="cl-to">${rect(8, 8, 2, 3, '#1F1E1D')}${rect(8, 8, 2, 1, 'url(#cl-v)')}${rect(8, 9, 1, 1, '#fff')}${rect(18, 8, 2, 3, '#1F1E1D')}${rect(18, 8, 2, 1, 'url(#cl-v)')}${rect(18, 9, 1, 1, '#fff')}</g></g>`
  )
}

function posePanico() {
  return (
    `<g class="cl-ps"><g filter="url(#cl-b)" class="cl-pg"><path fill="${VERMELHO.g}" d="${GLOW(8)}"/></g>` +
    perna(6) + perna(10) + perna(16, 1) + perna(20, 1) +
    `<g class="cl-pe">${bracoE(8)}</g><g class="cl-pd">${bracoD(8)}</g>${tronco}` +
    rect(6, 8, 4, 4, '#fff') + rect(6, 11, 4, 1, '#D9D4D2') + rect(18, 8, 4, 4, '#fff') + rect(18, 11, 4, 1, '#D9D4D2') +
    `<g class="cl-pu">${rect(7, 9, 2, 2, '#1F1E1D')}${rect(19, 9, 2, 2, '#1F1E1D')}</g>` +
    // o raio amarelo (a exclamação do original)
    `<g class="cl-px"><g filter="url(#cl-x)" opacity=".6">${rect(24, 0, 2, 3, 'url(#cl-y)')}${rect(24, 4, 2, 2, 'url(#cl-y)')}</g>${rect(24, 0, 2, 3, 'url(#cl-y)')}${rect(24, 4, 2, 2, 'url(#cl-y)')}</g></g>`
  )
}

// ---------------------------------------------------------------- água: contorno que acompanha a escama da frente
// mesma geometria e mesmo tempo da crista da frente (agua.js): o que está abaixo dela fica "molhado"
const arco = (x0, x1, y, wl, fundo) => {
  const r = wl * 0.66
  let d = `M${f(x0)} ${f(y)}`
  for (let x = x0; x < x1; x += wl) d += `A${f(r)} ${f(r)} 0 0 1 ${f(x + wl)} ${f(y)}`
  return d + `V${f(fundo)}H${f(x0)}Z`
}

// ---------------------------------------------------------------- CSS compartilhado e por pose
const CSS_BASE =
  `.cl-mv{animation:cl-aR 44s linear infinite}@keyframes cl-aR{to{transform:translateX(420px)}}` +
  `.cl-mb,.cl-fl{animation:cl-bb 4.4s ease-in-out -3s infinite alternate}@keyframes cl-bb{from{transform:translateY(-3px)}to{transform:translateY(4px)}}`

const CSS_VEZ =
  `.cl-gl{animation:cl-gl 4s ease-in-out infinite}@keyframes cl-gl{0%,100%{opacity:.56}55%{opacity:.42}}` +
  `.cl-sq{animation:cl-sq 4s steps(1) infinite}@keyframes cl-sq{55%{transform:translateY(1px)}}` +
  `.cl-eo{animation:cl-eo 8s steps(1) infinite}@keyframes cl-eo{0%{opacity:1}20%{opacity:0}23.5%{opacity:1}70%{opacity:0}73%{opacity:1}74.5%{opacity:0}77.5%{opacity:1}}` +
  `.cl-em{opacity:0;animation:cl-em 8s steps(1) infinite}@keyframes cl-em{0%{opacity:0}20%{opacity:1}21%{opacity:0}22.5%{opacity:1}23.5%{opacity:0}70%{opacity:1}71%{opacity:0}72%{opacity:1}73%{opacity:0}74.5%{opacity:1}75.5%{opacity:0}76.5%{opacity:1}77.5%{opacity:0}}` +
  `.cl-ef{opacity:0;animation:cl-ef 8s steps(1) infinite}@keyframes cl-ef{0%{opacity:0}21%{opacity:1}22.5%{opacity:0}71%{opacity:1}72%{opacity:0}75.5%{opacity:1}76.5%{opacity:0}}` +
  // olha para o centro da tela (esquerda), de vez em quando
  `.cl-lk{animation:cl-lk 8s steps(1) infinite}@keyframes cl-lk{0%{transform:none}40%{transform:translateX(-1px)}55%{transform:none}}` +
  // perninhas batendo devagar debaixo d'água
  `.cl-pa{animation:cl-kp 2.6s steps(1) infinite}.cl-pb{animation:cl-kq 2.6s steps(1) infinite -1.3s}` +
  `@keyframes cl-kp{0%{transform:translateY(-1px)}25%{transform:translateY(-2px)}50%{transform:translateY(-1px)}75%{transform:none}}` +
  `@keyframes cl-kq{0%{transform:translateY(-1px)}25%{transform:translateY(-2px)}50%{transform:translateY(-1px)}75%{transform:none}}` +
  `.cl-ro{animation:cl-ro 6.3s ease-in-out -1s infinite alternate;transform-origin:${14 * S}px ${15.5 * S}px}@keyframes cl-ro{from{transform:rotate(-2.4deg)}to{transform:rotate(2.4deg)}}` +
  `.cl-ri{transform-box:fill-box;transform-origin:50% 50%;opacity:0;animation:cl-ri 4.8s ease-out infinite}@keyframes cl-ri{0%{opacity:.75;transform:scale(.45)}100%{opacity:0;transform:scale(2.6)}}`

const CSS_TRAB =
  `.cl-gl2{animation:cl-tg 2s ease-in-out infinite}@keyframes cl-tg{0%,100%{opacity:.4}50%{opacity:.62}}` +
  `.cl-te{animation:cl-tp 1s steps(1) infinite}.cl-td{animation:cl-tq 1s steps(1) infinite -.5s}` +
  `@keyframes cl-tp{0%{transform:translateY(-1px)}12.5%{transform:translate(1px,-2px)}25%{transform:translateY(-1px)}37.5%{transform:none}}` +
  `@keyframes cl-tq{0%{transform:translateY(-1px)}12.5%{transform:translate(-1px,-2px)}25%{transform:translateY(-1px)}37.5%{transform:none}}` +
  `.cl-tb{animation:cl-tb 1s steps(1) infinite}@keyframes cl-tb{0%{transform:none}12.5%{transform:translate(1px,-1px)}25%{transform:none}37.5%{transform:translateY(1px)}50%{transform:none}62.5%{transform:translate(-1px,-1px)}75%{transform:none}87.5%{transform:translateY(1px)}}` +
  `.cl-ta{animation:cl-ta .5s steps(1) infinite}@keyframes cl-ta{0%{transform:none}25%{transform:translateY(1px)}50%{transform:none}75%{transform:translateY(-1px)}}` +
  `.cl-to{animation:cl-to 3s steps(1) infinite}@keyframes cl-to{0%{transform:translateX(1px)}50%{transform:translateX(-1px)}}` +
  // deriva lenta para os lados e ondulação vertical (em px da cena)
  `.cl-dr{animation:cl-dr 15s ease-in-out -4s infinite alternate}@keyframes cl-dr{from{transform:translateX(-24px)}to{transform:translateX(24px)}}` +
  `.cl-ob{animation:cl-ob 3.4s ease-in-out -1s infinite alternate}@keyframes cl-ob{from{transform:translateY(-5px)}to{transform:translateY(6px)}}`

const CSS_PAN =
  `.cl-ps{animation:cl-ps .9s steps(1) infinite}@keyframes cl-ps{0%{transform:translateX(1px)}8%{transform:none}16%{transform:translateX(-1px)}24%{transform:translateX(1px)}32%{transform:none}40%{transform:translateX(-1px)}48%{transform:none}}` +
  `.cl-pe{animation:cl-pb .5s steps(1) infinite}.cl-pd{animation:cl-pb .5s steps(1) infinite -.25s}@keyframes cl-pb{50%{transform:translateY(2px)}}` +
  `.cl-pg{animation:cl-pg 1s ease-out infinite}@keyframes cl-pg{0%{opacity:.85}60%,100%{opacity:.45}}` +
  `.cl-pu{animation:cl-pu 1s steps(1) infinite}@keyframes cl-pu{0%{transform:translateY(1px)}48%{transform:none}}` +
  `.cl-px{animation:cl-px 1s steps(1) infinite}@keyframes cl-px{60%{opacity:.3}}`

const REDUZIDO = (cls) => `@media (prefers-reduced-motion:reduce){${cls.map((c) => '.' + c).join(',')}{animation:none!important}}`

// ---------------------------------------------------------------- montagem de cada estado
function maskMolhado(sup) {
  const y4 = sup + 8
  const topo = sup - 330
  const regiao = `maskUnits="userSpaceOnUse" x="1100" y="${f(topo)}" width="470" height="${f(1010 - topo)}"`
  return `<mask id="cl-mw" ${regiao}><g class="cl-mb"><g class="cl-mv"><path fill="#fff" d="${arco(672, 1512, y4, 84, 1010)}"/></g></g></mask>`
}

// molhado = o mesmo desenho, esmaecido e azulado, só abaixo da crista da frente
const FILTRO_MOLHADO = `<filter id="cl-w" color-interpolation-filters="sRGB" x="-10%" y="-10%" width="120%" height="120%"><feColorMatrix type="matrix" values=".74 .02 0 0 0  .02 .66 .04 0 .05  .02 .06 .6 0 .15  0 0 0 1 0"/></filter>`

export function desenhar(d) {
  const sup = d.sup
  const estado = d.estado === 'trabalhando' || d.estado === 'precisa' ? d.estado : 'vez'
  const P = estado === 'precisa' ? VERMELHO : LARANJA
  let css = CSS_BASE
  let defs = defsBicho(P, estado === 'precisa') + FILTRO_MOLHADO
  let svg = ''
  const cls = ['cl-mb', 'cl-mv', 'cl-fl']

  if (estado === 'vez') {
    // a linha d'água corta o bicho na altura da boinha
    const Y0 = sup - 17 * S
    css += CSS_VEZ
    defs += maskMolhado(sup)
    const um = `<g transform="translate(${f(X0)} ${f(Y0)})"><g class="cl-fl"><g class="cl-ro"><g transform="scale(${S})">${poseVez()}</g></g></g></g>`
    const aneis = [0, -2.4].map((dl) => `<ellipse class="cl-ri" style="animation-delay:${dl}s" cx="${CX}" cy="${f(sup + 7)}" rx="46" ry="6" fill="none" stroke="#B5E4FA" stroke-width="2.2" stroke-dasharray="16 10"/>`).join('')
    svg = aneis + um + `<g mask="url(#cl-mw)"><g filter="url(#cl-w)">${um}</g></g>`
    cls.push('cl-gl', 'cl-sq', 'cl-eo', 'cl-em', 'cl-ef', 'cl-lk', 'cl-pa', 'cl-pb', 'cl-ro', 'cl-ri')
  } else if (estado === 'trabalhando') {
    // mergulhado, uns 130 abaixo da superfície; água rasa: logo abaixo dela; nunca passa de y 840
    const cy = Math.min(sup + 120, Math.max(784, sup + 58))
    const Y0 = cy - 14 * S
    css += CSS_TRAB
    // bolhinhas pixel subindo da cabeça até a superfície
    const topoBicho = cy - 8 * S - 6
    const sobe = Math.max(36, topoBicho - (sup + 14))
    const passos = Math.max(8, Math.round(sobe / 5))
    css += `@keyframes cl-bu{0%{transform:translateY(0);opacity:0}12%{opacity:.95}80%{opacity:.8}100%{transform:translateY(${-f(sobe)}px);opacity:0}}` +
      `.cl-bu{opacity:0;animation:cl-bu 5.6s steps(${passos}) infinite}`
    const bol = [[-30, 0, 7, 0], [6, -1.1, 9, 1], [38, -2.3, 6, 2], [-12, -3.1, 6, 3], [24, -4.2, 8, 4]]
      .map(([dx, dl, t, k]) => `<rect class="cl-bu" style="animation-delay:${dl}s;animation-duration:${f(5 + k * 0.45)}s" x="${f(CX + dx - t / 2)}" y="${f(topoBicho)}" width="${t}" height="${t}" fill="#9FD8F5" fill-opacity=".18" stroke="#B5E4FA" stroke-width="1.8"/>`).join('')
    const bicho = `<g transform="translate(${f(X0)} ${f(Y0)})"><g class="cl-dr"><g class="cl-ob"><g transform="scale(${S})">${poseTrab()}</g></g></g></g>`
    svg = bol + `<g filter="url(#cl-w)">${bicho}</g>`
    cls.push('cl-gl2', 'cl-te', 'cl-td', 'cl-tb', 'cl-ta', 'cl-to', 'cl-dr', 'cl-ob', 'cl-bu')
  } else {
    // salta da água em ciclo de 3,5 s: espera, agacha, voa, cai com respingo e anel
    const T = 3.5
    const base = sup + 58 // centro do bicho em repouso: corpo logo abaixo da superfície
    const Y0 = base - 14 * S
    const pico = -134 // subida em px da cena, a partir do repouso
    const pernaFora = -(base + 8 * S - sup) // deslocamento em que os pés cruzam a superfície
    const t0 = 31 // % do ciclo em que a cena nasce (o pulo vem logo)
    // trajetória em parábola, com amostras lineares
    const pts = [[0, 0], [27, 0], [33, 9]]
    for (let i = 1; i <= 8; i++) { const u = i / 8; pts.push([33 + 18 * u, f(pico + (9 - pico) * (1 - u) * (1 - u))]) }
    for (let i = 1; i <= 8; i++) { const u = i / 8; pts.push([51 + 18 * u, f(pico + (16 - pico) * u * u)]) }
    pts.push([80, 0], [100, 0])
    css += CSS_PAN +
      `.cl-pl{animation:cl-pl ${T}s linear -${f((T * t0) / 100)}s infinite}@keyframes cl-pl{${pts.map(([p, y]) => `${f(p)}%{transform:translateY(${y}px)}`).join('')}}`
    // instante em que os pés tocam a água na queda e na subida (parábola)
    const subida = 33 + 18 * (1 - Math.sqrt(Math.max(0, (pernaFora - pico) / (9 - pico))))
    const queda = 51 + 18 * Math.sqrt(Math.max(0, (pernaFora - pico) / (16 - pico)))
    const ti = f(queda)
    const ts = f(subida)
    const dl = `-${f((T * t0) / 100)}s`
    // anéis na água: um na saída, dois na queda
    css += `.cl-an{opacity:0;transform-box:fill-box;transform-origin:50% 50%}` +
      `@keyframes cl-aa{0%,${ts}%{opacity:0;transform:scale(.3)}${f(+ts + 0.4)}%{opacity:.8;transform:scale(.4)}${f(+ts + 14)}%,100%{opacity:0;transform:scale(1.7)}}` +
      `@keyframes cl-ab{0%,${ti}%{opacity:0;transform:scale(.3)}${f(+ti + 0.4)}%{opacity:.9;transform:scale(.4)}${f(+ti + 24)}%,100%{opacity:0;transform:scale(2.6)}}` +
      `@keyframes cl-ac{0%,${f(+ti + 5)}%{opacity:0;transform:scale(.3)}${f(+ti + 5.4)}%{opacity:.7;transform:scale(.4)}${f(+ti + 29)}%,100%{opacity:0;transform:scale(2.6)}}`
    // respingos: quadradinhos que sobem em arco (dx em px, h = altura)
    const gotas = (k0, t, esc) => [[-52, 70], [-34, 98], [-16, 118], [16, 118], [34, 98], [52, 70], [-70, 44], [70, 44]].map(([dx, h], i) => ({ dx: dx * esc, h: h * esc, t, i, k0 }))
    css += `@keyframes cl-xa{0%,${ti}%{transform:translateX(0);opacity:0}${f(+ti + 0.3)}%{opacity:1}${f(+ti + 15)}%{transform:translateX(var(--dx));opacity:.9}${f(+ti + 15.5)}%,100%{transform:translateX(var(--dx));opacity:0}}` +
      `@keyframes cl-ya{0%,${ti}%{transform:translateY(0);animation-timing-function:cubic-bezier(.2,.7,.4,1)}${f(+ti + 6.5)}%{transform:translateY(calc(var(--h)*-1));animation-timing-function:cubic-bezier(.6,0,.9,.5)}${f(+ti + 15)}%,100%{transform:translateY(0)}}` +
      `@keyframes cl-xb{0%,${ts}%{transform:translateX(0);opacity:0}${f(+ts + 0.3)}%{opacity:1}${f(+ts + 14)}%{transform:translateX(var(--dx));opacity:.9}${f(+ts + 14.5)}%,100%{transform:translateX(var(--dx));opacity:0}}` +
      `@keyframes cl-yb{0%,${ts}%{transform:translateY(0);animation-timing-function:cubic-bezier(.2,.7,.4,1)}${f(+ts + 6)}%{transform:translateY(calc(var(--h)*-1));animation-timing-function:cubic-bezier(.6,0,.9,.5)}${f(+ts + 14)}%,100%{transform:translateY(0)}}` +
      `.cl-ga{animation:cl-xa ${T}s linear ${dl} infinite;opacity:0}.cl-gb{animation:cl-ya ${T}s linear ${dl} infinite}` +
      `.cl-gc{animation:cl-xb ${T}s linear ${dl} infinite;opacity:0}.cl-gd{animation:cl-yb ${T}s linear ${dl} infinite}`
    const gota = (g, c) => `<g class="cl-ga" style="--dx:${f(g.dx)}px"><g class="cl-gb" style="--h:${f(g.h)}px"><rect x="${f(CX - 3.5)}" y="${f(sup - 4)}" width="7" height="7" fill="${c}" stroke="#0B1C3D" stroke-width="1.4"/></g></g>`
    const gotaS = (g, c) => `<g class="cl-gc" style="--dx:${f(g.dx)}px"><g class="cl-gd" style="--h:${f(g.h)}px"><rect x="${f(CX - 2.5)}" y="${f(sup - 4)}" width="5" height="5" fill="${c}" stroke="#0B1C3D" stroke-width="1.2"/></g></g>`
    const grandes = gotas(0, 7, 1).map((g, i) => gota(g, i % 2 ? '#F3EAD3' : '#B5E4FA')).join('')
    const pequenas = gotas(0, 5, 0.55).filter((_, i) => i < 6).map((g, i) => gotaS(g, i % 2 ? '#F3EAD3' : '#B5E4FA')).join('')
    const anel = (n, rx, ry, w) => `<ellipse class="cl-an" style="animation:cl-${n} ${T}s linear ${dl} infinite" cx="${CX}" cy="${f(sup + 6)}" rx="${rx}" ry="${ry}" fill="none" stroke="#F3EAD3" stroke-width="${w}" stroke-dasharray="14 8"/>`
    const aneis = anel('aa', 40, 5, 2) + anel('ab', 52, 7, 2.6) + anel('ac', 52, 7, 2)
    const um = `<g transform="translate(${f(X0)} ${f(Y0)})"><g class="cl-pl"><g transform="scale(${S})">${posePanico()}</g></g></g>`
    defs += maskMolhado(sup)
    svg = aneis + um + `<g mask="url(#cl-mw)"><g filter="url(#cl-w)">${um}</g></g>` + grandes + pequenas
    cls.push('cl-ps', 'cl-pe', 'cl-pd', 'cl-pg', 'cl-pu', 'cl-px', 'cl-pl', 'cl-an', 'cl-ga', 'cl-gb', 'cl-gc', 'cl-gd')
    // movimento reduzido: o bicho fica fora da água, parado, em vez de preso debaixo dela
    css += `@media (prefers-reduced-motion:reduce){.cl-pl{transform:translateY(${f(pernaFora - 14)}px)}}`
  }
  css += REDUZIDO(cls)
  return { css, defs, svg }
}
