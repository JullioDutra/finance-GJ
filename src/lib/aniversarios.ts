// Aniversários: datas que se repetem todo ano. Funções puras (site, WhatsApp e "bom dia").

import type { Aniversario, Banco } from "./types";
import { diasEntre, semAcento } from "./format";

const bissexto = (a: number) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;

/** Data (YYYY-MM-DD) do aniversário num ano. 29/02 vira 28/02 nos anos não bissextos. */
export function dataNoAno(a: Pick<Aniversario, "data">, ano: number): string {
  const md = a.data === "02-29" && !bissexto(ano) ? "02-28" : a.data;
  return `${ano}-${md}`;
}

/** Próxima data do aniversário a partir de hoje (inclusive). */
export function proximaData(a: Pick<Aniversario, "data">, hoje: string): string {
  const ano = Number(hoje.slice(0, 4));
  const d = dataNoAno(a, ano);
  return d >= hoje ? d : dataNoAno(a, ano + 1);
}

/** Idade que a pessoa completa na data informada (se o ano for conhecido). */
export function idadeEm(a: Pick<Aniversario, "ano">, dataIso: string): number | null {
  if (!a.ano || a.ano < 1900) return null;
  const idade = Number(dataIso.slice(0, 4)) - a.ano;
  return idade > 0 && idade < 130 ? idade : null;
}

export interface ProximoAniversario {
  aniversario: Aniversario;
  data: string;
  dias: number; // 0 = hoje
  idade: number | null;
}

/** Aniversários dos próximos `dias` dias (0 = só hoje), do mais próximo ao mais distante. */
export function proximosAniversarios(b: Banco, hoje: string, dias = 366): ProximoAniversario[] {
  return (b.aniversarios ?? [])
    .map((a) => {
      const data = proximaData(a, hoje);
      return { aniversario: a, data, dias: diasEntre(hoje, data), idade: idadeEm(a, data) };
    })
    .filter((p) => p.dias <= dias)
    .sort((x, y) => x.dias - y.dias || x.aniversario.nome.localeCompare(y.aniversario.nome));
}

/** "15/03" ou "15/03/1990" -> { data: "03-15", ano? } */
export function lerDataAniversario(t: string): { data: string; ano?: number } | null {
  const m = t.trim().match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1]) return null;
  let ano = m[3] ? Number(m[3]) : undefined;
  if (ano !== undefined && ano < 100) ano += ano > 30 ? 1900 : 2000;
  return { data: `${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`, ...(ano ? { ano } : {}) };
}

export const RELACOES = ["Família", "Amigos", "Trabalho", "Igreja", "Faculdade", "Outros"];

/** Adivinha a relação pelo texto ("tia Ana" -> Família). */
export function relacaoPorTexto(t: string): string {
  const n = ` ${semAcento(t)} `;
  if (/ (mae|pai|vo|vovo|avo|tia|tio|prima|primo|irma|irmao|sogra|sogro|cunhada|cunhado|madrinha|padrinho|afilhad[ao]|sobrinh[ao]|filh[ao]|familia) /.test(n)) return "Família";
  if (/ (chefe|colega|trabalho|empresa) /.test(n)) return "Trabalho";
  if (/ (pastor|pastora|igreja|padre) /.test(n)) return "Igreja";
  return "Amigos";
}

export const textoIdade = (idade: number | null) => (idade ? `${idade} anos` : "");
