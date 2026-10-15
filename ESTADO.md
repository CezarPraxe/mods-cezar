# ESTADO — mods do Claude Code (painel-cezar)

Atualizado: 10/10/2026 · instalado (`painel-cezar@mods-cezar`, scope user, **versão 0.14.1**) · público em github.com/CezarPraxe/mods-cezar

## O que é
Plugin `painel-cezar`: `plugins\painel-cezar\hooks\register.tsx` (faixa + painel de agentes, um módulo só) + `hooks\clawd.jsx` + `types\index.d.ts`. 100% independente: quem instala do GitHub tem tudo.
- **Faixa acima do prompt** (desktop/terminal; o celular não tem): `ctx` · barra do 5h · barra da semana · `⏱ 42m` (cache) · **Clawd** · **📦** (só compacta) · **💾**.
  - 5h e semana sem rótulo: a ordem e o horário identificam (5h em hora do dia, semana em dias).
  - A bolinha nas barras marca o tempo da janela que já passou; a barra é o uso. Barra antes da bolinha = folga.
- **Clawd** (só no desktop; no terminal é o botão `sub`): clique abre o painel de agentes (`$.ui.open({ id: 'agentes-cezar' })`). Três estados:
  - **trabalhando** (`turn.start` da conversa principal **ou qualquer subagente rodando**, lido de `ag_agents`): o mesmo Clawd andando do painel de agentes, animado por CSS dentro do SVG, sem redesenhar a faixa;
  - **vez** (`turn.complete`): parado, pisca de vez em quando;
  - **pânico** (`tool.check` = ask, ou `tool.call` de AskUserQuestion/ExitPlanMode, até a ferramenta terminar): vermelho, olho arregalado, treme e ergue um "!" amarelo. O SVG cresce para 28 px de altura nessa hora.
- **💾**: manda o prompt do ESTADO.md (aviso na hora, segundo clique ignorado) e compacta sozinho quando o turno acaba. Depois relê o ctx 5 vezes, de 2 em 2 s.
- **⏱ cache**: conta do **início** de cada chamada da conversa principal (`turn.step`), guardado no `$.store` (`cache:<sessionId>`), então reiniciar o app não esquenta. Dura 1 h, ou 5 min se a 5h ou a semana chegar a 100% (uso extra). Toast "⏱ Cache frio (motivo): regravou Nk tokens" quando uma chamada ≥ 20k regrava em vez de ler. Motivos: trocou o modelo, passou do tempo, ou mudou esforço/ferramentas/CLAUDE.md. Compactação não avisa.
- **Hora de Rondônia em toda mensagem:** o `prompt.submit` anexa ao contexto (o modelo lê, o Cezar não vê) "Agora em Rondônia (UTC−4): dia da semana, dd/mm/aaaa, hh:mm". Motivo: SDR e Estagiário mandavam "bom dia" de tarde, e a regra no AGENTS.md não resolvia porque o modelo não tem relógio.
- Toast ao passar de 70% de contexto.
- **Limites (5h e semana) por sessão** desde 0.13.3: antes a faixa usava a leitura mais nova de qualquer sessão, e com o CLI numa conta e o desktop em outra trocava o limite de uma pela outra. O engine não informa a conta, então cada sessão mostra só a própria.
- **Fantasias por função** (0.14.0, uma por Sonnet): contador (relatorio-fatura, faturas), pesquisador, revisor/conferente, redator (terno grafite), advogado, cobrança (gravata verde e moeda), atendente (WhatsApp), executor, obra-longa (pá), animador (pintor), exceção (cientista). Regras em `tierOf`; prévia em `_archive	mpantasias`.

## Decisões
- Português, mínimo de texto, visual uniforme: chip com fundo neutro, cor só no número e na barra. Horário de Rondônia (UTC−4).
- **Hora injetada = só dia, data e hora.** Sem regra de saudação: o Cezar pediu assim, porque o modelo já sabe qual saudação usar.
- **Clawd:** grade 12×8 do ClawdMoji (github.com/afspies/ClawdMoji), #DA7758, pânico #E24B4A com "!" #FFD60A. O pânico é a mistura aprovada pelo Cezar de "! amarelo" com "braço erguido": um "!" no topo da cabeça parecia chifre.
  - Animação trocando o quadro a cada 0,4 s (`$.clock.every`). No estado "vez" só redesenha na piscada.
  - **Não usar `Svg isInteractive: true`:** a moldura que roda SMIL tem fundo branco e fica feia na faixa.
  - Clique: Box absoluto com um `Client` invisível (`clawd.jsx`), que faz `post`; o hook `ui.message` abre o painel. Desenhar o Clawd com texto em blocos ficou gigante e cheio de vãos.
- Botão de plugin só aceita texto. Emoji serve (💾), mas não existe emoji do Clawd.
- Painel abre por botão: `/comando` de mod não chega ao hook no desktop.
- Função que recebe `$` fica no topo do mesmo arquivo, e **nenhuma variável local pode repetir o nome dela**. A 0.9.0 não carregou por uma `const inicio` ao lado de `inicio($)`, e o `validate` não pega isso.
- **Reprovados, não propor de novo:**
  - coluna lateral docada;
  - botão/painel `onde está` (Arquivos);
  - instalar o mod prompt-cache-control (davila7). Dele só aproveitamos as ideias do ⏱; a faixa dele é longa, em inglês, e duplicaria o nosso medidor.
- Varredura de mods no X e no catálogo davila7 (06/10): o Cezar só quis o "Clawd em pânico" (ideia do @nvr0x5). image-view e secret-redactor foram sugeridos e não pedidos.
- **Painel de agentes = código do savvy-progress (MIT, johnnyvizz) trazido para dentro** em 10/10 (0.11.0), com a tradução e o custo em "% 5h". Tirados: faixa de progresso do savvy-flow, ferramentas `progress`/`step`, tarefas planejadas. O `savvy-progress@claude-kit` ficou **desabilitado** (não desinstalado). Crédito em `LICENSE-savvy-progress` e no topo do register.tsx.
- **O engine aceita um só módulo de hooks por plugin** e recusa dois hooks sem filtro no mesmo evento: por isso tudo está num arquivo, e session.start/turn.step/turn.complete/session.measure foram fundidos.
- Preço e janela de modelo (`PRICES`/`windowOf` no register.tsx) conferidos na página oficial em 10/10: janela de 1M em tudo menos Haiku 4.x; Haiku 5.5 tem preço próprio e outro acima de 100k de prompt. O engine só informa a janela da conversa principal, então a tabela é necessária: rever a cada modelo novo.

## Como mexer (regra dura)
1. Editar **só** `~\.claude\mods-cezar\plugins\painel-cezar\` e subir `version` no `plugin.json`.
2. `claude plugin validate .` → `claude plugin marketplace update mods-cezar` → `claude plugin update painel-cezar@mods-cezar`.
   - Depois: `git commit` + `git push`. A pasta é o repositório **público** github.com/CezarPraxe/mods-cezar (desde 09/10). Nada de segredo, caminho pessoal ou dado de cliente no código.
3. **Provar que carrega antes de pedir reinício:** `claude -p "ok" --model haiku --debug-file x.log` e procurar `hooks module painel-cezar@mods-cezar loaded` / `did not load`. Para testar a hora: perguntar ao `-p` que horas são.
4. **Reiniciar só a sessão, não o app:** arquivar a sessão na barra lateral e desarquivar. Isso mata o programa dela, e ao clicar nela sobe um novo, com a conversa inteira, os mods relidos e os MCPs reconectados. Testado em 09/10 na CLAUDE STARTUP: o programa das 09:36 morreu e nasceu um às 09:46 com as 2344 mensagens. Chat novo também pega a versão nova.
   - Arquivar desliga o Controle Remoto da sessão; sessão aberta pelo celular eu não consigo arquivar pela ferramenta, só o Cezar pela barra lateral.
   - **`/reload-plugins` NÃO troca a versão de plugin instalado** (testado 10/10, com e sem --force: a faixa seguiu na 0.10.1 com a 0.13.0 instalada), apesar da doc dizer que sim. Só arquivar/desarquivar ou chat novo.
- ⚠️ **Nunca testar por cópia em `dev-mods`** com o plugin já instalado: as duas carregam e a instalada é a que aparece.
- Prévia de desenho: exportar os SVGs com node e rasterizar com PIL (o navegador interno mostrou página vazia para HTML local).

## Pendente / próximo passo
- **Conferido no app:**
  - 💾 (0.7.2);
  - hora injetada (0.10.1: chegou "quarta-feira, 07/10/2026, 15:53" numa mensagem de teste);
  - Clawd carregando e piscando (print do Cezar na 0.9.1, ainda com fundo branco).
- **Falta o Cezar ver:**
  - Clawd com fundo transparente e as três animações (0.9.2+);
  - o pânico de verdade: aparece com permissão ligada ou pergunta com opções; neste chat a permissão está desligada;
  - se o clique no Clawd ainda abre os Agentes;
  - se SDR e Estagiário passaram a acertar a saudação.
- **Em aberto:**
  - 15/10: painel de Agentes vazio ("painel-cezar has not drawn in this pane") num chat com subagente rodando; no teste isolado (`claude plugin test`, mount com `requestId` no topo) ele desenha. 0.14.1 mostra o erro no painel em vez de ficar vazio: ver o texto vermelho da próxima vez.
  - % 5h no painel de agentes, ainda não visto funcionando;
  - 0.13.x no app (fantasias: advogado-* de terno com maleta, executor-*/obra-longa-* de capacete; tsc zerado em 0.13.1): Clawd andando com subagente rodando, 📦, painel de agentes vindo do próprio plugin.
  - toast de cache frio, ainda não disparado.
- **Depois:**
- `usage-meter@claude-mods` segue desligado (não apagado).
