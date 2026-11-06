// Agenda compartilhada do casal: compromissos (eventos) + prazos automáticos
// (contas do dia 6, fornecedores, tarefas e o dia do casamento).
// Funções puras, usadas pelo site e pelo WhatsApp.

import type { AreaEvento, Banco, Evento, PessoaId, TipoEvento } from "./types";
import { contasDoMes } from "./calc";
import { isoDe, mesDe, semAcento, somarMeses } from "./format";

export type TipoItemAgenda = "evento" | "fornecedor" | "tarefa" | "conta" | "casamento";

export interface ItemAgenda {
  id: string;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM ou ""
  titulo: string;
  sub: string;
  tipo: TipoItemAgenda;
  area: AreaEvento;
  pessoa: PessoaId;
  evento?: Evento;
}

export const areaDoEvento = (e: Evento): AreaEvento => e.area ?? "casamento";

export function itensAgenda(b: Banco, opts: { automaticos?: boolean; hoje?: string } = {}): ItemAgenda[] {
  const automaticos = opts.automaticos ?? true;
  const itens: ItemAgenda[] = b.eventos.map((e) => ({
    id: e.id,
    data: e.data,
    hora: e.hora,
    titulo: e.titulo,
    sub: [e.local, e.observacao].filter(Boolean).join(" · "),
    tipo: "evento",
    area: areaDoEvento(e),
    pessoa: e.pessoa ?? "casal",
    evento: e,
  }));
  if (automaticos) {
    for (const f of b.fornecedores.filter((x) => x.vencimento)) {
      itens.push({ id: `f-${f.id}`, data: f.vencimento, hora: "", titulo: `Quitar ${f.nome}`, sub: f.categoria, tipo: "fornecedor", area: "casamento", pessoa: "casal" });
    }
    for (const t of b.tarefas.filter((x) => x.prazo && !x.feita)) {
      itens.push({ id: `t-${t.id}`, data: t.prazo, hora: "", titulo: t.titulo, sub: `prazo da tarefa · ${t.grupo}`, tipo: "tarefa", area: "casamento", pessoa: t.responsavel });
    }
    if (b.config.dataCasamento) {
      itens.push({ id: "casamento", data: b.config.dataCasamento, hora: "", titulo: "Nosso casamento", sub: "", tipo: "casamento", area: "casamento", pessoa: "casal" });
    }
    // contas fixas não pagas: do mês passado até 3 meses à frente
    const base = mesDe(opts.hoje ?? isoDe(new Date()));
    for (let i = -1; i <= 3; i++) {
      const mes = somarMeses(base, i);
      for (const c of contasDoMes(b, mes, opts.hoje ?? isoDe(new Date())).filter((x) => !x.pago)) {
        itens.push({ id: `c-${c.conta.id}-${mes}`, data: c.vencimento, hora: "", titulo: `Pagar ${c.conta.nome}`, sub: "conta do dia " + c.conta.dia, tipo: "conta", area: "casal", pessoa: c.conta.pessoa });
      }
    }
  }
  return itens.sort((a, b) => (a.data + (a.hora || "99")).localeCompare(b.data + (b.hora || "99")) || a.titulo.localeCompare(b.titulo));
}

/** Busca sem acento por título, local, observação e tipo. */
export function buscarNaAgenda(itens: ItemAgenda[], termo: string): ItemAgenda[] {
  const palavras = semAcento(termo).split(/\s+/).filter(Boolean);
  if (!palavras.length) return [];
  return itens.filter((i) => {
    const alvo = semAcento(`${i.titulo} ${i.sub} ${i.evento?.tipo ?? i.tipo}`);
    return palavras.every((p) => alvo.includes(p));
  });
}

// ---------------- leitura de datas e horas (WhatsApp) ----------------

const DIAS_SEMANA = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];

function somarDias(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return isoDe(d);
}

/**
 * Procura uma data no começo/meio do texto: hoje, amanhã, depois de amanhã, dia da semana
 * ("sexta", "sexta-feira"), "15/11", "15/11/2027", "dia 15". Devolve a data e o texto sem ela.
 */
export function extrairData(texto: string, hoje: string): { data: string | null; resto: string } {
  const tokens = texto.split(/\s+/).filter(Boolean);
  const n = tokens.map((t) => semAcento(t).replace(/[,.;]$/, ""));
  for (let i = 0; i < n.length; i++) {
    const t = n[i];
    let data: string | null = null;
    let consumidos = 1;
    if (t === "hoje") data = hoje;
    else if (t === "amanha") data = somarDias(hoje, 1);
    else if (t === "depois" && n[i + 1] === "de" && n[i + 2] === "amanha") {
      data = somarDias(hoje, 2);
      consumidos = 3;
    } else if (/^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(t)) {
      const [d, m, a] = t.split("/");
      let ano = a ? (a.length === 2 ? 2000 + Number(a) : Number(a)) : Number(hoje.slice(0, 4));
      let iso = `${ano}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      if (!a && iso < hoje) {
        ano += 1; // "15/01" em novembro = ano que vem
        iso = `${ano}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }
      data = iso;
    } else if (t === "dia" && /^\d{1,2}$/.test(n[i + 1] ?? "")) {
      const dia = Number(n[i + 1]);
      let mes = mesDe(hoje);
      if (dia < Number(hoje.slice(8))) mes = somarMeses(mes, 1);
      data = `${mes}-${String(dia).padStart(2, "0")}`;
      consumidos = 2;
    } else {
      const base = t.replace(/-feira$/, "");
      const idx = DIAS_SEMANA.indexOf(base);
      if (idx >= 0) {
        const atual = new Date(hoje + "T12:00:00").getDay();
        let dif = (idx - atual + 7) % 7;
        if (dif === 0) dif = 7; // "sexta" dito numa sexta = a próxima
        data = somarDias(hoje, dif);
        if (n[i + 1] === "feira") consumidos = 2;
      }
    }
    if (data) {
      // tira também "no"/"na"/"em"/"para" antes da data
      const inicio = i > 0 && ["no", "na", "em", "para", "pra", "de", "do"].includes(n[i - 1]) ? i - 1 : i;
      const resto = [...tokens.slice(0, inicio), ...tokens.slice(i + consumidos)].join(" ");
      return { data, resto };
    }
  }
  return { data: null, resto: texto };
}

/** Procura uma hora: 19h, 19h30, 19:30, 9am não. Devolve "HH:MM". */
export function extrairHora(texto: string): { hora: string; resto: string } {
  const tokens = texto.split(/\s+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    const t = semAcento(tokens[i]).replace(/[,.;]$/, "");
    const m = t.match(/^(\d{1,2})(?:h(\d{2})?|:(\d{2})h?)$/) ?? t.match(/^(\d{1,2})(h)$/);
    if (m) {
      const h = Number(m[1]);
      const min = Number(m[2] ?? m[3] ?? 0) || 0;
      if (h <= 23 && min <= 59) {
        const antes = semAcento(tokens[i - 1] ?? "");
        const inicio = i > 0 && ["as", "a", "às"].includes(antes) ? i - 1 : i;
        return { hora: `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`, resto: [...tokens.slice(0, inicio), ...tokens.slice(i + 1)].join(" ") };
      }
    }
  }
  return { hora: "", resto: texto };
}

const PALAVRAS_CASAMENTO = [
  "casamento", "buffet", "vestido", "noiva", "noivo", "terno", "cerimonial", "cerimonialista", "fotografo", "foto", "filmagem",
  "decoracao", "flores", "buque", "igreja", "paroquia", "padre", "cartorio", "convite", "convites", "degustacao", "bolo",
  "doces", "bem casado", "aliancas", "alianca", "dj", "banda", "padrinhos", "madrinhas", "lua de mel", "festa", "salao",
];

const TIPO_POR_PALAVRA: [string[], TipoEvento][] = [
  [["medico", "medica", "dentista", "consulta", "exame", "terapia", "psicologo", "fisioterapia", "vacina"], "consulta"],
  [["reuniao", "call", "conversa"], "reuniao"],
  [["prova", "degustacao", "provar"], "prova"],
  [["visita", "visitar", "conhecer"], "visita"],
  [["pagar", "pagamento", "boleto", "parcela"], "pagamento"],
  [["aniversario", "niver", "festa", "churrasco", "jantar", "almoco", "cha"], "social"],
  [["viagem", "voo", "aeroporto", "hotel"], "viagem"],
  [["trabalho", "aula", "prova da faculdade", "curso", "plantao"], "trabalho"],
  [["lembrar", "lembrete"], "lembrete"],
];

export function areaPorTitulo(titulo: string): AreaEvento {
  const t = ` ${semAcento(titulo)} `;
  return PALAVRAS_CASAMENTO.some((p) => t.includes(` ${p}`)) ? "casamento" : "casal";
}

export function tipoPorTitulo(titulo: string): TipoEvento {
  const t = ` ${semAcento(titulo)} `;
  for (const [palavras, tipo] of TIPO_POR_PALAVRA) if (palavras.some((p) => t.includes(` ${p}`))) return tipo;
  return "outro";
}

/** Rótulo curto de dia: "hoje", "amanhã", "sex, 15/11". */
export function rotuloDia(iso: string, hoje: string): string {
  if (iso === hoje) return "hoje";
  if (iso === somarDias(hoje, 1)) return "amanhã";
  const d = new Date(iso + "T12:00:00");
  const sem = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d.getDay()];
  return `${sem}, ${iso.slice(8)}/${iso.slice(5, 7)}${iso.slice(0, 4) !== hoje.slice(0, 4) ? "/" + iso.slice(2, 4) : ""}`;
}

export { somarDias };
