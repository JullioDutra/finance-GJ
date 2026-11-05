"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useDados } from "@/lib/store";
import type { Lancamento, TipoLancamento } from "@/lib/types";
import { FormLancamento } from "./form-lancamento";
import { cx, Modal } from "./ui";

interface ItemNav {
  href: string;
  nome: string;
  icone: string;
}

const NAV_FINANCAS: ItemNav[] = [
  { href: "/", nome: "Painel", icone: "📊" },
  { href: "/lancamentos", nome: "Lançamentos", icone: "🧾" },
  { href: "/contas", nome: "Dia 6", icone: "✅" },
  { href: "/relatorio", nome: "Relatório", icone: "🖨️" },
];

const NAV_CASAMENTO: ItemNav[] = [
  { href: "/casamento", nome: "Painel", icone: "💍" },
  { href: "/casamento/fornecedores", nome: "Fornecedores", icone: "🤝" },
  { href: "/casamento/organizacao", nome: "Tarefas", icone: "📋" },
  { href: "/casamento/calendario", nome: "Agenda", icone: "📅" },
  { href: "/casamento/relatorio", nome: "Relatório", icone: "🖨️" },
];

interface LancCtx {
  abrir: (opts?: { editar?: Lancamento; tipo?: TipoLancamento }) => void;
}
const LancamentoCtx = createContext<LancCtx>({ abrir: () => undefined });
export const useLancamentoModal = () => useContext(LancamentoCtx);

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { modo, erro, salvando } = useDados();
  const [modal, setModal] = useState<{ editar?: Lancamento; tipo?: TipoLancamento } | null>(null);
  const abrir = useCallback((o?: { editar?: Lancamento; tipo?: TipoLancamento }) => setModal(o ?? {}), []);
  const fechar = useCallback(() => setModal(null), []);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  if (path === "/login") return <>{children}</>;

  const casamento = path.startsWith("/casamento");
  const nav = casamento ? NAV_CASAMENTO : NAV_FINANCAS;
  const ativo = (href: string) => (href === "/" || href === "/casamento" ? path === href : path.startsWith(href));

  return (
    <LancamentoCtx.Provider value={{ abrir }}>
      <header className="no-print sticky top-0 z-30 border-b border-line bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <Link href={casamento ? "/casamento" : "/"} className="flex items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand text-sm text-brand-ink">G&J</span>
            <span className="hidden sm:inline">Finanças G&J</span>
          </Link>
          <div className="ml-auto inline-flex rounded-xl border border-line bg-surface p-0.5 text-sm">
            <Link href="/" className={cx("rounded-[10px] px-3 py-1.5", !casamento ? "bg-brand text-brand-ink" : "text-muted")}>
              💰 Finanças
            </Link>
            <Link href="/casamento" className={cx("rounded-[10px] px-3 py-1.5", casamento ? "bg-brand text-brand-ink" : "text-muted")}>
              💍 Casamento
            </Link>
          </div>
          <Link href="/ajustes" aria-label="Ajustes" className={cx("rounded-xl p-2 text-lg", path === "/ajustes" ? "bg-brand-soft" : "hover:bg-surface-2")}>
            ⚙️
          </Link>
        </div>
        <nav className="mx-auto hidden max-w-6xl gap-1 px-4 pb-2 md:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={cx("rounded-lg px-3 py-1.5 text-sm", ativo(n.href) ? "bg-surface font-medium shadow-sm" : "text-muted hover:text-ink")}>
              {n.icone} {n.nome}
            </Link>
          ))}
          {!casamento && (
            <button type="button" onClick={() => abrir()} className="ml-auto rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-brand-ink">
              + Novo lançamento
            </button>
          )}
        </nav>
      </header>

      {modo === "local" && (
        <div className="no-print border-b border-warn/30 bg-warn-soft px-4 py-2 text-center text-xs text-warn">
          {erro || "Modo local: os dados estão salvos só neste aparelho. Configure o Supabase para sincronizar entre vocês dois (veja Ajustes)."}
        </div>
      )}
      {modo === "erro" && <div className="no-print bg-danger-soft px-4 py-2 text-center text-xs text-danger">Erro ao carregar: {erro}</div>}
      {salvando && <div className="no-print fixed right-3 top-[calc(4rem+env(safe-area-inset-top))] z-40 rounded-full bg-surface px-3 py-1 text-xs text-muted shadow">salvando…</div>}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-4 md:pb-10">
        {modo === "carregando" ? <div className="py-20 text-center text-muted">Carregando…</div> : children}
      </main>

      {/* Navegação inferior (celular) */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-around">
          {nav.map((n, i) => (
            <FragmentoNav key={n.href} n={n} ativo={ativo(n.href)} meio={!casamento && i === 2 ? () => abrir() : undefined} />
          ))}
        </div>
      </nav>

      <Modal aberto={modal !== null} aoFechar={fechar} titulo={modal?.editar ? "Editar lançamento" : "Novo lançamento"}>
        {modal && <FormLancamento key={modal.editar?.id ?? "novo"} editar={modal.editar} tipoInicial={modal.tipo} aoTerminar={fechar} />}
      </Modal>
    </LancamentoCtx.Provider>
  );
}

function FragmentoNav({ n, ativo, meio }: { n: ItemNav; ativo: boolean; meio?: () => void }) {
  return (
    <>
      {meio && (
        <button type="button" onClick={meio} aria-label="Novo lançamento" className="-mt-5 grid h-14 w-14 shrink-0 place-items-center self-start rounded-2xl bg-brand text-3xl text-brand-ink shadow-lg">
          +
        </button>
      )}
      <Link href={n.href} className={cx("flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[11px]", ativo ? "font-semibold text-brand" : "text-muted")}>
        <span className="text-lg leading-none">{n.icone}</span>
        {n.nome}
      </Link>
    </>
  );
}
