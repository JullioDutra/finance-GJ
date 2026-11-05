import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { Banco, Colecao } from "../types";
import { COLECOES } from "../types";
import { bancoVazio, CONFIG_PADRAO } from "../defaults";
import type { Op } from "../ops";

// Dois bancos suportados (o primeiro configurado vence):
//  1. Neon / Postgres  -> DATABASE_URL (criado automaticamente pela integração Neon da Vercel)
//  2. Supabase         -> SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY

const urlPostgres = () => process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
const usaNeon = () => !!urlPostgres();
const usaSupabase = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

// Banco em memória: só para testes locais (GJ_BANCO_MEMORIA=1). Some ao reiniciar o servidor.
const usaMemoria = () => process.env.GJ_BANCO_MEMORIA === "1" && !usaNeon() && !usaSupabase();
const g = globalThis as unknown as { __gjMemoria?: Map<string, { colecao: string; id: string; dados: unknown }> };
const memoria = (g.__gjMemoria ??= new Map());

export function bancoConfigurado(): boolean {
  return usaNeon() || usaSupabase() || usaMemoria();
}

let cliente: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (!cliente) {
    cliente = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cliente;
}

let sqlCache: NeonQueryFunction<false, false> | null = null;
let tabelaPronta: Promise<unknown> | null = null;
/** Conexão com o Neon. Na primeira vez cria a tabela sozinho (não precisa rodar SQL manualmente). */
async function pg(): Promise<NeonQueryFunction<false, false>> {
  if (!sqlCache) sqlCache = neon(urlPostgres());
  const sql = sqlCache;
  if (!tabelaPronta) {
    tabelaPronta = (async () => {
      await sql.query(
        "create table if not exists registros (colecao text not null, id text not null, dados jsonb not null, atualizado_em timestamptz not null default now(), primary key (colecao, id))",
      );
      await sql.query("create index if not exists registros_colecao_idx on registros (colecao)");
    })().catch((e) => {
      tabelaPronta = null;
      throw e;
    });
  }
  await tabelaPronta;
  return sql;
}

const TABELA = "registros";

interface Linha {
  colecao: string;
  id: string;
  dados: unknown;
}

async function lerTudo(): Promise<Linha[]> {
  if (usaMemoria()) return [...memoria.values()].map((l) => ({ ...l, dados: structuredClone(l.dados) }));
  if (usaNeon()) {
    const sql = await pg();
    return (await sql.query("select colecao, id, dados from registros order by colecao, id")) as Linha[];
  }
  const todas: Linha[] = [];
  const passo = 1000;
  for (let de = 0; ; de += passo) {
    const { data, error } = await sb()
      .from(TABELA)
      .select("colecao,id,dados")
      .order("colecao")
      .order("id")
      .range(de, de + passo - 1);
    if (error) throw new Error(`Erro ao ler o banco: ${error.message}`);
    todas.push(...(data as Linha[]));
    if (!data || data.length < passo) break;
  }
  return todas;
}

/** Carrega o banco inteiro. Na primeira vez, grava categorias, tarefas e orçamentos padrão. */
export async function carregarBanco(): Promise<Banco> {
  const linhas = await lerTudo();
  if (!linhas.some((l) => l.colecao === "config")) {
    const inicial = bancoVazio();
    const ops: Op[] = [{ tipo: "upsert", colecao: "config", id: "config", dados: inicial.config }];
    for (const col of COLECOES) {
      if (col === "config") continue;
      for (const r of inicial[col] as { id: string }[]) ops.push({ tipo: "upsert", colecao: col, id: r.id, dados: r });
    }
    await aplicarNoServidor(ops);
    return inicial;
  }
  const b: Banco = {
    config: { ...CONFIG_PADRAO },
    categorias: [],
    lancamentos: [],
    contas: [],
    pagamentosContas: [],
    fornecedores: [],
    pagamentosFornecedores: [],
    tarefas: [],
    eventos: [],
  };
  for (const l of linhas) {
    if (l.colecao === "config") b.config = { ...CONFIG_PADRAO, ...(l.dados as object), id: "config" };
    else if ((COLECOES as string[]).includes(l.colecao)) {
      (b[l.colecao as Exclude<Colecao, "config">] as unknown[]).push({ ...(l.dados as object), id: l.id });
    }
  }
  return b;
}

// ---------- coleções internas (só o servidor lê; nunca vão para o navegador) ----------
export type ColecaoInterna = "_passkeys";

export async function lerInterno<T>(colecao: ColecaoInterna): Promise<T[]> {
  return (await lerTudo()).filter((l) => l.colecao === colecao).map((l) => l.dados as T);
}

export async function gravarInterno(colecao: ColecaoInterna, id: string, dados: object | null): Promise<void> {
  const op = dados ? { tipo: "upsert", colecao, id, dados } : { tipo: "delete", colecao, id };
  await gravar([op as unknown as Op]);
}

export async function aplicarNoServidor(ops: Op[]): Promise<void> {
  await gravar(ops.filter((o) => (COLECOES as string[]).includes(o.colecao)));
}

async function gravar(ops: Op[]): Promise<void> {
  const validas = ops.filter((o) => typeof o.id === "string" && o.id.length > 0 && o.id.length < 600);
  // última operação de cada registro vence
  const finais = new Map<string, Op>();
  for (const o of validas) finais.set(`${o.colecao}\u0000${o.id}`, o);
  const upserts: Linha[] = [];
  const deletes = new Map<string, string[]>();
  for (const o of finais.values()) {
    if (o.tipo === "upsert") upserts.push({ colecao: o.colecao, id: o.id, dados: { ...(o.dados as object), id: o.id } });
    else deletes.set(o.colecao, [...(deletes.get(o.colecao) ?? []), o.id]);
  }
  if (usaMemoria()) {
    for (const u of upserts) memoria.set(`${u.colecao}\u0000${u.id}`, structuredClone(u));
    for (const [colecao, ids] of deletes) for (const id of ids) memoria.delete(`${colecao}\u0000${id}`);
    return;
  }
  if (usaNeon()) {
    const sql = await pg();
    for (let i = 0; i < upserts.length; i += 500) {
      const lote = upserts.slice(i, i + 500);
      await sql.query(
        `insert into registros (colecao, id, dados, atualizado_em)
         select c, i, d::jsonb, now() from unnest($1::text[], $2::text[], $3::text[]) as t(c, i, d)
         on conflict (colecao, id) do update set dados = excluded.dados, atualizado_em = now()`,
        [lote.map((u) => u.colecao), lote.map((u) => u.id), lote.map((u) => JSON.stringify(u.dados))],
      );
    }
    for (const [colecao, ids] of deletes) {
      await sql.query("delete from registros where colecao = $1 and id = any($2::text[])", [colecao, ids]);
    }
    return;
  }
  const agora = new Date().toISOString();
  for (let i = 0; i < upserts.length; i += 500) {
    const lote = upserts.slice(i, i + 500).map((u) => ({ ...u, atualizado_em: agora }));
    const { error } = await sb().from(TABELA).upsert(lote, { onConflict: "colecao,id" });
    if (error) throw new Error(`Erro ao salvar: ${error.message}`);
  }
  for (const [colecao, ids] of deletes) {
    const { error } = await sb().from(TABELA).delete().eq("colecao", colecao).in("id", ids);
    if (error) throw new Error(`Erro ao apagar: ${error.message}`);
  }
}
