# Finanças G&J 💍

Controle financeiro do casal até o casamento + organização do casamento. Instalável no celular (PWA).

- **Finanças:** lançamentos, painel (receita x gasto x guardado, custo da casa mês a mês, tópicos mais gastos), checklist das **contas do dia 6**, relatório para imprimir/PDF e lançamentos **pelo WhatsApp**.
- **Agenda:** calendário compartilhado do casal (dia a dia + casamento), com próximos compromissos, calendário do mês, busca e comandos pelo WhatsApp (`agenda`, `marcar sexta 19h dentista`, `desmarcar…`, `buscar…`).
- **Casamento:** fornecedores (o que **já dá para pagar** com o guardado e o que falta), organização (checklist), agenda/calendário, painel e relatório.

O planejamento completo de cada área está em [`docs/PLANEJAMENTO.md`](docs/PLANEJAMENTO.md).

## Rodar no computador

```bash
npm install
```

```bash
npm run dev
```

Abra http://localhost:3000. Sem variáveis de ambiente o app roda em **modo local** (dados só no navegador).

Testes da lógica (parser do WhatsApp e cálculos):

```bash
npm run testar
```

## Colocar no ar (Vercel + Neon)

1. **Vercel** — projeto ligado a este repositório (cada push faz deploy).
2. **Banco (Neon)** — no projeto da Vercel: **Storage → Create Database → Neon → Connect**.
   A integração cria a variável `DATABASE_URL` e o app **cria a tabela sozinho** no primeiro acesso. Depois faça **Redeploy**.
3. **Variáveis** (*Settings → Environment Variables*, modelo em [`.env.example`](.env.example)):

   | Variável | Para quê |
   |---|---|
   | `DATABASE_URL` | criada pela integração Neon |
   | `APP_PIN` | PIN que vocês dois usam para entrar |
   | `APP_SECRET` | texto aleatório longo |
   | `WHATSAPP_WEBHOOK_TOKEN` | token secreto do webhook |
   | `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | opcionais (API oficial da Meta, para o app responder) |

   Alternativa ao Neon: Supabase (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, rodando antes [`supabase/schema.sql`](supabase/schema.sql)).
4. Se já lançaram coisas no modo local: em **Ajustes → Exportar backup** antes e **Importar backup** depois.

## Acesso
- Entram com o **PIN** (`APP_PIN`) e ficam conectados por ~1 ano em cada aparelho.
- No primeiro login o app oferece **entrar com digital / Face ID** (passkey). Depois é só tocar no botão.
  Os aparelhos cadastrados aparecem (e podem ser removidos) em **Ajustes → Acesso**.

## Instalar no celular
- **iPhone (Safari):** Compartilhar → *Adicionar à Tela de Início*.
- **Android (Chrome):** menu ⋮ → *Instalar app*.

## WhatsApp (Evolution API)

**Modo recomendado com número pessoal:** criem um grupo só com vocês dois (com o número do robô), mandem `ativar grupo` nele e, em **Ajustes → WhatsApp**, liguem **"Ler somente o grupo de finanças"**. O robô passa a ler só esse grupo (sempre ativo, sem "iniciar finanças") e descarta todo o resto na hora, sem responder nem guardar.


1. Na instância da Evolution → **Webhook** → ativar, com a URL:
   ```
   https://financas-gj.vercel.app/api/whatsapp?token=SEU_WHATSAPP_WEBHOOK_TOKEN
   ```
2. Eventos: só **MESSAGES_UPSERT** (Webhook by Events e Base64 desligados — se ligar “by events”, também funciona).
3. Cadastrem os números de vocês em **Ajustes**. O robô **só atende esses dois números** — mensagens de qualquer outro número são ignoradas, sem resposta.
4. Para lançar, mandem **`iniciar finanças`** (o robô confirma). A partir daí tudo vira lançamento/consulta até mandarem **`encerrar`** ou ficarem 10 min sem mensagens. Fora do modo finanças o robô fica em silêncio (conversa normal), em conversas e grupos.

O app responde usando o `server_url`, `instance` e `apikey` que a própria Evolution envia no webhook.
Se preferir fixar, cadastre na Vercel `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` e `EVOLUTION_INSTANCE`.
Se o número da instância for de um de vocês, a conversa “comigo mesmo” também funciona.

Estilo das respostas (Ajustes → WhatsApp → Estilo das respostas, cada um pode ser desligado):
- **Reação ✅** na própria mensagem quando um lançamento, conta paga ou compromisso dá certo (sem texto extra).
- **Cartão em imagem** para consultas (`resumo`, `contas`, `casamento`, `agenda`, `tarefas`, `buscar`, `ajuda`) e para listas de vários itens. Se a imagem falhar, vai em texto.
- **Checklist de tarefas**: `tarefas` mostra a lista numerada; `feito 3` (ou `feito 2 5 7`, ou `feito convites`) marca como feita; `reabrir convites` desfaz.
- **Texto limpo, sem emojis** para erros, avisos e respostas curtas.
- Prévia dos cartões: `/api/cartao?tipo=resumo|contas|casamento|agenda|tarefas|busca|ajuda` (logado).

### Bom dia às 7h e aniversários
Todo dia às 7h (Brasília) o robô manda no grupo de finanças um cartão com:
- os compromissos de hoje;
- quem faz aniversário hoje (com a idade, se o ano foi cadastrado) e os aniversários dos próximos 7 dias;
- o **Radar do casal**: contas atrasadas ou vencendo hoje, ritmo de gastos do mês x mês anterior (a partir do dia 10), tarefas atrasadas, meta de guardar (da metade do mês em diante) e, às segundas, como foi a semana e quais fornecedores a reserva já cobre;
- nos marcos da contagem regressiva (365, 300, 200, 100, 50, 30… 1 dia), um destaque especial.

Como funciona:
- O agendador da Vercel (`vercel.json`) chama `/api/bom-dia` às 10:00 UTC. No plano Hobby a Vercel garante só a hora (chega entre 7h e 7h59).
- Defina `CRON_SECRET` na Vercel (a Vercel manda esse segredo sozinha ao chamar).
- O robô aprende o endereço da Evolution com as mensagens que chegam do grupo: depois do deploy, mande qualquer mensagem no grupo uma vez.
- Para chegar exatamente às 7:00, use também um cron na VPS (o envio acontece no máximo uma vez por dia, então os dois podem ficar ligados):
  ```
  0 7 * * * curl -s "https://financas-gj.vercel.app/api/bom-dia?token=SEU_WHATSAPP_WEBHOOK_TOKEN" >/dev/null
  ```
  (no `crontab -e` da VPS, com o fuso em America/Sao_Paulo; se a VPS estiver em UTC, use `0 10 * * *`).
- Testes: `?previa=1` só mostra o texto; `?forcar=1` manda de novo. Também dá para mandar `bom dia` no grupo a qualquer hora.
- Liga/desliga em Ajustes → WhatsApp → Estilo das respostas.

Aniversários: tela em **Agenda → Aniversários** e pelo WhatsApp:
`aniversário tia Ana 15/03` (ou `15/03/1970` para mostrar a idade) · `aniversários` · `apagar aniversário Ana` · vários de uma vez com `aniversários` e uma pessoa por linha. Eles também aparecem no calendário.

Tarefas: `tarefas` (checklist) · `feito 3` · `reabrir convites`.

Agenda: `agenda` · `agenda amanhã` · `agenda semana` · `marcar sexta 19h dentista` · `desmarcar dentista` · `buscar buffet`.

Exemplos: `mercado 154,90` · `gastei 45 uber` · `recebi 3500 salário` · `guardei 500` · `paguei luz` · `resumo` · `contas` · `casamento`.

Também aceita Meta Cloud API, Twilio, Z-API e JSON genérico (`{"from": "5511...", "text": "mercado 50"}`).

## Estrutura
```
src/app/              telas (finanças em /, casamento em /casamento) e APIs (/api/dados, /api/whatsapp, /api/login)
src/lib/calc.ts       cálculos (resumo do mês, contas do dia 6, plano de pagamento dos fornecedores)
src/lib/whatsapp.ts   interpretação das mensagens
src/lib/server/cartoes.tsx  cartões em imagem do WhatsApp (fontes em assets/fonts)
src/lib/ops.ts        operações de escrita (usadas pelo app, WhatsApp e importação)
src/lib/store.tsx     dados no navegador (sincroniza com a nuvem ou salva localmente)
supabase/schema.sql   estrutura do banco
```
