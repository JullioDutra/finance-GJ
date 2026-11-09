// Testes rápidos da lógica (parser do WhatsApp e cálculos). Rodar: npm run testar
import assert from "node:assert/strict";
import { bancoVazio } from "../src/lib/defaults";
import { lerPlanilha } from "../src/lib/planilha";
import { extrairMensagem } from "../src/lib/whatsapp-entrada";
import { comandoSessao, ehAtivarGrupo, MSG_INICIO, novaExpiracao, sessaoAtiva } from "../src/lib/whatsapp-sessao";
import { assinar, ehMensagemDoRobo, MARCA, MSG_AJUDA, separarCartao } from "../src/lib/whatsapp-modelos";
import { textoEvangelho } from "../src/lib/evangelho";
import { textoEstudo } from "../src/lib/estudo";
import { diasOcupados, mesDoArgumento } from "../src/lib/whatsapp-agenda";
import { buscarConvites, lerComandoConvidados, textoAvisoConfirmacoes, type ConvitePainel } from "../src/lib/convidados";
import { areaPorTitulo, buscarNaAgenda, extrairData, extrairHora, itensAgenda } from "../src/lib/agenda";
import { aplicarOps } from "../src/lib/ops";
import { proximaData } from "../src/lib/aniversarios";
import { montarBomDia } from "../src/lib/bom-dia";
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
// resposta nova do robô (cartão com divisória) na conversa "comigo mesmo" também é ignorada
assert.equal(extrairMensagem(evo({ key: { remoteJid: "5511977776666@s.whatsapp.net", fromMe: true }, message: { conversation: "✅ *Gasto registrado*\n━━━━━━━━━━━━━━━━━━\n🛒 *Mercado* · *R$ 10,00*" } })), "ignorar");
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

// mensagem própria em grupo passa adiante (a rota só lê o grupo de finanças); no privado com outra pessoa, não
ev = extrairMensagem(evo({ key: { remoteJid: "120363@g.us", fromMe: true }, message: { conversation: "uber 32" } }));
assert.ok(ev && ev !== "ignorar" && ev.grupo === true && ev.propria === true && ev.de === "5511977776666");
assert.equal(extrairMensagem(evo({ key: { remoteJid: "5511955554444@s.whatsapp.net", fromMe: true }, message: { conversation: "oi" } })), "ignorar");

// ---------- botões ----------
// clique em botão (nativeFlow) vira o comando do id
ev = extrairMensagem(evo({ key: { remoteJid: "5511999991111@s.whatsapp.net", fromMe: false }, message: { interactiveResponseMessage: { body: { text: "📊 Resumo" }, nativeFlowResponseMessage: { name: "quick_reply", paramsJson: '{"id":"resumo"}' } } } }));
assert.ok(ev && ev !== "ignorar" && ev.texto === "resumo");
ev = extrairMensagem(evo({ key: { remoteJid: "5511999991111@s.whatsapp.net", fromMe: false }, message: { buttonsResponseMessage: { selectedButtonId: "contas" } } }));
assert.ok(ev && ev !== "ignorar" && ev.texto === "contas");
// lançamento traz botão Desfazer com o id do lançamento; desfazer remove
const rl = processarMensagem(b, "padaria 12", "p1", HOJE);
const idL = (rl.ops[0] as { id: string }).id;
assert.equal(rl.botoes?.[0].id, `desfazer ${idL}`);
b = aplicarOps(b, rl.ops);
const rd = processarMensagem(b, `desfazer ${idL}`, "p1", HOJE);
assert.ok(rd.ok && rd.ops.length === 1 && rd.ops[0].tipo === "delete");
b = aplicarOps(b, rd.ops);
assert.ok(!b.lancamentos.some((l) => l.id === idL));
// separar cartão em título/corpo/rodapé para os botões
const partes = separarCartao(MSG_INICIO);
assert.equal(partes.titulo, "Modo finanças ativo");
assert.ok(partes.corpo.startsWith("Pode mandar") && partes.rodape.startsWith("Para sair"));

// ---------- modo finanças (iniciar / encerrar) ----------
assert.equal(comandoSessao("iniciar finanças"), "iniciar");
assert.equal(comandoSessao("  Iniciar Finanças!  "), "iniciar");
assert.equal(comandoSessao("iniciar financas"), "iniciar");
assert.equal(comandoSessao("vou iniciar finanças amanhã"), null, "só a mensagem exata");
assert.equal(comandoSessao("Encerrar"), "encerrar");
assert.equal(comandoSessao("sair"), "encerrar");
assert.equal(comandoSessao("mercado 10"), null);
assert.ok(ehAtivarGrupo("Ativar grupo") && !ehAtivarGrupo("vamos ativar grupo amanhã"));
const t0 = 1_000_000;
assert.equal(sessaoAtiva(undefined, t0), false);
assert.equal(sessaoAtiva({ id: "x", expira: novaExpiracao(t0) }, t0 + 9 * 60_000), true);
assert.equal(sessaoAtiva({ id: "x", expira: novaExpiracao(t0) }, t0 + 11 * 60_000), false);

// ---------- agenda ----------
// HOJE = 2026-11-05 (quinta-feira)
assert.equal(extrairData("amanhã dentista", HOJE).data, "2026-11-06");
assert.equal(extrairData("sexta 19h dentista", HOJE).data, "2026-11-06");
assert.equal(extrairData("na segunda-feira reunião", HOJE).data, "2026-11-09");
assert.equal(extrairData("quinta", HOJE).data, "2026-11-12", "mesmo dia da semana = próxima");
assert.equal(extrairData("15/01 consulta", HOJE).data, "2027-01-15", "data passada sem ano = ano que vem");
assert.equal(extrairData("dia 20 aniversário", HOJE).data, "2026-11-20");
assert.equal(extrairData("depois de amanhã x", HOJE).data, "2026-11-07");
assert.equal(extrairData("dia 3", HOJE).data, "2026-12-03");
assert.deepEqual(extrairHora("19h dentista"), { hora: "19:00", resto: "dentista" });
assert.equal(extrairHora("às 10:30 reunião").hora, "10:30");
assert.equal(extrairHora("19h30 jantar").hora, "19:30");
assert.equal(areaPorTitulo("degustação do buffet"), "casamento");
assert.equal(areaPorTitulo("dentista"), "casal");

let ba: Banco = { ...bancoVazio(), fornecedores: [], pagamentosFornecedores: [] };
const wa = (t: string, p: "p1" | "p2" = "p2") => {
  const r = processarMensagem(ba, t, p, HOJE);
  ba = aplicarOps(ba, r.ops);
  return r;
};
let ra = wa("marcar sexta 19h dentista");
assert.ok(ra.ok, ra.resposta);
assert.equal(ba.eventos.length, 1);
assert.deepEqual([ba.eventos[0].titulo, ba.eventos[0].data, ba.eventos[0].hora, ba.eventos[0].area, ba.eventos[0].pessoa, ba.eventos[0].tipo], ["Dentista", "2026-11-06", "19:00", "casal", "p2", "consulta"]);
ra = wa("agendar 15/11 10:30 degustação buffet");
assert.equal(ba.eventos[1].area, "casamento"); assert.equal(ba.eventos[1].pessoa, "casal"); assert.equal(ba.eventos[1].tipo, "prova");
wa("marcar amanhã aniversário da mãe casal");
assert.equal(ba.eventos[2].pessoa, "casal");
// listar
ra = wa("agenda amanhã");
assert.ok(ra.resposta.includes("Dentista") && ra.resposta.includes("Aniversário da mãe") && !ra.resposta.includes("buffet"));
ra = wa("agenda semana");
assert.ok(ra.resposta.includes("Dentista") && !ra.resposta.includes("degustação"));
ra = wa("agenda 15/11");
assert.ok(ra.resposta.toLowerCase().includes("degustação"));
// buscar (por palavra e por data)
assert.equal(buscarNaAgenda(itensAgenda(ba, { hoje: HOJE }), "buffet", HOJE).length, 1);
const soEv = itensAgenda(ba, { hoje: HOJE, automaticos: false });
assert.deepEqual(buscarNaAgenda(soEv, "15/11", HOJE).map((i) => i.titulo), ["Degustação buffet"]);
assert.deepEqual(buscarNaAgenda(soEv, "amanhã", HOJE).map((i) => i.titulo).sort(), ["Aniversário da mãe", "Dentista"]);
assert.equal(buscarNaAgenda(soEv, "sexta dentista", HOJE).length, 1);
assert.equal(buscarNaAgenda(soEv, "15/11 dentista", HOJE).length, 0);
assert.equal(buscarNaAgenda(soEv, "novembro", HOJE).length, 3);
ra = wa("buscar dentista");
assert.ok(ra.resposta.includes("Dentista"));
// desmarcar
ra = wa("desmarcar dentista");
assert.ok(ra.ok && !ba.eventos.some((e) => e.titulo === "Dentista"));
ra = wa("desmarcar inexistente");
assert.equal(ra.ok, false);
// desfazer sem id remove o último compromisso marcado pelo WhatsApp
wa("marcar sábado 20h pizza");
assert.ok(ba.eventos.some((e) => e.titulo === "Pizza"));
ra = wa("desfazer");
assert.ok(ra.ok && !ba.eventos.some((e) => e.titulo === "Pizza"), ra.resposta);
// ---------- lista do caderno (uma mensagem só) ----------
const listaCaderno = `marcar
Faculdade:
06/11: horas complementares
06/11: CEPE
12/11: trabalho Aninha
22/11: fotos formatura
23/11: entrega caderno TCC (ver detalhamento)
03/12: trabalho Gilson
Fazer relatório de estágio
Casamento:
Olhar dia cartório
Pedir batistério
Definir pajens/daminhas
21/11: fotos pré-wedding
21/11: chá de noiva
Igreja:
05/11: reunião Metamorfose
14/11: reunião Metamorfose
14/11: noite de massas RNSC
02/12: missa Metamorfose
Pessoal:
07/11: peeling 9:30
14/11: sobrancelha 9:30
16/11: olhar vestido pré-wedding`;
const antesEv = ba.eventos.length, antesTf = ba.tarefas.length;
ra = wa(listaCaderno, "p2");
assert.ok(ra.ok, ra.resposta);
const novos = ba.eventos.slice(antesEv);
assert.equal(novos.length, 15, ra.resposta);
assert.equal(ba.tarefas.length - antesTf, 3);
const peel = novos.find((e) => e.titulo === "Peeling")!;
assert.deepEqual([peel.data, peel.hora, peel.area, peel.pessoa, peel.observacao], ["2026-11-07", "09:30", "casal", "p2", "Pessoal"]);
assert.equal(novos.find((e) => e.titulo === "Reunião Metamorfose" )!.data, "2026-11-05", "05/11 fica neste ano");
assert.equal(novos.find((e) => e.titulo === "Fotos pré-wedding")!.area, "casamento");
assert.equal(novos.find((e) => e.titulo === "Horas complementares")!.tipo, "trabalho");
assert.ok(ra.resposta.includes("Fazer relatório de estágio"), "sem data avisado");
// mandar de novo não duplica
ra = wa(listaCaderno, "p2");
assert.equal(ra.ok, false);
assert.equal(ba.eventos.length, antesEv + 15);
// desfazer tudo
const loteId = ra.botoes ? "" : novos[0].lote!;
ra = wa(`desmarcar-lote ${loteId}`);
assert.ok(ra.ok && ba.eventos.length === antesEv && ba.tarefas.length === antesTf, ra.resposta);
// "desfazer lista" (texto, para grupos sem botões)
wa(listaCaderno, "p2");
assert.equal(ba.eventos.length, antesEv + 15);
ra = wa("desfazer lista");
assert.ok(ra.ok && ba.eventos.length === antesEv, ra.resposta);
// lista sem a palavra marcar (linhas começando com data)
ra = wa("07/11 9:30 peeling\n14/11 9:30 sobrancelha");
assert.equal(ba.eventos.length, antesEv + 2);
// tarefa avulsa e lista de tarefas
ra = wa("tarefa comprar lembrancinhas");
assert.ok(ra.ok && ba.tarefas.some((t) => t.titulo === "Comprar lembrancinhas"));
ra = wa("tarefas");
assert.ok(ra.resposta.includes(`${ba.tarefas.filter((t) => !t.feita).length} pendente(s)`));

// lançamentos continuam funcionando
ra = wa("mercado 20");
assert.ok(ra.ok && ba.lancamentos.length === 1, ra.resposta);

// estilo das respostas: sem emojis, reação nos lançamentos e imagem nas consultas
const emoji = /\p{Extended_Pictographic}/u;
const semEmoji = (t: string) => assert.ok(!emoji.test(t), `tem emoji: ${t}`);
semEmoji(MSG_AJUDA.replace("✓", ""));
semEmoji(MSG_INICIO);
for (const cmd of ["resumo", "contas", "casamento", "agenda", "agenda semana", "tarefas", "ajuda", "xyz qualquer coisa", "desfazer"]) {
  semEmoji(wa(cmd).resposta);
}
ra = wa("uber 15");
assert.equal(ra.reagir, "✅");
assert.equal(wa("resumo").imagem?.tipo, "resumo");
if (ba.contas.length) assert.equal(wa("contas").imagem?.tipo, "contas");
assert.equal(processarMensagem(b, "contas", "p1", HOJE).imagem?.tipo, "contas");
assert.equal(wa("casamento").imagem?.tipo, "casamento");
assert.equal(wa("agenda semana").imagem?.tipo, "agenda");
assert.equal(wa("marcar 20/12 dentista").reagir, "✅");
assert.equal(wa("xyz qualquer coisa").reagir, undefined);

// checklist de tarefas
{
  const bt = bancoVazio();
  const tw = (t: string) => {
    const r = processarMensagem(bt, t, "p2", HOJE);
    Object.assign(bt, aplicarOps(bt, r.ops));
    return r;
  };
  let rt = tw("tarefas");
  assert.equal(rt.imagem?.tipo, "tarefas");
  assert.ok(rt.resposta.includes("1. ☐") && rt.resposta.includes(`0 de ${bt.tarefas.length} feitas`), rt.resposta);
  semEmoji(rt.resposta);
  const primeira = rt.resposta.match(/1\. ☐ ([^\n·]+)/)![1].trim();
  rt = tw("feito 1 3");
  assert.ok(rt.ok && rt.reagir === "✅" && bt.tarefas.filter((t) => t.feita).length === 2, rt.resposta);
  assert.ok(bt.tarefas.find((t) => t.titulo === primeira)!.feita);
  rt = tw("feito 999");
  assert.equal(rt.ok, false);
  rt = tw("fiz 50 mercado");
  assert.ok(rt.ok && bt.lancamentos.length === 1, "fiz 50 continua sendo lançamento");
  rt = tw(`reabrir ${primeira}`);
  assert.ok(rt.ok && !bt.tarefas.find((t) => t.titulo === primeira)!.feita, rt.resposta);
  rt = tw("tarefa comprar alianças até 01/12");
  assert.ok(bt.tarefas.some((t) => t.titulo === "Comprar alianças" && t.prazo.endsWith("-12-01")), rt.resposta);
  assert.equal(tw("ajuda").imagem?.tipo, "ajuda");
  assert.equal(tw("marcar 20/12 15h prova do vestido\n21/12 degustação").imagem?.tipo, "lista");
  assert.equal(tw("buscar vestido").imagem?.tipo, "busca");
}

// aniversários e bom dia
{
  const ba2 = bancoVazio();
  const aw = (t: string, dia = HOJE) => {
    const r = processarMensagem(ba2, t, "p1", dia);
    Object.assign(ba2, aplicarOps(ba2, r.ops));
    return r;
  };
  let r = aw("aniversário tia Ana 15/03/1970");
  assert.ok(r.ok && r.reagir === "✅", r.resposta);
  assert.deepEqual({ ...ba2.aniversarios[0], id: "" }, { id: "", nome: "Tia Ana", data: "03-15", ano: 1970, relacao: "Família", observacao: "" });
  r = aw("aniversário tia Ana 15/03/1970");
  assert.equal(r.ok, false, "não duplica");
  r = aw("aniversários\nJoão 20/05\nMaria dia 29/02\nsem data aqui");
  assert.equal(ba2.aniversarios.length, 3, r.resposta);
  assert.ok(r.resposta.includes("sem data aqui"));
  r = aw("niver da Bia 01/01");
  assert.ok(ba2.aniversarios.some((a) => a.nome === "Bia" && a.data === "01-01"), r.resposta);
  r = aw("aniversários");
  assert.equal(r.imagem?.tipo, "aniversarios");
  r = aw("aniversário Ana");
  assert.ok(r.resposta.includes("15/03"), r.resposta);
  r = aw("apagar aniversário Bia");
  assert.ok(r.ok && !ba2.aniversarios.some((a) => a.nome === "Bia"));
  // 29/02 em ano não bissexto vira 28/02 e aparece na agenda
  assert.equal(proximaData({ data: "02-29" }, "2027-01-10"), "2027-02-28");
  assert.equal(proximaData({ data: "02-29" }, "2028-01-10"), "2028-02-29");
  assert.ok(itensAgenda(ba2, { hoje: "2027-01-10" }).some((i) => i.tipo === "aniversario" && i.data === "2027-03-15" && i.sub.startsWith("57 anos")));
  // bom dia
  const dia = "2027-03-15";
  const bd = montarBomDia(ba2, dia);
  assert.equal(bd.aniversariosHoje[0]?.aniversario.nome, "Tia Ana");
  assert.equal(bd.aniversariosHoje[0]?.idade, 57);
  r = aw("bom dia!", dia);
  assert.equal(r.imagem?.tipo, "bomdia");
  assert.ok(r.resposta.includes("Aniversário hoje") && r.resposta.includes("Tia Ana · 57 anos"), r.resposta);
  semEmoji(r.resposta);
  // bom dia sem nada financeiro: sem contas/fornecedores; tarefas com prazo próximo entram
  const bR = bancoVazio();
  bR.contas.push({ id: "c1", nome: "Luz", valor: 100, categoriaId: bR.categorias[0].id, dia: 15, pessoa: "casal", ativa: true, observacao: "" });
  bR.eventos.push({ id: "e1", titulo: "Dentista", data: "2027-03-15", hora: "09:00", local: "", tipo: "consulta", observacao: "", area: "casal" });
  bR.tarefas = [
    { id: "t1", titulo: "Enviar convites", grupo: "Convidados", responsavel: "casal", prazo: "2027-03-10", feita: false, observacao: "" },
    { id: "t2", titulo: "Provar bolo", grupo: "Festa", responsavel: "casal", prazo: "2027-03-18", feita: false, observacao: "" },
    { id: "t3", titulo: "Lua de mel", grupo: "Pós-casamento", responsavel: "casal", prazo: "2027-05-01", feita: false, observacao: "" },
  ];
  const bd2 = montarBomDia(bR, "2027-03-15");
  assert.deepEqual(bd2.compromissos.map((i) => i.titulo), ["Dentista"]);
  assert.deepEqual(bd2.tarefas.map((t) => t.tarefa.titulo), ["Enviar convites", "Provar bolo"]);
  const txt = processarMensagem(bR, "bom dia", "p1", "2027-03-15").resposta;
  assert.ok(!/luz|R\$|gasto/i.test(txt) && txt.includes("Tarefas a fazer") && txt.includes("(atrasada)"), txt);
  // marco do casamento
  bR.config.dataCasamento = "2027-06-18";
  assert.equal(montarBomDia(bR, "2027-03-10").marco, 100);
  assert.equal(montarBomDia(bR, "2027-03-11").marco, null);
}

// assinatura do robô, evangelho e estudo
{
  assert.equal(assinar(MARCA + "*Oi*\ntexto", "Ron Weasley"), "*Ron Weasley(bot):*\n*Oi*\ntexto" + MARCA);
  assert.equal(assinar("Bom dia", ""), "Bom dia" + MARCA);
  assert.ok(assinar(MARCA + "*Oi*", "Ron Weasley").startsWith("*"), "nada antes do * (senão o negrito some)");
  assert.ok(ehMensagemDoRobo(assinar("x", "Ron Weasley")));
  assert.equal(bancoVazio().config.nomeRobo, "Ron Weasley");
  const ev = textoEvangelho({ data: "09/11/2026", liturgia: "Dedicação da Basílica do Latrão", referencia: "Jo 2,13-22", titulo: "Proclamação do Evangelho de Jesus Cristo segundo João", texto: "Estava próxima a Páscoa dos judeus,\n\n\n\n e Jesus subiu a Jerusalém." });
  assert.ok(ev.includes("*Jo 2,13-22*") && ev.includes("_Dedicação da Basílica do Latrão_") && !ev.includes("\n\n\n"), ev);
  const es = textoEstudo("2026-11-09");
  assert.ok(es.includes("Hora de estudar") && es !== textoEstudo("2026-11-10"));
  semEmoji(es);
}

// calendário do mês
{
  const h = "2026-11-09";
  assert.equal(mesDoArgumento("", h), "2026-11");
  assert.equal(mesDoArgumento("dezembro", h), "2026-12");
  assert.equal(mesDoArgumento("jan", h), "2027-01");
  assert.equal(mesDoArgumento("outubro", h), "2026-10");
  assert.equal(mesDoArgumento("03/2027", h), "2027-03");
  assert.equal(mesDoArgumento("próximo", h), "2026-12");
  assert.equal(mesDoArgumento("banana", h), null);
  const bc = bancoVazio();
  bc.eventos.push(
    { id: "c1", titulo: "Dentista", data: "2026-11-20", hora: "09:00", local: "", tipo: "consulta", observacao: "", area: "casal" },
    { id: "c2", titulo: "Prova do vestido", data: "2026-11-20", hora: "15:00", local: "", tipo: "prova", observacao: "", area: "casamento" },
    { id: "c3", titulo: "Ceia", data: "2026-12-24", hora: "", local: "", tipo: "social", observacao: "", area: "casal" },
  );
  assert.deepEqual(diasOcupados(bc, "2026-11", h).map(([d, i]) => [d, i.length]), [["2026-11-20", 2]]);
  let rc = processarMensagem(bc, "calendário", "p1", h);
  assert.ok(rc.ok && rc.imagem?.tipo === "calendario" && rc.imagem.mes === "2026-11" && rc.resposta.includes("Dentista"), rc.resposta);
  rc = processarMensagem(bc, "calendario dezembro", "p1", h);
  assert.ok(rc.imagem?.tipo === "calendario" && rc.imagem.mes === "2026-12" && rc.resposta.includes("Ceia"));
  assert.equal(processarMensagem(bc, "calendario xyz", "p1", h).ok, false);
}

// convidados (Painel dos Noivos)
{
  assert.deepEqual(lerComandoConvidados("Convidados"), { tipo: "resumo" });
  assert.deepEqual(lerComandoConvidados("confirmados"), { tipo: "lista", status: "confirmados" });
  assert.deepEqual(lerComandoConvidados("quem falta"), { tipo: "lista", status: "pendentes" });
  assert.deepEqual(lerComandoConvidados("novo convidado Maria Souza 3"), { tipo: "novo", nome: "Maria Souza", quantidade: 3, telefone: "" });
  assert.deepEqual(lerComandoConvidados("novo convidado Tio Zé tel 61 99999-8888"), { tipo: "novo", nome: "Tio Zé", quantidade: 1, telefone: "61999998888" });
  assert.deepEqual(lerComandoConvidados("remover convidado #12"), { tipo: "remover", busca: "#12", id: 12 });
  assert.deepEqual(lerComandoConvidados("remover convidado Maria"), { tipo: "remover", busca: "Maria", id: null });
  assert.deepEqual(lerComandoConvidados("convidado Maria"), { tipo: "ver", busca: "Maria" });
  assert.equal(lerComandoConvidados("contas"), null);
  assert.equal(lerComandoConvidados("pendentes"), null, "pendentes continua sendo das contas");
  const conv = (id: number, nome: string): ConvitePainel => ({ id, nome, telefone: "", grupo: "", observacoes: "", quantidade_esperada: 2, quantidade_confirmada: 0, faltam: 2, confirmado: false, confirmacoes_site: [] });
  const lista = [conv(1, "Maria Souza"), conv(2, "Maria Lima"), conv(3, "João")];
  assert.equal(buscarConvites(lista, "maria").length, 2);
  assert.equal(buscarConvites(lista, "maria souza")[0].id, 1);
  assert.equal(buscarConvites(lista, "joao")[0].id, 3);
  const aviso = textoAvisoConfirmacoes(
    [{ confirmacao: { id: 7, nome: "Joana", telefone: "", quantidade: 1, mensagem: "Estaremos lá!", criado_em: "" }, convite: { ...conv(3, "Maria Souza"), quantidade_esperada: 5, quantidade_confirmada: 1, faltam: 4 } }],
    { convites: 10, convites_confirmados: 4, convites_pendentes: 6, pessoas_esperadas: 60, pessoas_confirmadas: 42, pessoas_faltando: 18, confirmacoes_sem_vinculo: 0 },
  );
  assert.ok(aviso.includes("*Joana* confirmou 1 pessoa") && aviso.includes("1 de 5 (faltam 4)") && aviso.includes("*42* confirmadas"), aviso);
  semEmoji(aviso);
}

console.log("✅ Todos os testes de lógica passaram");
console.log("\nExemplo de resposta do WhatsApp:\n" + processarMensagem(b, "resumo", "p1", HOJE).resposta);
