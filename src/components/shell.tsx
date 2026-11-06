"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  CalendarClock,
  CalendarDays,
  CalendarHeart,
  CircleCheckBig,
  Cloud,
  HandCoins,
  HardDrive,
  Heart,
  LayoutDashboard,
  ListChecks,
  Plus,
  Printer,
  ReceiptText,
  Search,
  Settings,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useDados } from "@/lib/store";
import type { Lancamento, TipoLancamento } from "@/lib/types";
import { FormLancamento } from "./form-lancamento";
import { AgendaCtx, FormEvento, type AbrirEvento } from "./agenda";
import { cx, Modal } from "./ui";

interface ItemNav {
  href: string;
  nome: string;
  icone: LucideIcon;
}

const NAV_FINANCAS: ItemNav[] = [
  { href: "/", nome: "Painel", icone: LayoutDashboard },
  { href: "/lancamentos", nome: "Lançamentos", icone: ReceiptText },
  { href: "/contas", nome: "Dia 6", icone: CircleCheckBig },
  { href: "/relatorio", nome: "Relatório", icone: Printer },
];

const NAV_AGENDA: ItemNav[] = [
  { href: "/agenda", nome: "Próximos", icone: CalendarClock },
  { href: "/agenda/calendario", nome: "Calendário", icone: CalendarDays },
  { href: "/agenda/buscar", nome: "Buscar", icone: Search },
];

const NAV_CASAMENTO: ItemNav[] = [
  { href: "/casamento", nome: "Painel", icone: Heart },
  { href: "/casamento/fornecedores", nome: "Fornecedores", icone: HandCoins },
  { href: "/casamento/organizacao", nome: "Tarefas", icone: ListChecks },
  { href: "/casamento/calendario", nome: "Agenda", icone: CalendarHeart },
  { href: "/casamento/relatorio", nome: "Relatório", icone: Printer },
];

interface LancCtx {
  abrir: (opts?: { editar?: Lancamento; tipo?: TipoLancamento }) => void;
}
const LancamentoCtx = createContext<LancCtx>({ abrir: () => undefined });
export const useLancamentoModal = () => useContext(LancamentoCtx);

/** Monograma G&J com o "&" em dourado. */
export function Monograma({ grande }: { grande?: boolean }) {
  return (
    <span className={cx("display inline-flex items-baseline font-medium leading-none", grande ? "text-5xl" : "text-[1.35rem]")}>
      G<span className="mx-[0.06em] italic text-gold">&amp;</span>J
    </span>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { modo, erro, salvando } = useDados();
  const [modal, setModal] = useState<{ editar?: Lancamento; tipo?: TipoLancamento } | null>(null);
  const abrir = useCallback((o?: { editar?: Lancamento; tipo?: TipoLancamento }) => setModal(o ?? {}), []);
  const fechar = useCallback(() => setModal(null), []);
  const [modalEv, setModalEv] = useState<AbrirEvento | null>(null);
  const abrirEvento = useCallback((o?: AbrirEvento) => setModalEv(o ?? {}), []);
  const fecharEvento = useCallback(() => setModalEv(null), []);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  if (path === "/login") return <>{children}</>;

  const casamento = path.startsWith("/casamento");
  const agendaArea = path.startsWith("/agenda");
  const financas = !casamento && !agendaArea;
  const nav = casamento ? NAV_CASAMENTO : agendaArea ? NAV_AGENDA : NAV_FINANCAS;
  const ativo = (href: string) => (href === "/" || href === "/casamento" || href === "/agenda" ? path === href : path.startsWith(href));
  const novo = agendaArea ? () => abrirEvento() : () => abrir();

  return (
    <LancamentoCtx.Provider value={{ abrir }}>
     <AgendaCtx.Provider value={{ abrir: abrirEvento }}>
      {/* ===== Barra lateral (computador) ===== */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface/70 px-4 py-6 backdrop-blur lg:flex">
        <Link href="/" className="px-2">
          <Monograma />
          <div className="mt-1.5 text-xs text-muted">Finanças e casamento</div>
        </Link>

        <button
          type="button"
          onClick={novo}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-brand-ink shadow-sm hover:bg-brand-2"
        >
          <Plus className="h-4 w-4" strokeWidth={2.4} /> {agendaArea ? "Novo compromisso" : "Novo lançamento"}
        </button>

        <GrupoNav titulo="Finanças" icone={Wallet} itens={NAV_FINANCAS} ativo={ativo} />
        <GrupoNav titulo="Agenda" icone={CalendarDays} itens={NAV_AGENDA} ativo={ativo} />
        <GrupoNav titulo="Casamento" icone={Heart} itens={NAV_CASAMENTO} ativo={ativo} />

        <div className="mt-auto space-y-1 pt-6">
          <ItemLateral item={{ href: "/ajustes", nome: "Ajustes", icone: Settings }} ativo={path === "/ajustes"} />
          <IndicadorModo modo={modo} />
        </div>
      </aside>

      {/* ===== Topo (celular / tablet) ===== */}
      <header className="no-print sticky top-0 z-30 border-b border-line bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <Link href={casamento ? "/casamento" : agendaArea ? "/agenda" : "/"} aria-label="Início" className="shrink-0">
            <Monograma />
          </Link>
          <div className="ml-auto inline-flex min-w-0 rounded-xl border border-line bg-surface-2/70 p-0.5 text-[0.78rem]">
            {[
              { href: "/", nome: "Finanças", icone: Wallet, on: financas },
              { href: "/agenda", nome: "Agenda", icone: CalendarDays, on: agendaArea },
              { href: "/casamento", nome: "Casamento", icone: Heart, on: casamento },
            ].map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className={cx("inline-flex items-center gap-1 rounded-[10px] px-2.5 py-1.5", a.on ? "bg-surface font-medium text-ink shadow-sm" : "text-muted")}
              >
                <a.icone className="h-3.5 w-3.5 shrink-0" /> <span className={cx(!a.on && "hidden min-[400px]:inline")}>{a.nome}</span>
              </Link>
            ))}
          </div>
          <Link
            href="/ajustes"
            aria-label="Ajustes"
            className={cx("grid h-9 w-9 place-items-center rounded-xl", path === "/ajustes" ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface-2")}
          >
            <Settings className="h-[18px] w-[18px]" />
          </Link>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:pl-64">
        {modo === "local" && (
          <div className="no-print border-b border-warn/25 bg-warn-soft px-4 py-2 text-center text-xs text-warn">
            {erro || "Modo local: os dados estão salvos só neste aparelho. Conecte o banco de dados para sincronizar entre vocês dois (veja Ajustes)."}
          </div>
        )}
        {modo === "erro" && <div className="no-print bg-danger-soft px-4 py-2 text-center text-xs text-danger">Erro ao carregar: {erro}</div>}
        {salvando && (
          <div className="no-print fixed right-3 top-[calc(4rem+env(safe-area-inset-top))] z-40 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted shadow lg:top-4">
            salvando…
          </div>
        )}

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
          {modo === "carregando" ? (
            <div className="grid place-items-center py-24 text-muted">
              <Monograma grande />
              <div className="mt-4 text-sm">Carregando…</div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      {/* ===== Navegação inferior (celular) ===== */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-1">
          {nav.map((n, i) => (
            <FragmentoNav
              key={n.href}
              n={n}
              ativo={ativo(n.href)}
              meio={(financas && i === 2) || (agendaArea && i === 2) ? novo : undefined}
              rotulo={agendaArea ? "Novo compromisso" : "Novo lançamento"}
            />
          ))}
        </div>
      </nav>

      <Modal aberto={modal !== null} aoFechar={fechar} titulo={modal?.editar ? "Editar lançamento" : "Novo lançamento"}>
        {modal && <FormLancamento key={modal.editar?.id ?? "novo"} editar={modal.editar} tipoInicial={modal.tipo} aoTerminar={fechar} />}
      </Modal>
      <Modal aberto={modalEv !== null} aoFechar={fecharEvento} titulo={modalEv?.editar ? "Editar compromisso" : "Novo compromisso"}>
        {modalEv && <FormEvento key={modalEv.editar?.id ?? `novo-${modalEv.data ?? ""}`} inicial={modalEv} aoTerminar={fecharEvento} />}
      </Modal>
     </AgendaCtx.Provider>
    </LancamentoCtx.Provider>
  );
}

function GrupoNav({ titulo, icone: Icone, itens, ativo }: { titulo: string; icone: LucideIcon; itens: ItemNav[]; ativo: (h: string) => boolean }) {
  return (
    <div className="mt-7">
      <div className="rotulo mb-2 flex items-center gap-1.5 px-2">
        <Icone className="h-3 w-3" strokeWidth={2.4} /> {titulo}
      </div>
      <div className="space-y-0.5">
        {itens.map((n) => (
          <ItemLateral key={n.href} item={n} ativo={ativo(n.href)} />
        ))}
      </div>
    </div>
  );
}

function ItemLateral({ item, ativo }: { item: ItemNav; ativo: boolean }) {
  const Icone = item.icone;
  return (
    <Link
      href={item.href}
      className={cx(
        "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
        ativo ? "bg-brand-soft font-medium text-brand" : "text-muted hover:bg-surface-2 hover:text-ink",
      )}
    >
      {ativo && <span className="absolute -left-4 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-brand" aria-hidden />}
      <Icone className="h-[18px] w-[18px]" strokeWidth={ativo ? 2.2 : 1.8} />
      {item.nome}
    </Link>
  );
}

function IndicadorModo({ modo }: { modo: string }) {
  if (modo === "carregando") return null;
  const nuvem = modo === "nuvem";
  const Icone = nuvem ? Cloud : HardDrive;
  return (
    <div className="flex items-center gap-2 px-2.5 py-2 text-xs text-muted">
      <Icone className="h-3.5 w-3.5" />
      {nuvem ? "Sincronizado na nuvem" : "Salvo só neste aparelho"}
    </div>
  );
}

function FragmentoNav({ n, ativo, meio, rotulo }: { n: ItemNav; ativo: boolean; meio?: () => void; rotulo: string }) {
  const Icone = n.icone;
  return (
    <>
      {meio && (
        <div className="flex flex-1 justify-center">
          <button
            type="button"
            onClick={meio}
            aria-label={rotulo}
            className="-mt-5 grid h-14 w-14 place-items-center rounded-2xl bg-brand text-brand-ink shadow-lg shadow-brand/30 ring-4 ring-bg active:scale-95"
          >
            <Plus className="h-6 w-6" strokeWidth={2.4} />
          </button>
        </div>
      )}
      <Link href={n.href} className={cx("flex min-w-0 flex-1 flex-col items-center gap-1 pb-1.5 pt-2 text-[10.5px]", ativo ? "font-semibold text-brand" : "text-muted")}>
        <Icone className="h-5 w-5" strokeWidth={ativo ? 2.2 : 1.7} />
        {n.nome}
      </Link>
    </>
  );
}
