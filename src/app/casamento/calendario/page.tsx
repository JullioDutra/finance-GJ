"use client";

import { useState } from "react";
import { useDados } from "@/lib/store";
import { dataBR, hojeISO, mesAtual, nomeMes, novoId } from "@/lib/format";
import { TIPOS_EVENTO } from "@/lib/defaults";
import type { Evento } from "@/lib/types";
import { Botao, Campo, Card, cx, Input, Modal, Select, SeletorMes, Textarea, Titulo } from "@/components/ui";

interface Item {
  id: string;
  data: string;
  titulo: string;
  emoji: string;
  sub: string;
  tipo: "evento" | "fornecedor" | "tarefa" | "casamento" | "conta";
  evento?: Evento;
}

const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

export default function Calendario() {
  const { banco } = useDados();
  const [mes, setMes] = useState(mesAtual());
  const [dia, setDia] = useState<string | null>(null);
  const [editar, setEditar] = useState<Evento | { novo: string } | null>(null);
  const hoje = hojeISO();

  const itens: Item[] = [
    ...banco.eventos.map((e) => ({ id: e.id, data: e.data, titulo: e.titulo, emoji: TIPOS_EVENTO[e.tipo]?.emoji ?? "📌", sub: [e.hora, e.local].filter(Boolean).join(" · "), tipo: "evento" as const, evento: e })),
    ...banco.fornecedores.filter((f) => f.vencimento).map((f) => ({ id: `f-${f.id}`, data: f.vencimento, titulo: `Quitar ${f.nome}`, emoji: "💸", sub: f.categoria, tipo: "fornecedor" as const })),
    ...banco.tarefas.filter((t) => t.prazo && !t.feita).map((t) => ({ id: `t-${t.id}`, data: t.prazo, titulo: t.titulo, emoji: "📋", sub: `prazo da tarefa · ${t.grupo}`, tipo: "tarefa" as const })),
    ...(banco.config.dataCasamento ? [{ id: "casamento", data: banco.config.dataCasamento, titulo: "Nosso casamento!", emoji: "💍", sub: "", tipo: "casamento" as const }] : []),
  ];
  const porDia = new Map<string, Item[]>();
  for (const i of itens) porDia.set(i.data, [...(porDia.get(i.data) ?? []), i]);

  const [y, m] = mes.split("-").map(Number);
  const primeiroDiaSemana = new Date(y, m - 1, 1).getDay();
  const diasNoMes = new Date(y, m, 0).getDate();
  const celulas: (string | null)[] = [...Array(primeiroDiaSemana).fill(null), ...Array.from({ length: diasNoMes }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`)];

  const doMes = itens.filter((i) => i.data.startsWith(mes)).sort((a, b) => a.data.localeCompare(b.data));
  const selecionados = dia ? porDia.get(dia) ?? [] : [];

  const corTipo = (t: Item["tipo"]) =>
    t === "casamento" ? "bg-brand" : t === "fornecedor" ? "bg-despesa" : t === "tarefa" ? "bg-warn" : "bg-receita";

  return (
    <div className="space-y-4">
      <Titulo
        titulo="Agenda do casamento"
        sub="Reuniões, provas, visitas, vencimentos de fornecedores e prazos de tarefas"
        acoes={
          <>
            <SeletorMes mes={mes} setMes={setMes} />
            <Botao onClick={() => setEditar({ novo: dia ?? hoje })}>+ Compromisso</Botao>
          </>
        }
      />

      <div className="flex flex-wrap gap-3 text-xs text-muted">
        {[
          ["bg-receita", "Compromisso"],
          ["bg-despesa", "Vencimento de fornecedor"],
          ["bg-warn", "Prazo de tarefa"],
          ["bg-brand", "Casamento"],
        ].map(([c, n]) => (
          <span key={n} className="inline-flex items-center gap-1.5">
            <span className={cx("h-2.5 w-2.5 rounded-full", c)} /> {n}
          </span>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
            {SEMANA.map((s, i) => (
              <div key={i} className="py-1 font-medium">
                {s}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {celulas.map((d, i) => {
              if (!d) return <div key={i} />;
              const lista = porDia.get(d) ?? [];
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDia(d === dia ? null : d)}
                  className={cx(
                    "flex aspect-square flex-col items-center rounded-xl border p-1 text-sm transition sm:aspect-auto sm:min-h-20 sm:items-start sm:p-1.5",
                    d === dia ? "border-brand bg-brand-soft" : "border-line hover:bg-surface-2",
                    d === hoje && "ring-2 ring-brand/40",
                  )}
                >
                  <span className={cx("num text-xs", d === hoje ? "font-bold text-brand" : "text-muted")}>{Number(d.slice(8))}</span>
                  <span className="mt-auto flex flex-wrap justify-center gap-0.5 sm:hidden">
                    {lista.slice(0, 3).map((it) => (
                      <span key={it.id} className={cx("h-1.5 w-1.5 rounded-full", corTipo(it.tipo))} />
                    ))}
                  </span>
                  <span className="hidden w-full space-y-0.5 sm:block">
                    {lista.slice(0, 3).map((it) => (
                      <span key={it.id} className="flex w-full items-center gap-1 truncate text-left text-[11px] leading-tight">
                        <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", corTipo(it.tipo))} />
                        <span className="truncate">{it.titulo}</span>
                      </span>
                    ))}
                    {lista.length > 3 && <span className="text-[10px] text-muted">+{lista.length - 3}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        <Card titulo={dia ? dataBR(dia) : `Em ${nomeMes(mes)}`} acao={dia && <Botao pequeno variante="secundario" onClick={() => setEditar({ novo: dia })}>+ Neste dia</Botao>}>
          <ListaItens itens={dia ? selecionados : doMes} mostrarData={!dia} onEditar={(e) => setEditar(e)} vazio={dia ? "Nada neste dia." : "Nada marcado neste mês."} />
        </Card>
      </div>

      <Modal aberto={editar !== null} aoFechar={() => setEditar(null)} titulo={editar && "novo" in editar ? "Novo compromisso" : "Editar compromisso"}>
        {editar && <FormEvento e={"novo" in editar ? undefined : editar} dataInicial={"novo" in editar ? editar.novo : undefined} aoTerminar={() => setEditar(null)} />}
      </Modal>
    </div>
  );
}

function ListaItens({ itens, mostrarData, onEditar, vazio }: { itens: Item[]; mostrarData: boolean; onEditar: (e: Evento) => void; vazio: string }) {
  if (!itens.length) return <p className="text-sm text-muted">{vazio}</p>;
  return (
    <ul className="space-y-2">
      {itens.map((i) => (
        <li key={i.id}>
          <button type="button" disabled={!i.evento} onClick={() => i.evento && onEditar(i.evento)} className="flex w-full gap-2 rounded-xl p-1.5 text-left enabled:hover:bg-surface-2">
            <span className="text-lg">{i.emoji}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{i.titulo}</span>
              <span className="block text-xs text-muted">
                {mostrarData && dataBR(i.data)}
                {mostrarData && i.sub && " · "}
                {i.sub}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function FormEvento({ e: inicial, dataInicial, aoTerminar }: { e?: Evento; dataInicial?: string; aoTerminar: () => void }) {
  const { aplicar } = useDados();
  const [e, setE] = useState<Evento>(inicial ?? { id: novoId(), titulo: "", data: dataInicial ?? hojeISO(), hora: "", local: "", tipo: "reuniao", observacao: "" });
  const set = <K extends keyof Evento>(k: K, v: Evento[K]) => setE((x) => ({ ...x, [k]: v }));
  return (
    <form
      className="space-y-4"
      onSubmit={async (ev) => {
        ev.preventDefault();
        if (!e.titulo.trim()) return;
        await aplicar([{ tipo: "upsert", colecao: "eventos", id: e.id, dados: { ...e, titulo: e.titulo.trim() } }], "Compromisso salvo");
        aoTerminar();
      }}
    >
      <Campo rotulo="O quê">
        <Input value={e.titulo} onChange={(x) => set("titulo", x.target.value)} required autoFocus={!inicial} placeholder="ex.: Degustação do buffet" />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Data">
          <Input type="date" value={e.data} onChange={(x) => set("data", x.target.value)} required />
        </Campo>
        <Campo rotulo="Hora">
          <Input type="time" value={e.hora} onChange={(x) => set("hora", x.target.value)} />
        </Campo>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Tipo">
          <Select value={e.tipo} onChange={(x) => set("tipo", x.target.value as Evento["tipo"])}>
            {Object.entries(TIPOS_EVENTO).map(([k, v]) => (
              <option key={k} value={k}>
                {v.emoji} {v.nome}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo rotulo="Local">
          <Input value={e.local} onChange={(x) => set("local", x.target.value)} />
        </Campo>
      </div>
      <Campo rotulo="Observação">
        <Textarea rows={2} value={e.observacao} onChange={(x) => set("observacao", x.target.value)} />
      </Campo>
      <div className="flex gap-2">
        {inicial && (
          <Botao
            variante="perigo"
            onClick={async () => {
              if (!confirm("Excluir este compromisso?")) return;
              await aplicar([{ tipo: "delete", colecao: "eventos", id: inicial.id }], "Compromisso excluído");
              aoTerminar();
            }}
          >
            Excluir
          </Botao>
        )}
        <Botao type="submit" className="flex-1">
          Salvar
        </Botao>
      </div>
    </form>
  );
}
