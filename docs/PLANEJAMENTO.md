# Planejamento — Finanças G&J

Sistema do casal para o período até o casamento. Dois "mundos" separados no topo do app:
**💰 Finanças** (o dia a dia) e **💍 Casamento** (fornecedores, organização e agenda).

---

## 1. Finanças

### 1.1 Lançamentos (`/lancamentos` e botão **+**)
- Três tipos: **Gasto**, **Receita** e **Guardar** (dinheiro separado para a reserva do casamento).
- Campos: valor, descrição, categoria, data e **de quem** (Nome 1, Nome 2 ou Casal).
- A categoria é **sugerida automaticamente** pela descrição (ex.: "uber" → Transporte).
- Lista agrupada por dia, com filtros por tipo, pessoa, categoria e busca.
- Exporta o mês para **Excel/CSV**.
- Lançamentos vindos do WhatsApp aparecem com 💬; os gerados pelas contas do dia 6 com ✅.

### 1.2 Painel financeiro (`/`)
| Bloco | O que responde |
|---|---|
| Receitas / Gastos / Guardado / Sobra | Quanto entrou, quanto saiu, quanto foi guardado e o que sobrou no mês — com a variação contra o mês anterior |
| Alerta do dia 6 | Quantas contas fixas ainda faltam pagar e quanto |
| Receita x Gasto x Guardado (6 meses) | Evolução mês a mês |
| Para onde vai o dinheiro | % da receita que virou gasto, guardado e sobra |
| 🏠 Custo da casa mês a mês | Soma das categorias marcadas como "casa" e quanto mudou de um mês para o outro |
| Tópicos mais gastos | Ranking das categorias do mês |
| Quem gastou / recebeu | Divisão por pessoa |
| Reserva do casamento | Quanto há disponível e quanto falta guardar |

**Fórmula da sobra:** `receitas − gastos − guardado`.

### 1.3 Contas do dia 6 (`/contas`)
- Cadastre uma vez as contas fixas (aluguel, luz, internet, cartão…), com valor previsto, dia e quem paga.
- Todo mês a lista aparece sozinha como **checklist**. Um toque marca como paga.
- Marcar como paga **cria o gasto automaticamente** em Lançamentos (desmarcar remove).
- Dá para pagar um valor diferente do previsto (ex.: a luz veio mais cara).
- Mostra total do mês, já pago, falta pagar, % concluído e contas **atrasadas** (passou do dia e não marcou).
- Pelo WhatsApp: `paguei luz` ou `paguei luz 187,30`.

### 1.4 Relatório financeiro (`/relatorio`)
- Período livre (este mês, mês passado, últimos 6 meses, desde o início ou personalizado).
- Contém: resumo, evolução, tabela mês a mês (com variação do custo da casa), gastos por categoria,
  comparativo com o mês anterior, contas do dia 6, divisão por pessoa, situação da reserva e a lista completa de lançamentos.
- Botão **Imprimir / PDF** — o layout de impressão esconde menus e botões e quebra páginas corretamente.

### 1.5 WhatsApp
Mensagem → webhook `/api/whatsapp` → lançamento direto no sistema + resposta de confirmação.

| Mensagem | Resultado |
|---|---|
| `mercado 154,90` | Gasto em Mercado |
| `gastei 45 uber` | Gasto em Transporte |
| `recebi 3500 salário` / `+3500 salário` | Receita |
| `guardei 500` | Guardado (reserva do casamento) |
| `paguei luz` / `paguei luz 187,30` | Marca a conta do dia 6 como paga |
| `... ontem` / `... 12/03` | Muda a data |
| `... casal` | Lança como do casal |
| `resumo`, `contas`, `casamento`, `ajuda` | Consultas rápidas |

Quem mandou é descoberto pelo número cadastrado em Ajustes. Há um **simulador** em Ajustes para testar.

---

## 2. Casamento (área separada)

### 2.1 Fornecedores (`/casamento/fornecedores`)
- Cadastro: nome, categoria, contato, valor total, data limite para quitar, prioridade e observação.
- Registro de **pagamentos** (entrada, parcelas) com histórico.
- **Importação da planilha**: copiar as linhas do Excel/Google Sheets e colar
  (`Nome · Categoria · Valor total · Valor já pago · Quitar até · Contato`).
- **Cálculo do que já dá para pagar:**
  1. `Reserva disponível = já tinham guardado + todos os "Guardar" − pagamentos feitos com a reserva`
  2. Os fornecedores são ordenados pelo vencimento (depois prioridade).
  3. Para cada um, se o que falta pagar cabe no saldo, vai para **✅ Já dá para pagar** e o valor é "reservado".
     Se não cabe, vai para **⏳ Ainda falta dinheiro**, mostrando quanto falta na reserva para ele.
  4. `Falta guardar = total que falta pagar − reserva disponível`.
- Pagamentos feitos com outro dinheiro (ex.: presente da família) podem ser marcados como "fora da reserva".

### 2.2 Organização (`/casamento/organizacao`)
- Checklist com 20 tarefas típicas já cadastradas (dá para editar/excluir), agrupadas por tema
  (Planejamento, Cerimônia, Festa, Fornecedores, Trajes, Convidados, Documentos, Pós-casamento).
- Responsável, prazo, observação; filtros pendentes/todas/feitas e por pessoa; tarefas atrasadas em vermelho.

### 2.3 Agenda (`/casamento/calendario`)
- Calendário mensal com compromissos (reuniões, provas/degustações, visitas, pagamentos).
- Mostra automaticamente: **vencimentos dos fornecedores**, **prazos das tarefas** e o **dia do casamento**.

### 2.4 Painel do casamento (`/casamento`)
- Contagem regressiva, tarefas concluídas.
- Contratado, já pago, reserva disponível, falta guardar (com alerta se passar do orçamento).
- Barra: já pago / dá para pagar com a reserva / ainda falta dinheiro.
- **Projeção:** no ritmo atual (meta mensal ou média dos últimos 3 meses), quanto terão no dia do casamento
  e quanto precisam guardar por mês para quitar tudo.
- Próximos vencimentos, próximas tarefas, agenda e orçamento por categoria.

### 2.5 Relatório do casamento (`/casamento/relatorio`)
Resumo financeiro, tabela de fornecedores na ordem de pagamento, tarefas pendentes e próximos compromissos — pronto para imprimir.

---

## 3. Técnico
- **Next.js 16** (App Router) + **Tailwind 4**, todo em português.
- **PWA**: manifesto, ícones e service worker → instalável no celular (abre em tela cheia, funciona offline para consulta).
- **Dados**: Supabase (Postgres) numa tabela simples `registros` (coleção + id + JSON).
  Sem Supabase configurado o app funciona em **modo local** (dados no navegador) — bom para testar.
- **Acesso**: PIN compartilhado (`APP_PIN`), cookie assinado, válido por 1 ano.
- Toda escrita passa por "operações" (`src/lib/ops.ts`) usadas igualmente pelo app, pelo WhatsApp e pela importação.
- Testes da lógica: `npm run testar`.

## 4. Próximos passos
1. Configurar Supabase + Vercel (ver README).
2. Conectar o provedor de WhatsApp (adicionar a skill de WhatsApp para ajustar ao provedor que vocês usam).
3. Importar a planilha de fornecedores do casamento.
4. Cadastrar as contas fixas do dia 6 e a reserva que já existe.
