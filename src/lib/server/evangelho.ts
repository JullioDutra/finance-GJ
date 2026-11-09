import "server-only";
import type { Evangelho } from "../evangelho";

// Liturgia diária (CNBB) pela API pública https://github.com/Dancrf/liturgia-diaria (v2).

interface RespostaLiturgia {
  data?: string;
  liturgia?: string;
  leituras?: { evangelho?: { referencia?: string; titulo?: string; texto?: string }[] };
}

/** Evangelho do dia (YYYY-MM-DD). Devolve null se a API não responder ou não tiver o evangelho. */
export async function buscarEvangelho(dia: string): Promise<Evangelho | null> {
  const [ano, mes, d] = dia.split("-");
  try {
    const res = await fetch(`https://liturgia.up.railway.app/v2/?dia=${d}&mes=${mes}&ano=${ano}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("evangelho: API respondeu", res.status);
      return null;
    }
    const j = (await res.json()) as RespostaLiturgia;
    const ev = j.leituras?.evangelho?.[0];
    if (!ev?.texto) return null;
    return { data: j.data ?? "", liturgia: j.liturgia ?? "", referencia: ev.referencia ?? "", titulo: ev.titulo ?? "", texto: ev.texto };
  } catch (e) {
    console.error("evangelho: erro ao buscar", e);
    return null;
  }
}
