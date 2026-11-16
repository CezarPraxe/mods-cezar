// Fundo e céu (prefixo fu-): noite, grão, retícula nas bordas, xadrez, estrelinhas, cadentes, plâncton.
// Não recebe dados: a saída é sempre a mesma (semente fixa).

function gerador(semente) {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const r1 = (n) => Math.round(n * 10) / 10
const LUA = [300, 270, 128]
const SELO = [1330, 270, 128]
const dentro = (x, y, c) => (x - c[0]) ** 2 + (y - c[1]) ** 2 < c[2] ** 2

export function desenhar() {
  const rnd = gerador(0x1a2b3c)
  const entre = (a, b) => a + (b - a) * rnd()
  const esc = (v) => v[Math.floor(rnd() * v.length)]

  // ---- estrelas de 4 pontas
  const pontos = []
  const livre = (x, y, d) => pontos.every((p) => (p[0] - x) ** 2 + (p[1] - y) ** 2 > d * d)
  function sortear(regiao, d, n) {
    const achados = []
    for (let k = 0; k < 4000 && achados.length < n; k++) {
      const [x, y] = regiao()
      if (dentro(x, y, LUA) || dentro(x, y, SELO)) continue
      if (!livre(x, y, d)) continue
      pontos.push([x, y])
      achados.push([x, y])
    }
    return achados
  }
  const lado = (y0, y1) => () => [rnd() < 0.5 ? entre(14, 410) : entre(1190, 1586), entre(y0, y1)]
  const alto = () => [rnd() < 0.5 ? entre(14, 405) : entre(1195, 1586), entre(14, 150)]
  const miolo = () => [entre(450, 1150), entre(20, 420)]

  const cores = ['fu-k1', 'fu-k1', 'fu-k1', 'fu-k2', 'fu-k2', 'fu-k3']
  const dur = ['fu-a1', 'fu-a2', 'fu-a3', 'fu-a4', 'fu-a5', 'fu-a6']
  const atr = () => `${esc(dur)} fu-d${1 + Math.floor(rnd() * 8)}`

  let estrelas = ''
  const grandes = sortear(lado(170, 640), 46, 30).concat(sortear(alto, 52, 14))
  for (const [x, y] of grandes) {
    const r = r1(entre(3.4, 8.5))
    estrelas += `<g transform="translate(${Math.round(x)} ${Math.round(y)}) scale(${r})" class="${esc(cores)}"><use href="#fu-s" class="${atr()}"/></g>`
  }
  // algumas grandes de contorno amarelo, bem nas bordas (estourado de impresso)
  for (const [x, y] of sortear(lado(210, 560), 90, 5)) {
    const r = r1(entre(11, 16))
    estrelas += `<g transform="translate(${Math.round(x)} ${Math.round(y)}) scale(${r})" class="fu-k2"><use href="#fu-s" class="fu-a6 fu-d${1 + Math.floor(rnd() * 8)}"/></g>`
  }
  // fracas na coluna do texto
  for (const [x, y] of sortear(miolo, 70, 6)) {
    estrelas += `<g transform="translate(${Math.round(x)} ${Math.round(y)}) scale(${r1(entre(2.6, 4))})" class="fu-k1" opacity=".22"><use href="#fu-s" class="${atr()}"/></g>`
  }
  // pontinhos de luz
  let pingos = ''
  const tinys = sortear(lado(30, 700), 28, 31).concat(sortear(alto, 34, 12))
  for (const [x, y] of tinys) {
    pingos += `<circle cx="${Math.round(x)}" cy="${Math.round(y)}" r="${r1(entre(0.9, 1.9))}" class="${atr()} ${esc(cores)}"/>`
  }
  const tinyFracos = sortear(miolo, 50, 8)
  for (const [x, y] of tinyFracos) {
    pingos += `<circle cx="${Math.round(x)}" cy="${Math.round(y)}" r="1.2" class="${atr()} fu-k1" fill-opacity=".3"/>`
  }

  // ---- plâncton / poeira (· + °) subindo nas laterais
  const glifos = [['·', 'fu-z1'], ['·', 'fu-z1'], ['+', 'fu-z2'], ['°', 'fu-z3'], ['·', 'fu-z1'], ['+', 'fu-z2']]
  let plancton = ''
  const cp = ['fu-k3', 'fu-k1', 'fu-k3', 'fu-k2']
  for (let k = 0; k < 32; k++) {
    const naColuna = k >= 27
    const c = naColuna ? esc(['fu-k3', 'fu-k1']) : esc(cp)
    const x = naColuna ? entre(450, 1150) : rnd() < 0.5 ? entre(20, 420) : entre(1180, 1580)
    const y = naColuna ? entre(250, 760) : entre(260, 900)
    const [g, z] = esc(glifos)
    plancton += `<text x="${Math.round(x)}" y="${Math.round(y)}" class="fu-p fu-s${1 + (k % 3)} fu-e${1 + Math.floor(rnd() * 8)} ${z} ${c}"${naColuna ? ' fill-opacity=".5"' : ''}>${g}</text>`
  }

  const defs =
    // noite
    '<linearGradient id="fu-noite" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#030A1B"/><stop offset=".38" stop-color="#06122B"/><stop offset=".78" stop-color="#081A3D"/><stop offset="1" stop-color="#0A2250"/></linearGradient>' +
    '<radialGradient id="fu-clarao" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#0685F3" stop-opacity=".26"/><stop offset=".55" stop-color="#56B1E1" stop-opacity=".09"/><stop offset="1" stop-color="#56B1E1" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="fu-vig" cx=".5" cy=".45" r=".78"><stop offset=".55" stop-color="#02060F" stop-opacity="0"/><stop offset="1" stop-color="#02060F" stop-opacity=".62"/></radialGradient>' +
    // estrela de 4 pontas
    '<path id="fu-s" d="M0-1C.07-.26.26-.07 1 0 .26.07.07.26 0 1-.07.26-.26.07-1 0-.26-.07-.07-.26 0-1Z"/>' +
    // grão de papel
    '<filter id="fu-g" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .95 0 0 0 0 .92 0 0 0 0 .82 1.6 0 0 0 -.62"/></filter>' +
    // retícula: pontos inclinados, dois tamanhos
    '<pattern id="fu-h1" width="13" height="13" patternUnits="userSpaceOnUse" patternTransform="rotate(18)"><circle cx="6.5" cy="6.5" r="2.5" fill="#56B1E1"/></pattern>' +
    '<pattern id="fu-h2" width="13" height="13" patternUnits="userSpaceOnUse" patternTransform="rotate(18)"><circle cx="6.5" cy="6.5" r="1.25" fill="#56B1E1"/></pattern>' +
    '<linearGradient id="fu-mA" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff"/><stop offset=".07" stop-color="#fff" stop-opacity=".8"/><stop offset=".13" stop-color="#fff" stop-opacity="0"/><stop offset=".87" stop-color="#fff" stop-opacity="0"/><stop offset=".93" stop-color="#fff" stop-opacity=".8"/><stop offset="1" stop-color="#fff"/></linearGradient>' +
    '<linearGradient id="fu-mB" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff"/><stop offset=".12" stop-color="#fff" stop-opacity=".7"/><stop offset=".22" stop-color="#fff" stop-opacity="0"/><stop offset=".78" stop-color="#fff" stop-opacity="0"/><stop offset=".88" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff"/></linearGradient>' +
    '<radialGradient id="fu-mC" cx=".5" cy=".5" r=".72"><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></radialGradient>' +
    '<mask id="fu-m1"><rect width="1600" height="1000" fill="url(#fu-mA)"/><rect width="1600" height="1000" fill="url(#fu-mC)"/></mask>' +
    '<mask id="fu-m3"><rect width="1600" height="1000" fill="url(#fu-mA)"/></mask>' +
    '<mask id="fu-m2"><rect width="1600" height="1000" fill="url(#fu-mB)" opacity=".8"/></mask>' +
    // xadrez fino
    '<pattern id="fu-xz" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#F2B830"/><rect x="10" y="10" width="10" height="10" fill="#F2B830"/></pattern>' +
    // rastro de estrela cadente
    '<linearGradient id="fu-rastro" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#F3EAD3" stop-opacity="0"/><stop offset="1" stop-color="#F3EAD3"/></linearGradient>'

  const cad = (x, y, ang, dist, dur, atraso) =>
    `<g transform="translate(${x} ${y}) rotate(${ang})"><g class="fu-c" style="--fu-dist:${dist}px;animation-duration:${dur}s;animation-delay:-${atraso}s"><rect x="-86" y="-1.1" width="86" height="2.2" rx="1.1" fill="url(#fu-rastro)"/><g fill="#F3EAD3" transform="scale(4.2)"><use href="#fu-s"/></g></g></g>`

  const svg =
    '<rect width="1600" height="1000" fill="url(#fu-noite)"/>' +
    '<ellipse cx="800" cy="905" rx="980" ry="250" fill="url(#fu-clarao)"/>' +
    // retícula nas bordas e cantos
    '<g opacity=".34" mask="url(#fu-m1)"><rect width="1600" height="1000" fill="url(#fu-h1)"/></g>' +
    '<g opacity=".22" mask="url(#fu-m2)"><rect width="1600" height="1000" fill="url(#fu-h2)"/></g>' +
    '<rect width="1600" height="1000" fill="url(#fu-vig)"/>' +
    // faixa xadrez no alto
    '<rect width="1600" height="22" fill="#0A1834"/><rect y="2" width="1600" height="20" fill="url(#fu-xz)" opacity=".5"/><rect y="22" width="1600" height="2" fill="#F2B830" opacity=".5"/><g mask="url(#fu-m3)" opacity=".6"><rect y="180" width="1600" height="10" fill="url(#fu-xz)"/><rect y="192" width="1600" height="1.5" fill="#F2B830" opacity=".6"/></g><g opacity=".42" fill="url(#fu-xz)"><rect y="24" width="10" height="976"/><rect x="1590" y="24" width="10" height="976"/></g><path d="M11 24V1000M1589 24V1000" stroke="#F2B830" stroke-width="1.5" opacity=".35"/>' +
    estrelas + pingos +
    cad(40, 330, 72, 250, 83, 0.9) + cad(1560, 90, 114, 260, 97, 41) + cad(1190, 36, 21, 210, 109, 70) +
    plancton +
    '<rect width="1600" height="1000" filter="url(#fu-g)" opacity=".1"/>'

  const css =
    '.fu-a1,.fu-a2,.fu-a3,.fu-a4,.fu-a5,.fu-a6{transform-origin:0 0}' +
    '.fu-a1{animation:fu-t1 2.7s ease-in-out infinite}.fu-a2{animation:fu-t2 4.1s ease-in-out infinite}' +
    '.fu-a3{animation:fu-t3 5.6s ease-in-out infinite}.fu-a4{animation:fu-t1 7.3s ease-in-out infinite}' +
    '.fu-a5{animation:fu-t2 9.4s ease-in-out infinite}.fu-a6{animation:fu-t3 12.5s ease-in-out infinite}' +
    '.fu-d1{animation-delay:-.4s}.fu-d2{animation-delay:-1.3s}.fu-d3{animation-delay:-2.1s}.fu-d4{animation-delay:-3.4s}' +
    '.fu-d5{animation-delay:-4.6s}.fu-d6{animation-delay:-5.9s}.fu-d7{animation-delay:-7.7s}.fu-d8{animation-delay:-10.2s}' +
    '@keyframes fu-t1{0%,100%{opacity:.3;transform:scale(.62)}50%{opacity:1;transform:scale(1)}}' +
    '@keyframes fu-t2{0%,70%,100%{opacity:.85;transform:scale(1)}80%{opacity:.12;transform:scale(.4)}90%{opacity:1;transform:scale(1.12)}}' +
    '@keyframes fu-t3{0%,100%{opacity:.45;transform:scale(.8)}35%{opacity:1;transform:scale(1.05)}65%{opacity:.6;transform:scale(.88)}}' +
    '.fu-c{opacity:0;animation:fu-cad 31s linear infinite}' +
    '@keyframes fu-cad{0%{opacity:0;transform:translateX(0)}.2%{opacity:1}1.3%{opacity:.9}1.6%{opacity:0;transform:translateX(var(--fu-dist))}100%{opacity:0;transform:translateX(var(--fu-dist))}}' +
    '.fu-k1{fill:#F3EAD3}.fu-k2{fill:#F2B830}.fu-k3{fill:#56B1E1}' +
    '.fu-p{font-family:monospace;font-weight:700;opacity:.45;animation:fu-sobe 27s linear infinite}' +
    '.fu-s2{animation:fu-sobe2 36s linear infinite}.fu-s3{animation:fu-sobe3 44s linear infinite}' +
    '.fu-z1{font-size:34px}.fu-z2{font-size:17px}.fu-z3{font-size:15px}' +
    '.fu-e1{animation-delay:-2s}.fu-e2{animation-delay:-7s}.fu-e3{animation-delay:-12s}.fu-e4{animation-delay:-17s}' +
    '.fu-e5{animation-delay:-22s}.fu-e6{animation-delay:-27s}.fu-e7{animation-delay:-33s}.fu-e8{animation-delay:-40s}' +
    '@keyframes fu-sobe{0%{opacity:0;transform:translateY(0)}18%{opacity:.55}82%{opacity:.5}100%{opacity:0;transform:translateY(-230px)}}' +
    '@keyframes fu-sobe2{0%{opacity:0;transform:translate(0,0)}18%{opacity:.5}50%{transform:translate(12px,-120px)}82%{opacity:.45}100%{opacity:0;transform:translate(-8px,-260px)}}' +
    '@keyframes fu-sobe3{0%{opacity:0;transform:translate(0,0)}20%{opacity:.5}50%{transform:translate(-14px,-100px)}80%{opacity:.4}100%{opacity:0;transform:translate(10px,-200px)}}' +
    '@media (prefers-reduced-motion:reduce){.fu-a1,.fu-a2,.fu-a3,.fu-a4,.fu-a5,.fu-a6,.fu-c,.fu-p{animation:none}}'

  return { css, defs, svg }
}
