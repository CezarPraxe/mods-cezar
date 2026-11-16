// Selo de aviso (se-): selo estourado anos 30 que carimba no canto de cima à direita.
// Só existe com aviso 'compactar' ou 'cache'. Animação só CSS, sem acaso.
const MAR = '#0B1C3D', CRE = '#F3EAD3', LAR = '#E8742A', AMA = '#F2B830'

const burst = (pts, R, r) => {
  let p = ''
  for (let i = 0; i < pts * 2; i++) {
    const a = (Math.PI * i) / pts - Math.PI / 2
    const rr = i % 2 ? r : R
    p += (i ? 'L' : 'M') + (Math.cos(a) * rr).toFixed(1) + ' ' + (Math.sin(a) * rr).toFixed(1)
  }
  return p + 'Z'
}
const faisca = (s) => `M0 ${-s}L${s * 0.22} ${-s * 0.22}L${s} 0L${s * 0.22} ${s * 0.22}L0 ${s}L${-s * 0.22} ${s * 0.22}L${-s} 0L${-s * 0.22} ${-s * 0.22}Z`

const CSS = `
.se-carimbo{animation:se-stamp .9s cubic-bezier(.3,.7,.4,1) both}
.se-bal{animation:se-sway 6.5s ease-in-out infinite}
.se-glint{animation:se-glint 5s linear infinite;animation-delay:-3.2s;opacity:0}
.se-fa{opacity:0}
.se-f1{animation:se-pop 7s ease-in-out infinite -1s}
.se-f2{animation:se-pop 9s ease-in-out infinite -4.5s}
.se-f3{animation:se-pop 8s ease-in-out infinite -6.2s}
.se-f4{animation:se-pop 10s ease-in-out infinite -2.6s}
.se-f5{animation:se-pop 11s ease-in-out infinite -8.3s}
@keyframes se-stamp{0%{transform:scale(1.3);opacity:0}30%{opacity:1}52%{transform:scale(.93)}72%{transform:scale(1.04)}100%{transform:scale(1);opacity:1}}
@keyframes se-sway{0%,100%{transform:rotate(10deg)}50%{transform:rotate(14.5deg)}}
@keyframes se-glint{0%{transform:rotate(0);opacity:0}3%{opacity:.85}22%{transform:rotate(360deg);opacity:.85}26%{transform:rotate(360deg);opacity:0}100%{transform:rotate(360deg);opacity:0}}
@keyframes se-pop{0%,100%{transform:scale(0) rotate(0);opacity:0}5%{transform:scale(1) rotate(45deg);opacity:.95}12%{transform:scale(.7) rotate(90deg);opacity:.7}18%{transform:scale(0) rotate(135deg);opacity:0}}
@media (prefers-reduced-motion:reduce){.se-carimbo,.se-bal,.se-glint,.se-fa{animation:none}.se-bal{transform:rotate(12deg)}.se-glint{display:none}}`

export function desenhar(d) {
  if (d.aviso !== 'compactar' && d.aviso !== 'cache') return { css: '', defs: '', svg: '' }
  const cache = d.aviso === 'cache'
  const cor = cache ? AMA : LAR
  const t1 = cache ? 'CACHE' : 'COMPACTE'
  const t2 = cache ? 'vencendo' : 'contexto cheio'
  const fs1 = cache ? 24 : 18.5
  const B = burst(18, 75, 63)
  const fa = (cls, x, y, s, c) => `<g transform="translate(${x} ${y})"><path class="se-fa ${cls}" d="${faisca(s)}" fill="${c}"/></g>`
  const txt = (y, fs, w, s, extra = '') =>
    `<text y="${y}" text-anchor="middle" font-family="monospace" font-weight="700" font-size="${fs}" letter-spacing="${s}" ${extra} fill="${CRE}" stroke="${MAR}" stroke-width="${w}" stroke-linejoin="round" paint-order="stroke">`
  const svg = `<g transform="translate(1330 270)">
<g class="se-carimbo"><g class="se-bal">
<path d="${B}" transform="translate(6 7)" fill="${MAR}"/>
<path d="${B}" fill="${cor}" stroke="${MAR}" stroke-width="6" stroke-linejoin="round"/>
<circle r="54" fill="none" stroke="${CRE}" stroke-width="1.6" stroke-dasharray="3 5" opacity=".7"/>
<circle class="se-glint" r="68" fill="none" stroke="${CRE}" stroke-width="5" stroke-linecap="round" stroke-dasharray="34 400"/>
<path d="${faisca(6)}" transform="translate(0 -36)" fill="${CRE}" stroke="${MAR}" stroke-width="1.5"/>
${txt(2, fs1, 5, 1)}${t1}</text>
<rect x="-34" y="10" width="68" height="3" rx="1.5" fill="${MAR}"/>
${txt(27, 11, 3.5, 0.3)}${t2}</text>
</g></g>
${fa('se-f1', -86, -50, 9, CRE)}${fa('se-f2', 90, -38, 7, AMA)}${fa('se-f3', 76, 68, 10, CRE)}${fa('se-f4', -80, 62, 7, AMA)}${fa('se-f5', 8, -96, 6, CRE)}
</g>`
  return { css: CSS, defs: '', svg }
}
