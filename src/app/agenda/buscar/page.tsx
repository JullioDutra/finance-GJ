"use client";

import { useState } from "react";
import { History, Search, X } from "lucide-react";
import { useDados } from "@/lib/store";
import { hojeISO } from "@/lib/format";
import { buscarNaAgenda, itensAgenda } from "@/lib/agenda";
import type { Evento } from "@/lib/types";
import { Card, cx, Input, Titulo, Vazio } from "@/components/ui";
import { aplicarFiltros, FiltrosAgenda, ListaPorDia, useAgendaModal, type FiltroArea } from "@/components/agenda";

const SUGESTOES = ["amanhã", "sábado", "dezembro", "faculdade", "igreja", "buffet"];

export default function AgendaBuscar() {
  const { banco } = useDados();
  const { abrir } = useAgendaModal();
  const hoje = hojeISO();
  const [busca, setBusca] = useState("");
  const [area, setArea] = useState<FiltroArea>("todos");
  const [pessoa, setPessoa] = useState("todos");
  const [automaticos, setAutomaticos] = useState(true);
  const abrirEv = (e: Evento) => abrir({ editar: e });

  const itens = aplicarFiltros(itensAgenda(banco, { hoje }), area, pessoa, automaticos);
  const achados = busca.trim() ? buscarNaAgenda(itens, busca, hoje) : [];
  const futuros = achados.filter((i) => i.data >= hoje);
  const passados = achados.filter((i) => i.data < hoje).reverse();

  return (
    <div className="space-y-5">
      <Titulo area="Agenda" titulo="Buscar" sub="Por nome, local, observação ou data (21/11, sábado, amanhã, dezembro)" />
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <Input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Palavra ou data (ex.: dentista, 21/11, sábado, dezembro)" className="py-3.5 pl-12 pr-10 text-lg" />
          {busca && (
            <button type="button" onClick={() => setBusca("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted" aria-label="Limpar">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {!busca && (
          <div className="flex flex-wrap gap-1.5">
            {SUGESTOES.map((s) => (
              <button key={s} type="button" onClick={() => setBusca(s)} className={cx("rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-muted hover:border-brand hover:text-brand")}>
                {s}
              </button>
            ))}
          </div>
        )}
        <FiltrosAgenda area={area} setArea={setArea} pessoa={pessoa} setPessoa={setPessoa} automaticos={automaticos} setAutomaticos={setAutomaticos} />
      </div>

      {!busca.trim() ? (
        <Vazio icone={Search}>Digite uma palavra para procurar nos compromissos de vocês.</Vazio>
      ) : !achados.length ? (
        <Vazio icone={Search}>Nada encontrado para “{busca}”.</Vazio>
      ) : (
        <>
          <Card titulo="Próximos" icone={Search} acao={<span className="text-xs text-muted">{futuros.length}</span>}>
            <ListaPorDia itens={futuros} onAbrir={abrirEv} vazio="Nenhum compromisso futuro." />
          </Card>
          {passados.length > 0 && (
            <Card titulo="Já passaram" icone={History} acao={<span className="text-xs text-muted">{passados.length}</span>}>
              <ListaPorDia itens={passados} onAbrir={abrirEv} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
