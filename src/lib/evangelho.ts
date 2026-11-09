// Evangelho do dia (liturgia católica) no WhatsApp. Só formatação; a busca fica em server/evangelho.ts.

import { cartao } from "./whatsapp-modelos";

export interface Evangelho {
  data: string; // dd/mm/aaaa
  liturgia: string;
  referencia: string;
  titulo: string;
  texto: string;
}

const LIMITE = 3500;

/** Limpa o texto vindo da API: espaços, quebras e marcações soltas. */
export function limparTextoLiturgia(t: string): string {
  return t
    .replace(/\r/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function textoEvangelho(e: Evangelho): string {
  let texto = limparTextoLiturgia(e.texto);
  if (texto.length > LIMITE) texto = texto.slice(0, texto.lastIndexOf(" ", LIMITE)) + "…";
  return cartao(
    "*Evangelho do dia*",
    [e.liturgia ? `_${limparTextoLiturgia(e.liturgia)}_` : null, "", `*${limparTextoLiturgia(e.referencia)}*`, e.titulo ? limparTextoLiturgia(e.titulo) : null, "", texto],
    "Palavra da Salvação",
  );
}
