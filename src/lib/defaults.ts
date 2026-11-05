import type { Banco, Categoria, Configuracoes, Fornecedor, PagamentoFornecedor, Tarefa } from "./types";

export const CONFIG_PADRAO: Configuracoes = {
  id: "config",
  nomeP1: "Jullio",
  nomeP2: "Gabriella",
  dataCasamento: "",
  orcamentoCasamento: 0,
  reservaInicial: 0,
  metaMensalGuardar: 0,
  diaPadraoContas: 6,
  telefoneP1: "",
  telefoneP2: "",
};

type Cat = Omit<Categoria, "id"> & { id: string };

export const CATEGORIAS_PADRAO: Cat[] = [
  // despesas da casa
  { id: "cat-aluguel", nome: "Aluguel / Prestação", tipo: "despesa", icone: "casa", casa: true, palavras: "aluguel,prestacao,financiamento,condominio,iptu" },
  { id: "cat-energia", nome: "Energia", tipo: "despesa", icone: "energia", casa: true, palavras: "luz,energia,enel,cemig,light,copel,celpe,coelba" },
  { id: "cat-agua", nome: "Água", tipo: "despesa", icone: "agua", casa: true, palavras: "agua,saneamento,sabesp,copasa,cedae" },
  { id: "cat-internet", nome: "Internet / Celular", tipo: "despesa", icone: "internet", casa: true, palavras: "internet,wifi,celular,telefone,vivo,claro,tim,oi,plano" },
  { id: "cat-gas", nome: "Gás", tipo: "despesa", icone: "gas", casa: true, palavras: "gas,botijao" },
  { id: "cat-mercado", nome: "Mercado", tipo: "despesa", icone: "mercado", casa: true, palavras: "mercado,supermercado,feira,atacadao,assai,hortifruti,padaria,acougue" },
  { id: "cat-casa", nome: "Itens p/ casa", tipo: "despesa", icone: "sofa", casa: true, palavras: "moveis,movel,eletro,decoracao,utensilio,limpeza,casa" },
  // despesas pessoais
  { id: "cat-transporte", nome: "Transporte", tipo: "despesa", icone: "carro", casa: false, palavras: "uber,99,gasolina,combustivel,posto,onibus,metro,estacionamento,pedagio,carro" },
  { id: "cat-alimentacao", nome: "Comer fora", tipo: "despesa", icone: "comida", casa: false, palavras: "restaurante,lanche,ifood,almoco,jantar,pizza,hamburguer,cafe,bar" },
  { id: "cat-saude", nome: "Saúde", tipo: "despesa", icone: "saude", casa: false, palavras: "farmacia,remedio,medico,consulta,exame,plano de saude,dentista,academia" },
  { id: "cat-lazer", nome: "Lazer", tipo: "despesa", icone: "lazer", casa: false, palavras: "cinema,show,viagem,passeio,lazer,netflix,spotify,streaming,jogo" },
  { id: "cat-compras", nome: "Compras pessoais", tipo: "despesa", icone: "compras", casa: false, palavras: "roupa,sapato,shopping,presente,beleza,salao,cabelo" },
  { id: "cat-educacao", nome: "Educação", tipo: "despesa", icone: "estudo", casa: false, palavras: "curso,faculdade,livro,escola,mensalidade" },
  { id: "cat-cartao", nome: "Cartão / Dívidas", tipo: "despesa", icone: "cartao", casa: false, palavras: "cartao,fatura,emprestimo,parcela,divida" },
  { id: "cat-casamento", nome: "Casamento (avulso)", tipo: "despesa", icone: "alianca", casa: false, palavras: "casamento,noivado" },
  { id: "cat-outros", nome: "Outros", tipo: "despesa", icone: "caixa", casa: false, palavras: "" },
  // receitas
  { id: "cat-salario", nome: "Salário", tipo: "receita", icone: "trabalho", casa: false, palavras: "salario,pagamento,holerite,adiantamento,vale" },
  { id: "cat-extra", nome: "Renda extra", tipo: "receita", icone: "extra", casa: false, palavras: "extra,freela,freelance,bico,venda,comissao,bonus,13" },
  { id: "cat-outras-receitas", nome: "Outras receitas", tipo: "receita", icone: "moedas", casa: false, palavras: "pix recebido,reembolso,presente recebido" },
  // guardado
  { id: "cat-reserva-casamento", nome: "Reserva do casamento", tipo: "guardado", icone: "cofre", casa: false, palavras: "guardei,reserva,poupanca,investi,casamento" },
];

const t = (id: string, titulo: string, grupo: string): Tarefa => ({
  id,
  titulo,
  grupo,
  responsavel: "casal",
  prazo: "",
  feita: false,
  observacao: "",
});

export const TAREFAS_PADRAO: Tarefa[] = [
  t("tf-01", "Definir orçamento total do casamento", "Planejamento"),
  t("tf-02", "Definir lista de convidados (rascunho)", "Planejamento"),
  t("tf-03", "Escolher e reservar local da cerimônia", "Cerimônia"),
  t("tf-04", "Escolher e reservar local da festa", "Festa"),
  t("tf-05", "Contratar buffet", "Festa"),
  t("tf-06", "Contratar fotógrafo / filmagem", "Fornecedores"),
  t("tf-07", "Contratar decoração e flores", "Fornecedores"),
  t("tf-08", "Contratar DJ / banda", "Festa"),
  t("tf-09", "Escolher padrinhos e madrinhas", "Cerimônia"),
  t("tf-10", "Dar entrada nos documentos do cartório", "Documentos"),
  t("tf-11", "Vestido da noiva", "Trajes"),
  t("tf-12", "Traje do noivo", "Trajes"),
  t("tf-13", "Alianças", "Cerimônia"),
  t("tf-14", "Convites / save the date", "Convidados"),
  t("tf-15", "Lista de presentes", "Convidados"),
  t("tf-16", "Bolo e doces", "Festa"),
  t("tf-17", "Confirmar presença dos convidados (RSVP)", "Convidados"),
  t("tf-18", "Prova final de trajes", "Trajes"),
  t("tf-19", "Reunião final com fornecedores", "Fornecedores"),
  t("tf-20", "Lua de mel", "Pós-casamento"),
];

// Orçamentos da planilha do casal ("Orçamentos.pdf"): categoria, fornecedor, total, já pago.
// Quando não há fornecedor definido, o nome usa a categoria.
const PLANILHA_ORCAMENTOS: [string, string, number, number][] = [
  ["Decoração", "GM Flores", 4500, 1350],
  ["Fotos / Vídeo", "Ravo Fotos", 6800, 2040],
  ["Dia da Noiva", "Kenya Botelho", 2450, 735],
  ["Cartório", "", 800, 0],
  ["Cerimonial", "Grazy", 2000, 600],
  ["Convites", "", 200, 200],
  ["Viagem / Lua de Mel", "", 5000, 5000],
  ["Caixa Padrinhos", "Diversos", 1000, 1000],
  ["Paróquia", "São José Operário", 1300, 200],
  ["Terno", "", 350, 0],
  ["Bem casado (Doces)", "", 300, 300],
  ["Time de Canto", "", 900, 0],
  ["Porta alianças", "", 150, 150],
  ["Buquê", "", 600, 0],
  ["Lapela", "", 0, 0],
];

/** Fornecedores e pagamentos já feitos da planilha de orçamentos (pagos antes do app = fora da reserva). */
export function orcamentoInicial(): { fornecedores: Fornecedor[]; pagamentos: PagamentoFornecedor[] } {
  const fornecedores: Fornecedor[] = [];
  const pagamentos: PagamentoFornecedor[] = [];
  PLANILHA_ORCAMENTOS.forEach(([categoria, nome, total, pago], i) => {
    const id = `forn-${String(i + 1).padStart(2, "0")}`;
    fornecedores.push({ id, nome: nome || categoria, categoria, contato: "", valorTotal: total, vencimento: "", prioridade: 2, observacao: "" });
    if (pago > 0) {
      pagamentos.push({ id: `${id}-pg-inicial`, fornecedorId: id, data: "2026-11-05", valor: pago, observacao: "Já pago (planilha de orçamentos)", daReserva: false });
    }
  });
  return { fornecedores, pagamentos };
}

export function bancoVazio(): Banco {
  return {
    config: { ...CONFIG_PADRAO },
    categorias: CATEGORIAS_PADRAO.map((c) => ({ ...c })),
    lancamentos: [],
    contas: [],
    pagamentosContas: [],
    fornecedores: orcamentoInicial().fornecedores,
    pagamentosFornecedores: orcamentoInicial().pagamentos,
    tarefas: TAREFAS_PADRAO.map((x) => ({ ...x })),
    eventos: [],
  };
}

export const GRUPOS_TAREFAS = [
  "Planejamento",
  "Cerimônia",
  "Festa",
  "Fornecedores",
  "Trajes",
  "Convidados",
  "Documentos",
  "Pós-casamento",
  "Outros",
];

export const CATEGORIAS_FORNECEDOR = [
  "Decoração",
  "Fotos / Vídeo",
  "Dia da Noiva",
  "Cartório",
  "Cerimonial",
  "Paróquia",
  "Convites",
  "Viagem / Lua de Mel",
  "Caixa Padrinhos",
  "Terno",
  "Bem casado (Doces)",
  "Time de Canto",
  "Porta alianças",
  "Buquê",
  "Lapela",
  "Local / Espaço",
  "Buffet",
  "Bebidas",
  "Fotografia",
  "Filmagem",
  "Decoração",
  "Flores",
  "Música / DJ",
  "Bolo e doces",
  "Vestido",
  "Traje do noivo",
  "Beleza",
  "Cerimonialista",
  "Convites",
  "Alianças",
  "Lembrancinhas",
  "Lua de mel",
  "Outros",
];

export const TIPOS_EVENTO: Record<string, { nome: string }> = {
  reuniao: { nome: "Reunião" },
  prova: { nome: "Prova / degustação" },
  visita: { nome: "Visita" },
  pagamento: { nome: "Pagamento" },
  outro: { nome: "Outro" },
};
