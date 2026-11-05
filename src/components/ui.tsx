"use client";

import { useEffect, useId } from "react";
import type { PessoaId } from "@/lib/types";
import { nomeMes, somarMeses } from "@/lib/format";
import { useDados } from "@/lib/store";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Titulo({ titulo, sub, acoes }: { titulo: string; sub?: React.ReactNode; acoes?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
      </div>
      {acoes && <div className="no-print flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}

export function Card({ children, className, titulo, acao }: { children: React.ReactNode; className?: string; titulo?: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <section className={cx("avoid-break rounded-2xl border border-line bg-surface p-4 shadow-sm", className)}>
      {(titulo || acao) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {titulo && <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{titulo}</h2>}
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
  cor,
  destaque,
}: {
  rotulo: string;
  valor: React.ReactNode;
  detalhe?: React.ReactNode;
  cor?: string; // classe de cor do marcador
  destaque?: boolean;
}) {
  return (
    <div className={cx("avoid-break rounded-2xl border border-line p-3.5", destaque ? "bg-brand-soft" : "bg-surface")}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
        {cor && <span className={cx("inline-block h-2.5 w-2.5 rounded-full", cor)} aria-hidden />}
        {rotulo}
      </div>
      <div className="num mt-1 text-xl font-semibold tracking-tight">{valor}</div>
      {detalhe && <div className="mt-0.5 text-xs text-muted">{detalhe}</div>}
    </div>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: "primario" | "secundario" | "perigo" | "fantasma"; pequeno?: boolean };

export function Botao({ variante = "primario", pequeno, className, ...p }: BtnProps) {
  return (
    <button
      type="button"
      {...p}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition active:scale-[.98] disabled:opacity-50",
        pequeno ? "px-3 py-1.5 text-sm" : "px-4 py-2.5 text-sm",
        variante === "primario" && "bg-brand text-brand-ink hover:opacity-90",
        variante === "secundario" && "border border-line bg-surface hover:bg-surface-2",
        variante === "perigo" && "border border-danger/40 bg-danger-soft text-danger hover:opacity-90",
        variante === "fantasma" && "text-muted hover:bg-surface-2 hover:text-ink",
        className,
      )}
    />
  );
}

export function Campo({ rotulo, children, dica, className }: { rotulo: string; children: React.ReactNode; dica?: string; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-xs font-medium text-muted">{rotulo}</span>
      {children}
      {dica && <span className="mt-1 block text-xs text-muted">{dica}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";

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
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={aoFechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl sm:max-w-lg sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id={id} className="text-lg font-semibold">
            {titulo}
          </h2>
          <button type="button" onClick={aoFechar} className="rounded-full p-2 text-muted hover:bg-surface-2" aria-label="Fechar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Selo({ children, tom = "neutro" }: { children: React.ReactNode; tom?: "neutro" | "ok" | "warn" | "danger" | "brand" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        tom === "neutro" && "bg-surface-2 text-muted",
        tom === "ok" && "bg-ok-soft text-ok",
        tom === "warn" && "bg-warn-soft text-warn",
        tom === "danger" && "bg-danger-soft text-danger",
        tom === "brand" && "bg-brand-soft text-brand",
      )}
    >
      {children}
    </span>
  );
}

export function Barra({ valor, total, cor = "bg-brand", altura = "h-2.5" }: { valor: number; total: number; cor?: string; altura?: string }) {
  const p = total > 0 ? Math.min(100, Math.max(0, (valor / total) * 100)) : 0;
  return (
    <div className={cx("w-full overflow-hidden rounded-full bg-surface-2", altura)} role="progressbar" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx("h-full rounded-full transition-all", cor)} style={{ width: `${p}%` }} />
    </div>
  );
}

export function Vazio({ children, acao }: { children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
      <div>{children}</div>
      {acao && <div className="mt-3">{acao}</div>}
    </div>
  );
}

export function SeletorMes({ mes, setMes }: { mes: string; setMes: (m: string) => void }) {
  return (
    <div className="inline-flex items-center rounded-xl border border-line bg-surface">
      <button type="button" className="px-3 py-2 text-muted hover:text-ink" onClick={() => setMes(somarMeses(mes, -1))} aria-label="Mês anterior">
        ‹
      </button>
      <span className="min-w-36 text-center text-sm font-medium">{nomeMes(mes)}</span>
      <button type="button" className="px-3 py-2 text-muted hover:text-ink" onClick={() => setMes(somarMeses(mes, 1))} aria-label="Próximo mês">
        ›
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

export function SeletorPessoa({ valor, onChange, comTodos }: { valor: string; onChange: (v: string) => void; comTodos?: boolean }) {
  const { lista } = usePessoas();
  const opcoes = comTodos ? [{ id: "todos", nome: "Todos" }, ...lista] : lista;
  return (
    <div className="inline-flex rounded-xl border border-line bg-surface p-0.5">
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cx("rounded-[10px] px-3 py-1.5 text-sm transition", valor === o.id ? "bg-brand text-brand-ink" : "text-muted hover:text-ink")}
        >
          {o.nome}
        </button>
      ))}
    </div>
  );
}

export function Variacao({ v, inverso }: { v: number | null; inverso?: boolean }) {
  // inverso = aumento é ruim (gastos)
  if (v === null) return <span className="text-xs text-muted">sem mês anterior</span>;
  const sobe = v > 0;
  const ruim = inverso ? sobe : !sobe;
  const neutro = Math.abs(v) < 0.005;
  return (
    <span className={cx("num text-xs font-medium", neutro ? "text-muted" : ruim ? "text-danger" : "text-ok")}>
      {neutro ? "=" : sobe ? "▲" : "▼"} {Math.abs(v * 100).toFixed(1).replace(".", ",")}% vs mês anterior
    </span>
  );
}
