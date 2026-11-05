import { parseValor } from "./format";

export function dataPlanilha(s: string): string {
  const t = s.trim();
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${ano}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

const sem = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/**
 * Lê linhas coladas do Excel/Sheets (tab) ou CSV (;). Se houver linha de cabeçalho, as colunas são
 * reconhecidas pelo nome (Categoria, Fornecedor, Valor Total, Pago, Vencimento, Contato — "Restante" é ignorado).
 * Sem cabeçalho, usa a ordem: Categoria · Fornecedor · Valor total · Pago · Quitar até · Contato.
 */
export function lerPlanilha(texto: string) {
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.split(l.includes("\t") ? "\t" : ";").map((c) => c.trim().replace(/^"|"$/g, "")))
    .filter((cols) => cols.some((c) => c));
  let mapa = { categoria: 0, nome: 1, total: 2, pago: 3, vencimento: 4, contato: 5 };
  const iCab = linhas.findIndex((cols) => cols.some((c) => /^(categoria|fornecedor|valor total|nome)$/.test(sem(c))));
  if (iCab >= 0) {
    const cab = linhas[iCab].map(sem);
    const achar = (...nomes: string[]) => cab.findIndex((c) => nomes.some((n) => c === n || c.startsWith(n)));
    mapa = {
      categoria: achar("categoria"),
      nome: achar("fornecedor", "nome"),
      total: achar("valor total", "total", "valor"),
      pago: achar("pago", "valor pago", "ja pago"),
      vencimento: achar("vencimento", "quitar", "data", "ate"),
      contato: achar("contato", "telefone"),
    };
    linhas.splice(0, iCab + 1);
  }
  const col = (cols: string[], i: number) => (i >= 0 ? cols[i] ?? "" : "");
  return linhas
    .map((c) => {
      const categoria = col(c, mapa.categoria) || "Outros";
      return {
        nome: col(c, mapa.nome) || categoria,
        categoria,
        total: parseValor(col(c, mapa.total)) || 0,
        pago: parseValor(col(c, mapa.pago)) || 0,
        vencimento: dataPlanilha(col(c, mapa.vencimento)),
        contato: col(c, mapa.contato),
      };
    })
    .filter((p) => p.nome && p.nome !== "Outros");
}

