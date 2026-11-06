"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, CalendarPlus, MessageCircle, Plus, Search, Sun, X } from "lucide-react";
import { useDados } from "@/lib/store";
import { hojeISO, nomeMes } from "@/lib/format";
import { buscarNaAgenda, itensAgenda, somarDias } from "@/lib/agenda";
import type { Evento } from "@/lib/types";
import { Botao, Card, Input, Titulo } from "@/components/ui";
import { aplicarFiltros, FiltrosAgenda, LinhaItem, ListaPorDia, useAgendaModal, type FiltroArea } from "@/components/agenda";

const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

export default function AgendaProximos() {
  const { banco } = useDados();
  const { abrir } = useAgendaModal();
  const hoje = hojeISO();
  const [area, setArea] = useState<FiltroArea>("todos");
  const [pessoa, setPessoa] = useState("todos");
  const [automaticos, setAutomaticos] = useState(true);
  const [busca, setBusca] = useState("");

  const todos = aplicarFiltros(itensAgenda(banco, { hoje }), area, pessoa, automaticos);
  const deHoje = todos.filter((i) => i.data === hoje);
  const amanha = somarDias(hoje, 1);
  const deAmanha = todos.filter((i) => i.data === amanha);
  const semana = todos.filter((i) => i.data > amanha && i.data <= somarDias(hoje, 7));
  const adiante = todos.filter((i) => i.data > somarDias(hoje, 7) && i.data <= somarDias(hoje, 60));
  const resultados = busca.trim() ? buscarNaAgenda(todos, busca, hoje) : [];
  const d = new Date(hoje + "T12:00:00");
  const abrirEv = (e: Evento) => abrir({ editar: e });

  return (
    <div className="space-y-5">
      <Titulo
        area="Agenda"
        titulo="Nossa agenda"
        sub="Compromissos do dia a dia e do casamento, num só lugar"
        acoes={
          <Botao icone={Plus} onClick={() => abrir()}>
            Compromisso
          </Botao>
        }
      />

      {/* Hoje */}
      <section className="avoid-break overflow-hidden rounded-3xl border border-line bg-surface shadow-cartao">
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr]">
          <div className="relative bg-hero p-6 text-hero-ink">
            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full border border-white/10" aria-hidden />
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em] opacity-75">
              <Sun className="h-3.5 w-3.5" /> Hoje
            </div>
            <div className="display num mt-2 text-6xl font-medium leading-none">{hoje.slice(8)}</div>
            <div className="mt-2 text-sm opacity-85">
              {DIAS[d.getDay()]}, {nomeMes(hoje.slice(0, 7)).toLowerCase()}
            </div>
            <div className="mt-4 text-sm opacity-85">{deHoje.length ? `${deHoje.length} compromisso(s)` : "Dia livre"}</div>
          </div>
          <div className="p-3 sm:p-4">
            {deHoje.length ? (
              deHoje.map((i) => <LinhaItem key={i.id} item={i} onAbrir={abrirEv} />)
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 py-6 text-center text-sm text-muted">
                Nada marcado para hoje.
                <Botao variante="secundario" pequeno icone={CalendarPlus} onClick={() => abrir({ data: hoje })}>
                  Marcar algo hoje
                </Botao>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Busca rápida + filtros */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou data (ex.: dentista, 21/11)" className="py-3 pl-10 pr-10" />
          {busca && (
            <button type="button" onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" aria-label="Limpar busca">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <FiltrosAgenda area={area} setArea={setArea} pessoa={pessoa} setPessoa={setPessoa} automaticos={automaticos} setAutomaticos={setAutomaticos} />
      </div>

      {busca.trim() ? (
        <Card titulo={`Resultados para “${busca}”`} icone={Search} acao={<span className="text-xs text-muted">{resultados.length} encontrado(s)</span>}>
          <ListaPorDia itens={resultados} onAbrir={abrirEv} vazio="Nenhum compromisso encontrado." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card titulo="Amanhã" icone={CalendarDays} acao={<span className="text-xs text-muted">{deAmanha.length}</span>}>
            <ListaPorDia itens={deAmanha} onAbrir={abrirEv} vazio="Nada marcado." />
          </Card>
          <Card titulo="Próximos 7 dias" icone={CalendarDays} acao={<span className="text-xs text-muted">{semana.length}</span>}>
            <ListaPorDia itens={semana} onAbrir={abrirEv} vazio="Semana tranquila." />
          </Card>
          <Card titulo="Mais adiante" icone={CalendarDays} className="lg:col-span-2" acao={<Link href="/agenda/calendario" className="text-xs font-medium text-brand">Ver calendário</Link>}>
            <ListaPorDia itens={adiante} onAbrir={abrirEv} vazio="Nada nos próximos 2 meses." />
          </Card>
        </div>
      )}

      <p className="flex items-start gap-2 text-xs text-muted">
        <MessageCircle className="mt-px h-3.5 w-3.5 shrink-0" />
        <span>
          Pelo WhatsApp: <code>agenda</code>, <code>agenda amanhã</code>, <code>marcar sexta 19h dentista</code>, <code>desmarcar dentista</code>, <code>buscar buffet</code>.
        </span>
      </p>
    </div>
  );
}
