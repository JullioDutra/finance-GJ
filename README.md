# Finanças G&J 💍

Controle financeiro do casal até o casamento + organização do casamento. Instalável no celular (PWA).

- **Finanças:** lançamentos, painel (receita x gasto x guardado, custo da casa mês a mês, tópicos mais gastos), checklist das **contas do dia 6**, relatório para imprimir/PDF e lançamentos **pelo WhatsApp**.
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

## Colocar no ar (Supabase + Vercel)

1. **Supabase** — crie um projeto grátis em supabase.com → *SQL Editor* → cole e rode [`supabase/schema.sql`](supabase/schema.sql).
   Em *Project Settings → API* copie a **URL** e a chave **service_role**.
2. **Vercel** — importe este repositório e cadastre em *Settings → Environment Variables* (modelo em [`.env.example`](.env.example)):

   | Variável | Para quê |
   |---|---|
   | `SUPABASE_URL` | URL do projeto Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | chave service_role (fica só no servidor) |
   | `APP_PIN` | PIN que vocês dois usam para entrar |
   | `APP_SECRET` | texto aleatório longo |
   | `WHATSAPP_WEBHOOK_TOKEN` | token secreto do webhook |
   | `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | opcionais (API oficial da Meta, para o app responder) |

3. Se já lançaram coisas no modo local: em **Ajustes → Exportar backup** antes e **Importar backup** depois.

## Instalar no celular
- **iPhone (Safari):** Compartilhar → *Adicionar à Tela de Início*.
- **Android (Chrome):** menu ⋮ → *Instalar app*.

## WhatsApp
Configure no provedor o webhook:

```
https://SEU-APP.vercel.app/api/whatsapp?token=SEU_WHATSAPP_WEBHOOK_TOKEN
```

Aceita **Meta WhatsApp Cloud API** (o mesmo token é o *Verify token*), **Twilio**, **Z-API**, **Evolution API** e JSON genérico (`{"from": "5511...", "text": "mercado 50"}`, útil para n8n/Make).
Cadastre os números de vocês em **Ajustes** para o sistema saber quem mandou.

Exemplos: `mercado 154,90` · `gastei 45 uber` · `recebi 3500 salário` · `guardei 500` · `paguei luz` · `resumo` · `contas` · `casamento`.

## Estrutura
```
src/app/              telas (finanças em /, casamento em /casamento) e APIs (/api/dados, /api/whatsapp, /api/login)
src/lib/calc.ts       cálculos (resumo do mês, contas do dia 6, plano de pagamento dos fornecedores)
src/lib/whatsapp.ts   interpretação das mensagens
src/lib/ops.ts        operações de escrita (usadas pelo app, WhatsApp e importação)
src/lib/store.tsx     dados no navegador (sincroniza com a nuvem ou salva localmente)
supabase/schema.sql   estrutura do banco
```
