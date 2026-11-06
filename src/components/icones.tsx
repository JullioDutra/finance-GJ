import {
  Banknote,
  Bell,
  Briefcase,
  BriefcaseBusiness,
  CakeSlice,
  Camera,
  Car,
  Church,
  Coins,
  CreditCard,
  Droplets,
  Flame,
  Flower2,
  Gem,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Mail,
  MapPin,
  Music,
  Package,
  PartyPopper,
  PiggyBank,
  Pin,
  Plane,
  Scissors,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Sofa,
  Sparkles,
  Stethoscope,
  Tag,
  Users,
  UtensilsCrossed,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { createElement, type ComponentProps } from "react";
import type { Categoria } from "@/lib/types";
import { cx } from "./ui-base";

/** Ícones disponíveis para categorias (o nome é o que fica salvo no banco). */
export const ICONES_CATEGORIA: Record<string, LucideIcon> = {
  casa: House,
  energia: Zap,
  agua: Droplets,
  internet: Wifi,
  gas: Flame,
  mercado: ShoppingCart,
  sofa: Sofa,
  carro: Car,
  comida: UtensilsCrossed,
  saude: HeartPulse,
  lazer: PartyPopper,
  compras: ShoppingBag,
  estudo: GraduationCap,
  cartao: CreditCard,
  alianca: Gem,
  caixa: Package,
  trabalho: Briefcase,
  extra: Sparkles,
  moedas: Coins,
  cofre: PiggyBank,
  presente: Gift,
  viagem: Plane,
  roupa: Shirt,
  beleza: Scissors,
  musica: Music,
  foto: Camera,
  flores: Flower2,
  igreja: Church,
  banco: Landmark,
  dinheiro: Banknote,
  correio: Mail,
  outros: Tag,
};

const PADRAO_POR_ID: Record<string, string> = {
  "cat-aluguel": "casa",
  "cat-energia": "energia",
  "cat-agua": "agua",
  "cat-internet": "internet",
  "cat-gas": "gas",
  "cat-mercado": "mercado",
  "cat-casa": "sofa",
  "cat-transporte": "carro",
  "cat-alimentacao": "comida",
  "cat-saude": "saude",
  "cat-lazer": "lazer",
  "cat-compras": "compras",
  "cat-educacao": "estudo",
  "cat-cartao": "cartao",
  "cat-casamento": "alianca",
  "cat-outros": "caixa",
  "cat-salario": "trabalho",
  "cat-extra": "extra",
  "cat-outras-receitas": "moedas",
  "cat-reserva-casamento": "cofre",
};

/** Desenha o ícone de uma categoria (o componente vem de um mapa estático). */
export function IconeCategoria({ categoria, ...props }: { categoria?: Pick<Categoria, "id" | "icone"> } & ComponentProps<LucideIcon>) {
  return createElement(iconeDaCategoria(categoria), props);
}

export function iconeDaCategoria(c: Pick<Categoria, "id" | "icone"> | undefined): LucideIcon {
  if (!c) return Tag;
  return ICONES_CATEGORIA[c.icone ?? ""] ?? ICONES_CATEGORIA[PADRAO_POR_ID[c.id] ?? ""] ?? Tag;
}

const TONS = {
  despesa: "bg-despesa/12 text-despesa",
  receita: "bg-receita/12 text-receita",
  guardado: "bg-guardado/14 text-guardado",
  neutro: "bg-surface-2 text-muted",
  brand: "bg-brand-soft text-brand",
} as const;

/** Ícone da categoria dentro de um "chip" colorido pelo tipo. */
export function ChipCategoria({ categoria, tamanho = "md", tom }: { categoria?: Categoria; tamanho?: "sm" | "md" | "lg"; tom?: keyof typeof TONS }) {
  const t = tom ?? (categoria?.tipo as keyof typeof TONS) ?? "neutro";
  return (
    <span
      className={cx(
        "grid shrink-0 place-items-center rounded-xl",
        TONS[t] ?? TONS.neutro,
        tamanho === "sm" && "h-7 w-7",
        tamanho === "md" && "h-9 w-9",
        tamanho === "lg" && "h-11 w-11",
      )}
      aria-hidden
    >
      <IconeCategoria categoria={categoria} className={tamanho === "sm" ? "h-3.5 w-3.5" : tamanho === "lg" ? "h-5 w-5" : "h-[18px] w-[18px]"} strokeWidth={1.9} />
    </span>
  );
}

/** Nome da categoria com ícone pequeno, para textos e tabelas. */
export function RotuloCategoria({ categoria, className }: { categoria?: Categoria; className?: string }) {
  return (
    <span className={cx("inline-flex min-w-0 items-center gap-1.5", className)}>
      <IconeCategoria categoria={categoria} className="h-3.5 w-3.5 shrink-0 text-muted" strokeWidth={2} aria-hidden />
      <span className="truncate">{categoria?.nome ?? "Sem categoria"}</span>
    </span>
  );
}

export const ICONES_EVENTO: Record<string, LucideIcon> = {
  reuniao: Users,
  prova: CakeSlice,
  visita: MapPin,
  pagamento: Banknote,
  consulta: Stethoscope,
  trabalho: BriefcaseBusiness,
  social: PartyPopper,
  viagem: Plane,
  lembrete: Bell,
  outro: Pin,
};
