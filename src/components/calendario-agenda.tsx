"use client";

import { useState } from "react";
import { CalendarDays, CalendarPlus, Plus } from "lucide-react";
import { useDados } from "@/lib/store";
import { dataBR, hojeISO, mesAtual, nomeMes } from "@/lib/format";
import { itensAgenda } from "@/lib/agenda";
import type { AreaEvento, Evento } from "@/lib/types";
import { Botao, Card, SeletorMes, Titulo } from "./ui";
import { aplicarFiltros, FiltrosAgenda, GradeMes, LegendaAgenda, ListaPorDia, useAgendaModal, type FiltroArea } from "./agenda";

/** Calendário do mês. Com `areaFixa` vira a agenda só do casamento. */
export function CalendarAgenda({ areaFixa }: { areaFixa?: AreaEvento }) {
  const { banco } = useDados();
  const { abrir } = useAgendaModal();
  const hoje = hojeISO();
  const [mes, setMes] = useState(mesAtual());
  const [dia, setDia] = useState<string | null>(null);
  const [area, setArea] = useState<FiltroArea>(areaFixa ?? "todos");
  const [pessoa, setPessoa] = useState("todos");
  const [automaticos, setAutomaticos] = useState(true);
  const abrirEv = (e: Evento) => abrir({ editar: e });

  const itens = aplicarFiltros(itensAgenda(banco, { hoje }), areaFixa ?? area, pessoa, automaticos);
  const doMes = itens.filter((i) => i.data.startsWith(mes));
  const doDia = dia ? itens.filter((i) => i.data === dia) : [];

  return (
    <div className="space-y-5">
      <Titulo
        area={areaFixa === "casamento" ? "Casamento" : "Agenda"}
        titulo={areaFixa === "casamento" ? "Agenda do casamento" : "Calendário"}
        sub={areaFixa === "casamento" ? "Reuniões, provas, visitas, vencimentos de fornecedores e prazos de tarefas" : "O mês inteiro de vocês dois"}
        acoes={
          <>
            <SeletorMes mes={mes} setMes={setMes} />
            <Botao icone={Plus} onClick={() => abrir({ data: dia ?? hoje, area: areaFixa })}>
              Compromisso
            </Botao>
          </>
        }
      />

      <div className="space-y-2">
        <FiltrosAgenda area={area} setArea={setArea} pessoa={pessoa} setPessoa={setPessoa} automaticos={automaticos} setAutomaticos={setAutomaticos} esconderArea={!!areaFixa} />
        <LegendaAgenda />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <GradeMes mes={mes} itens={itens} dia={dia} setDia={setDia} />
        </Card>
        <Card
          titulo={dia ? dataBR(dia) : `Em ${nomeMes(mes).toLowerCase()}`}
          icone={CalendarDays}
          acao={
            dia && (
              <Botao pequeno variante="secundario" icone={CalendarPlus} onClick={() => abrir({ data: dia, area: areaFixa })}>
                Neste dia
              </Botao>
            )
          }
        >
          <ListaPorDia compacto itens={dia ? doDia : doMes} onAbrir={abrirEv} vazio={dia ? "Nada neste dia." : "Nada marcado neste mês."} />
        </Card>
      </div>
    </div>
  );
}
