// Peixes e bolhas (prefixo pe-): um peixe por subagente rodando, peixe de barriga para cima por erro.
// Sem Math.random: a semente é o índice do peixe, então o peixe 1 nada igual com 1 ou com 12 agentes.
const MAR = '#0B1C3D'
// saudáveis: amarelo, azul-tinta e creme (laranja e coral são só do erro); 6 e 10 são andarilhos, sem amarelo
const COR = ['#F2B830', '#56B1E1', '#F3EAD3', '#56B1E1', '#F2B830', '#F3EAD3', '#F3EAD3', '#F2B830', '#56B1E1', '#F2B830', '#56B1E1', '#F3EAD3']
const ERRO = '#F07A5E'
const CINZA = '#8A93A6'

function sem(s) {
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const n = (v, k = 1) => String(+v.toFixed(k))
const lim = (v, a, b) => Math.min(b, Math.max(a, v))

const CSS = `
.pe-n,.pe-m{animation:pe-n var(--pe-T) ease-in-out var(--pe-D) infinite}
.pe-m{animation:pe-n var(--pe-T) ease-in-out var(--pe-D) infinite,pe-wo var(--pe-T) ease-in-out var(--pe-D) infinite}
.pe-v{animation:pe-f var(--pe-T) linear var(--pe-D) infinite}
.pe-o{animation:pe-o var(--pe-B) ease-in-out var(--pe-E) infinite alternate}
.pe-t{animation:pe-t var(--pe-W) ease-in-out var(--pe-V) infinite alternate}
.pe-sw{animation:pe-sw var(--pe-T) ease-in-out var(--pe-D) infinite alternate}
.pe-fb{animation:pe-fb var(--pe-T) ease-out var(--pe-D) infinite;opacity:0}
.pe-r{animation:pe-r var(--pe-T) linear var(--pe-D) infinite;opacity:0}
.pe-s{animation:pe-s var(--pe-W) ease-in-out var(--pe-V) infinite alternate}
.pe-bal{animation:pe-bal var(--pe-T) ease-in-out var(--pe-D) infinite alternate}
.pe-rp{fill:none;stroke:#F07A5E;stroke-width:1.6;transform-box:fill-box;transform-origin:center;animation:pe-rp var(--pe-T) ease-out var(--pe-D) infinite;opacity:0}
@keyframes pe-n{0%,100%{transform:translate(0,0)}50%{transform:translate(var(--pe-dx),var(--pe-dy))}}
@keyframes pe-f{0%,49.9%{transform:scaleX(var(--pe-a))}50%,99.9%{transform:scaleX(calc(var(--pe-a)*-1))}100%{transform:scaleX(var(--pe-a))}}
@keyframes pe-wo{0%,100%{opacity:.85}13%,38%{opacity:.26}50%{opacity:.85}63%,88%{opacity:.26}}
@keyframes pe-o{0%{transform:translate(0,-3px) rotate(-2.5deg)}100%{transform:translate(0,3px) rotate(2.5deg)}}
@keyframes pe-t{0%{transform:rotate(-17deg)}100%{transform:rotate(17deg)}}
@keyframes pe-sw{0%{transform:translate(-9px,3px)}100%{transform:translate(9px,-3px)}}
@keyframes pe-fb{0%{transform:translate(0,0);opacity:0}5%{opacity:.9}30%{transform:translate(2px,-30px);opacity:.8}38%{transform:translate(2px,-36px);opacity:0}100%{transform:translate(2px,-36px);opacity:0}}
@keyframes pe-r{0%{transform:translate(0,0);opacity:0}7%{opacity:.85}78%{opacity:.75}100%{transform:translate(0,var(--pe-r));opacity:0}}
@keyframes pe-s{0%{transform:translateX(calc(var(--pe-w)*-1))}100%{transform:translateX(var(--pe-w))}}
@keyframes pe-bal{0%{transform:translate(-2px,-2px) rotate(-5deg)}100%{transform:translate(2px,3px) rotate(5deg)}}
@keyframes pe-rp{0%{transform:scale(.45);opacity:.65}70%{opacity:.12}100%{transform:scale(1.35);opacity:0}}
@media (prefers-reduced-motion:reduce){.pe-n,.pe-m,.pe-v,.pe-o,.pe-t,.pe-sw,.pe-fb,.pe-r,.pe-s,.pe-bal,.pe-rp{animation:none}.pe-r,.pe-fb,.pe-rp{opacity:0}}
`.replace(/\n/g, '')

// Peixe virado para a direita, centro em (0,0), ~47 de comprimento. A cor vem de currentColor.
const corpo = (id, k, w) => `<g id="pe-c${id}" stroke="${k}" stroke-width="${w}" stroke-linejoin="round" fill="currentColor"><path d="M-7-8Q0-25 13-9Z"/><path d="M-3 8Q2 20 11 9Z"/><path d="M22 0C17-10 3-13-8-7C-12-5-14-2-14 0C-14 2-12 5-8 7C3 13 17 10 22 0Z"/><path d="M3-10Q6.5 0 3 10L-1 9Q2.5 0-1-9Z" fill="${MAR}" fill-opacity=".24" stroke="none"/><path d="M8.5-6Q5.5 0 8.5 6M20.5 3Q18 4.7 15.5 3.6" fill="none" stroke-width="1.4" stroke-linecap="round"/></g><g id="pe-t${id}" fill="currentColor" stroke="${k}" stroke-width="${w}" stroke-linejoin="round"><path d="M0 0L-14-10Q-10 0-14 10Z"/></g>`
const DEFS = (corpo('', MAR, 2.2) + corpo('x', ERRO, 2.8) + `
<g id="pe-e"><circle cx="13" cy="-2.5" r="4.7" fill="#FFF8E9" stroke="${MAR}" stroke-width="1.7"/><circle cx="14.4" cy="-2.3" r="2.3" fill="${MAR}"/><circle cx="15.2" cy="-3.4" r=".85" fill="#FFF8E9"/></g>
<g id="pe-x"><circle cx="13" cy="-2.5" r="6.2" fill="#FFF8E9" stroke="${ERRO}" stroke-width="2"/><path d="M9.6-5.9L16.4.9M16.4-5.9L9.6.9" stroke="${MAR}" stroke-width="2.8" stroke-linecap="round"/></g>
<g id="pe-bo"><circle r="5" fill="#56B1E1" fill-opacity=".16" stroke="#8FD6F7" stroke-width="1.5"/><path d="M-2.5-1.5A3 3 0 0 1 0-3.3" fill="none" stroke="#F3EAD3" stroke-width="1.2" stroke-linecap="round"/></g>
<g id="pe-ex"><circle r="8" fill="#0A1834" stroke="${ERRO}" stroke-width="2"/><text y="4.2" text-anchor="middle" font-family="monospace" font-size="12" font-weight="bold" fill="${ERRO}">!</text></g>`).split('\n').join('')

const REG = [150, 1170] // início da faixa lateral (esquerda, direita); largura 280

function peixe(i, sup) {
  const r = sem(7919 * (i + 1) + 13)
  const lado = i % 2
  const andarilho = i === 6 || i === 10
  const s = 0.76 + r() * 0.3
  const T = andarilho ? 78 + r() * 14 : 15 + r() * 13
  let x0, dx, dir
  if (andarilho) {
    dir = i === 10 ? -1 : 1
    x0 = dir > 0 ? 190 : 1205
    dx = 1015 * dir
    r(); r()
  } else {
    const wl = 80 + r() * 150
    const ini = REG[lado] + 24 + r() * (280 - 48 - wl)
    dir = r() < 0.5 ? 1 : -1
    x0 = dir > 0 ? ini : ini + wl
    dx = wl * dir
  }
  // esquerda: abaixo dos erros; direita: fora da área do Clawd (x 1220–1440, até sup+170)
  const lo = sup + (lado === 1 && !andarilho ? 196 : 82)
  const hi = Math.max(860, lo + 60)
  const f = (0.31 + i * 0.618034 + r() * 0.12) % 1
  const y0 = andarilho ? lim(762 + r() * 28, lo, hi) : lo + f * (hi - lo)
  const dy = lim(y0 + (r() - 0.5) * 56, lo, hi) - y0
  const D = -r() * T
  const B = 3 + r() * 2.5
  const E = -r() * 5
  const W = 0.55 + r() * 0.35
  const V = -r()
  const Tb = 7 + r() * 6
  const Db = -r() * Tb
  const op = andarilho ? '' : ` opacity="${n(0.97 - 0.2 * f, 2)}"`
  const sty = `--pe-dx:${n(dx)}px;--pe-dy:${n(dy)}px;--pe-T:${n(T)}s;--pe-D:${n(D)}s;--pe-a:${dir}`
  return {
    lado: andarilho ? -1 : lado,
    s: `<g transform="translate(${n(x0)} ${n(y0)})"${op}><g class="${andarilho ? 'pe-m' : 'pe-n'}" style="${sty}"><g class="pe-v"><g class="pe-o" style="--pe-B:${n(B)}s;--pe-E:${n(E)}s"><g transform="scale(${n(s, 2)})" color="${COR[i % 12]}"><g transform="translate(-12 0)"><use href="#pe-t" class="pe-t" style="--pe-W:${n(W, 2)}s;--pe-V:${n(V, 2)}s"/></g><use href="#pe-c"/><use href="#pe-e"/></g></g></g><g class="pe-fb" style="--pe-T:${n(Tb)}s;--pe-D:${n(Db)}s"><use href="#pe-bo" transform="translate(0 -9) scale(.6)"/><use href="#pe-bo" transform="translate(5 -16) scale(.38)"/></g></g></g>`,
  }
}

const XE = [290, 205, 360, 247]
const YE = [30, 40, 36, 66]
const TE = [-9, 8, -5, 12]

function erro(j, sup) {
  const r = sem(3301 * (j + 1) + 5)
  const s = 1.15 + r() * 0.1
  const T = 3.6 + r() * 1.8
  const D = -r() * T
  const Tb = 8 + r() * 5
  const x = XE[j]
  const y = sup + YE[j]
  return `<g transform="translate(${x} ${n(sup + 3)})"><ellipse class="pe-rp" rx="30" ry="4.5" style="--pe-T:${n(T * 1.4)}s;--pe-D:${n(D)}s"/></g><g transform="translate(${x} ${n(y)})"><circle r="34" fill="${ERRO}" fill-opacity=".13"/><g class="pe-bal" style="--pe-T:${n(T)}s;--pe-D:${n(D)}s"><g transform="rotate(${TE[j]}) scale(${n(s, 2)} ${n(-s, 2)})" color="${CINZA}"><g transform="translate(-12 0) rotate(8)"><use href="#pe-tx"/></g><use href="#pe-cx"/><use href="#pe-x"/></g></g><g class="pe-fb" style="--pe-T:${n(Tb)}s;--pe-D:${n(-r() * Tb)}s"><use href="#pe-ex" transform="translate(18 -4) scale(.9)"/></g></g>`
}

// bolhas ambiente: laterais e fundo, sobem até a superfície e apagam lá
function bolhas(sup) {
  const r = sem(424242)
  let o = ''
  for (let k = 0; k < 22; k++) {
    const zona = k % 11
    let x, alfa = 1
    if (zona < 3) x = 70 + r() * 80
    else if (zona < 5) x = 150 + r() * 280
    else if (zona < 7) x = 1450 + r() * 90
    else if (zona < 10) x = 1170 + r() * 280
    else { x = 470 + r() * 660; alfa = 0.45 }
    const tam = 0.5 + r() * 0.7
    const y0 = 985 + r() * 25
    const dist = y0 - sup
    const v = 26 + r() * 22
    const T = dist / v
    const D = -r() * T
    const w = 3 + r() * 5
    const W = 2.6 + r() * 2.4
    if (dist < 30) { r(); r(); continue }
    o += `<g transform="translate(${n(x)} ${n(y0)})"${alfa < 1 ? ` opacity="${alfa}"` : ''}><g class="pe-r" style="--pe-r:${n(-dist)}px;--pe-T:${n(T)}s;--pe-D:${n(D)}s"><g class="pe-s" style="--pe-w:${n(w)}px;--pe-W:${n(W)}s;--pe-V:${n(-r() * W)}s"><use href="#pe-bo" transform="scale(${n(tam, 2)})"/></g></g></g>`
  }
  return o
}

// rótulo no estilo da lua, no ar, borda direita em x=412 (a mesma do rótulo da água), 8 acima dele
function rotulo(ag, er, sup, ideal) {
  if (!ag && !er) return ''
  const txt = (ag ? `agentes ${ag}` : '') + (ag && er ? ' · ' : '') + (er ? `erro ${er}` : '')
  const w = Math.round(txt.length * 9.4 + 18)
  const yb = Math.min(sup, 740 - (ideal || 0) * 2) - 20 - 26 - 8 // base do meu retângulo
  const x = 412 - w
  const y = n(yb - 26)
  return `<g><rect x="${x}" y="${y}" width="${w}" height="26" rx="6" fill="#0A1834" stroke="${MAR}" stroke-width="3"/><rect x="${x}" y="${y}" width="${w}" height="26" rx="6" fill="none" stroke="${er ? ERRO : '#F3EAD3'}" stroke-width="1.6" opacity=".7"/><text x="403" y="${n(yb - 8)}" text-anchor="end" font-family="monospace" font-size="14" font-weight="bold" letter-spacing="1" fill="#F3EAD3">${txt}</text></g>`
}

export function desenhar(d) {
  const sup = d.sup
  const ag = Math.max(0, Math.min(12, d.agentes | 0))
  const er = Math.max(0, Math.min(4, d.erros | 0))
  const esq = [], dir = [], and = []
  for (let i = 0; i < ag; i++) {
    const p = peixe(i, sup)
    ;(p.lado < 0 ? and : p.lado === 0 ? esq : dir).push(p.s)
  }
  const sw = (lista, T, D) => (lista.length ? `<g class="pe-sw" style="--pe-T:${T}s;--pe-D:${D}s">${lista.join('')}</g>` : '')
  let svg = bolhas(sup) + and.join('') + sw(esq, 9.5, -2) + sw(dir, 11.5, -6)
  for (let j = 0; j < er; j++) svg += erro(j, sup)
  svg += rotulo(ag, er, sup, d.ideal)
  return { css: CSS, defs: DEFS, svg }
}
