import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Cake,
  CalendarDays,
  Check,
  CircleAlert,
  Heart,
  Hourglass,
  ListChecks,
  MessageCircle,
  PiggyBank,
  ReceiptText,
  Search,
  Sparkles,
  Wallet,
  Sun,
  type LucideIcon,
} from "lucide-react";
import type { Banco } from "../types";
import { contasDoMes, planoCasamento, resumoMes, totaisContas, variacao } from "../calc";
import { diasEntre, dinheiro, nomeMes, somarMeses } from "../format";
import { buscarNaAgenda, itensAgenda, rotuloDia, type ItemAgenda } from "../agenda";
import { checklistTarefas, type ItemChecklist } from "../tarefas";
import { MAX_TAREFAS_BOM_DIA, montarBomDia, prazoTarefa, textoMarco } from "../bom-dia";
import { proximosAniversarios, textoIdade } from "../aniversarios";
import { diasOcupados } from "../whatsapp-agenda";
import type { PedidoImagem } from "../whatsapp";
import { ICONES_EVENTO, iconeDaCategoria } from "@/components/icones";
import * as Lucide from "lucide";

// Os componentes do lucide-react são "de navegador"; aqui usamos os mesmos ícones do pacote `lucide`
// (só os vetores) para desenhar o SVG dentro da imagem.
type NoIcone = [string, Record<string, string | number>][];
function Ico({ icone, size, color, strokeWidth = 2 }: { icone: LucideIcon; size: number; color: string; strokeWidth?: number }) {
  const nome = (icone as { displayName?: string }).displayName ?? "";
  const no = ((Lucide as unknown as Record<string, NoIcone>)[nome] ?? (Lucide as unknown as Record<string, NoIcone>).Circle) as NoIcone;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {no.map(([tag, attrs], i) => {
        const Tag = tag as "path";
        return <Tag key={i} {...(attrs as Record<string, string>)} />;
      })}
    </svg>
  );
}

// Cartões em imagem (PNG) para as consultas do WhatsApp, com a identidade do app.
// Satori: todo <div> com mais de um filho precisa de display:flex.

const C = {
  bg: "#f6f1ea",
  card: "#fffdfa",
  ink: "#241c20",
  muted: "#6f6469",
  line: "#e6ddd2",
  soft: "#f1ebe3",
  brand: "#7b2d4e",
  brandSoft: "#f4e6ec",
  gold: "#a87b3f",
  goldSoft: "#f5ecdd",
  receita: "#2a78d6",
  despesa: "#eb6834",
  guardado: "#1baf7a",
  ok: "#1d7a43",
  okSoft: "#e3f2e8",
  warn: "#9a5b00",
  danger: "#b8322f",
};
const W = 1080;
const PAD = 56;

// ---------- fontes (arquivos em assets/fonts, incluídos no deploy via next.config) ----------
let fontes: Promise<{ name: string; data: ArrayBuffer; weight: 400 | 500 | 600; style: "normal" }[]> | null = null;
function carregarFontes() {
  if (!fontes) {
    const ler = async (arquivo: string) => {
      const buf = await readFile(path.join(process.cwd(), "assets/fonts", arquivo));
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    };
    fontes = Promise.all([
      ler("inter-latin-400-normal.woff").then((data) => ({ name: "Inter", data, weight: 400 as const, style: "normal" as const })),
      ler("inter-latin-600-normal.woff").then((data) => ({ name: "Inter", data, weight: 600 as const, style: "normal" as const })),
      ler("fraunces-latin-500-normal.woff").then((data) => ({ name: "Fraunces", data, weight: 500 as const, style: "normal" as const })),
    ]).catch((e) => {
      console.error("cartões: fontes não carregadas, usando a padrão", e);
      fontes = null;
      return [];
    });
  }
  return fontes;
}

// ---------- peças ----------
const serif = "Fraunces";

function Monograma({ cor = C.ink, tamanho = 34 }: { cor?: string; tamanho?: number }) {
  return (
    <div style={{ display: "flex", fontFamily: serif, fontSize: tamanho, color: cor }}>
      G<span style={{ color: cor === C.ink ? C.gold : "#e3c08a", margin: "0 1px" }}>&amp;</span>J
    </div>
  );
}

function Chip({ icone: I, cor, tamanho = 64 }: { icone: LucideIcon; cor: string; tamanho?: number }) {
  return (
    <div style={{ display: "flex", width: tamanho, height: tamanho, borderRadius: tamanho * 0.3, background: cor + "1f", alignItems: "center", justifyContent: "center" }}>
      <Ico icone={I} size={tamanho * 0.5} color={cor} />
    </div>
  );
}

function Rotulo({ children, cor = C.muted }: { children: string; cor?: string }) {
  return <div style={{ display: "flex", fontSize: 22, letterSpacing: 3, color: cor, fontWeight: 600 }}>{children.toUpperCase()}</div>;
}

function Barra({ fracao, cor, altura = 12 }: { fracao: number; cor: string; altura?: number }) {
  const f = Math.max(0, Math.min(1, Number.isFinite(fracao) ? fracao : 0));
  return (
    <div style={{ display: "flex", width: "100%", height: altura, borderRadius: altura, background: C.soft }}>
      <div style={{ display: "flex", width: `${Math.max(f * 100, f > 0 ? 2 : 0)}%`, height: altura, borderRadius: altura, background: cor }} />
    </div>
  );
}

function Moldura({ children, altura }: { children: ReactNode; altura: number }) {
  return (
    <div style={{ display: "flex", width: W, height: altura, background: C.bg, padding: 28, fontFamily: "Inter" }}>
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: C.card, borderRadius: 48, border: `2px solid ${C.line}`, overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}

function Cabecalho({ rotulo, titulo }: { rotulo: string; titulo: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", padding: `${PAD}px ${PAD}px 28px` }}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <Rotulo cor={C.brand}>{rotulo}</Rotulo>
        <div style={{ display: "flex", fontFamily: serif, fontSize: 60, color: C.ink, marginTop: 8 }}>{titulo}</div>
      </div>
      <Monograma />
    </div>
  );
}

const pctTxt = (v: number | null) => (v === null ? "" : `${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v * 100))}% vs mês anterior`);

// ---------- RESUMO DO MÊS ----------
function Resumo(b: Banco, mes: string) {
  const r = resumoMes(b, mes);
  const ant = resumoMes(b, somarMeses(mes, -1));
  const top = r.porCategoria.slice(0, 4);
  const max = Math.max(1, ...top.map((t) => t.total));
  const vCasa = variacao(r.casa, ant.casa);
  const linhas: [LucideIcon, string, string, number, string][] = [
    [ArrowUpRight, C.receita, "Receitas", r.receitas, pctTxt(variacao(r.receitas, ant.receitas))],
    [ArrowDownRight, C.despesa, "Gastos", r.despesas, pctTxt(variacao(r.despesas, ant.despesas))],
    [PiggyBank, C.guardado, "Guardado", r.guardado, r.receitas > 0 ? `${Math.round((r.guardado / r.receitas) * 100)}% da renda` : ""],
  ];
  const altura = 56 + 330 + linhas.length * 112 + 40 + (top.length ? 70 + top.length * 82 : 0) + 110 + 56;
  return {
    altura,
    jsx: (
      <Moldura altura={altura}>
        <div style={{ display: "flex", flexDirection: "column", background: C.brand, color: "#fff8f3", padding: `${PAD}px ${PAD}px 48px` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Rotulo cor="#f1d9e3">{`Resumo · ${nomeMes(mes)}`}</Rotulo>
            <Monograma cor="#fff8f3" />
          </div>
          <div style={{ display: "flex", fontSize: 26, opacity: 0.85, marginTop: 34 }}>Sobra do mês</div>
          <div style={{ display: "flex", fontFamily: serif, fontSize: 104, lineHeight: 1.05, color: r.sobra < 0 ? "#ffd2c8" : "#fff8f3" }}>{dinheiro(r.sobra)}</div>
          {r.receitas > 0 && (
            <div style={{ display: "flex", fontSize: 26, opacity: 0.85, marginTop: 14 }}>
              {`Gastaram ${Math.round((r.despesas / r.receitas) * 100)}% da renda e guardaram ${Math.round((r.guardado / r.receitas) * 100)}%`}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", padding: `16px ${PAD}px 0` }}>
          {linhas.map(([I, cor, nome, valor, extra]) => (
            <div key={nome} style={{ display: "flex", alignItems: "center", height: 112, borderBottom: `2px solid ${C.line}` }}>
              <Chip icone={I} cor={cor} />
              <div style={{ display: "flex", flex: 1, fontSize: 32, color: C.muted, marginLeft: 26 }}>{nome}</div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <div style={{ display: "flex", fontSize: 38, fontWeight: 600, color: C.ink }}>{dinheiro(valor)}</div>
                {extra && <div style={{ display: "flex", fontSize: 22, color: C.muted }}>{extra}</div>}
              </div>
            </div>
          ))}
        </div>
        {top.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", padding: `40px ${PAD}px 0` }}>
            <Rotulo>Onde mais gastaram</Rotulo>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 22 }}>
              {top.map((c) => {
                const I = iconeDaCategoria(c.categoria);
                return (
                  <div key={c.categoria.id} style={{ display: "flex", alignItems: "center", height: 82 }}>
                    <Ico icone={I} size={30} color={C.muted} />
                    <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 22 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, color: C.ink }}>
                        <span>{c.categoria.nome}</span>
                        <span style={{ fontWeight: 600 }}>{dinheiro(c.total)}</span>
                      </div>
                      <div style={{ display: "flex", marginTop: 10 }}>
                        <Barra fracao={c.total / max} cor={C.despesa} altura={10} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div style={{ display: "flex", margin: `auto ${PAD}px ${PAD}px`, padding: "24px 28px", background: C.soft, borderRadius: 24, fontSize: 26, color: C.muted, justifyContent: "space-between" }}>
          <span>Custo da casa</span>
          <span style={{ display: "flex", color: C.ink, fontWeight: 600 }}>
            {dinheiro(r.casa)}
            {vCasa !== null && <span style={{ color: vCasa > 0 ? C.danger : C.ok, marginLeft: 14, fontWeight: 400 }}>{`${vCasa >= 0 ? "+" : "−"}${Math.abs(Math.round(vCasa * 100))}%`}</span>}
          </span>
        </div>
      </Moldura>
    ),
    legenda: `Resumo de ${nomeMes(mes).split(" ")[0].toLowerCase()}`,
  };
}

// ---------- CONTAS DO DIA 6 ----------
function Contas(b: Banco, mes: string, hoje: string) {
  const lista = contasDoMes(b, mes, hoje);
  const t = totaisContas(lista);
  const altura = 56 + 160 + 230 + Math.max(1, lista.length) * 96 + 56 + 40;
  return {
    altura,
    jsx: (
      <Moldura altura={altura}>
        <Cabecalho rotulo={`Contas do dia ${b.config.diaPadraoContas}`} titulo={nomeMes(mes)} />
        <div style={{ display: "flex", flexDirection: "column", margin: `0 ${PAD}px`, padding: 34, background: t.falta > 0 ? C.soft : C.okSoft, borderRadius: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 24, color: C.muted }}>{t.falta > 0 ? "Falta pagar" : "Tudo pago"}</div>
              <div style={{ display: "flex", fontFamily: serif, fontSize: 72, color: t.falta > 0 ? C.ink : C.ok }}>{dinheiro(t.falta)}</div>
            </div>
            <div style={{ display: "flex", fontSize: 28, color: C.muted, marginBottom: 14 }}>{`${t.qtdPagas} de ${t.qtd} pagas`}</div>
          </div>
          <div style={{ display: "flex", marginTop: 18 }}>
            <Barra fracao={t.qtd ? t.qtdPagas / t.qtd : 0} cor={C.ok} altura={14} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", padding: `24px ${PAD}px 0` }}>
          {!lista.length && <div style={{ display: "flex", fontSize: 28, color: C.muted, height: 96, alignItems: "center" }}>Nenhuma conta fixa cadastrada.</div>}
          {lista.map((c) => (
            <div key={c.conta.id} style={{ display: "flex", alignItems: "center", height: 96, borderBottom: `2px solid ${C.line}` }}>
              <div style={{ display: "flex", width: 48, height: 48, borderRadius: 48, alignItems: "center", justifyContent: "center", background: c.pago ? C.ok : "transparent", border: c.pago ? "none" : `3px solid ${c.atrasada ? C.danger : C.line}` }}>
                {c.pago ? <Ico icone={Check} size={28} color="#ffffff" strokeWidth={3} /> : c.atrasada ? <Ico icone={CircleAlert} size={26} color={C.danger} /> : null}
              </div>
              <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 26 }}>
                <div style={{ display: "flex", fontSize: 30, color: c.pago ? C.muted : C.ink, textDecoration: c.pago ? "line-through" : "none" }}>{c.conta.nome}</div>
                <div style={{ display: "flex", fontSize: 22, color: c.atrasada ? C.danger : C.muted }}>{c.pago ? "pago" : c.atrasada ? "atrasada" : `vence ${rotuloDia(c.vencimento, hoje)}`}</div>
              </div>
              <div style={{ display: "flex", fontSize: 32, fontWeight: 600, color: c.pago ? C.muted : C.ink }}>{dinheiro(c.valor)}</div>
            </div>
          ))}
        </div>
      </Moldura>
    ),
    legenda: `Contas do dia ${b.config.diaPadraoContas} · ${nomeMes(mes).split(" ")[0].toLowerCase()}`,
  };
}

// ---------- CASAMENTO ----------
function Casamento(b: Banco, hoje: string) {
  const p = planoCasamento(b, hoje.slice(0, 7));
  const dias = b.config.dataCasamento ? diasEntre(hoje, b.config.dataCasamento) : null;
  const pagoFr = p.totalContratado > 0 ? p.totalPago / p.totalContratado : 0;
  const temRodape = p.mesesRestantes > 0 && p.faltaGuardar > 0;
  const altura = (dias !== null ? 1060 : 960) + (temRodape ? 110 : 30);
  const linha = (rotulo: string, valor: string, cor = C.ink) => (
    <div key={rotulo} style={{ display: "flex", justifyContent: "space-between", fontSize: 30, height: 64, alignItems: "center", borderBottom: `2px solid ${C.line}` }}>
      <span style={{ color: C.muted }}>{rotulo}</span>
      <span style={{ color: cor, fontWeight: 600 }}>{valor}</span>
    </div>
  );
  return {
    altura,
    jsx: (
      <Moldura altura={altura}>
        <div style={{ display: "flex", flexDirection: "column", background: C.goldSoft, padding: `${PAD}px ${PAD}px 44px` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Rotulo cor={C.gold}>{dias === null ? "Data a definir" : dias > 0 ? "Faltam" : "Casados há"}</Rotulo>
            <Monograma />
          </div>
          {dias !== null && (
            <div style={{ display: "flex", alignItems: "baseline", marginTop: 10 }}>
              <div style={{ display: "flex", fontFamily: serif, fontSize: 132, color: C.ink, lineHeight: 1 }}>{String(Math.abs(dias))}</div>
              <div style={{ display: "flex", fontFamily: serif, fontSize: 48, color: C.muted, marginLeft: 18 }}>dias</div>
            </div>
          )}
          <div style={{ display: "flex", marginTop: 26 }}>
            <Barra fracao={pagoFr} cor={C.ok} altura={14} />
          </div>
          <div style={{ display: "flex", fontSize: 24, color: C.muted, marginTop: 12 }}>{`${Math.round(pagoFr * 100)}% dos fornecedores já pago`}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", padding: `22px ${PAD}px 0` }}>
          {linha("Contratado", dinheiro(p.totalContratado))}
          {linha("Já pago", dinheiro(p.totalPago), C.ok)}
          {linha("Falta pagar", dinheiro(p.totalRestante))}
          {linha("Reserva disponível", dinheiro(p.disponivel))}
          {linha("Falta guardar", dinheiro(p.faltaGuardar), p.faltaGuardar > 0 ? C.danger : C.ok)}
        </div>
        <div style={{ display: "flex", gap: 22, padding: `34px ${PAD}px 0` }}>
          {[
            [Check, C.ok, "Dá para pagar agora", `${p.daParaPagar.length} · ${dinheiro(p.valorDaParaPagar)}`],
            [Hourglass, C.warn, "Ainda falta dinheiro", `${p.faltam.length} fornecedor(es)`],
          ].map(([I, cor, t, v]) => (
            <div key={t as string} style={{ display: "flex", flex: 1, flexDirection: "column", padding: 28, borderRadius: 26, background: (cor as string) + "14" }}>
              <Chip icone={I as LucideIcon} cor={cor as string} tamanho={52} />
              <div style={{ display: "flex", fontSize: 24, color: C.muted, marginTop: 16 }}>{t as string}</div>
              <div style={{ display: "flex", fontSize: 30, color: C.ink, fontWeight: 600, marginTop: 4 }}>{v as string}</div>
            </div>
          ))}
        </div>
        {temRodape && (
          <div style={{ display: "flex", margin: `auto ${PAD}px ${PAD}px`, fontSize: 26, color: C.muted }}>
            {`Guardando ${dinheiro(p.precisaPorMes)} por mês vocês quitam tudo até o casamento.`}
          </div>
        )}
      </Moldura>
    ),
    legenda: dias !== null && dias >= 0 ? `Casamento · faltam ${dias} dias` : "Casamento",
  };
}

// ---------- AGENDA ----------
const COR_TIPO = (i: ItemAgenda) =>
  i.tipo === "aniversario" ? C.guardado : i.tipo === "casamento" ? C.gold : i.tipo === "fornecedor" || i.tipo === "conta" ? C.despesa : i.tipo === "tarefa" ? C.warn : i.area === "casamento" ? C.brand : C.receita;
const ICONE_TIPO = (i: ItemAgenda): LucideIcon =>
  i.tipo === "aniversario" ? Cake : i.tipo === "evento" ? (ICONES_EVENTO[i.evento?.tipo ?? "outro"] ?? CalendarDays) : i.tipo === "fornecedor" ? Banknote : i.tipo === "conta" ? ReceiptText : i.tipo === "tarefa" ? ListChecks : Heart;
const SEM = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const corta = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1) + "…" : t);
const ROW = 96;

/** Blocos de dias (coluna com a data + compromissos). Devolve o JSX e a altura ocupada. */
function BlocosDias(b: Banco, itens: ItemAgenda[], hoje: string, comMes: boolean) {
  const nomes = (p: string) => (p === "p1" ? b.config.nomeP1 : p === "p2" ? b.config.nomeP2 : "");
  const dias = new Map<string, ItemAgenda[]>();
  for (const i of itens) dias.set(i.data, [...(dias.get(i.data) ?? []), i]);
  const altDia = (n: number) => 40 + Math.max(n * ROW, comMes ? 124 : ROW);
  const altura = [...dias.values()].reduce((s, l) => s + altDia(l.length), 0);
  const jsx = [...dias.entries()].map(([dia, lista]) => {
    const d = new Date(dia + "T12:00:00");
    const destaque = dia === hoje;
    return (
      <div key={dia} style={{ display: "flex", padding: `20px ${PAD}px`, height: altDia(lista.length), borderTop: `2px solid ${C.line}` }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 96, color: destaque ? C.brand : C.muted }}>
          <div style={{ display: "flex", fontSize: 20, letterSpacing: 2, fontWeight: 600 }}>{destaque ? "HOJE" : SEM[d.getDay()]}</div>
          <div style={{ display: "flex", fontFamily: serif, fontSize: 58, color: destaque ? C.brand : C.ink, lineHeight: 1.1 }}>{dia.slice(8)}</div>
          {comMes && <div style={{ display: "flex", fontSize: 20, letterSpacing: 2 }}>{`${MES[d.getMonth()]}${dia.slice(0, 4) !== hoje.slice(0, 4) ? " " + dia.slice(2, 4) : ""}`}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 30 }}>
          {lista.map((i) => {
            const sub = [i.hora, i.evento?.local, nomes(i.pessoa), !i.evento ? i.sub : i.evento.observacao].filter(Boolean).join(" · ");
            return (
              <div key={i.id} style={{ display: "flex", alignItems: "center", height: ROW }}>
                <Chip icone={ICONE_TIPO(i)} cor={COR_TIPO(i)} tamanho={60} />
                <div style={{ display: "flex", flexDirection: "column", marginLeft: 24, flex: 1 }}>
                  <div style={{ display: "flex", fontSize: 30, fontWeight: 600, color: dia < hoje ? C.muted : C.ink }}>{corta(i.titulo, 38)}</div>
                  {sub && <div style={{ display: "flex", fontSize: 22, color: C.muted }}>{corta(sub, 52)}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  });
  return { jsx, altura };
}

function Vazio({ texto }: { texto: string }) {
  return <div style={{ display: "flex", padding: `30px ${PAD}px`, fontSize: 32, color: C.muted, height: 160 }}>{texto}</div>;
}

function Agenda(b: Banco, de: string, ate: string, titulo: string, hoje: string) {
  const itens = itensAgenda(b, { hoje }).filter((i) => i.data >= de && i.data <= ate);
  const blocos = BlocosDias(b, itens, hoje, de.slice(0, 7) !== ate.slice(0, 7));
  const altura = 56 + 190 + (itens.length ? blocos.altura : 160) + 56;
  return {
    altura,
    jsx: (
      <Moldura altura={altura}>
        <Cabecalho rotulo="Agenda" titulo={titulo} />
        {!itens.length && <Vazio texto="Nada marcado." />}
        {blocos.jsx}
      </Moldura>
    ),
    legenda: titulo,
  };
}

// ---------- BUSCA ----------
function Busca(b: Banco, termo: string, hoje: string) {
  const achados = buscarNaAgenda(itensAgenda(b, { hoje }), termo, hoje);
  const futuros = achados.filter((i) => i.data >= hoje).slice(0, 8);
  const passados = achados.filter((i) => i.data < hoje).slice(-3);
  const resto = achados.length - futuros.length - passados.length;
  const bf = BlocosDias(b, futuros, hoje, true);
  const bp = BlocosDias(b, passados, hoje, true);
  const altura = 56 + 190 + (achados.length ? bf.altura + (passados.length ? 70 + bp.altura : 0) : 160) + (resto > 0 ? 80 : 0) + 56;
  return {
    altura,
    jsx: (
      <Moldura altura={altura}>
        <Cabecalho rotulo={`Busca · ${achados.length} resultado(s)`} titulo={corta(termo.charAt(0).toUpperCase() + termo.slice(1), 26)} />
        {!achados.length && <Vazio texto="Nada encontrado." />}
        {futuros.length > 0 && bf.jsx}
        {passados.length > 0 && (
          <div style={{ display: "flex", height: 70, alignItems: "flex-end", padding: `0 ${PAD}px 16px`, borderTop: `2px solid ${C.line}` }}>
            <Rotulo>Já passaram</Rotulo>
          </div>
        )}
        {passados.length > 0 && bp.jsx}
        {resto > 0 && <div style={{ display: "flex", height: 80, alignItems: "center", padding: `0 ${PAD}px`, fontSize: 24, color: C.muted, borderTop: `2px solid ${C.line}` }}>{`+${resto} no app (Agenda → Buscar)`}</div>}
      </Moldura>
    ),
    legenda: `Busca: ${termo}`,
  };
}

// ---------- TAREFAS (checklist) ----------
const COR_SITUACAO = { atrasada: C.danger, logo: C.warn, normal: C.muted } as const;

function LinhaTarefa({ it, hoje, nomes }: { it: ItemChecklist; hoje: string; nomes: (p: string) => string }) {
  const t = it.tarefa;
  const prazo = t.prazo ? (it.situacao === "atrasada" ? `atrasada · era ${rotuloDia(t.prazo, hoje)}` : `até ${rotuloDia(t.prazo, hoje)}`) : "";
  const sub = [prazo, nomes(t.responsavel)].filter(Boolean).join(" · ");
  return (
    <div style={{ display: "flex", alignItems: "center", height: 88 }}>
      <div style={{ display: "flex", width: 46, height: 46, borderRadius: 14, border: `3px solid ${it.situacao === "atrasada" ? C.danger : C.line}`, alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 600, color: C.muted }}>
        {String(it.n)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 24 }}>
        <div style={{ display: "flex", fontSize: 29, color: C.ink }}>{corta(t.titulo, 44)}</div>
        {sub && <div style={{ display: "flex", fontSize: 22, color: COR_SITUACAO[it.situacao] }}>{sub}</div>}
      </div>
    </div>
  );
}

function Tarefas(b: Banco, hoje: string) {
  const ck = checklistTarefas(b, hoje);
  const nomes = (p: string) => (p === "p1" ? b.config.nomeP1 : p === "p2" ? b.config.nomeP2 : "");
  const LIM = 16;
  let usados = 0;
  const grupos = ck.grupos
    .map((g) => {
      const itens = g.itens.slice(0, Math.max(0, LIM - usados));
      usados += itens.length;
      return { grupo: g.grupo, itens };
    })
    .filter((g) => g.itens.length);
  const resto = ck.itens.length - usados;
  const atrasadas = ck.itens.filter((i) => i.situacao === "atrasada").length;
  const altura = 56 + 190 + 210 + grupos.reduce((s, g) => s + 74 + g.itens.length * 88, 0) + (ck.itens.length ? 0 : 140) + (resto > 0 ? 70 : 0) + 120 + 30;
  return {
    altura,
    jsx: (
      <Moldura altura={altura}>
        <Cabecalho rotulo="Checklist do casamento" titulo="Tarefas" />
        <div style={{ display: "flex", flexDirection: "column", margin: `0 ${PAD}px`, padding: 32, background: ck.itens.length ? C.goldSoft : C.okSoft, borderRadius: 28, height: 180 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <div style={{ display: "flex", fontFamily: serif, fontSize: 72, color: C.ink, lineHeight: 1 }}>{String(ck.feitas)}</div>
              <div style={{ display: "flex", fontSize: 28, color: C.muted, marginLeft: 12 }}>{`de ${ck.total} feitas`}</div>
            </div>
            <div style={{ display: "flex", fontSize: 26, color: atrasadas ? C.danger : C.muted }}>{atrasadas ? `${atrasadas} atrasada(s)` : `${ck.itens.length} pendente(s)`}</div>
          </div>
          <div style={{ display: "flex", marginTop: 24 }}>
            <Barra fracao={ck.total ? ck.feitas / ck.total : 0} cor={C.ok} altura={14} />
          </div>
        </div>
        {!ck.itens.length && (
          <div style={{ display: "flex", alignItems: "center", height: 140, padding: `0 ${PAD}px`, fontSize: 32, color: C.ok }}>
            <Ico icone={Check} size={36} color={C.ok} strokeWidth={3} />
            <span style={{ marginLeft: 16 }}>{ck.total ? "Tudo feito!" : "Nenhuma tarefa ainda."}</span>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", padding: `30px ${PAD}px 0` }}>
          {grupos.map((g) => (
            <div key={g.grupo} style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", height: 74, alignItems: "flex-end", paddingBottom: 10, borderBottom: `2px solid ${C.line}` }}>
                <Rotulo cor={C.brand}>{g.grupo}</Rotulo>
              </div>
              {g.itens.map((it) => (
                <LinhaTarefa key={it.tarefa.id} it={it} hoje={hoje} nomes={nomes} />
              ))}
            </div>
          ))}
          {resto > 0 && <div style={{ display: "flex", height: 70, alignItems: "center", fontSize: 24, color: C.muted }}>{`+${resto} no app (Casamento → Tarefas)`}</div>}
        </div>
        <div style={{ display: "flex", margin: `auto ${PAD}px ${PAD}px`, padding: "22px 28px", background: C.soft, borderRadius: 24, fontSize: 25, color: C.muted }}>
          {ck.itens.length ? "Para marcar como feita: feito 3  ·  vários: feito 2 5 7" : "Para adicionar: tarefa <o quê>"}
        </div>
      </Moldura>
    ),
    legenda: `Tarefas · ${ck.itens.length} pendente(s)`,
  };
}

// ---------- LISTA ADICIONADA ----------
function Lista(b: Banco, lote: string, semData: string[], repetidos: number, hoje: string) {
  const itens = itensAgenda(b, { hoje }).filter((i) => i.tipo === "evento" && i.evento?.lote === lote);
  const tarefas = b.tarefas.filter((t) => t.lote === lote);
  const blocos = BlocosDias(b, itens, hoje, true);
  const sd = semData.slice(0, 6);
  const altura =
    56 + 190 + blocos.altura + (tarefas.length ? 74 + tarefas.length * 80 : 0) + (sd.length ? 74 + sd.length * 56 : 0) + (repetidos ? 70 : 0) + 120 + 40;
  const linhaSimples = (key: string, texto: string, sub: string, icone: LucideIcon, cor: string, alt: number) => (
    <div key={key} style={{ display: "flex", alignItems: "center", height: alt }}>
      <Ico icone={icone} size={30} color={cor} />
      <div style={{ display: "flex", fontSize: 28, color: C.ink, marginLeft: 22, flex: 1 }}>{corta(texto, 44)}</div>
      {sub && <div style={{ display: "flex", fontSize: 22, color: C.muted }}>{sub}</div>}
    </div>
  );
  return {
    altura,
    jsx: (
      <Moldura altura={altura}>
        <Cabecalho rotulo="Lista adicionada" titulo={`${itens.length + tarefas.length} item(ns)`} />
        {blocos.jsx}
        {tarefas.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", padding: `0 ${PAD}px`, borderTop: `2px solid ${C.line}` }}>
            <div style={{ display: "flex", height: 74, alignItems: "flex-end", paddingBottom: 10 }}>
              <Rotulo cor={C.brand}>Tarefas do casamento</Rotulo>
            </div>
            {tarefas.map((t) => linhaSimples(t.id, t.titulo, t.prazo ? `até ${rotuloDia(t.prazo, hoje)}` : "", ListChecks, C.warn, 80))}
          </div>
        )}
        {sd.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", padding: `0 ${PAD}px`, borderTop: `2px solid ${C.line}` }}>
            <div style={{ display: "flex", height: 74, alignItems: "flex-end", paddingBottom: 10 }}>
              <Rotulo cor={C.danger}>Sem data · não marquei</Rotulo>
            </div>
            {sd.map((x, i) => linhaSimples(`sd${i}`, x, "", CircleAlert, C.danger, 56))}
          </div>
        )}
        {repetidos > 0 && <div style={{ display: "flex", height: 70, alignItems: "center", padding: `0 ${PAD}px`, fontSize: 24, color: C.muted }}>{`${repetidos} item(ns) já estavam cadastrados e não foram repetidos.`}</div>}
        <div style={{ display: "flex", margin: `auto ${PAD}px ${PAD}px`, padding: "22px 28px", background: C.soft, borderRadius: 24, fontSize: 25, color: C.muted }}>
          {sd.length ? "Para os sem data: marcar <dia> <o quê>" : "Errou algo? Mande desfazer lista"}
        </div>
      </Moldura>
    ),
    legenda: `Lista adicionada · ${itens.length + tarefas.length} item(ns)`,
  };
}

// ---------- AJUDA (guia de comandos) ----------
const GUIA: [LucideIcon, string, string, [string, string][]][] = [
  [Wallet, C.despesa, "Lançar", [["mercado 154,90", "gasto"], ["recebi 3500 salário", "receita"], ["guardei 500", "reserva"], ["paguei luz", "conta do dia 6"], ["desfazer", "apaga o último"]]],
  [CalendarDays, C.receita, "Agenda", [["agenda semana", "próximos 7 dias"], ["marcar sexta 19h dentista", "novo compromisso"], ["desmarcar dentista", "remove"], ["buscar vestido", "pesquisa"]]],
  [ListChecks, C.gold, "Casamento", [["tarefas", "checklist"], ["tarefa olhar convites", "nova tarefa"], ["feito 3", "marca como feita"], ["casamento", "pagamentos"]]],
  [Search, C.brand, "Consultas", [["resumo", "mês atual"], ["contas", "dia 6"]]],
];

function Ajuda() {
  const altura = 56 + 190 + GUIA.reduce((s, [, , , cmds]) => s + 96 + cmds.length * 70, 0) + 30 + 130 + 40;
  return {
    altura,
    jsx: (
      <Moldura altura={altura}>
        <Cabecalho rotulo="G&J Finanças" titulo="Como usar" />
        {GUIA.map(([I, cor, titulo, cmds]) => (
          <div key={titulo} style={{ display: "flex", flexDirection: "column", padding: `0 ${PAD}px`, borderTop: `2px solid ${C.line}` }}>
            <div style={{ display: "flex", alignItems: "center", height: 96 }}>
              <Chip icone={I} cor={cor} tamanho={52} />
              <div style={{ display: "flex", fontFamily: serif, fontSize: 38, color: C.ink, marginLeft: 20 }}>{titulo}</div>
            </div>
            {cmds.map(([cmd, desc]) => (
              <div key={cmd} style={{ display: "flex", alignItems: "center", height: 70 }}>
                <div style={{ display: "flex", padding: "8px 18px", background: C.soft, borderRadius: 14, fontSize: 27, color: C.ink, fontWeight: 600 }}>{cmd}</div>
                <div style={{ display: "flex", fontSize: 24, color: C.muted, marginLeft: 18 }}>{desc}</div>
              </div>
            ))}
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", margin: `30px ${PAD}px ${PAD}px`, padding: "22px 28px", background: C.okSoft, borderRadius: 24, fontSize: 25, color: C.ok }}>
          <Ico icone={MessageCircle} size={30} color={C.ok} />
          <span style={{ marginLeft: 14 }}>Quando der certo, eu reajo com</span>
          <div style={{ display: "flex", margin: "0 10px", width: 36, height: 36, borderRadius: 10, background: C.ok, alignItems: "center", justifyContent: "center" }}>
            <Ico icone={Check} size={24} color="#ffffff" strokeWidth={3} />
          </div>
          <span>na sua mensagem</span>
        </div>
      </Moldura>
    ),
    legenda: "Como usar · mande ajuda quando quiser",
  };
}

// ---------- BOM DIA (7h) ----------
function Secao({ titulo, cor = C.muted, children }: { titulo: string; cor?: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", padding: `0 ${PAD}px`, borderTop: `2px solid ${C.line}` }}>
      <div style={{ display: "flex", height: 74, alignItems: "flex-end", paddingBottom: 12 }}>
        <Rotulo cor={cor}>{titulo}</Rotulo>
      </div>
      {children}
    </div>
  );
}

function BomDiaCartao(b: Banco, hoje: string) {
  const bd = montarBomDia(b, hoje);
  const nomes = (p: string) => (p === "p1" ? b.config.nomeP1 : p === "p2" ? b.config.nomeP2 : "");
  const marco = bd.marco;
  const alturaTopo = marco !== null ? 400 : 300;
  const comp = bd.compromissos.slice(0, 8);
  const tarefas = bd.tarefas.slice(0, MAX_TAREFAS_BOM_DIA);
  const altura =
    56 +
    alturaTopo +
    (bd.aniversariosHoje.length ? 40 + bd.aniversariosHoje.length * 76 : 0) +
    74 + Math.max(1, comp.length) * ROW + (bd.compromissos.length > comp.length ? 50 : 0) +
    (tarefas.length ? 74 + tarefas.length * 80 + (bd.tarefas.length > tarefas.length ? 50 : 0) : 0) +
    (bd.aniversariosEmBreve.length ? 74 + bd.aniversariosEmBreve.length * 64 : 0) +
    56 + 30;
  const nomesCasal = [b.config.nomeP1, b.config.nomeP2].filter(Boolean).join(" e ");
  return {
    altura,
    jsx: (
      <Moldura altura={altura}>
        <div style={{ display: "flex", flexDirection: "column", height: alturaTopo, background: marco !== null ? C.goldSoft : C.brand, color: marco !== null ? C.ink : "#fff8f3", padding: `${PAD}px ${PAD}px 40px` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <Ico icone={marco !== null ? Sparkles : Sun} size={30} color={marco !== null ? C.gold : "#f1d9e3"} />
              <div style={{ display: "flex", marginLeft: 14 }}>
                <Rotulo cor={marco !== null ? C.gold : "#f1d9e3"}>{bd.dataExtenso}</Rotulo>
              </div>
            </div>
            <Monograma cor={marco !== null ? C.ink : "#fff8f3"} />
          </div>
          <div style={{ display: "flex", fontFamily: serif, fontSize: 76, lineHeight: 1.1, marginTop: 26 }}>{bd.segunda ? "Boa semana" : "Bom dia"}</div>
          <div style={{ display: "flex", fontSize: 28, opacity: 0.85, marginTop: 6 }}>
            {nomesCasal ? `${nomesCasal}${bd.diasCasamento !== null && bd.diasCasamento > 0 && marco === null ? ` · faltam ${bd.diasCasamento} dias para o casamento` : ""}` : ""}
          </div>
          {marco !== null && (
            <div style={{ display: "flex", alignItems: "center", marginTop: 24, padding: "18px 26px", borderRadius: 22, background: "#ffffff99" }}>
              <Ico icone={Heart} size={32} color={C.brand} />
              <div style={{ display: "flex", fontFamily: serif, fontSize: 40, color: C.brand, marginLeft: 16 }}>{textoMarco(marco)}</div>
            </div>
          )}
        </div>

        {bd.aniversariosHoje.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", padding: `20px ${PAD}px`, background: C.okSoft }}>
            {bd.aniversariosHoje.map((a) => (
              <div key={a.aniversario.id} style={{ display: "flex", alignItems: "center", height: 76 }}>
                <Chip icone={Cake} cor={C.guardado} tamanho={56} />
                <div style={{ display: "flex", fontSize: 30, color: C.ink, marginLeft: 22 }}>
                  <span>Hoje é aniversário de&nbsp;</span>
                  <span style={{ fontWeight: 600 }}>{corta(a.aniversario.nome, 22)}</span>
                  {a.idade ? <span style={{ color: C.muted, marginLeft: 12 }}>{`· ${textoIdade(a.idade)}`}</span> : null}
                </div>
              </div>
            ))}
          </div>
        )}

        <Secao titulo="Compromissos de hoje" cor={C.brand}>
          {!comp.length && (
            <div style={{ display: "flex", alignItems: "center", height: ROW, fontSize: 30, color: C.muted }}>
              <Ico icone={Sun} size={32} color={C.gold} />
              <span style={{ marginLeft: 18 }}>Nenhum compromisso. Dia livre!</span>
            </div>
          )}
          {comp.map((i) => {
            const sub = [i.evento?.local, nomes(i.pessoa), !i.evento ? i.sub : i.area === "casamento" ? "Casamento" : ""].filter(Boolean).join(" · ");
            return (
              <div key={i.id} style={{ display: "flex", alignItems: "center", height: ROW }}>
                <Chip icone={ICONE_TIPO(i)} cor={COR_TIPO(i)} tamanho={60} />
                <div style={{ display: "flex", flexDirection: "column", marginLeft: 24, flex: 1 }}>
                  <div style={{ display: "flex", fontSize: 30, fontWeight: 600, color: C.ink }}>{corta(i.titulo, 38)}</div>
                  {sub && <div style={{ display: "flex", fontSize: 22, color: C.muted }}>{corta(sub, 52)}</div>}
                </div>
                {i.hora && <div style={{ display: "flex", fontFamily: serif, fontSize: 36, color: C.ink }}>{i.hora}</div>}
              </div>
            );
          })}
          {bd.compromissos.length > comp.length && <div style={{ display: "flex", height: 50, fontSize: 24, color: C.muted }}>{`+${bd.compromissos.length - comp.length} no app`}</div>}
        </Secao>

        {tarefas.length > 0 && (
          <Secao titulo="Tarefas a fazer" cor={C.gold}>
            {tarefas.map((it) => {
              const prazo = prazoTarefa(it, hoje);
              const cor = prazo === "atrasada" ? C.danger : prazo === "hoje" ? C.warn : C.muted;
              return (
                <div key={it.tarefa.id} style={{ display: "flex", alignItems: "center", height: 80 }}>
                  <div style={{ display: "flex", width: 46, height: 46, borderRadius: 14, border: `3px solid ${prazo === "atrasada" ? C.danger : C.line}`, alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 600, color: C.muted }}>
                    {String(it.n)}
                  </div>
                  <div style={{ display: "flex", fontSize: 29, color: C.ink, marginLeft: 24, flex: 1 }}>{corta(it.tarefa.titulo, 36)}</div>
                  <div style={{ display: "flex", fontSize: 23, color: cor, fontWeight: prazo === "atrasada" || prazo === "hoje" ? 600 : 400 }}>{prazo}</div>
                </div>
              );
            })}
            {bd.tarefas.length > tarefas.length && <div style={{ display: "flex", height: 50, fontSize: 24, color: C.muted }}>{`+${bd.tarefas.length - tarefas.length} (mande tarefas)`}</div>}
          </Secao>
        )}

        {bd.aniversariosEmBreve.length > 0 && (
          <Secao titulo="Aniversários chegando">
            {bd.aniversariosEmBreve.map((a) => (
              <div key={a.aniversario.id} style={{ display: "flex", alignItems: "center", height: 64 }}>
                <Ico icone={Cake} size={28} color={C.guardado} />
                <div style={{ display: "flex", fontSize: 28, color: C.ink, marginLeft: 20, flex: 1 }}>{corta(a.aniversario.nome, 30)}</div>
                <div style={{ display: "flex", fontSize: 24, color: C.muted }}>{`${rotuloDia(a.data, hoje)}${a.idade ? ` · ${textoIdade(a.idade)}` : ""}`}</div>
              </div>
            ))}
          </Secao>
        )}
      </Moldura>
    ),
    legenda: marco !== null ? textoMarco(marco) : bd.segunda ? "Bom dia e boa semana" : "Bom dia",
  };
}

// ---------- ANIVERSÁRIOS ----------
function AniversariosCartao(b: Banco, hoje: string) {
  const todos = proximosAniversarios(b, hoje, 60);
  const lista = todos.slice(0, 12);
  const altura = 56 + 190 + (lista.length ? lista.length * 100 : 160) + (todos.length > lista.length ? 70 : 0) + 120 + 30;
  return {
    altura,
    jsx: (
      <Moldura altura={altura}>
        <Cabecalho rotulo="Próximos 60 dias" titulo="Aniversários" />
        {!lista.length && <Vazio texto={(b.aniversarios ?? []).length ? "Nenhum nos próximos 60 dias." : "Nenhum aniversário cadastrado ainda."} />}
        {lista.map((p) => {
          const d = new Date(p.data + "T12:00:00");
          const hj = p.dias === 0;
          return (
            <div key={p.aniversario.id} style={{ display: "flex", alignItems: "center", height: 100, padding: `0 ${PAD}px`, borderTop: `2px solid ${C.line}`, background: hj ? C.okSoft : "transparent" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 96 }}>
                <div style={{ display: "flex", fontFamily: serif, fontSize: 46, lineHeight: 1, color: hj ? C.ok : C.ink }}>{p.data.slice(8)}</div>
                <div style={{ display: "flex", fontSize: 18, letterSpacing: 2, color: C.muted, marginTop: 4 }}>{MES[d.getMonth()]}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 28 }}>
                <div style={{ display: "flex", fontSize: 30, fontWeight: 600, color: C.ink }}>{corta(p.aniversario.nome, 30)}</div>
                <div style={{ display: "flex", fontSize: 22, color: C.muted }}>{[p.aniversario.relacao, p.idade ? `faz ${p.idade} anos` : ""].filter(Boolean).join(" · ")}</div>
              </div>
              <div style={{ display: "flex", fontSize: 24, fontWeight: hj ? 600 : 400, color: hj ? C.ok : C.muted }}>{hj ? "HOJE" : p.dias === 1 ? "amanhã" : `em ${p.dias} dias`}</div>
            </div>
          );
        })}
        {todos.length > lista.length && <div style={{ display: "flex", height: 70, alignItems: "center", padding: `0 ${PAD}px`, fontSize: 24, color: C.muted }}>{`+${todos.length - lista.length} no app (Agenda → Aniversários)`}</div>}
        <div style={{ display: "flex", margin: `30px ${PAD}px ${PAD}px`, padding: "22px 28px", background: C.soft, borderRadius: 24, fontSize: 25, color: C.muted }}>
          Para cadastrar: aniversário tia Ana 15/03
        </div>
      </Moldura>
    ),
    legenda: "Próximos aniversários",
  };
}

// ---------- CALENDÁRIO DO MÊS ----------
const SEM_CURTO = ["D", "S", "T", "Q", "Q", "S", "S"];

function CalendarioCartao(b: Banco, mes: string, hoje: string) {
  const ocupados = new Map(diasOcupados(b, mes, hoje));
  const aniversarios = new Set(itensAgenda(b, { hoje }).filter((i) => i.tipo === "aniversario" && i.data.startsWith(mes)).map((i) => i.data));
  const [ano, m] = mes.split("-").map(Number);
  const primeiro = new Date(ano, m - 1, 1).getDay();
  const total = new Date(ano, m, 0).getDate();
  const celulas: (number | null)[] = [...Array(primeiro).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  while (celulas.length % 7) celulas.push(null);
  const semanas = Array.from({ length: celulas.length / 7 }, (_, i) => celulas.slice(i * 7, i * 7 + 7));
  const CEL = 112;
  const lista = [...ocupados.entries()];
  const mostrar = lista.slice(0, 12);
  const altura = 56 + 190 + 56 + semanas.length * CEL + 90 + (mostrar.length ? 74 + mostrar.length * 62 + (lista.length > mostrar.length ? 54 : 0) : 0) + 56;
  const largura = (W - 56 - PAD * 2) / 7;
  return {
    altura,
    jsx: (
      <Moldura altura={altura}>
        <Cabecalho rotulo={`Calendário · ${lista.length} dia(s) com compromisso`} titulo={nomeMes(mes)} />
        <div style={{ display: "flex", flexDirection: "column", padding: `0 ${PAD}px` }}>
          <div style={{ display: "flex", height: 56, alignItems: "center" }}>
            {SEM_CURTO.map((d, i) => (
              <div key={i} style={{ display: "flex", width: largura, justifyContent: "center", fontSize: 22, fontWeight: 600, letterSpacing: 2, color: C.muted }}>
                {d}
              </div>
            ))}
          </div>
          {semanas.map((sem, k) => (
            <div key={k} style={{ display: "flex", height: CEL }}>
              {sem.map((dia, i) => {
                if (!dia) return <div key={i} style={{ display: "flex", width: largura }} />;
                const iso = `${mes}-${String(dia).padStart(2, "0")}`;
                const cheio = ocupados.has(iso);
                const qtd = ocupados.get(iso)?.length ?? 0;
                const ehHoje = iso === hoje;
                const passado = iso < hoje;
                return (
                  <div key={i} style={{ display: "flex", flexDirection: "column", width: largura, alignItems: "center", justifyContent: "center" }}>
                    <div
                      style={{
                        display: "flex",
                        width: 76,
                        height: 76,
                        borderRadius: 76,
                        alignItems: "center",
                        justifyContent: "center",
                        background: cheio ? (passado ? "#e9a3a1" : C.danger) : "transparent",
                        border: ehHoje ? `4px solid ${C.brand}` : "4px solid transparent",
                        fontSize: 32,
                        fontWeight: cheio || ehHoje ? 600 : 400,
                        color: cheio ? "#ffffff" : passado ? "#b3a9ad" : C.ink,
                      }}
                    >
                      {String(dia)}
                    </div>
                    <div style={{ display: "flex", height: 18, marginTop: 4, alignItems: "center" }}>
                      {qtd > 1 && <div style={{ display: "flex", fontSize: 16, fontWeight: 600, color: C.danger }}>{`${qtd}x`}</div>}
                      {aniversarios.has(iso) && <div style={{ display: "flex", width: 10, height: 10, borderRadius: 10, background: C.guardado, marginLeft: qtd > 1 ? 6 : 0 }} />}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div style={{ display: "flex", height: 90, alignItems: "center", fontSize: 22, color: C.muted }}>
            <div style={{ display: "flex", width: 22, height: 22, borderRadius: 22, background: C.danger }} />
            <span style={{ marginLeft: 10, marginRight: 30 }}>compromisso</span>
            <div style={{ display: "flex", width: 22, height: 22, borderRadius: 22, border: `4px solid ${C.brand}` }} />
            <span style={{ marginLeft: 10, marginRight: 30 }}>hoje</span>
            <div style={{ display: "flex", width: 12, height: 12, borderRadius: 12, background: C.guardado }} />
            <span style={{ marginLeft: 10 }}>aniversário</span>
          </div>
        </div>
        {mostrar.length > 0 && (
          <Secao titulo="Compromissos do mês" cor={C.danger}>
            {mostrar.map(([dia, itens]) => {
              const d = new Date(dia + "T12:00:00");
              const texto = itens.map((i) => (i.hora ? `${i.hora} ` : "") + i.titulo).join(" · ");
              return (
                <div key={dia} style={{ display: "flex", alignItems: "center", height: 62, opacity: dia < hoje ? 0.55 : 1 }}>
                  <div style={{ display: "flex", width: 110, fontSize: 26, fontWeight: 600, color: C.danger }}>{`${SEM[d.getDay()].slice(0, 3)} ${dia.slice(8)}`}</div>
                  <div style={{ display: "flex", flex: 1, fontSize: 27, color: C.ink }}>{corta(texto, 50)}</div>
                </div>
              );
            })}
            {lista.length > mostrar.length && <div style={{ display: "flex", height: 54, alignItems: "center", fontSize: 24, color: C.muted }}>{`+${lista.length - mostrar.length} dia(s) no app`}</div>}
          </Secao>
        )}
      </Moldura>
    ),
    legenda: `Calendário · ${nomeMes(mes)}`,
  };
}

/** Gera o cartão como PNG (base64). Devolve null se não der para gerar. */
export async function gerarCartao(b: Banco, pedido: PedidoImagem, hoje: string): Promise<{ base64: string; legenda: string } | null> {
  try {
    const c =
      pedido.tipo === "resumo"
        ? Resumo(b, pedido.mes)
        : pedido.tipo === "contas"
          ? Contas(b, pedido.mes, hoje)
          : pedido.tipo === "casamento"
            ? Casamento(b, hoje)
            : pedido.tipo === "tarefas"
              ? Tarefas(b, hoje)
              : pedido.tipo === "busca"
                ? Busca(b, pedido.termo, hoje)
                : pedido.tipo === "ajuda"
                  ? Ajuda()
                  : pedido.tipo === "lista"
                    ? Lista(b, pedido.lote, pedido.semData, pedido.repetidos, hoje)
                    : pedido.tipo === "bomdia"
                      ? BomDiaCartao(b, hoje)
                      : pedido.tipo === "aniversarios"
                        ? AniversariosCartao(b, hoje)
                        : pedido.tipo === "calendario"
                          ? CalendarioCartao(b, pedido.mes, hoje)
                    : Agenda(b, pedido.de, pedido.ate, pedido.titulo || `Agenda de ${rotuloDia(pedido.de, hoje)}`, hoje);
    const img = new ImageResponse(c.jsx, { width: W, height: Math.min(4000, Math.round(c.altura)), fonts: await carregarFontes() });
    const buf = Buffer.from(await img.arrayBuffer());
    return { base64: buf.toString("base64"), legenda: c.legenda };
  } catch (e) {
    console.error("cartões: falha ao gerar imagem", e);
    return null;
  }
}
