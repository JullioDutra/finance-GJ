import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  Check,
  CircleAlert,
  Heart,
  Hourglass,
  ListChecks,
  PiggyBank,
  ReceiptText,
  type LucideIcon,
} from "lucide-react";
import type { Banco } from "../types";
import { contasDoMes, planoCasamento, resumoMes, totaisContas, variacao } from "../calc";
import { diasEntre, dinheiro, nomeMes, somarMeses } from "../format";
import { itensAgenda, rotuloDia, type ItemAgenda } from "../agenda";
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
  i.tipo === "casamento" ? C.gold : i.tipo === "fornecedor" || i.tipo === "conta" ? C.despesa : i.tipo === "tarefa" ? C.warn : i.area === "casamento" ? C.brand : C.receita;
const ICONE_TIPO = (i: ItemAgenda): LucideIcon =>
  i.tipo === "evento" ? (ICONES_EVENTO[i.evento?.tipo ?? "outro"] ?? CalendarDays) : i.tipo === "fornecedor" ? Banknote : i.tipo === "conta" ? ReceiptText : i.tipo === "tarefa" ? ListChecks : Heart;
const SEM = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

function Agenda(b: Banco, de: string, ate: string, titulo: string, hoje: string) {
  const nomes = (p: string) => (p === "p1" ? b.config.nomeP1 : p === "p2" ? b.config.nomeP2 : "");
  const itens = itensAgenda(b, { hoje }).filter((i) => i.data >= de && i.data <= ate);
  const dias = new Map<string, ItemAgenda[]>();
  for (const i of itens) dias.set(i.data, [...(dias.get(i.data) ?? []), i]);
  const altura = 56 + 190 + (itens.length ? [...dias.values()].reduce((s, l) => s + 40 + l.length * 96, 0) : 160) + 56;
  return {
    altura,
    jsx: (
      <Moldura altura={altura}>
        <Cabecalho rotulo="Agenda" titulo={titulo} />
        {!itens.length && <div style={{ display: "flex", padding: `30px ${PAD}px`, fontSize: 32, color: C.muted }}>Nada marcado.</div>}
        {[...dias.entries()].map(([dia, lista]) => {
          const d = new Date(dia + "T12:00:00");
          return (
            <div key={dia} style={{ display: "flex", padding: `20px ${PAD}px`, borderTop: `2px solid ${C.line}` }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 96, color: dia === hoje ? C.brand : C.muted }}>
                <div style={{ display: "flex", fontSize: 20, letterSpacing: 2, fontWeight: 600 }}>{dia === hoje ? "HOJE" : SEM[d.getDay()]}</div>
                <div style={{ display: "flex", fontFamily: serif, fontSize: 58, color: dia === hoje ? C.brand : C.ink, lineHeight: 1.1 }}>{dia.slice(8)}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 30 }}>
                {lista.map((i) => {
                  const sub = [i.hora, i.evento?.local, nomes(i.pessoa), !i.evento ? i.sub : i.evento.observacao].filter(Boolean).join(" · ");
                  return (
                    <div key={i.id} style={{ display: "flex", alignItems: "center", height: 96 }}>
                      <Chip icone={ICONE_TIPO(i)} cor={COR_TIPO(i)} tamanho={60} />
                      <div style={{ display: "flex", flexDirection: "column", marginLeft: 24, flex: 1 }}>
                        <div style={{ display: "flex", fontSize: 30, fontWeight: 600, color: C.ink }}>{i.titulo.length > 38 ? i.titulo.slice(0, 37) + "…" : i.titulo}</div>
                        {sub && <div style={{ display: "flex", fontSize: 22, color: C.muted }}>{sub.length > 52 ? sub.slice(0, 51) + "…" : sub}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </Moldura>
    ),
    legenda: titulo,
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
            : Agenda(b, pedido.de, pedido.ate, pedido.titulo || `Agenda de ${rotuloDia(pedido.de, hoje)}`, hoje);
    const img = new ImageResponse(c.jsx, { width: W, height: Math.min(4000, Math.round(c.altura)), fonts: await carregarFontes() });
    const buf = Buffer.from(await img.arrayBuffer());
    return { base64: buf.toString("base64"), legenda: c.legenda };
  } catch (e) {
    console.error("cartões: falha ao gerar imagem", e);
    return null;
  }
}
