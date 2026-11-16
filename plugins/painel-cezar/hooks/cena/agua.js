// Água da semana (prefixo ag-). Recebe semana, ideal, sup. Devolve { css, defs, tras, frente }.
// tras  = corpo da água (6 camadas de onda, retícula, raios, glifos, fundo, linha do ideal)
// frente = contorno marinho da crista da frente, espuma, respingos, brilho correndo e cintilas
const f = (v) => String(Math.round(v * 10) / 10)

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ESTRELA = 'M0-10Q1.6-1.6 10 0Q1.6 1.6 0 10Q-1.6 1.6-10 0Q-1.6-1.6 0-10Z'
const FUNDO = 1100

// onda suave (seno): período exato wl, para o laço sem emenda
function seno(x0, x1, y, amp, wl) {
  let d = `M${f(x0)} ${f(y)}Q${f(x0 + wl / 4)} ${f(y - amp)} ${f(x0 + wl / 2)} ${f(y)}`
  for (let x = x0 + wl / 2; x < x1; x += wl / 2) d += `T${f(x + wl / 2)} ${f(y)}`
  return d + `V${FUNDO}H${f(x0)}Z`
}

// crista pontuda (trocoide) para a camada do meio
function crista(x0, x1, y, amp, wl) {
  let d = `M${f(x0)} ${f(y)}`
  for (let x = x0; x < x1; x += wl) {
    d += `C${f(x + wl * 0.2)} ${f(y)} ${f(x + wl * 0.4)} ${f(y - amp * 0.85)} ${f(x + wl / 2)} ${f(y - amp)}`
    d += `C${f(x + wl * 0.6)} ${f(y - amp * 0.85)} ${f(x + wl * 0.8)} ${f(y)} ${f(x + wl)} ${f(y)}`
  }
  return d + `V${FUNDO}H${f(x0)}Z`
}

// escamas (vieira) estilo anos 30: aberta (contorno) e fechada (corpo)
function vieira(x0, x1, y, wl, fechar) {
  const r = wl * 0.66
  let d = `M${f(x0)} ${f(y)}`
  for (let x = x0; x < x1; x += wl) d += `A${f(r)} ${f(r)} 0 0 1 ${f(x + wl)} ${f(y)}`
  return fechar ? d + `V${FUNDO}H${f(x0)}Z` : d
}

export function desenhar(d) {
  const { semana, ideal, sup } = d
  const R = rng(4747)
  const H = 1010 - sup // profundidade até o pé
  const abaixo = semana < ideal
  const COR = abaixo ? '#F2B830' : '#56B1E1'

  // ---------- geometria das camadas
  const P4 = 420 // 5 escamas de 84: período do laço da crista da frente
  const WL4 = 84
  const y4 = sup + 8
  const h4 = WL4 * 0.66 - Math.sqrt((WL4 * 0.66) ** 2 - (WL4 / 2) ** 2)
  const L1 = seno(-360, 1600 + 360, sup - 30, 9, 360)
  const L2 = seno(-240, 1600 + 240, sup - 18, 8, 240)
  const L3 = crista(-168, 1600 + 168, sup - 5, 11, 168)
  const L4 = vieira(-P4, 1600 + P4 + WL4, y4, WL4, true)
  const C4 = vieira(-P4, 1600 + P4 + WL4, y4, WL4, false)
  const D5 = vieira(-480, 1600 + 480, sup + 50, 96, false)
  const D6 = vieira(-576, 1600 + 576, sup + 92, 96, false)

  // ---------- CSS
  const css = `
.ag-mL1{animation:ag-aL1 72s linear infinite}@keyframes ag-aL1{to{transform:translateX(-360px)}}
.ag-mR2{animation:ag-aR2 44s linear infinite}@keyframes ag-aR2{to{transform:translateX(240px)}}
.ag-mL3{animation:ag-aL3 29s linear infinite}@keyframes ag-aL3{to{transform:translateX(-168px)}}
.ag-mR4{animation:ag-aR4 44s linear infinite}@keyframes ag-aR4{to{transform:translateX(420px)}}
.ag-mL5{animation:ag-aL5 46s linear infinite}@keyframes ag-aL5{to{transform:translateX(-480px)}}
.ag-mR6{animation:ag-aR6 58s linear infinite}@keyframes ag-aR6{to{transform:translateX(576px)}}
.ag-b1{animation:ag-bb 8s ease-in-out -2s infinite alternate}
.ag-b2{animation:ag-bb 6.4s ease-in-out -4s infinite alternate}
.ag-b3{animation:ag-bb 5.2s ease-in-out -1s infinite alternate}
.ag-b4{animation:ag-bb 4.4s ease-in-out -3s infinite alternate}
@keyframes ag-bb{from{transform:translateY(-3px)}to{transform:translateY(4px)}}
.ag-ry{animation:ag-ra 31s ease-in-out infinite alternate,ag-rb 9s ease-in-out infinite}
.ag-ry:nth-child(2n){animation-duration:43s,12s;animation-delay:-11s,-3s}
.ag-ry:nth-child(3n){animation-duration:37s,7.5s;animation-delay:-22s,-5s}
@keyframes ag-ra{from{transform:rotate(-4deg)}to{transform:rotate(4deg)}}
@keyframes ag-rb{0%,100%{opacity:.55}50%{opacity:1}}
.ag-g1,.ag-g2,.ag-g3,.ag-g4,.ag-g5{fill:none;stroke:#7FD0F5;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.ag-g1{animation:ag-dr 11s ease-in-out -2s infinite alternate,ag-tw 5.5s ease-in-out -1s infinite}
.ag-g2{animation:ag-dr 14s ease-in-out -7s infinite alternate-reverse,ag-tw 7s ease-in-out -4s infinite}
.ag-g3{animation:ag-dr 9s ease-in-out -4s infinite alternate,ag-tw 4.6s ease-in-out -2.5s infinite}
.ag-g4{animation:ag-dr 16s ease-in-out -9s infinite alternate-reverse,ag-tw 6.2s ease-in-out -.5s infinite}
.ag-g5{animation:ag-dr 12.5s ease-in-out -1s infinite alternate,ag-tw 8s ease-in-out -6s infinite}
@keyframes ag-dr{from{transform:translateX(-12px)}to{transform:translateX(18px)}}
@keyframes ag-tw{0%,100%{opacity:.18}50%{opacity:1}}
.ag-mt{fill:#9FE0FF}
.ag-m1{animation:ag-up 17s linear -3s infinite}.ag-m2{animation:ag-up 23s linear -11s infinite}
.ag-m3{animation:ag-up 20s linear -16s infinite}.ag-m4{animation:ag-up 27s linear -6s infinite}
@keyframes ag-up{0%{transform:translate(0,0);opacity:0}15%{opacity:.9}55%{opacity:.35}80%{opacity:.8}100%{transform:translate(12px,-120px);opacity:0}}
.ag-sw{animation:ag-sy 6s ease-in-out infinite alternate}
.ag-sw2{animation:ag-sy 8.5s ease-in-out -3s infinite alternate-reverse}
@keyframes ag-sy{from{transform:rotate(-5deg)}to{transform:rotate(5deg)}}
.ag-gn{fill:#D8F3FF;animation:ag-gl 5s ease-in-out infinite}
@keyframes ag-gl{0%{opacity:0}16%{opacity:1}40%{opacity:0}100%{opacity:0}}
.ag-pf{animation:ag-pu 5s ease-in-out infinite}
@keyframes ag-pu{0%{transform:scale(.4);opacity:0}25%{transform:scale(1);opacity:.95}60%{transform:scale(.85) translateY(-2px);opacity:.7}100%{transform:scale(.5) translateY(-4px);opacity:0}}
.ag-sa{animation:ag-sA 3.8s ease-out infinite}
.ag-sb{animation:ag-sB 4.6s ease-out infinite}
@keyframes ag-sA{0%{transform:translate(0,2px) scale(.3);opacity:0}12%{opacity:1}100%{transform:translate(9px,-26px) scale(1);opacity:0}}
@keyframes ag-sB{0%{transform:translate(0,2px) scale(.3);opacity:0}14%{opacity:1}100%{transform:translate(-8px,-21px) scale(.9);opacity:0}}
.ag-st{fill:#CFEFFF;stroke:#0B1C3D;stroke-width:1.4;stroke-linejoin:round;transform-box:fill-box;transform-origin:center;animation:ag-ts 4.4s ease-in-out infinite}
@keyframes ag-ts{0%,100%{transform:scale(.3);opacity:.3}50%{transform:scale(1);opacity:1}}
.ag-pisca{animation:ag-pi 4.8s ease-in-out infinite}
@keyframes ag-pi{0%,100%{opacity:.5}50%{opacity:1}}
.ag-calma{animation:ag-ca 10s ease-in-out infinite}
@keyframes ag-ca{0%,100%{opacity:.78}50%{opacity:1}}
.ag-ie{transform-box:fill-box;transform-origin:center;animation:ag-ie 3.6s ease-in-out infinite}
@keyframes ag-ie{0%,100%{transform:scale(.8) rotate(0)}50%{transform:scale(1.12) rotate(8deg)}}
@media (prefers-reduced-motion:reduce){[class^="ag-"],[class*=" ag-"]{animation:none!important}}
`.replace(/\n/g, '')

  // ---------- defs
  const gx = (id, stops, x1, x2) =>
    `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="0" x2="${x2}" y2="0">${stops}</linearGradient>`
  const cinza = (o, c) => `<stop offset="${o}" stop-color="${c}"/>`
  const mascara = (id, g) =>
    `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="1600" height="1100"><rect width="1600" height="1100" fill="url(#${g})"/></mask>`
  const rampa = (id, stops) =>
    `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${sup + 10}" x2="0" y2="1010">${stops}</linearGradient>`

  const defs = [
    // corpo da água (a escama da frente carrega o degradê)
    `<linearGradient id="ag-gb" gradientUnits="userSpaceOnUse" x1="0" y1="${sup - 20}" x2="0" y2="1010"><stop offset="0" stop-color="#1D56AE"/><stop offset=".16" stop-color="#15489A"/><stop offset=".5" stop-color="#0C2C61"/><stop offset="1" stop-color="#06122B"/></linearGradient>`,
    // máscaras laterais: o centro some, a vida mora nos lados
    gx('ag-gc', cinza(0, '#fff') + cinza(0.2, '#fff') + cinza(0.35, '#4a4a4a') + cinza(0.65, '#4a4a4a') + cinza(0.8, '#fff') + cinza(1, '#fff'), 0, 1600),
    gx('ag-gv', cinza(0, '#fff') + cinza(0.2, '#fff') + cinza(0.26, '#080808') + cinza(0.74, '#080808') + cinza(0.8, '#fff') + cinza(1, '#fff'), 0, 1600),
    gx('ag-gf', cinza(0, '#fff') + cinza(0.2, '#fff') + cinza(0.34, '#262626') + cinza(0.66, '#262626') + cinza(0.8, '#fff') + cinza(1, '#fff'), 0, 1600),
    mascara('ag-mc', 'ag-gc'),
    mascara('ag-mv', 'ag-gv'),
    mascara('ag-mf', 'ag-gf'),
    // calma escura no meio do pé (caixa de mensagem)
    gx('ag-gp', `<stop offset="0" stop-color="#06122B" stop-opacity="0"/><stop offset=".3" stop-color="#06122B" stop-opacity=".6"/><stop offset=".7" stop-color="#06122B" stop-opacity=".6"/><stop offset="1" stop-color="#06122B" stop-opacity="0"/>`, 380, 1220),
    `<linearGradient id="ag-gq" gradientUnits="userSpaceOnUse" x1="0" y1="740" x2="0" y2="830"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient>`,
    `<mask id="ag-mp" maskUnits="userSpaceOnUse" x="0" y="0" width="1600" height="1100"><rect width="1600" height="1100" fill="url(#ag-gq)"/></mask>`,
    // retícula que escurece com a profundidade (três tamanhos de ponto)
    `<pattern id="ag-pa" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="4.5" cy="4.5" r="1.3" fill="#06122B"/></pattern>`,
    `<pattern id="ag-pb" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="4.5" cy="4.5" r="2.2" fill="#06122B"/></pattern>`,
    `<pattern id="ag-pc" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="4.5" cy="4.5" r="3.1" fill="#06122B"/></pattern>`,
    `<pattern id="ag-pl" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="5" cy="5" r="1.2" fill="#56B1E1"/></pattern>`,
    rampa('ag-r1', cinza(0, '#000') + cinza(0.12, '#fff') + cinza(0.4, '#fff') + cinza(0.7, '#000')),
    rampa('ag-r2', cinza(0.25, '#000') + cinza(0.5, '#fff') + cinza(0.7, '#fff') + cinza(0.95, '#000')),
    rampa('ag-r3', cinza(0.55, '#000') + cinza(0.9, '#fff')),
    rampa('ag-r4', cinza(0, '#000') + cinza(0.05, '#fff') + cinza(0.22, '#000')),
    ['1', '2', '3', '4'].map((k) => `<mask id="ag-q${k}" maskUnits="userSpaceOnUse" x="0" y="0" width="1600" height="1100"><rect width="1600" height="1100" fill="url(#ag-r${k})"/></mask>`).join(''),
    // raios de luz
    `<linearGradient id="ag-ra" gradientUnits="userSpaceOnUse" x1="0" y1="${sup + 6}" x2="0" y2="${sup + 6 + Math.min(460, H + 40)}"><stop offset="0" stop-color="#56B1E1" stop-opacity=".2"/><stop offset="1" stop-color="#56B1E1" stop-opacity="0"/></linearGradient>`,
    // linha do ideal: some na borda de fora, acende para dentro
    `<linearGradient id="ag-ge" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="408" y2="0"><stop offset="0" stop-color="${COR}" stop-opacity="0"/><stop offset=".4" stop-color="${COR}" stop-opacity=".9"/><stop offset="1" stop-color="${COR}"/></linearGradient>`,
    `<linearGradient id="ag-gd" gradientUnits="userSpaceOnUse" x1="1600" y1="0" x2="1192" y2="0"><stop offset="0" stop-color="${COR}" stop-opacity="0"/><stop offset=".4" stop-color="${COR}" stop-opacity=".9"/><stop offset="1" stop-color="${COR}"/></linearGradient>`,
    `<radialGradient id="ag-ha"><stop offset="0" stop-color="${COR}" stop-opacity=".5"/><stop offset="1" stop-color="${COR}" stop-opacity="0"/></radialGradient>`,
    // peças reaproveitadas
    `<path id="ag-c4" d="${C4}"/>`,
    ...[
      [1.3, 'a', 0],
      [0, 'b', 0],
      [0.95, '', 0],
      [0, 'a', 1],
      [1.1, 'b', 0],
    ].map(([pf, g, g2], k) =>
      `<g id="ag-k${k}"><ellipse class="ag-gn" style="animation-delay:-${f(k)}s" cy="2.5" rx="15" ry="2.5"/>` +
      (pf ? `<g transform="scale(${pf})" fill="#F3EAD3" stroke="#0B1C3D" stroke-width="1.4"><use class="ag-pf" href="#ag-puf" style="animation-delay:-${f(k * 0.9 + 0.4)}s"/></g>` : '') +
      (g ? `<use class="ag-s${g}" href="#ag-gt" style="animation-delay:-${f(k * 0.7)}s"/>` : '') +
      (g2 || k === 2 ? `<use class="ag-s${k % 2 ? 'a' : 'b'}" href="#ag-gt" style="animation-delay:-${f(k * 0.7 + 1.9)}s" transform="translate(-6 3)"/>` : '') +
      '</g>',
    ),
    `<g id="ag-puf"><circle cx="-5.5" cy="-3" r="3.8"/><circle cx="0" cy="-5.5" r="4.8"/><circle cx="6" cy="-3" r="3.4"/></g>`,
    `<path id="ag-gt" d="M0-6C2-3.4 4.2-.8 4.2 1.8A4.2 4.2 0 0 1-4.2 1.8C-4.2-.8-2-3.4 0-6Z" fill="#B5E4FA"/>`,
    `<g id="ag-al"><path d="M-6 0C-17-30 7-56-3-92C12-54-8-28 6 0Z"/><path d="M4 0C-6-22 14-40 7-68C20-40 2-22 14 0Z"/><path d="M-14 0C-26-20-6-34-14-54C-2-34-18-18-4 0Z"/></g>`,
  ].join('')

  // ---------- TRÁS
  const t = []
  t.push('<g mask="url(#ag-mc)">')
  // 1-3: três camadas de fundo, mais escuras, lentas e baixas, sentidos alternados
  t.push(`<g class="ag-b1"><g class="ag-mL1"><path d="${L1}" fill="#0B2352" stroke="#56B1E1" stroke-opacity=".2" stroke-width="1.6"/></g></g>`)
  t.push(`<g class="ag-b2"><g class="ag-mR2"><path d="${L2}" fill="#0D2D66" stroke="#56B1E1" stroke-opacity=".3" stroke-width="1.8"/></g></g>`)
  t.push(`<g class="ag-b3"><g class="ag-mL3"><path d="${L3}" fill="#103A80" stroke="#56B1E1" stroke-opacity=".5" stroke-width="2"/></g></g>`)
  // 4: corpo em escamas (a mesma geometria do contorno que vai na frente)
  t.push(`<g class="ag-b4"><g class="ag-mR4"><path d="${L4}" fill="url(#ag-gb)"/></g></g>`)
  // 5-6: fileiras de escama só em traço, dentro da água, cada uma para um lado
  t.push(`<g opacity=".28"><g class="ag-mL5"><path d="${D5}" fill="none" stroke="#56B1E1" stroke-width="2"/></g></g>`)
  if (sup + 92 < 975) t.push(`<g opacity=".16"><g class="ag-mR6"><path d="${D6}" fill="none" stroke="#56B1E1" stroke-width="2"/></g></g>`)
  // retícula: luz fina logo abaixo da crista, tinta cada vez maior no fundo
  const ret = (pat, q, op) => `<rect x="0" y="${sup + 10}" width="1600" height="${H}" fill="url(#${pat})" opacity="${op}" mask="url(#ag-q${q})"/>`
  t.push(ret('ag-pl', 4, 0.5) + ret('ag-pa', 1, 0.55) + ret('ag-pb', 2, 0.6) + ret('ag-pc', 3, 0.7))
  // raios de luz em leque (cáusticas), só nas laterais
  const raios = []
  const xr = [40, 140, 250, 360, 1230, 1340, 1450, 1560]
  const L = Math.min(460, H + 40)
  xr.forEach((x0, i) => {
    const lean = (i < 4 ? 0.22 : -0.22) + (R() - 0.5) * 0.12
    const xb = x0 + lean * L
    const hw = 7 + L * (0.1 + R() * 0.05)
    raios.push(
      `<g class="ag-ry" style="transform-origin:${x0}px ${sup + 6}px"><polygon fill="url(#ag-ra)" points="${f(x0 - 7)},${sup + 6} ${f(x0 + 7)},${sup + 6} ${f(xb + hw)},${f(sup + 6 + L)} ${f(xb - hw)},${f(sup + 6 + L)}"/></g>`,
    )
  })
  t.push(`<g mask="url(#ag-mv)">${raios.join('')}`)
  // tracinhos de onda desenhados (path, ponta redonda, comprimentos variados), só em x ≤ 400 e x ≥ 1205
  const tracinho = (x, y, meias) => `M${f(x)} ${f(y)}q5-5 10 0${'t10 0'.repeat(meias - 1)}`
  let nl = 0
  for (let y = sup + 48; y < 990; y += 44, nl++) {
    t.push(`<g opacity="${f(Math.max(0.35, 0.95 - nl * 0.07))}">`)
    for (let k = 0; k < 4; k++) {
      const meias = 2 + Math.floor(R() * 4)
      const len = meias * 10
      const x = k < 2 ? 20 + k * 175 + R() * (150 - len) : 1205 + (k - 2) * 175 + R() * (150 - len)
      t.push(`<path class="ag-g${((nl + k) % 5) + 1}" d="${tracinho(x, y + (k % 2) * 7 + R() * 6, meias)}"/>`)
    }
    t.push('</g>')
  }
  // plâncton bioluminescente subindo devagar
  for (let i = 0; i < 24; i++) {
    const esq = i < 12
    const x = esq ? 12 + R() * 400 : 1190 + R() * 400
    const y = sup + 30 + R() * (H - 40)
    t.push(`<circle class="ag-mt ag-m${(i % 4) + 1}" cx="${f(x)}" cy="${f(y)}" r="${f(1.2 + R() * 1.6)}"/>`)
  }
  t.push('</g>')
  // fundo: seixos e plantinhas nas laterais
  const alt = Math.min(1, (1000 - sup - 22) / 100)
  const base = []
  for (let i = 0; i < 18; i++) {
    const x = i < 9 ? 10 + R() * 410 : 1180 + R() * 420
    const rx = 8 + R() * 18
    base.push(`<ellipse cx="${f(x)}" cy="${f(992 + R() * 14)}" rx="${f(rx)}" ry="${f(rx * (0.45 + R() * 0.25))}" fill="${R() < 0.5 ? '#0B1C3D' : '#123B6F'}" stroke="#56B1E1" stroke-opacity=".3" stroke-width="1.4"/>`)
  }
  t.push(base.join(''))
  if (alt > 0.28) {
    const px = [28, 84, 140, 352, 404, 1198, 1250, 1514, 1566]
    px.forEach((x, i) => {
      const s = alt * (0.7 + R() * 0.45)
      const flip = i % 2 ? -1 : 1
      t.push(`<g transform="translate(${x} 1004) scale(${f(s * flip)} ${f(s)})"><use class="ag-sw${i % 3 ? '' : '2'}" href="#ag-al" fill="#1F6FA6" fill-opacity=".72" stroke="#0B1C3D" stroke-width="2" stroke-linejoin="round"/></g>`)
    })
  }
  // calma escura no meio do pé
  t.push(`<rect x="380" y="760" width="840" height="260" fill="url(#ag-gp)" mask="url(#ag-mp)"/>`)
  t.push('</g>')

  // linha do ideal: luz tracejada nas duas laterais, estrelinha na ponta
  const yi = 740 - ideal * 2
  const estrela = (x) =>
    `<circle cx="${x}" cy="${f(yi)}" r="17" fill="url(#ag-ha)"/><g transform="translate(${x} ${f(yi)}) scale(1.7)"><path class="ag-ie" d="${ESTRELA}" fill="${COR}" stroke="#0B1C3D" stroke-width="1.1" stroke-linejoin="round"/></g>`
  const tracos = (x1, x2, g) =>
    `<path d="M${x1} ${f(yi)}H${x2}" stroke="url(#${g})" stroke-width="10" opacity=".14" fill="none"/><path d="M${x1} ${f(yi)}H${x2}" stroke="url(#${g})" stroke-width="3" stroke-dasharray="14 9" stroke-linecap="round" fill="none"/>`
  t.push(
    `<g class="${abaixo ? 'ag-pisca' : 'ag-calma'}">` +
      tracos(0, 405, 'ag-ge') + tracos(1600, 1190, 'ag-gd') +
      estrela(405) + estrela(1190) +
      '</g>',
  )
  // rótulo no estilo único da lua: sempre no ar, terminando colado na estrela da esquerda
  const txt = `semana ≈${semana}% · meta ≈${ideal}%`
  const wr = Math.round(txt.length * 9.4 + 18)
  const yb = Math.min(sup, yi) - 20 // base do retângulo
  const xd = Math.max(412, 205 + wr) // borda direita: o texto começa depois da barra lateral do app
  const rotulo =
    `<g><rect x="${xd - wr}" y="${yb - 26}" width="${wr}" height="26" rx="6" fill="#0A1834" stroke="#0B1C3D" stroke-width="3"/>` +
    `<rect x="${xd - wr}" y="${yb - 26}" width="${wr}" height="26" rx="6" fill="none" stroke="${abaixo ? '#F2B830' : '#F3EAD3'}" stroke-width="1.6" opacity=".7"/>` +
    `<text x="${xd - 9}" y="${yb - 8}" text-anchor="end" font-family="monospace" font-size="14" font-weight="bold" letter-spacing="1" fill="#F3EAD3">${txt}</text></g>`

  // ---------- FRENTE
  const fr = []
  fr.push('<g mask="url(#ag-mf)">')
  fr.push(`<g class="ag-b4"><g class="ag-mR4">`)
  fr.push(`<use href="#ag-c4" fill="none" stroke="#56B1E1" stroke-opacity=".16" stroke-width="11"/>`)
  fr.push(`<use href="#ag-c4" fill="none" stroke="#0B1C3D" stroke-width="5.5" stroke-linejoin="round"/>`)
  fr.push(`<g transform="translate(0 3.6)"><use href="#ag-c4" fill="none" stroke="#56B1E1" stroke-opacity=".9" stroke-width="2"/></g>`)
  // elementos de crista: 5 variantes (símbolos), uma por escama; o laço é de 5 escamas, então não há emenda
  const n = Math.ceil((1600 + P4 + WL4 + P4) / WL4)
  const ty = f(y4 - h4)
  for (let i = 0; i < n; i++) fr.push(`<use href="#ag-k${i % 5}" x="${f(-P4 + WL4 * (i + 0.5))}" y="${ty}"/>`)
  fr.push('</g></g>')
  // cintilas na superfície, só nas laterais
  const cint = []
  for (let i = 0; i < 12; i++) {
    const x = i < 6 ? 30 + R() * 370 : 1450 + R() * 120
    const y = sup - 26 + R() * 22
    cint.push(`<g transform="translate(${f(x)} ${f(y)}) scale(${f(0.55 + R() * 0.7)})"><path class="ag-st" style="animation-delay:-${f(R() * 4.4)}s;animation-duration:${f(3 + R() * 3)}s" d="${ESTRELA}"/></g>`)
  }
  fr.push(cint.join(''))
  fr.push('</g>')
  fr.push(rotulo)

  return { css, defs, tras: t.join(''), frente: fr.join('') }
}
