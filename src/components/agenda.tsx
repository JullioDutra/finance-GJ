"use client";

import { createContext, createElement, useContext, useState } from "react";
import { CalendarDays, ChevronRight, Clock, Heart, MapPin, Trash2, UserRound } from "lucide-react";
import { useDados } from "@/lib/store";
import { dataBR, hojeISO, nomeMes, novoId } from "@/lib/format";
import { AREAS_EVENTO, TIPOS_EVENTO } from "@/lib/defaults";
import { areaPorTitulo, rotuloDia, tipoPorTitulo, type ItemAgenda, type TipoItemAgenda } from "@/lib/agenda";
import type { AreaEvento, Evento, PessoaId, TipoEvento } from "@/lib/types";
import { ICONES_EVENTO } from "./icones";
import { Botao, Campo, cx, Input, Segmentos, Select, SeletorPessoa, Selo, Textarea, usePessoas } from "./ui";
import { Banknote, Cake, ListChecks, ReceiptText } from "lucide-react";

// ---------- modal "novo compromisso" (aberto pelo shell) ----------
export interface AbrirEvento {
  editar?: Evento;
  data?: string;
  area?: AreaEvento;
}
export const AgendaCtx = createContext<{ abrir: (o?: AbrirEvento) => void }>({ abrir: () => undefined });
export const useAgendaModal = () => useContext(AgendaCtx);

// ---------- aparência dos itens ----------
const ICONE_AUTOMATICO: Record<Exclude<TipoItemAgenda, "evento">, typeof CalendarDays> = {
  fornecedor: Banknote,
  tarefa: ListChecks,
  conta: ReceiptText,
  casamento: Heart,
  aniversario: Cake,
};

export function iconeItem(i: ItemAgenda) {
  return i.tipo === "evento" ? (ICONES_EVENTO[i.evento?.tipo ?? "outro"] ?? CalendarDays) : ICONE_AUTOMATICO[i.tipo];
}

export function tomItem(i: ItemAgenda): string {
  if (i.tipo === "casamento") return "bg-gold-soft text-gold";
  if (i.tipo === "fornecedor") return "bg-despesa/12 text-despesa";
  if (i.tipo === "conta") return "bg-despesa/12 text-despesa";
  if (i.tipo === "tarefa") return "bg-warn-soft text-warn";
  if (i.tipo === "aniversario") return "bg-guardado/12 text-guardado";
  return i.area === "casamento" ? "bg-brand-soft text-brand" : "bg-receita/12 text-receita";
}

export function corPonto(i: ItemAgenda): string {
  if (i.tipo === "casamento") return "bg-gold";
  if (i.tipo === "fornecedor" || i.tipo === "conta") return "bg-despesa";
  if (i.tipo === "tarefa") return "bg-warn";
  if (i.tipo === "aniversario") return "bg-guardado";
  return i.area === "casamento" ? "bg-brand" : "bg-receita";
}

export function LegendaAgenda() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {[
        ["bg-receita", "Dia a dia"],
        ["bg-brand", "Casamento"],
        ["bg-despesa", "Pagamentos"],
        ["bg-warn", "Prazos de tarefas"],
        ["bg-guardado", "Aniversários"],
        ["bg-gold", "Dia do casamento"],
      ].map(([c, n]) => (
        <span key={n} className="inline-flex items-center gap-1.5">
          <span className={cx("h-2.5 w-2.5 rounded-full", c)} /> {n}
        </span>
      ))}
    </div>
  );
}

// ---------- linha de um compromisso ----------
export function LinhaItem({ item, onAbrir, mostrarData, compacto }: { item: ItemAgenda; onAbrir?: (e: Evento) => void; mostrarData?: boolean; compacto?: boolean }) {
  const { nome } = usePessoas();
  const editavel = !!item.evento && !!onAbrir;
  return (
    <button
      type="button"
      disabled={!editavel}
      onClick={() => item.evento && onAbrir?.(item.evento)}
      className="group flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition enabled:hover:bg-surface-2/70"
    >
      <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-xl", tomItem(item))}>
        {createElement(iconeItem(item), { className: "h-[18px] w-[18px]", strokeWidth: 1.9 })}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{item.titulo}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
          {mostrarData && <span className="font-medium text-ink/80">{dataBR(item.data)}</span>}
          {item.hora && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {item.hora}
            </span>
          )}
          {item.evento?.local && (
            <span className="inline-flex min-w-0 items-center gap-1 truncate">
              <MapPin className="h-3 w-3 shrink-0" /> {item.evento.local}
            </span>
          )}
          {!item.evento && item.sub && <span className="truncate">{item.sub}</span>}
          {item.pessoa !== "casal" && (
            <span className="inline-flex items-center gap-1">
              <UserRound className="h-3 w-3" /> {nome(item.pessoa)}
            </span>
          )}
        </span>
      </span>
      <span className={cx("hidden shrink-0", !compacto && "sm:block")}>
        <Selo tom={item.area === "casamento" ? "brand" : "neutro"}>{item.area === "casamento" ? "Casamento" : "Dia a dia"}</Selo>
      </span>
      {editavel && <ChevronRight className="h-4 w-4 shrink-0 text-muted opacity-0 transition group-hover:opacity-100" />}
    </button>
  );
}

/** Lista agrupada por dia, com cabeçalho de data. */
export function ListaPorDia({ itens, onAbrir, vazio, compacto }: { itens: ItemAgenda[]; onAbrir?: (e: Evento) => void; vazio?: React.ReactNode; compacto?: boolean }) {
  const hoje = hojeISO();
  if (!itens.length) return <div className="py-6 text-center text-sm text-muted">{vazio ?? "Nada por aqui."}</div>;
  const dias = new Map<string, ItemAgenda[]>();
  for (const i of itens) dias.set(i.data, [...(dias.get(i.data) ?? []), i]);
  return (
    <div className="space-y-4">
      {[...dias.entries()].map(([dia, lista]) => {
        const d = new Date(dia + "T12:00:00");
        const passado = dia < hoje;
        return (
          <div key={dia} className={cx("flex gap-3", passado && "opacity-60")}>
            <div className={cx("w-12 shrink-0 pt-2 text-center", dia === hoje ? "text-brand" : "text-muted")}>
              <div className="text-[0.65rem] font-semibold uppercase tracking-wider">{["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d.getDay()]}</div>
              <div className="display num text-2xl font-medium leading-tight">{dia.slice(8)}</div>
              <div className="text-[0.65rem] uppercase">{nomeMes(dia.slice(0, 7), true).split("/")[0]}</div>
            </div>
            <div className="min-w-0 flex-1 border-l border-line pl-2">
              {lista.map((i) => (
                <LinhaItem key={i.id} item={i} onAbrir={onAbrir} compacto={compacto} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- filtros ----------
export type FiltroArea = "todos" | AreaEvento;

export function aplicarFiltros(itens: ItemAgenda[], area: FiltroArea, pessoa: string, automaticos: boolean) {
  return itens.filter(
    (i) =>
      (area === "todos" || i.area === area) &&
      (pessoa === "todos" || i.pessoa === pessoa || i.pessoa === "casal") &&
      (automaticos || i.tipo === "evento"),
  );
}

export function FiltrosAgenda({
  area,
  setArea,
  pessoa,
  setPessoa,
  automaticos,
  setAutomaticos,
  esconderArea,
}: {
  area: FiltroArea;
  setArea: (a: FiltroArea) => void;
  pessoa: string;
  setPessoa: (p: string) => void;
  automaticos: boolean;
  setAutomaticos: (v: boolean) => void;
  esconderArea?: boolean;
}) {
  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      {!esconderArea && (
        <Segmentos
          valor={area}
          onChange={setArea}
          opcoes={[
            { id: "todos", nome: "Tudo" },
            { id: "casal", nome: "Dia a dia" },
            { id: "casamento", nome: "Casamento" },
          ]}
        />
      )}
      <SeletorPessoa valor={pessoa} onChange={setPessoa} comTodos />
      <label className="inline-flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-muted">
        <input type="checkbox" checked={automaticos} onChange={(e) => setAutomaticos(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
        Prazos e contas
      </label>
    </div>
  );
}

// ---------- calendário do mês ----------
const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

export function GradeMes({ mes, itens, dia, setDia }: { mes: string; itens: ItemAgenda[]; dia: string | null; setDia: (d: string | null) => void }) {
  const hoje = hojeISO();
  const porDia = new Map<string, ItemAgenda[]>();
  for (const i of itens) porDia.set(i.data, [...(porDia.get(i.data) ?? []), i]);
  const [y, m] = mes.split("-").map(Number);
  const primeiro = new Date(y, m - 1, 1).getDay();
  const diasNoMes = new Date(y, m, 0).getDate();
  const celulas: (string | null)[] = [...Array(primeiro).fill(null), ...Array.from({ length: diasNoMes }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`)];
  return (
    <div>
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
                "flex aspect-square flex-col items-center rounded-xl border p-1 text-sm transition sm:aspect-auto sm:min-h-24 sm:items-start sm:p-1.5",
                d === dia ? "border-brand bg-brand-soft" : "border-transparent bg-surface-2/50 hover:border-line hover:bg-surface-2",
              )}
            >
              <span className={cx("num grid h-6 w-6 place-items-center rounded-full text-xs", d === hoje ? "bg-brand font-semibold text-brand-ink" : "text-muted")}>{Number(d.slice(8))}</span>
              <span className="mt-auto flex flex-wrap justify-center gap-0.5 sm:hidden">
                {lista.slice(0, 4).map((it) => (
                  <span key={it.id} className={cx("h-1.5 w-1.5 rounded-full", corPonto(it))} />
                ))}
              </span>
              <span className="hidden w-full space-y-0.5 sm:block">
                {lista.slice(0, 3).map((it) => (
                  <span key={it.id} className="flex w-full items-center gap-1 truncate text-left text-[11px] leading-tight">
                    <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", corPonto(it))} />
                    {it.hora && <span className="num text-muted">{it.hora}</span>}
                    <span className="truncate">{it.titulo}</span>
                  </span>
                ))}
                {lista.length > 3 && <span className="text-[10px] text-muted">+{lista.length - 3}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- formulário ----------
export function FormEvento({ inicial, aoTerminar }: { inicial: AbrirEvento; aoTerminar: () => void }) {
  const { aplicar } = useDados();
  const existente = inicial.editar;
  const [e, setE] = useState<Evento>(
    existente ?? {
      id: novoId(),
      titulo: "",
      data: inicial.data ?? hojeISO(),
      hora: "",
      local: "",
      tipo: "outro",
      observacao: "",
      area: inicial.area ?? "casal",
      pessoa: "casal",
      origem: "app",
      criadoEm: new Date().toISOString(),
    },
  );
  const [tipoManual, setTipoManual] = useState(!!existente);
  const [areaManual, setAreaManual] = useState(!!existente || !!inicial.area);
  const set = <K extends keyof Evento>(k: K, v: Evento[K]) => setE((x) => ({ ...x, [k]: v }));
  const area = e.area ?? "casamento";
  return (
    <form
      className="space-y-4"
      onSubmit={async (ev) => {
        ev.preventDefault();
        if (!e.titulo.trim()) return;
        await aplicar([{ tipo: "upsert", colecao: "eventos", id: e.id, dados: { ...e, titulo: e.titulo.trim() } }], existente ? "Compromisso atualizado" : "Compromisso marcado");
        aoTerminar();
      }}
    >
      <Campo rotulo="O quê">
        <Input
          value={e.titulo}
          onChange={(x) => {
            const t = x.target.value;
            setE((cur) => ({
              ...cur,
              titulo: t,
              tipo: tipoManual ? cur.tipo : tipoPorTitulo(t),
              area: areaManual ? cur.area : areaPorTitulo(t),
            }));
          }}
          required
          autoFocus={!existente}
          placeholder="ex.: Dentista, Degustação do buffet, Aniversário da mãe"
        />
      </Campo>
      <div>
        <span className="mb-1.5 block text-xs font-medium text-muted">Área</span>
        <Segmentos
          valor={area}
          onChange={(v) => {
            set("area", v as AreaEvento);
            setAreaManual(true);
          }}
          opcoes={Object.entries(AREAS_EVENTO).map(([id, a]) => ({ id: id as AreaEvento, nome: a.nome }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Dia">
          <Input type="date" value={e.data} onChange={(x) => set("data", x.target.value)} required />
        </Campo>
        <Campo rotulo="Hora (opcional)">
          <Input type="time" value={e.hora} onChange={(x) => set("hora", x.target.value)} />
        </Campo>
      </div>
      <div>
        <span className="mb-1.5 block text-xs font-medium text-muted">De quem</span>
        <SeletorPessoa valor={e.pessoa ?? "casal"} onChange={(v) => set("pessoa", v as PessoaId)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Tipo">
          <Select
            value={e.tipo}
            onChange={(x) => {
              set("tipo", x.target.value as TipoEvento);
              setTipoManual(true);
            }}
          >
            {Object.entries(TIPOS_EVENTO).map(([k, v]) => (
              <option key={k} value={k}>
                {v.nome}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo rotulo="Local">
          <Input value={e.local} onChange={(x) => set("local", x.target.value)} placeholder="opcional" />
        </Campo>
      </div>
      <Campo rotulo="Observação">
        <Textarea rows={2} value={e.observacao} onChange={(x) => set("observacao", x.target.value)} placeholder="opcional" />
      </Campo>
      <div className="flex gap-2">
        {existente && (
          <Botao
            variante="perigo"
            icone={Trash2}
            onClick={async () => {
              if (!confirm("Remover este compromisso?")) return;
              await aplicar([{ tipo: "delete", colecao: "eventos", id: existente.id }], "Compromisso removido");
              aoTerminar();
            }}
          >
            Remover
          </Botao>
        )}
        <Botao type="submit" className="flex-1">
          {existente ? "Salvar" : "Marcar compromisso"}
        </Botao>
      </div>
      {existente?.origem === "whatsapp" && <p className="text-center text-xs text-muted">Marcado pelo WhatsApp</p>}
    </form>
  );
}

export { rotuloDia };
