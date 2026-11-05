// Testes rápidos da lógica (parser do WhatsApp e cálculos). Rodar: npm run testar
import assert from "node:assert/strict";
import { bancoVazio } from "../src/lib/defaults";
import { lerPlanilha } from "../src/lib/planilha";
import { extrairMensagem } from "../src/lib/whatsapp-entrada";
import { comandoSessao, novaExpiracao, sessaoAtiva } from "../src/lib/whatsapp-sessao";
import { aplicarOps } from "../src/lib/ops";
import { identificarPessoa, processarMensagem, pessoaPorTelefone } from "../src/lib/whatsapp";
import { contasDoMes, planoCasamento, resumoMes, totaisContas } from "../src/lib/calc";
import { parseValor } from "../src/lib/format";
import type { Banco, Lancamento } from "../src/lib/types";

const HOJE = "2026-11-05";
let b: Banco = { ...bancoVazio(), fornecedores: [], pagamentosFornecedores: [] };
b.config.telefoneP1 = "(11) 99999-1111";
b.config.telefoneP2 = "11 98888-2222";

function msg(texto: string, pessoa: "p1" | "p2" | "casal" = "p1") {
  const r = processarMensagem(b, texto, pessoa, HOJE);
  b = aplicarOps(b, r.ops);
  return r;
}
const ultimo = () => b.lancamentos[b.lancamentos.length - 1] as Lancamento;

// valores
assert.equal(parseValor("1.234,56"), 1234.56);
assert.equal(parseValor("45,9"), 45.9);
assert.equal(parseValor("1.500"), 1500);
assert.equal(parseValor("45.90"), 45.9);
assert.equal(parseValor("R$ 3500"), 3500);

// gastos
msg("mercado 154,90");
assert.equal(ultimo().tipo, "despesa"); assert.equal(ultimo().valor, 154.9); assert.equal(ultimo().categoriaId, "cat-mercado");
msg("gastei 45 no uber");
assert.equal(ultimo().categoriaId, "cat-transporte"); assert.equal(ultimo().descricao, "uber");
msg("ifood 62,50 ontem", "p2");
assert.equal(ultimo().data, "2026-11-04"); assert.equal(ultimo().pessoa, "p2"); assert.equal(ultimo().categoriaId, "cat-alimentacao");
msg("farmácia 30 03/11 casal");
assert.equal(ultimo().data, "2026-11-03"); assert.equal(ultimo().pessoa, "casal"); assert.equal(ultimo().categoriaId, "cat-saude");
msg("coisa aleatoria 10");
assert.equal(ultimo().categoriaId, "cat-outros");

// receitas e guardado
msg("recebi 3500 salário");
assert.equal(ultimo().tipo, "receita"); assert.equal(ultimo().categoriaId, "cat-salario");
msg("+1200 freela", "p2");
assert.equal(ultimo().tipo, "receita"); assert.equal(ultimo().categoriaId, "cat-extra");
msg("guardei 500");
assert.equal(ultimo().tipo, "guardado"); assert.equal(ultimo().valor, 500);

// erro
const e = msg("mercado");
assert.equal(e.ok, false); assert.equal(e.ops.length, 0);

// telefone -> pessoa
assert.equal(pessoaPorTelefone(b, "5511999991111"), "p1");
assert.equal(pessoaPorTelefone(b, "whatsapp:+5511988882222"), "p2");
assert.equal(pessoaPorTelefone(b, "5521000000000"), "casal");

// contas do dia 6
b = aplicarOps(b, [
  { tipo: "upsert", colecao: "contas", id: "luz", dados: { id: "luz", nome: "Luz", valor: 180, categoriaId: "cat-energia", dia: 6, pessoa: "casal", ativa: true, observacao: "" } },
  { tipo: "upsert", colecao: "contas", id: "alug", dados: { id: "alug", nome: "Aluguel", valor: 1500, categoriaId: "cat-aluguel", dia: 6, pessoa: "casal", ativa: true, observacao: "" } },
]);
let t = totaisContas(contasDoMes(b, "2026-11", HOJE));
assert.equal(t.total, 1680); assert.equal(t.qtdPagas, 0);
const pg = msg("paguei luz 187,30");
assert.ok(pg.ok, pg.resposta);
t = totaisContas(contasDoMes(b, "2026-11", HOJE));
assert.equal(t.pago, 187.3); assert.equal(t.falta, 1500); assert.equal(t.qtdPagas, 1);
assert.equal(t.atrasadas, 0, "dia 6 ainda não passou em 05/11");
assert.equal(totaisContas(contasDoMes(b, "2026-11", "2026-11-07")).atrasadas, 1);

// resumo do mês
const r = resumoMes(b, "2026-11");
assert.equal(r.receitas, 4700);
assert.equal(r.guardado, 500);
assert.equal(r.despesas, 489.7);
assert.equal(r.casa, 342.2); // mercado + energia
assert.equal(r.sobra, Math.round((4700 - r.despesas - 500) * 100) / 100);

// casamento: reserva 10.000 + 500 guardado
b.config.reservaInicial = 10000;
b.config.dataCasamento = "2027-10-10";
b.config.metaMensalGuardar = 2000;
b = aplicarOps(b, [
  { tipo: "upsert", colecao: "fornecedores", id: "buffet", dados: { id: "buffet", nome: "Buffet", categoria: "Buffet", contato: "", valorTotal: 20000, vencimento: "2027-08-01", prioridade: 1, observacao: "" } },
  { tipo: "upsert", colecao: "fornecedores", id: "foto", dados: { id: "foto", nome: "Fotógrafo", categoria: "Fotografia", contato: "", valorTotal: 6000, vencimento: "2027-03-01", prioridade: 2, observacao: "" } },
  { tipo: "upsert", colecao: "fornecedores", id: "dj", dados: { id: "dj", nome: "DJ", categoria: "Música / DJ", contato: "", valorTotal: 3000, vencimento: "2027-05-01", prioridade: 2, observacao: "" } },
  // pagamento antigo (fora da reserva) e um da reserva
  { tipo: "upsert", colecao: "pagamentosFornecedores", id: "p1", dados: { id: "p1", fornecedorId: "buffet", data: "2026-10-01", valor: 5000, observacao: "", daReserva: false } },
  { tipo: "upsert", colecao: "pagamentosFornecedores", id: "p2", dados: { id: "p2", fornecedorId: "foto", data: "2026-11-01", valor: 1000, observacao: "" } },
]);
const p = planoCasamento(b, "2026-11");
assert.equal(p.guardado, 10500);
assert.equal(p.pagoDaReserva, 1000);
assert.equal(p.disponivel, 9500);
assert.equal(p.totalContratado, 29000);
assert.equal(p.totalPago, 6000);
assert.equal(p.totalRestante, 23000);
// ordem por vencimento: foto (falta 5000) cabe -> saldo 4500; dj (3000) cabe -> 1500; buffet (15000) não cabe
assert.deepEqual(p.daParaPagar.map((x) => x.fornecedor.id), ["foto", "dj"]);
assert.deepEqual(p.faltam.map((x) => x.fornecedor.id), ["buffet"]);
assert.equal(p.faltam[0].falta, 13500);
assert.equal(p.faltaGuardar, 13500);
assert.equal(p.mesesRestantes, 12);
assert.equal(p.projecaoNoCasamento, 9500 + 2000 * 12);
assert.equal(p.vaiDar, true);

// planilha "Orçamentos" (copiada do Google Sheets, com linhas vazias e coluna Restante)
const colada = [
  "Categoria\tFornecedor\tValor Total\tPago\tRestante",
  "Decoração\tGM Flores\tR$4 500,00\tR$1 350,00\tR$3 150,00",
  "Cartório\t\tR$800,00\t\t",
  "Paróquia\tSão José Operario\tR$1 300,00\tR$200,00\tR$1 100,00",
  "Lapela\t\t\t\t",
  "\t\t\t\t",
].join("\n");
const lidas = lerPlanilha(colada);
assert.equal(lidas.length, 4);
assert.deepEqual(lidas[0], { nome: "GM Flores", categoria: "Decoração", total: 4500, pago: 1350, vencimento: "", contato: "" });
assert.equal(lidas[1].nome, "Cartório"); assert.equal(lidas[1].total, 800); assert.equal(lidas[1].pago, 0);
assert.equal(lidas[3].total, 0);

// orçamento inicial (vem pré-carregado)
const ini = bancoVazio();
assert.equal(ini.config.nomeP2, "Gabriella");
const pi = planoCasamento(ini, "2026-11");
assert.equal(ini.fornecedores.length, 15);
assert.equal(pi.totalContratado, 26350);
assert.equal(pi.totalPago, 11575);
assert.equal(pi.totalRestante, 14775);
assert.equal(pi.disponivel, 0, "pagos da planilha não descontam da reserva");
assert.equal(pi.semValor.length, 1); // Lapela
assert.equal(pi.faltaGuardar, 14775);

// ---------- Evolution API ----------
const evo = (data: object, extra: object = {}) => ({ event: "messages.upsert", instance: "gj", server_url: "https://evo.exemplo.com", apikey: "k", sender: "5511977776666@s.whatsapp.net", data, ...extra });
// conversa direta com o número do robô
let ev: ReturnType<typeof extrairMensagem> = extrairMensagem(evo({ key: { remoteJid: "5511999991111@s.whatsapp.net", fromMe: false, id: "1" }, pushName: "Jullio", message: { conversation: "mercado 10" } }));
assert.ok(ev && ev !== "ignorar");
{
  assert.equal(ev.provedor, "evolution"); assert.equal(ev.de, "5511999991111"); assert.equal(ev.texto, "mercado 10");
  assert.equal(ev.responderPara, "5511999991111@s.whatsapp.net"); assert.equal(ev.instancia, "gj");
  assert.equal(pessoaPorTelefone(b, ev.de), "p1");
}
// texto estendido (respondendo/citando) e formato @lid com senderPn
ev = extrairMensagem(evo({ key: { remoteJid: "123456789@lid", senderPn: "5511988882222@s.whatsapp.net", fromMe: false }, pushName: "Gabi", message: { extendedTextMessage: { text: "uber 20" } } }));
assert.ok(ev && ev !== "ignorar" && ev.de === "5511988882222" && ev.texto === "uber 20" && ev.responderPara === "123456789@lid");
// grupo: quem mandou é o participant
ev = extrairMensagem(evo({ key: { remoteJid: "1203630@g.us", participant: "5511988882222@s.whatsapp.net", fromMe: false }, pushName: "Gabriella", message: { conversation: "guardei 100" } }));
assert.ok(ev && ev !== "ignorar" && ev.de === "5511988882222" && ev.responderPara === "1203630@g.us");
// só o número vale: nome do perfil igual ao de vocês NÃO libera o acesso
const bNomes = { ...b, config: { ...b.config, nomeP1: "Jullio", nomeP2: "Gabriella" } };
assert.equal(identificarPessoa(bNomes, "5521912345678"), null, "número estranho é ignorado");
assert.equal(identificarPessoa({ ...bNomes, config: { ...bNomes.config, telefoneP1: "", telefoneP2: "" } }, "5511999991111"), null, "sem números cadastrados ninguém é atendido");
// desconhecidos não são atendidos pela Evolution
assert.equal(identificarPessoa(bNomes, "123"), null);
assert.equal(identificarPessoa(b, "5511999991111"), "p1");
// mensagens próprias: ignora, exceto conversa comigo mesmo; nunca a resposta do robô
assert.equal(extrairMensagem(evo({ key: { remoteJid: "5511999991111@s.whatsapp.net", fromMe: true }, message: { conversation: "oi" } })), "ignorar");
ev = extrairMensagem(evo({ key: { remoteJid: "5511977776666@s.whatsapp.net", fromMe: true }, message: { conversation: "luz 100" } }));
assert.ok(ev && ev !== "ignorar" && ev.de === "5511977776666" && ev.propria === true);
assert.equal(extrairMensagem(evo({ key: { remoteJid: "5511977776666@s.whatsapp.net", fromMe: true }, message: { conversation: "🤖 ✅ Gasto registrado" } })), "ignorar");
// outros eventos e mensagens sem texto
assert.equal(extrairMensagem({ event: "connection.update", instance: "gj", data: { state: "open" } }), "ignorar");
assert.equal(extrairMensagem(evo({ key: { remoteJid: "5511999991111@s.whatsapp.net", fromMe: false }, message: { audioMessage: {} } })), "ignorar");
// evento em maiúsculas (MESSAGES_UPSERT) também vale
ev = extrairMensagem(evo({ key: { remoteJid: "5511999991111@s.whatsapp.net", fromMe: false }, message: { conversation: "resumo" } }, { event: "MESSAGES_UPSERT" }));
assert.ok(ev && ev !== "ignorar");

// IDs extras aprovados (código interno LID) — comparação exata
const bLid = { ...b, config: { ...b.config, whatsappExtraP2: ["123456789012345"] } };
assert.equal(identificarPessoa(bLid, "123456789012345"), "p2");
assert.equal(identificarPessoa(bLid, "999456789012345"), null, "não basta bater o final");

// ---------- modo finanças (iniciar / encerrar) ----------
assert.equal(comandoSessao("iniciar finanças"), "iniciar");
assert.equal(comandoSessao("  Iniciar Finanças!  "), "iniciar");
assert.equal(comandoSessao("iniciar financas"), "iniciar");
assert.equal(comandoSessao("vou iniciar finanças amanhã"), null, "só a mensagem exata");
assert.equal(comandoSessao("Encerrar"), "encerrar");
assert.equal(comandoSessao("sair"), "encerrar");
assert.equal(comandoSessao("mercado 10"), null);
const t0 = 1_000_000;
assert.equal(sessaoAtiva(undefined, t0), false);
assert.equal(sessaoAtiva({ id: "x", expira: novaExpiracao(t0) }, t0 + 9 * 60_000), true);
assert.equal(sessaoAtiva({ id: "x", expira: novaExpiracao(t0) }, t0 + 11 * 60_000), false);

console.log("✅ Todos os testes de lógica passaram");
console.log("\nExemplo de resposta do WhatsApp:\n" + processarMensagem(b, "resumo", "p1", HOJE).resposta);
