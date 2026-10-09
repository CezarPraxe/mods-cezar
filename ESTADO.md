# ESTADO — mods do Claude Code (painel-cezar)

Atualizado: 07/10/2026 · instalado (`painel-cezar@mods-cezar`, scope user, **versão 0.10.1**)

## O que é
Plugin `painel-cezar`: `plugins\painel-cezar\hooks\register.jsx` + `hooks\clawd.jsx` + `types\index.d.ts`.
- **Faixa acima do prompt** (desktop/terminal; o celular não tem): `ctx` · barra do 5h · barra da semana · `⏱ 42m` (cache) · **Clawd** · **💾**.
  - 5h e semana sem rótulo: a ordem e o horário identificam (5h em hora do dia, semana em dias).
  - A bolinha nas barras marca o tempo da janela que já passou; a barra é o uso. Barra antes da bolinha = folga.
- **Clawd** (só no desktop; no terminal é o botão `sub`): clique abre o painel de agentes do **savvy-progress** (`$.ui.open({ id: 'savvy-agents' })`). Três estados:
  - **trabalhando** (`turn.start`): perninhas andando;
  - **vez** (`turn.complete`): parado, pisca de vez em quando;
  - **pânico** (`tool.check` = ask, ou `tool.call` de AskUserQuestion/ExitPlanMode, até a ferramenta terminar): vermelho, olho arregalado, treme e ergue um "!" amarelo. O SVG cresce para 28 px de altura nessa hora.
- **💾**: manda o prompt do ESTADO.md (aviso na hora, segundo clique ignorado) e compacta sozinho quando o turno acaba. Depois relê o ctx 5 vezes, de 2 em 2 s.
- **⏱ cache**: conta do **início** de cada chamada da conversa principal (`turn.step`), guardado no `$.store` (`cache:<sessionId>`), então reiniciar o app não esquenta. Dura 1 h, ou 5 min se a 5h ou a semana chegar a 100% (uso extra). Toast "⏱ Cache frio (motivo): regravou Nk tokens" quando uma chamada ≥ 20k regrava em vez de ler. Motivos: trocou o modelo, passou do tempo, ou mudou esforço/ferramentas/CLAUDE.md. Compactação não avisa.
- **Hora de Rondônia em toda mensagem:** o `prompt.submit` anexa ao contexto (o modelo lê, o Cezar não vê) "Agora em Rondônia (UTC−4): dia da semana, dd/mm/aaaa, hh:mm". Motivo: SDR e Estagiário mandavam "bom dia" de tarde, e a regra no AGENTS.md não resolvia porque o modelo não tem relógio.
- Toast ao passar de 70% de contexto.

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
- O painel próprio de agentes (`PANE_AG`) continua no código, sem botão: o savvy substituiu.

## Como mexer (regra dura)
1. Editar **só** `~\.claude\mods-cezar\plugins\painel-cezar\` e subir `version` no `plugin.json`.
2. `claude plugin validate .` → `claude plugin marketplace update mods-cezar` → `claude plugin update painel-cezar@mods-cezar`.
3. **Provar que carrega antes de pedir reinício:** `claude -p "ok" --model haiku --debug-file x.log` e procurar `hooks module painel-cezar@mods-cezar loaded` / `did not load`. Para testar a hora: perguntar ao `-p` que horas são.
4. **Reiniciar só a sessão, não o app:** arquivar a sessão na barra lateral e desarquivar. Isso mata o programa dela, e ao clicar nela sobe um novo, com a conversa inteira, os mods relidos e os MCPs reconectados. Testado em 09/10 na CLAUDE STARTUP: o programa das 09:36 morreu e nasceu um às 09:46 com as 2344 mensagens. Chat novo também pega a versão nova.
   - Arquivar desliga o Controle Remoto da sessão; sessão aberta pelo celular eu não consigo arquivar pela ferramenta, só o Cezar pela barra lateral.
   - A doc diz que `/reload-plugins` digitado no chat troca a versão; ainda não conferido (a falha antiga pode ter sido a cópia em dev-mods).
- ⚠️ **Nunca testar por cópia em `dev-mods`** com o plugin já instalado: as duas carregam e a instalada é a que aparece.
- Prévia de desenho: exportar os SVGs com node e rasterizar com PIL (o navegador interno mostrou página vazia para HTML local).

## savvy-progress (claude-kit, JohnnyVizz) — painel de agentes adotado
- Instalado como `savvy-progress@claude-kit`. Edições feitas **na cópia do cache** (`~\.claude\plugins\cache\claude-kit\savvy-progress\1.2.0\hooks\register.tsx`):
  - tradução para português (original em `claudecode\_archive\tmp\savvy-progress-register-original.tsx`);
  - custo em **"% 5h"** no lugar de $. O câmbio é o Δ% do 5h ÷ Δ$ da sessão, com base no `$.store` (`cambio:<sessão>:<janela>`). Até o 5h subir 1 ponto, mostra $. Fica inflado se outros chats gastarem junto.
- ⚠️ Atualizar o plugin **apaga** essas edições.
- Ver a conversa de um subagente: só pelo app (a linha `>` no chat, ou o painel de tarefas).

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
  - % 5h do savvy, ainda não visto funcionando;
  - toast de cache frio, ainda não disparado.
- **Depois:**
  - fork do savvy-progress dentro de `mods-cezar`, para as edições não sumirem numa atualização;
  - opcional: apagar o `PANE_AG` sem uso.
- `usage-meter@claude-mods` segue desligado (não apagado).
