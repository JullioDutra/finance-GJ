// Gera uma prévia (HTML parecido com o WhatsApp) das mensagens do robô. Uso: npx tsx scripts/previa-whatsapp.ts saida.html
import { writeFileSync } from "node:fs";
import { bancoVazio } from "../src/lib/defaults";
import { aplicarOps } from "../src/lib/ops";
import { processarMensagem } from "../src/lib/whatsapp";
import { BOTOES_FIM, BOTOES_INICIO, MSG_FIM, MSG_INICIO } from "../src/lib/whatsapp-sessao";
import { separarCartao, type BotaoWhats } from "../src/lib/whatsapp-modelos";
import type { Banco } from "../src/lib/types";

const HOJE = "2026-11-05";
let b: Banco = bancoVazio();
b.config = { ...b.config, nomeP1: "Jullio", nomeP2: "Gabriella", dataCasamento: "2027-09-18", reservaInicial: 12000 };
const add = (data: string, tipo: "receita" | "despesa" | "guardado", valor: number, categoriaId: string, descricao: string) =>
  (b = aplicarOps(b, [{ tipo: "upsert", colecao: "lancamentos", id: Math.random().toString(36), dados: { data, tipo, valor, categoriaId, descricao, pessoa: "casal", origem: "app", criadoEm: "" } }]));
for (const m of ["2026-10", "2026-11"]) {
  add(`${m}-05`, "receita", 7800, "cat-salario", "salário");
  add(`${m}-06`, "despesa", 1800, "cat-aluguel", "aluguel");
  add(`${m}-03`, "despesa", m === "2026-11" ? 1100 : 980, "cat-mercado", "mercado");
  add(`${m}-04`, "despesa", 420, "cat-alimentacao", "restaurante");
  add(`${m}-07`, "guardado", 2000, "cat-reserva-casamento", "reserva");
}
b = aplicarOps(b, [
  { tipo: "upsert", colecao: "contas", id: "c1", dados: { id: "c1", nome: "Aluguel", valor: 1800, categoriaId: "cat-aluguel", dia: 6, pessoa: "casal", ativa: true, observacao: "" } },
  { tipo: "upsert", colecao: "contas", id: "c2", dados: { id: "c2", nome: "Luz", valor: 190, categoriaId: "cat-energia", dia: 6, pessoa: "casal", ativa: true, observacao: "" } },
  { tipo: "upsert", colecao: "contas", id: "c3", dados: { id: "c3", nome: "Internet", valor: 119.9, categoriaId: "cat-internet", dia: 6, pessoa: "casal", ativa: true, observacao: "" } },
  { tipo: "upsert", colecao: "pagamentosContas", id: "c1_2026-11", dados: { id: "c1_2026-11", contaId: "c1", mes: "2026-11", pago: true, valor: 1800, pagoEm: "2026-11-03" } },
]);

const conversa: [string, string, BotaoWhats[]?][] = [];
const enviar = (t: string) => {
  conversa.push(["eu", t]);
  const r = processarMensagem(b, t, "p2", HOJE);
  b = aplicarOps(b, r.ops);
  conversa.push(["robo", r.resposta, r.botoes]);
};
conversa.push(["eu", "iniciar finanças"], ["robo", MSG_INICIO, BOTOES_INICIO]);
enviar("mercado 154,90 feira do mês");
enviar("paguei luz");
enviar("resumo");
enviar("contas");
enviar("casamento");
enviar("mercado");
conversa.push(["eu", "encerrar"], ["robo", MSG_FIM, BOTOES_FIM]);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function wa(t: string): string {
  const blocos = t.split(/```/);
  return blocos
    .map((p, i) => {
      if (i % 2 === 1) return `<pre>${esc(p.replace(/^\n|\n$/g, ""))}</pre>`;
      return esc(p)
        .split("\n")
        .map((l) => (l.startsWith("&gt; ") ? `<span class="q">${l.slice(5)}</span>` : l))
        .join("\n")
        .replace(/`([^`\n]+)`/g, "<code>$1</code>")
        .replace(/\*([^*\n]+)\*/g, "<b>$1</b>")
        .replace(/(^|[\s(])_([^_\n]+)_/g, "$1<i>$2</i>")
        .replace(/~([^~\n]+)~/g, "<s>$1</s>")
        .replace(/\n/g, "<br>");
    })
    .join("");
}
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#efeae2;font:15px/1.4 -apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#111b21}
.top{background:#008069;color:#fff;padding:14px 16px;font-weight:600}
.chat{padding:14px 10px;max-width:420px;margin:auto}
.m{max-width:86%;margin:6px 0;padding:7px 9px 8px;border-radius:8px;box-shadow:0 1px .5px rgba(0,0,0,.13);white-space:normal;word-wrap:break-word}
.eu{background:#d9fdd3;margin-left:auto}.robo{background:#fff}
pre{font:13px/1.35 ui-monospace,Menlo,Consolas,monospace;margin:4px 0;white-space:pre}
code{font:13px ui-monospace,Menlo,monospace;background:rgba(0,0,0,.06);padding:1px 4px;border-radius:4px}
.q{display:inline-block;border-left:4px solid #06cf9c;padding-left:8px;color:#54656f}
.wrap{max-width:86%;margin:6px 0}.wrap .m{max-width:none;margin:0;border-radius:8px 8px 0 0}
.ft{color:#667781;font-size:13px;margin-top:6px}
.bt{background:#fff;border-top:1px solid #e9edef;text-align:center;color:#027eb5;padding:9px;font-weight:500;box-shadow:0 1px .5px rgba(0,0,0,.13)}
.bt:last-child{border-radius:0 0 8px 8px}
</style><div class="top">G&amp;J Finanças</div><div class="chat">${conversa
  .map(([q, t, bts]) => {
    if (q !== "robo" || !bts?.length) return `<div class="m ${q}">${wa(t)}</div>`;
    const c = separarCartao(t);
    return `<div class="wrap"><div class="m robo"><b>${esc(c.titulo)}</b><br><br>${wa(c.corpo)}<div class="ft">${esc(c.rodape || "G&J Finanças")}</div></div>${bts.map((x) => `<div class="bt">${esc(x.texto)}</div>`).join("")}</div>`;
  })
  .join("")}</div>`;
writeFileSync(process.argv[2] ?? "previa-whatsapp.html", html);
