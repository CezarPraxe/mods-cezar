# ESTADO — mods do Claude Code (painel-cezar)

Atualizado: 31/10/2026 · instalado (`painel-cezar@mods-cezar`, scope user, **versão 0.17.0**) · público em github.com/CezarPraxe/mods-cezar

## O que é
Plugin `painel-cezar`: `plugins\painel-cezar\hooks\register.tsx` (faixa + painel de agentes, um módulo só) + `hooks\clawd.jsx` + `types\index.d.ts`. 100% independente: quem instala do GitHub tem tudo.
- **Faixa acima do prompt** (desktop/terminal; o celular não tem): `ctx` · semana · `⏱ 42m` (cache) · **Clawd** · **compactar** · **salvar**.
  - **Desenho (0.17.0):** no desktop cada medidor é uma pílula SVG de 24 px, uma linha só (`pilulaAnel`, `pilulaSemana`, `pilulaCache`), em Box próprio para a linha quebrar. Modelado em dois pins: cluster de pílulas sem borda (350577152266479159) e cápsulas com brilho, a célula atual contornada (945967096751896278). A versão de duas linhas (32 px) foi recusada. O terminal segue em texto. Arte e provas em `C:\Users\Cezar\praxedes\rascunho\painel-previa\`.
  - **A semana:** 14 cápsulas (cheio = uso), contorno branco = onde o tempo está, `54%` e a hora da virada. Cor pela previsão de fechamento, sem mostrar o número: amarelo abaixo de 85% (sobra cota), verde de 85% a 100%, vermelho acima de 100%.
  - **Onda (`ondaSemana`, `montarOnda`):** luz que nasce na primeira cápsula, caminha a 9 px/s e 24 fps, freia na última cheia, com rastro que apaga em 3 a 4 s. Só gradiente e opacidade, sem filtro animado. A fase vem do relógio do PC, para não voltar ao começo quando o texto muda.
  - Janela de 5h: só aparece se a conta informar. No Ultra não existe mais; a outra conta ainda manda.
- **Semana (seção com esse nome no register.tsx):** contorno e cor andam em horas úteis: 7h às 23h de Rondônia, sábado pesa 0,4 e domingo 0,2 (seis semanas de gasto real). Previsão = uso + média por hora útil × horas úteis restantes, só depois de 8 horas úteis.
  - **Reprovados, não voltar sem ele pedir:** o `→ 55%` ao lado do uso ("achei desnecessário": só anda junto com o uso), a pílula `pouco / no ritmo / muito` com barrinhas e `%/h` ("números sem nexo"; o contorno branco já diz isso) e as frases de ritmo no painel de agentes.
  - **Câmbio do custo dos agentes (`% sem`):** 1 ponto ≈ US$ 23,5, medido em 30/10 em cinco trechos (23,3 a 24,2, igual antes e depois de virar Ultra). Cada sessão soma o próprio gasto em baldes de 5 min (`gasto:<sessão>`, últimas 6h). `marcos:<conta>` guarda quando o ponto virou; a cada 4 pontos mede dólar por ponto e mistura 30% no valor salvo (`usdPorPonto:<conta>`), limitado a 1/3 e 3× do inicial. Queda de 3+ pontos = semana zerou (aconteceu em 28/10: 49% → 11% sem mudar a data de virada); queda de 1 ou 2 = leitura atrasada, ignora.
  - **Conta = horário da virada reduzido à semana** (`contaDe`): o engine não informa a conta, mas cada uma vira num horário próprio. Com isso as sessões voltaram a compartilhar leitura sem misturar contas (ver 0.13.3). A conta de trabalho é a que vira sábado 11h de Rondônia.
  - O câmbio antigo por sessão foi retirado: dividia o aumento da conta inteira pelo gasto de uma sessão só, errado com sessões em paralelo. A loja se limpa sozinha (`faxinaLoja`).
- **Clawd** (só no desktop; no terminal é o botão `sub`): arte refeita em 31/10 em cima da grade oficial do ClawdMoji, **sem garra** (com garra foi reprovado). Três SVGs em `register.tsx` (`CLAWD_VEZ`, `CLAWD_TRABALHANDO`, `CLAWD_PANICO`), 28×24, animados só por CSS dentro do próprio SVG. Clique abre o painel de agentes.
  - **vez** (`turn.complete`): parado, respira, olha de lado e pisca;
  - **trabalhando** (`turn.start` da conversa principal **ou qualquer subagente rodando**, lido de `ag_agents`): anda;
  - **pânico** (`tool.check` = ask, ou `tool.call` de AskUserQuestion/ExitPlanMode, até a ferramenta terminar): vermelho, treme e ergue um "!".
- **Botões do desktop:** Prensa (`ICONE_COMPACTAR`) e disquete com check (`ICONE_SALVAR`), desenhados por `iconeClicavel`: SVG com um `Client` invisível por cima, porque botão do app só aceita texto. O clique chega ao hook `ui.message` pelo key. No terminal seguem como 📦 e 💾.
- **Salvar**: manda o prompt do ESTADO.md (aviso na hora, segundo clique ignorado) e compacta sozinho quando o turno acaba. Depois relê o ctx 5 vezes, de 2 em 2 s.
- **⏱ cache**: conta do **início** de cada chamada da conversa principal (`turn.step`), guardado no `$.store` (`cache:<sessionId>`), então reiniciar o app não esquenta. Dura 1 h, ou 5 min se a 5h ou a semana chegar a 100% (uso extra). Toast "⏱ Cache frio (motivo): regravou Nk tokens" quando uma chamada ≥ 20k regrava em vez de ler. Motivos: trocou o modelo, passou do tempo, ou mudou esforço/ferramentas/CLAUDE.md. Compactação não avisa.
- **Hora de Rondônia em toda mensagem:** o `prompt.submit` anexa ao contexto (o modelo lê, o Cezar não vê) "Agora em Rondônia (UTC−4): dia da semana, dd/mm/aaaa, hh:mm". Motivo: SDR e Estagiário mandavam "bom dia" de tarde, e a regra no AGENTS.md não resolvia porque o modelo não tem relógio.
- **⚙ N** (0.15.0): aparece na faixa quando há comando, monitor, workflow ou agendamento rodando em segundo plano; clique lista o que é. Anota no `tool.call` (run_in_background, Monitor, Workflow, CronCreate, ScheduleWakeup) e tira quando chega o `<task-notification>` com status final (`session.append`), no TaskStop/CronDelete ou no fim do prazo do ScheduleWakeup. Subagente não conta: ele já faz o Clawd andar. O engine não dá lista de tarefas ao mod (o `background_tasks` é só dos hooks de settings).
- Toast ao passar de 70% de contexto.
- **Limites (5h e semana) por sessão** desde 0.13.3: antes a faixa usava a leitura mais nova de qualquer sessão, e com o CLI numa conta e o desktop em outra trocava o limite de uma pela outra. O engine não informa a conta, então cada sessão mostra só a própria.
- **Fantasias por função** (0.14.0, uma por Sonnet): contador (relatorio-fatura, faturas), pesquisador, revisor/conferente, redator (terno grafite), advogado, cobrança (gravata verde e moeda), atendente (WhatsApp), executor, obra-longa (pá), animador (pintor), exceção (cientista). Regras em `tierOf` (a primeira que bate vence). Rascunhos e prévia (`elenco.png`, `c-*.mjs`, `render.mjs`) em `C:\Users\Cezar\claudecode\_archive\tmp\fantasias`.

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
   - 14/10 o Cezar viu a 0.14.0 aparecer nos outros chats sem arquivar: o app novo pode estar recarregando sozinho. Confirmar na próxima versão antes de largar o arquivar/desarquivar.
   - Arquivar desliga o Controle Remoto da sessão; sessão aberta pelo celular eu não consigo arquivar pela ferramenta, só o Cezar pela barra lateral.
   - **`/reload-plugins` NÃO troca a versão de plugin instalado** (testado 10/10, com e sem --force: a faixa seguiu na 0.10.1 com a 0.13.0 instalada), apesar da doc dizer que sim. Só arquivar/desarquivar ou chat novo.
- ⚠️ **Nunca testar por cópia em `dev-mods`** com o plugin já instalado: as duas carregam e a instalada é a que aparece.
- Prévia de desenho: exportar os SVGs com node e rasterizar com PIL (o navegador interno mostrou página vazia para HTML local).
- **Teste isolado do painel:** `claude plugin test .` com um `*.test.ts` em `hooks\` que faz `ui.mount({ plugin, surface, component: 'Pane', requestId: 'agentes-cezar', props: { bodyColumns } })` (o `requestId` vai no topo, não em `props`). Apagar o teste depois: não sobe para o repositório.
- Engine 2.1.295 trouxe `$.ui.notify` (notificação do Windows), `$.ui.selection` (texto selecionado) e `ui.fault`. O painel direito novo do app (Ambiente, Contexto, Conectores, Saídas) não aceita mod.

## Pendente / próximo passo
- **Próximo passo:** o painel de Agentes ficou vazio ("painel-cezar has not drawn in this pane") no chat "PWA receitas e estoque" em 15/10, com subagente rodando. No teste isolado ele desenha. A 0.14.1 mostra o erro em vermelho no próprio painel: o Cezar fecha o painel, clica no Clawd (ou arquiva/desarquiva) e manda o print do texto vermelho. Com ele, corrigir a causa.
- **Ideias oferecidas, sem resposta do Cezar:** notificação do Windows (subagente terminou, Clawd em pânico, 5h > 90%) e a lista de tarefas (TodoWrite/TaskCreate) na faixa ou no painel.
- **Conferido no app:** 💾; hora injetada; 📦 (0.13.1); fantasias por função no painel (0.14.0, "amei"); limites por sessão (0.13.3, a faixa bate com o painel do desktop).
- **Falta ver:** o ⚙ aparecendo e sumindo sozinho quando a tarefa termina (os ids saem do texto do resultado e do aviso: se não sumir, é o formato do id); o pânico de verdade (só com permissão ligada ou pergunta com opções); o Clawd da faixa andando com subagente; se SDR e Estagiário acertam a saudação; o toast de cache frio.
- `usage-meter@claude-mods` e `savvy-progress@claude-kit` seguem desligados (não apagados).
