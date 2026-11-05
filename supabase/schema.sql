-- Finanças G&J — estrutura do banco (Supabase / Postgres)
-- Rode este script UMA vez no Supabase: Dashboard > SQL Editor > New query > colar > Run.
--
-- Todos os dados ficam numa tabela simples, separados por "colecao"
-- (lancamentos, contas, fornecedores, tarefas...). Isso deixa o sistema
-- fácil de manter e de fazer backup.

create table if not exists public.registros (
  colecao       text        not null,
  id            text        not null,
  dados         jsonb       not null,
  atualizado_em timestamptz not null default now(),
  primary key (colecao, id)
);

create index if not exists registros_colecao_idx on public.registros (colecao);

-- Segurança: o acesso é feito SOMENTE pelo servidor do app (chave service_role).
-- Com RLS ligado e sem políticas, ninguém acessa pela chave pública.
alter table public.registros enable row level security;
