# mods-cezar

Mods (plugins de hooks) para o Claude Code, desktop e terminal.

## painel-cezar

Faixa acima do prompt:

- **ctx**: quanto da janela de contexto já foi usado; aviso ao passar de 70%.
- **Semana**: 14 cápsulas com o uso, a previsão de fechamento (`48% → 49%`) e o contorno marcando onde o tempo está. Amarelo = vai sobrar cota; verde = fecha bem; vermelho = acaba antes de virar. A janela de 5 h só aparece se a conta informar (no Ultra não existe).
- **⚡ Ritmo**: o gasto real da última hora, somando todas as sessões da conta, contra o que precisaria gastar para usar a semana inteira: `pouco`, `no ritmo` ou `muito`. As barrinhas são cada 5 minutos dessa hora. Calibrado para o uso do autor: horas úteis e pesos do fim de semana em `UTIL_INICIO`, `UTIL_FIM` e `PESO_DIA`, e dólar por ponto em `USD_POR_PONTO` (depois se recalibra sozinho).
- **⏱ cache**: quanto falta para o cache do prompt esfriar (1 h; 5 min quando o limite estoura e entra uso extra). Toast quando uma chamada grande regrava o cache, com o motivo provável.
- **Clawd** (desktop): anda enquanto o Claude ou qualquer subagente trabalha, pisca quando é a sua vez, entra em pânico com um "!" amarelo quando pede permissão ou faz pergunta. Clique abre o painel de agentes.
- **Painel de agentes**: um cartão por subagente, com Clawd animado, modelo, contexto, custo (em % da semana) e tempo. Adaptado do [savvy-progress](https://github.com/johnnyvizz/claude-kit) (MIT, © 2026 johnnyvizz; licença em `LICENSE-savvy-progress`).
- **📦**: compacta a conversa.
- **💾**: manda atualizar o `ESTADO.md` do projeto e compacta a conversa quando o turno acaba.
- **Hora local em toda mensagem**: anexa ao contexto, escondido, dia da semana, data e hora (UTC−4, Rondônia), para o modelo não dar "bom dia" de tarde. Troque o fuso em `horaRondonia()` no `hooks/register.tsx`.

## Instalar

```bash
claude plugin marketplace add CezarPraxe/mods-cezar
claude plugin install painel-cezar@mods-cezar
```

Depois reinicie a sessão: no app desktop, arquivar e desarquivar a sessão já basta; um chat novo também pega o mod.

## Mexer

Edite `plugins/painel-cezar/hooks/register.tsx`, suba `version` no `plugin.json`, e:

```bash
claude plugin validate plugins/painel-cezar
claude plugin marketplace update mods-cezar
claude plugin update painel-cezar@mods-cezar
```

`validate` não pega tudo: confira que carrega com `claude -p "ok" --debug-file x.log` e procure `hooks module painel-cezar@mods-cezar loaded`.

O `ESTADO.md` é o diário do projeto: decisões, o que foi reprovado e o que está pendente.
