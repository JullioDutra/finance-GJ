"use client";

import { useEffect, useId } from "react";
import { ChevronLeft, ChevronRight, Minus, TrendingDown, TrendingUp, X, type LucideIcon } from "lucide-react";
import type { PessoaId } from "@/lib/types";
import { nomeMes, somarMeses } from "@/lib/format";
import { useDados } from "@/lib/store";
import { cx } from "./ui-base";

export { cx };

/** Cabeçalho de página: rótulo da área, título em serifada, subtítulo e ações. */
export function Titulo({ titulo, sub, acoes, area }: { titulo: string; sub?: React.ReactNode; acoes?: React.ReactNode; area?: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        {area && <div className="rotulo mb-1 text-brand">{area}</div>}
        <h1 className="display text-[1.75rem] font-medium leading-tight sm:text-[2rem]">{titulo}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {acoes && <div className="no-print flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}

export function Card({
  children,
  className,
  titulo,
  icone: Icone,
  acao,
}: {
  children: React.ReactNode;
  className?: string;
  titulo?: React.ReactNode;
  icone?: LucideIcon;
  acao?: React.ReactNode;
}) {
  return (
    <section className={cx("avoid-break rounded-2xl border border-line bg-surface p-4 shadow-cartao sm:p-5", className)}>
      {(titulo || acao) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {titulo && (
            <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold">
              {Icone && <Icone className="h-4 w-4 text-brand" strokeWidth={2} aria-hidden />}
              {titulo}
            </h2>
          )}
          {acao}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({
  rotulo,
  valor,
  detalhe,
  icone: Icone,
  tom = "neutro",
}: {
  rotulo: string;
  valor: React.ReactNode;
  detalhe?: React.ReactNode;
  icone?: LucideIcon;
  tom?: "neutro" | "receita" | "despesa" | "guardado" | "brand" | "ok" | "gold";
}) {
  const tons = {
    neutro: "bg-surface-2 text-muted",
    receita: "bg-receita/12 text-receita",
    despesa: "bg-despesa/12 text-despesa",
    guardado: "bg-guardado/14 text-guardado",
    brand: "bg-brand-soft text-brand",
    ok: "bg-ok-soft text-ok",
    gold: "bg-gold-soft text-gold",
  };
  return (
    <div className="avoid-break rounded-2xl border border-line bg-surface p-4 shadow-cartao">
      <div className="flex items-center gap-2.5">
        {Icone && (
          <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-lg", tons[tom])}>
            <Icone className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
        )}
        <span className="text-[0.8rem] font-medium text-muted">{rotulo}</span>
      </div>
      <div className="num mt-3 text-[1.35rem] font-semibold tracking-tight">{valor}</div>
      {detalhe && <div className="mt-0.5 text-xs text-muted">{detalhe}</div>}
    </div>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "primario" | "secundario" | "perigo" | "fantasma";
  pequeno?: boolean;
  icone?: LucideIcon;
};

export function Botao({ variante = "primario", pequeno, icone: Icone, className, children, ...p }: BtnProps) {
  return (
    <button
      type="button"
      {...p}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition active:scale-[.98] disabled:opacity-50",
        pequeno ? "px-3 py-1.5 text-[0.8rem]" : "px-4 py-2.5 text-sm",
        variante === "primario" && "bg-brand text-brand-ink shadow-sm hover:bg-brand-2",
        variante === "secundario" && "border border-line bg-surface text-ink hover:bg-surface-2",
        variante === "perigo" && "border border-danger/30 bg-danger-soft text-danger hover:opacity-90",
        variante === "fantasma" && "text-muted hover:bg-surface-2 hover:text-ink",
        className,
      )}
    >
      {Icone && <Icone className={pequeno ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2} aria-hidden />}
      {children}
    </button>
  );
}

export function Campo({ rotulo, children, dica, className }: { rotulo: string; children: React.ReactNode; dica?: string; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block text-xs font-medium text-muted">{rotulo}</span>
      {children}
      {dica && <span className="mt-1 block text-xs text-muted">{dica}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-ink outline-none transition placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/15";

export function Input(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx(inputCls, p.className)} />;
}

export function Select(p: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cx(inputCls, "pr-8", p.className)} />;
}

export function Textarea(p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cx(inputCls, p.className)} />;
}

export function Modal({ aberto, aoFechar, titulo, children }: { aberto: boolean; aoFechar: () => void; titulo: string; children: React.ReactNode }) {
  const id = useId();
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    document.addEventListener("keydown", esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = prev;
    };
  }, [aberto, aoFechar]);
  if (!aberto) return null;
  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-[#1c1216]/45 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={aoFechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-w-lg sm:rounded-3xl sm:p-6"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-surface-3 sm:hidden" aria-hidden />
        <div className="mb-5 flex items-center justify-between">
          <h2 id={id} className="display text-xl font-medium">
            {titulo}
          </h2>
          <button type="button" onClick={aoFechar} className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-surface-2" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Selo({ children, tom = "neutro", icone: Icone }: { children: React.ReactNode; tom?: "neutro" | "ok" | "warn" | "danger" | "brand" | "gold"; icone?: LucideIcon }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.72rem] font-medium",
        tom === "neutro" && "bg-surface-2 text-muted",
        tom === "ok" && "bg-ok-soft text-ok",
        tom === "warn" && "bg-warn-soft text-warn",
        tom === "danger" && "bg-danger-soft text-danger",
        tom === "brand" && "bg-brand-soft text-brand",
        tom === "gold" && "bg-gold-soft text-gold",
      )}
    >
      {Icone && <Icone className="h-3 w-3" strokeWidth={2.2} aria-hidden />}
      {children}
    </span>
  );
}

export function Barra({ valor, total, cor = "bg-brand", altura = "h-2" }: { valor: number; total: number; cor?: string; altura?: string }) {
  const p = total > 0 ? Math.min(100, Math.max(0, (valor / total) * 100)) : 0;
  return (
    <div className={cx("w-full overflow-hidden rounded-full bg-surface-2", altura)} role="progressbar" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx("h-full rounded-full transition-all", cor)} style={{ width: `${p}%` }} />
    </div>
  );
}

export function Vazio({ children, acao, icone: Icone }: { children: React.ReactNode; acao?: React.ReactNode; icone?: LucideIcon }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-8 text-center text-sm text-muted">
      {Icone && (
        <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-surface-2 text-muted">
          <Icone className="h-5 w-5" strokeWidth={1.8} aria-hidden />
        </span>
      )}
      <div className="mx-auto max-w-sm">{children}</div>
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}

export function SeletorMes({ mes, setMes }: { mes: string; setMes: (m: string) => void }) {
  return (
    <div className="inline-flex items-center rounded-xl border border-line bg-surface shadow-sm">
      <button type="button" className="grid h-10 w-9 place-items-center text-muted hover:text-ink" onClick={() => setMes(somarMeses(mes, -1))} aria-label="Mês anterior">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-32 text-center text-sm font-medium">{nomeMes(mes)}</span>
      <button type="button" className="grid h-10 w-9 place-items-center text-muted hover:text-ink" onClick={() => setMes(somarMeses(mes, 1))} aria-label="Próximo mês">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function usePessoas() {
  const { banco } = useDados();
  const nome = (p: PessoaId) => (p === "p1" ? banco.config.nomeP1 : p === "p2" ? banco.config.nomeP2 : "Casal");
  const lista: { id: PessoaId; nome: string }[] = [
    { id: "p1", nome: banco.config.nomeP1 },
    { id: "p2", nome: banco.config.nomeP2 },
    { id: "casal", nome: "Casal" },
  ];
  return { nome, lista };
}

/** Controle segmentado genérico. */
export function Segmentos<T extends string>({ valor, onChange, opcoes }: { valor: T; onChange: (v: T) => void; opcoes: { id: T; nome: React.ReactNode }[] }) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-xl border border-line bg-surface-2/70 p-0.5">
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cx(
            "inline-flex items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3 py-1.5 text-sm transition",
            valor === o.id ? "bg-surface font-medium text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {o.nome}
        </button>
      ))}
    </div>
  );
}

export function SeletorPessoa({ valor, onChange, comTodos }: { valor: string; onChange: (v: string) => void; comTodos?: boolean }) {
  const { lista } = usePessoas();
  const opcoes = comTodos ? [{ id: "todos", nome: "Todos" }, ...lista] : lista;
  return <Segmentos valor={valor} onChange={onChange} opcoes={opcoes.map((o) => ({ id: o.id as string, nome: o.nome }))} />;
}

export function Variacao({ v, inverso }: { v: number | null; inverso?: boolean }) {
  // inverso = aumento é ruim (gastos)
  if (v === null) return <span className="text-xs text-muted">sem mês anterior</span>;
  const sobe = v > 0;
  const ruim = inverso ? sobe : !sobe;
  const neutro = Math.abs(v) < 0.005;
  const Icone = neutro ? Minus : sobe ? TrendingUp : TrendingDown;
  return (
    <span className={cx("num inline-flex items-center gap-1 text-xs font-medium", neutro ? "text-muted" : ruim ? "text-danger" : "text-ok")}>
      <Icone className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
      {Math.abs(v * 100).toFixed(1).replace(".", ",")}% vs mês anterior
    </span>
  );
}
