const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function dinheiro(v: number): string {
  return brl.format(Number.isFinite(v) ? v : 0);
}

export function dinheiroCurto(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (a >= 10_000) return `R$ ${(v / 1000).toFixed(0)} mil`;
  if (a >= 1000) return `R$ ${(v / 1000).toFixed(1).replace(".", ",")} mil`;
  return `R$ ${v.toFixed(0)}`;
}

export function pct(v: number, casas = 0): string {
  if (!Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(casas).replace(".", ",")}%`;
}

/** Converte "1.234,56", "1234.56", "R$ 45,9" etc. em número. */
export function parseValor(txt: string): number {
  let s = String(txt).replace(/[R$\s]/gi, "").trim();
  if (!s) return NaN;
  const temVirgula = s.includes(",");
  const temPonto = s.includes(".");
  if (temVirgula && temPonto) {
    // o último separador é o decimal
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (temVirgula) {
    s = s.replace(",", ".");
  } else if (temPonto) {
    // "1.500" = mil e quinhentos; "45.90" = decimal
    const partes = s.split(".");
    if (partes.length > 2 || partes[partes.length - 1].length === 3) s = s.replace(/\./g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

// ---------- datas ----------

export function hojeISO(): string {
  const d = new Date();
  return isoDe(d);
}

export function isoDe(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}

export function mesAtual(): string {
  return hojeISO().slice(0, 7);
}

export function mesDe(dataISO: string): string {
  return dataISO.slice(0, 7);
}

export function somarMeses(mes: string, n: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Lista de meses terminando em `fim` (inclusive), com `qtd` itens. */
export function ultimosMeses(fim: string, qtd: number): string[] {
  const r: string[] = [];
  for (let i = qtd - 1; i >= 0; i--) r.push(somarMeses(fim, -i));
  return r;
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function nomeMes(mes: string, curto = false): string {
  const [y, m] = mes.split("-").map(Number);
  const n = MESES[m - 1] ?? "";
  if (curto) return `${n.slice(0, 3)}/${String(y).slice(2)}`;
  return `${n.charAt(0).toUpperCase()}${n.slice(1)} de ${y}`;
}

export function dataBR(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function dataCurta(iso: string): string {
  if (!iso) return "—";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function diasEntre(deISO: string, ateISO: string): number {
  const a = new Date(deISO + "T12:00:00");
  const b = new Date(ateISO + "T12:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Número de meses (fracionado por mês cheio) entre o mês atual e o mês do casamento, incluindo o atual. */
export function mesesAte(mesInicio: string, mesFim: string): number {
  const [y1, m1] = mesInicio.split("-").map(Number);
  const [y2, m2] = mesFim.split("-").map(Number);
  return (y2 - y1) * 12 + (m2 - m1) + 1;
}

export function novoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
