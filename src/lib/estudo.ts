// Lembrete da noite para estudar para os concursos (WhatsApp).

import { cartao } from "./whatsapp-modelos";

const FRASES = [
  "Um pouco todo dia vence muito de vez em quando.",
  "A aprovação é construída nas noites em que ninguém está vendo.",
  "Constância é melhor que intensidade. Só não deixem o dia passar em branco.",
  "Cada questão resolvida hoje é uma a menos na prova.",
  "Quem estuda cansado ainda está na frente de quem não estudou.",
  "Revisão de hoje é memória de amanhã.",
  "O edital não muda; a preparação de vocês, sim.",
  "Disciplina é lembrar do objetivo quando a vontade acaba.",
  "Uma hora focada vale mais que três distraídas.",
  "Não precisa ser perfeito, precisa ser feito.",
  "A vaga é de quem continua.",
  "Pequenos blocos, grande resultado.",
  "Hoje é um bom dia para fazer aquela lista de exercícios.",
  "O cansaço passa; a aprovação fica.",
];

const DICAS = [
  "Celular longe, cronômetro de 50 minutos e 10 de pausa.",
  "Comecem pela matéria que mais trava. Depois fica fácil.",
  "Façam 20 questões da matéria de hoje e anotem os erros.",
  "Revisem rapidinho o que estudaram ontem antes de seguir.",
  "Escolham um tópico só e terminem ele.",
  "Leiam a lei seca do tópico e grifem as palavras-chave.",
  "Expliquem um para o outro o que aprenderam: fixa muito mais.",
];

export function textoEstudo(hoje: string): string {
  const d = new Date(hoje + "T12:00:00");
  const diaDoAno = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000);
  return cartao(
    "*Hora de estudar para os concursos*",
    [FRASES[diaDoAno % FRASES.length], "", `_Dica de hoje:_ ${DICAS[diaDoAno % DICAS.length]}`],
    "Bons estudos!",
  );
}
