import type { Banco, Categoria, Configuracoes, Tarefa } from "./types";

export const CONFIG_PADRAO: Configuracoes = {
  id: "config",
  nomeP1: "Jullio",
  nomeP2: "Noiva",
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
  { id: "cat-aluguel", nome: "Aluguel / Prestação", tipo: "despesa", emoji: "🏠", casa: true, palavras: "aluguel,prestacao,financiamento,condominio,iptu" },
  { id: "cat-energia", nome: "Energia", tipo: "despesa", emoji: "💡", casa: true, palavras: "luz,energia,enel,cemig,light,copel,celpe,coelba" },
  { id: "cat-agua", nome: "Água", tipo: "despesa", emoji: "🚿", casa: true, palavras: "agua,saneamento,sabesp,copasa,cedae" },
  { id: "cat-internet", nome: "Internet / Celular", tipo: "despesa", emoji: "📶", casa: true, palavras: "internet,wifi,celular,telefone,vivo,claro,tim,oi,plano" },
  { id: "cat-gas", nome: "Gás", tipo: "despesa", emoji: "🔥", casa: true, palavras: "gas,botijao" },
  { id: "cat-mercado", nome: "Mercado", tipo: "despesa", emoji: "🛒", casa: true, palavras: "mercado,supermercado,feira,atacadao,assai,hortifruti,padaria,acougue" },
  { id: "cat-casa", nome: "Itens p/ casa", tipo: "despesa", emoji: "🛋️", casa: true, palavras: "moveis,movel,eletro,decoracao,utensilio,limpeza,casa" },
  // despesas pessoais
  { id: "cat-transporte", nome: "Transporte", tipo: "despesa", emoji: "🚗", casa: false, palavras: "uber,99,gasolina,combustivel,posto,onibus,metro,estacionamento,pedagio,carro" },
  { id: "cat-alimentacao", nome: "Comer fora", tipo: "despesa", emoji: "🍔", casa: false, palavras: "restaurante,lanche,ifood,almoco,jantar,pizza,hamburguer,cafe,bar" },
  { id: "cat-saude", nome: "Saúde", tipo: "despesa", emoji: "💊", casa: false, palavras: "farmacia,remedio,medico,consulta,exame,plano de saude,dentista,academia" },
  { id: "cat-lazer", nome: "Lazer", tipo: "despesa", emoji: "🎉", casa: false, palavras: "cinema,show,viagem,passeio,lazer,netflix,spotify,streaming,jogo" },
  { id: "cat-compras", nome: "Compras pessoais", tipo: "despesa", emoji: "🛍️", casa: false, palavras: "roupa,sapato,shopping,presente,beleza,salao,cabelo" },
  { id: "cat-educacao", nome: "Educação", tipo: "despesa", emoji: "📚", casa: false, palavras: "curso,faculdade,livro,escola,mensalidade" },
  { id: "cat-cartao", nome: "Cartão / Dívidas", tipo: "despesa", emoji: "💳", casa: false, palavras: "cartao,fatura,emprestimo,parcela,divida" },
  { id: "cat-casamento", nome: "Casamento (avulso)", tipo: "despesa", emoji: "💍", casa: false, palavras: "casamento,noivado" },
  { id: "cat-outros", nome: "Outros", tipo: "despesa", emoji: "📦", casa: false, palavras: "" },
  // receitas
  { id: "cat-salario", nome: "Salário", tipo: "receita", emoji: "💼", casa: false, palavras: "salario,pagamento,holerite,adiantamento,vale" },
  { id: "cat-extra", nome: "Renda extra", tipo: "receita", emoji: "✨", casa: false, palavras: "extra,freela,freelance,bico,venda,comissao,bonus,13" },
  { id: "cat-outras-receitas", nome: "Outras receitas", tipo: "receita", emoji: "💰", casa: false, palavras: "pix recebido,reembolso,presente recebido" },
  // guardado
  { id: "cat-reserva-casamento", nome: "Reserva do casamento", tipo: "guardado", emoji: "💒", casa: false, palavras: "guardei,reserva,poupanca,investi,casamento" },
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

export function bancoVazio(): Banco {
  return {
    config: { ...CONFIG_PADRAO },
    categorias: CATEGORIAS_PADRAO.map((c) => ({ ...c })),
    lancamentos: [],
    contas: [],
    pagamentosContas: [],
    fornecedores: [],
    pagamentosFornecedores: [],
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

export const TIPOS_EVENTO: Record<string, { nome: string; emoji: string }> = {
  reuniao: { nome: "Reunião", emoji: "🤝" },
  prova: { nome: "Prova / degustação", emoji: "🍰" },
  visita: { nome: "Visita", emoji: "📍" },
  pagamento: { nome: "Pagamento", emoji: "💸" },
  outro: { nome: "Outro", emoji: "📌" },
};
