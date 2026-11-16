// Lua do contexto (prefixo lu-). ctx 0..100 = fase: 0 nova, 50 meia, 100 cheia (crescente, luz à direita).
// 70+ esquenta para laranja e pulsa; 90+ ganha anel de pulso. Sem azar: nenhuma aleatoriedade.
const CX = 270, CY = 270, R = 80
const CREME = [243, 234, 211], LARANJA = [232, 116, 42]

const n1 = (v) => Math.round(v * 10) / 10
const mix = (a, b, t) => '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('')
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')

// Contorno da parte iluminada: meia circunferência direita + terminador elíptico
function iluminado(f) {
  const rx = Math.max(R * Math.abs(1 - 2 * f), 0.01)
  const sw = f < 0.5 ? 0 : 1
  return `M${CX} ${CY - R}A${R} ${R} 0 0 1 ${CX} ${CY + R}A${n1(rx)} ${R} 0 0 ${sw} ${CX} ${CY - R}Z`
}

// Nuvem retrô: contorno por trás (traço grosso), recheio por cima, listras de impressão
function nuvem(c, esc, fill, listra) {
  const forma = `<circle cx="-34" cy="-8" r="15"/><circle cx="-10" cy="-18" r="22"/><circle cx="20" cy="-14" r="19"/><circle cx="42" cy="-6" r="13"/><rect x="-48" y="-8" width="104" height="14" rx="7"/>`
  return `<g class="${c}" transform="scale(${esc})"><g fill="#0B1C3D" stroke="#0B1C3D" stroke-width="9" stroke-linejoin="round">${forma}</g><g fill="${fill}">${forma}</g><path d="M-38 -1H46M-26 -9H30" stroke="${listra}" stroke-width="2.4" stroke-linecap="round" opacity=".5"/></g>`
}

export function desenhar(d) {
  const ctx = Math.max(0, Math.min(100, Math.round(d.ctx ?? 0)))
  const f = Math.max(ctx, 5) / 100 // ctx 0 ainda mostra um fio de luz
  const quente = ctx >= 70
  const forte = ctx >= 90

  const corLuz = quente ? '#E8742A' : '#F3EAD3'
  const corSombra = quente ? '#B8541C' : '#D9CCA6'
  const corHalo = quente ? '#E8742A' : '#F3EAD3'
  const corAro = quente ? '#E8742A' : '#F3EAD3'
  const corTexto = quente ? (forte ? '#F2B830' : '#F6C58A') : '#F3EAD3'
  const haloOp = n1(0.3 + 0.35 * f + (quente ? 0.2 : 0) + (forte ? 0.15 : 0))
  const aw = quente ? 2.4 : 1.6
  const dur = forte ? 2.6 : quente ? 3.6 : 7.5
  const amp = forte ? 1.12 : quente ? 1.09 : 1.05

  const lit = iluminado(f)
  const crateras = [[-28, -20, 14], [22, -36, 9], [31, 12, 17], [-14, 31, 11], [-46, 14, 7], [4, -4, 6], [48, -10, 5]]
  const crLuz = crateras.map(([x, y, r]) => `<circle cx="${CX + x}" cy="${CY + y}" r="${r}" fill="${corSombra}" stroke="#0B1C3D" stroke-width="2.6" stroke-opacity=".7"/><circle cx="${CX + x}" cy="${CY + y}" r="${r}" fill="url(#lu-ret)" opacity=".55"/>`).join('')
  const crSombra = crateras.map(([x, y, r]) => `<circle cx="${CX + x}" cy="${CY + y}" r="${r}" fill="none" stroke="#F3EAD3" stroke-width="2" opacity=".16"/>`).join('')

  const css = `
.lu-halo{transform-box:view-box;transform-origin:${CX}px ${CY}px;animation:lu-resp ${dur}s ease-in-out -1.7s infinite}
.lu-halo2{transform-box:view-box;transform-origin:${CX}px ${CY}px;animation:lu-resp ${dur * 1.6}s ease-in-out -4s infinite}
.lu-halo3{transform-box:view-box;transform-origin:${CX}px ${CY}px;animation:lu-resp ${dur * 2.1}s ease-in-out -2.6s infinite}
.lu-brilho{transform-box:view-box;transform-origin:${CX}px ${CY}px;animation:lu-gira 15s linear -3s infinite}
.lu-pulso{transform-box:view-box;transform-origin:${CX}px ${CY}px;animation:lu-onda 3.2s ease-out -.8s infinite}
.lu-nuvf{animation:lu-passa 96s linear -40s infinite;opacity:0}
.lu-nuvt{animation:lu-passa2 131s linear -100s infinite;opacity:0}
.lu-faixa{animation:lu-leve 6s ease-in-out -2s infinite}
@keyframes lu-resp{0%,100%{transform:scale(.97);opacity:.7}50%{transform:scale(${amp});opacity:1}}
@keyframes lu-gira{to{transform:rotate(360deg)}}
@keyframes lu-onda{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.55);opacity:0}}
@keyframes lu-passa{0%{transform:translate(110px,308px) scale(1);opacity:0}3%{opacity:.92}20%{opacity:.92}24%{transform:translate(410px,300px) scale(1);opacity:0}100%{transform:translate(410px,300px);opacity:0}}
@keyframes lu-passa2{0%{transform:translate(420px,214px) scale(.8);opacity:0}3%{opacity:.8}17%{opacity:.8}21%{transform:translate(130px,222px) scale(.8);opacity:0}100%{transform:translate(130px,222px);opacity:0}}
@keyframes lu-leve{0%,100%{opacity:.85}50%{opacity:1}}
@media (prefers-reduced-motion:reduce){.lu-halo,.lu-halo2,.lu-halo3,.lu-brilho,.lu-pulso,.lu-nuvf,.lu-nuvt,.lu-faixa{animation:none}.lu-nuvf,.lu-nuvt,.lu-pulso{opacity:0}}`

  const defs = `<pattern id="lu-ret" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="3.5" cy="3.5" r="1.45" fill="#0B1C3D"/></pattern>
<pattern id="lu-ret2" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="4.5" cy="4.5" r="1.3" fill="#F3EAD3"/></pattern>
<clipPath id="lu-cl"><path d="${lit}"/></clipPath>
<clipPath id="lu-cd"><circle cx="${CX}" cy="${CY}" r="${R}"/></clipPath>`

  const svg = `
<g id="lu-lua">
<g fill="none" stroke="${corHalo}" stroke-linecap="round">
<circle class="lu-halo" cx="${CX}" cy="${CY}" r="100" stroke-width="${aw + 1.4}" stroke-dasharray="1 8" opacity="${haloOp}"/>
<circle class="lu-halo2" cx="${CX}" cy="${CY}" r="118" stroke-width="${aw}" stroke-dasharray="14 9" opacity="${n1(haloOp * 0.8)}"/>
<circle class="lu-halo3" cx="${CX}" cy="${CY}" r="137" stroke-width="${aw + 1}" stroke-dasharray="1 11" opacity="${n1(haloOp * 0.6)}"/>
</g>
${forte ? `<circle class="lu-pulso" cx="${CX}" cy="${CY}" r="${R + 8}" fill="none" stroke="#E8742A" stroke-width="3.5"/>` : ''}
<g class="lu-nuvt" transform="translate(0 0)">${nuvem('', 1, '#1A3563', '#56B1E1')}</g>
<circle cx="${CX}" cy="${CY}" r="${R}" fill="#10244A"/>
<g clip-path="url(#lu-cd)"><circle cx="${CX}" cy="${CY}" r="${R}" fill="url(#lu-ret2)" opacity=".13"/>${crSombra}</g>
<g class="lu-faixa">
<g clip-path="url(#lu-cl)">
<circle cx="${CX}" cy="${CY}" r="${R}" fill="${corLuz}"/>
<path fill-rule="evenodd" fill="url(#lu-ret)" opacity=".42" d="M${CX - R} ${CY}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0ZM${CX - R + 26} ${CY - 26}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0Z"/>
${crLuz}
<g class="lu-brilho"><circle cx="${CX}" cy="${CY}" r="${R - 4}" fill="none" stroke="#FFF8E6" stroke-width="5" stroke-linecap="round" stroke-dasharray="64 440" opacity=".95"/></g>
</g>
<path d="${lit}" fill="none" stroke="#0B1C3D" stroke-width="3" stroke-linejoin="round"/>
</g>
<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="#0B1C3D" stroke-width="8"/>
<circle cx="${CX}" cy="${CY}" r="${R + 8}" fill="none" stroke="${corAro}" stroke-width="1.6" opacity="${quente ? '.55' : '.3'}"/>
<g class="lu-nuvf">${nuvem('', 1, '#223F72', '#56B1E1')}</g>
<g>
<rect x="${CX - 56}" y="${CY + R + 20}" width="112" height="28" rx="6" fill="#0A1834" stroke="#0B1C3D" stroke-width="3"/>
<rect x="${CX - 56}" y="${CY + R + 20}" width="112" height="28" rx="6" fill="none" stroke="${quente ? '#E8742A' : '#F3EAD3'}" stroke-width="1.6" opacity=".7"/>
<text x="${CX}" y="${CY + R + 40}" text-anchor="middle" font-family="monospace" font-size="16" font-weight="bold" letter-spacing="1" fill="${corTexto}">ctx ${ctx}%</text>
</g>
</g>`

  return { css, defs, svg }
}
