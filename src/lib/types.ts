// Tipos centrais do sistema. Todos os registros ficam numa única tabela
// genérica (`registros`) separados por "coleção", então cada tipo abaixo
// corresponde a uma coleção.

export type PessoaId = "p1" | "p2" | "casal";

export type TipoLancamento = "receita" | "despesa" | "guardado";

export interface Configuracoes {
  id: "config";
  nomeP1: string;
  nomeP2: string;
  dataCasamento: string; // YYYY-MM-DD
  orcamentoCasamento: number; // valor total previsto (opcional, se 0 usa soma dos fornecedores)
  reservaInicial: number; // quanto já tinham guardado antes de começar a usar o sistema
  metaMensalGuardar: number; // meta de quanto guardar por mês
  diaPadraoContas: number; // dia do mês das contas fixas (6)
  telefoneP1: string; // para identificar quem mandou no WhatsApp (só dígitos)
  telefoneP2: string;
  /** IDs extras do WhatsApp aprovados em Ajustes (ex.: código interno LID) */
  whatsappExtraP1?: string[];
  whatsappExtraP2?: string[];
  /** mostrar botões de resposta rápida nas mensagens do robô (padrão: sim) */
  whatsappBotoes?: boolean;
  /** grupo de finanças do WhatsApp (jid), registrado com "ativar grupo" */
  grupoWhatsapp?: string;
  /** quando ligado, o robô lê SOMENTE o grupo de finanças e ignora todo o resto */
  whatsappSomenteGrupo?: boolean;
}

export interface Categoria {
  id: string;
  nome: string;
  tipo: TipoLancamento;
  /** nome do ícone (ver ICONES_CATEGORIA); categorias antigas podem não ter */
  icone?: string;
  /** legado: versões antigas usavam emoji */
  emoji?: string;
  casa: boolean; // entra no "custo da casa"
  palavras: string; // palavras-chave separadas por vírgula (usadas no WhatsApp)
}

export interface Lancamento {
  id: string;
  data: string; // YYYY-MM-DD
  tipo: TipoLancamento;
  valor: number;
  categoriaId: string;
  descricao: string;
  pessoa: PessoaId;
  origem: "app" | "whatsapp" | "conta_fixa";
  contaId?: string; // quando gerado ao marcar conta fixa como paga
  mes?: string; // YYYY-MM da conta fixa
  criadoEm: string;
}

export interface ContaFixa {
  id: string;
  nome: string;
  valor: number; // valor previsto
  categoriaId: string;
  dia: number; // dia de vencimento (padrão 6)
  pessoa: PessoaId; // quem paga
  ativa: boolean;
  observacao: string;
}

export interface PagamentoConta {
  id: string; // `${contaId}_${mes}`
  contaId: string;
  mes: string; // YYYY-MM
  pago: boolean;
  valor: number; // valor efetivamente pago
  pagoEm: string; // YYYY-MM-DD
  lancamentoId?: string;
}

export interface Fornecedor {
  id: string;
  nome: string;
  categoria: string; // buffet, fotógrafo...
  contato: string;
  valorTotal: number;
  vencimento: string; // YYYY-MM-DD (prazo para quitar)
  prioridade: 1 | 2 | 3; // 1 = alta
  observacao: string;
}

export interface PagamentoFornecedor {
  id: string;
  fornecedorId: string;
  data: string;
  valor: number;
  observacao: string;
  /** false = pago antes de usar o sistema / com dinheiro de fora da reserva (não desconta da reserva) */
  daReserva?: boolean;
}

export interface Tarefa {
  id: string;
  titulo: string;
  grupo: string; // ex.: Cerimônia, Festa, Documentos
  responsavel: PessoaId;
  prazo: string; // YYYY-MM-DD ou ""
  feita: boolean;
  observacao: string;
  /** criada junto com outras numa lista pelo WhatsApp */
  lote?: string;
}

export type TipoEvento =
  | "reuniao"
  | "prova"
  | "visita"
  | "pagamento"
  | "consulta"
  | "trabalho"
  | "social"
  | "viagem"
  | "lembrete"
  | "outro";

/** "casamento" = organização do casamento; "casal" = dia a dia */
export type AreaEvento = "casamento" | "casal";

export interface Evento {
  id: string;
  titulo: string;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM ou ""
  local: string;
  tipo: TipoEvento;
  observacao: string;
  /** compromissos antigos (antes da Agenda) não têm área: são do casamento */
  area?: AreaEvento;
  /** de quem é o compromisso (padrão: casal) */
  pessoa?: PessoaId;
  origem?: "app" | "whatsapp";
  criadoEm?: string;
  /** marcados juntos numa lista pelo WhatsApp (permite "desfazer tudo") */
  lote?: string;
}

export interface Banco {
  config: Configuracoes;
  categorias: Categoria[];
  lancamentos: Lancamento[];
  contas: ContaFixa[];
  pagamentosContas: PagamentoConta[];
  fornecedores: Fornecedor[];
  pagamentosFornecedores: PagamentoFornecedor[];
  tarefas: Tarefa[];
  eventos: Evento[];
}

export type Colecao = Exclude<keyof Banco, "config"> | "config";

export const COLECOES: Colecao[] = [
  "config",
  "categorias",
  "lancamentos",
  "contas",
  "pagamentosContas",
  "fornecedores",
  "pagamentosFornecedores",
  "tarefas",
  "eventos",
];
