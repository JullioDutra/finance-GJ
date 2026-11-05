"use client";

import { useEffect, useRef, useState } from "react";
import { dinheiro, dinheiroCurto } from "@/lib/format";
import { cx } from "./ui";

/** Mede a largura real do container, para o texto do gráfico ficar sempre legível. */
function useLargura(padrao = 640) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(padrao);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export interface Serie {
  nome: string;
  cor: string; // var(--receita) etc.
  valores: number[];
}

function escalaMax(max: number): number {
  if (max <= 0) return 100;
  const mag = 10 ** Math.floor(Math.log10(max));
  const passos = [1, 2, 2.5, 5, 10];
  for (const p of passos) if (p * mag >= max) return p * mag;
  return 10 * mag;
}

export function Legenda({ itens }: { itens: { nome: string; cor: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {itens.map((i) => (
        <span key={i.nome} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: i.cor }} aria-hidden />
          {i.nome}
        </span>
      ))}
    </div>
  );
}

/** Barras agrupadas por mês (receita x gasto x guardado). */
export function BarrasMensais({ rotulos, series, altura = 200 }: { rotulos: string[]; series: Serie[]; altura?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const [ref, W] = useLargura();
  const H = altura;
  const pad = { t: 10, r: 8, b: 26, l: 64 };
  const max = escalaMax(Math.max(0, ...series.flatMap((s) => s.valores)));
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const grupo = iw / rotulos.length;
  const gap = 2;
  const larguraBarra = Math.min(22, (grupo * 0.7 - gap * (series.length - 1)) / series.length);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);

  return (
    <div className="relative" ref={ref}>
      <Legenda itens={series} />
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label={`Gráfico de barras: ${series.map((s) => s.nome).join(", ")} por mês`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)" className="num">
              {dinheiroCurto(t)}
            </text>
          </g>
        ))}
        {rotulos.map((r, i) => {
          const x0 = pad.l + grupo * i + (grupo - (larguraBarra * series.length + gap * (series.length - 1))) / 2;
          return (
            <g key={r} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(hover === i ? null : i)}>
              <rect x={pad.l + grupo * i} y={pad.t} width={grupo} height={ih} fill={hover === i ? "var(--surface-2)" : "transparent"} />
              {series.map((s, j) => {
                const v = s.valores[i] ?? 0;
                const h = Math.max(0, (v / max) * ih);
                const x = x0 + j * (larguraBarra + gap);
                const rr = Math.min(4, larguraBarra / 2, h);
                return v > 0 ? (
                  <path
                    key={s.nome}
                    d={`M${x},${pad.t + ih} V${pad.t + ih - h + rr} Q${x},${pad.t + ih - h} ${x + rr},${pad.t + ih - h} H${x + larguraBarra - rr} Q${x + larguraBarra},${pad.t + ih - h} ${x + larguraBarra},${pad.t + ih - h + rr} V${pad.t + ih} Z`}
                    fill={s.cor}
                  />
                ) : null;
              })}
              <text x={pad.l + grupo * i + grupo / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--muted)">
                {r}
              </text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-6 z-10 rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-lg"
          style={{ left: `clamp(0px, calc(${((pad.l + grupo * hover + grupo / 2) / W) * 100}% - 70px), calc(100% - 150px))` }}
        >
          <div className="mb-1 font-semibold">{rotulos[hover]}</div>
          {series.map((s) => (
            <div key={s.nome} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-muted">
                <span className="h-2 w-2 rounded-sm" style={{ background: s.cor }} />
                {s.nome}
              </span>
              <span className="num font-medium">{dinheiro(s.valores[hover] ?? 0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Linha única (ex.: custo da casa mês a mês). */
export function Linha({ rotulos, valores, cor = "var(--brand)", altura = 180, nome }: { rotulos: string[]; valores: number[]; cor?: string; altura?: number; nome: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const [ref, W] = useLargura();
  const H = altura;
  const pad = { t: 16, r: 28, b: 26, l: 64 };
  const max = escalaMax(Math.max(0, ...valores));
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const passo = rotulos.length > 1 ? iw / (rotulos.length - 1) : 0;
  const x = (i: number) => pad.l + (rotulos.length > 1 ? passo * i : iw / 2);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const d = valores.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  const ticks = [0, 0.5, 1].map((f) => f * max);
  return (
    <div className="relative" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Gráfico de linha: ${nome}`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">
              {dinheiroCurto(t)}
            </text>
          </g>
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="var(--muted)" strokeDasharray="3 3" />}
        <path d={d} fill="none" stroke={cor} strokeWidth={2} strokeLinejoin="round" />
        {valores.map((v, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(v)} r={hover === i ? 5 : 4} fill={cor} stroke="var(--surface)" strokeWidth={2} />
            <rect
              x={x(i) - (passo || iw) / 2}
              y={pad.t}
              width={passo || iw}
              height={ih}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onClick={() => setHover(i)}
            />
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--muted)">
              {rotulos[i]}
            </text>
          </g>
        ))}
        {valores.length > 0 && hover === null && (
          <text x={x(valores.length - 1)} y={y(valores[valores.length - 1]) - 10} textAnchor="end" fontSize={12} fontWeight={600} fill="var(--ink)">
            {dinheiro(valores[valores.length - 1])}
          </text>
        )}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-lg"
          style={{ left: `clamp(0px, calc(${(x(hover) / W) * 100}% - 60px), calc(100% - 130px))` }}
        >
          <div className="font-semibold">{rotulos[hover]}</div>
          <div className="num">{dinheiro(valores[hover])}</div>
          {hover > 0 && valores[hover - 1] > 0 && (
            <div className={cx("num", valores[hover] > valores[hover - 1] ? "text-danger" : "text-ok")}>
              {valores[hover] >= valores[hover - 1] ? "+" : ""}
              {dinheiro(valores[hover] - valores[hover - 1])} vs anterior
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Ranking horizontal (categorias mais gastas). */
export function Ranking({ itens, cor = "var(--despesa)", total }: { itens: { rotulo: React.ReactNode; valor: number; chave: string; extra?: React.ReactNode }[]; cor?: string; total?: number }) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  const soma = total ?? itens.reduce((s, i) => s + i.valor, 0);
  return (
    <ul className="space-y-2.5">
      {itens.map((i) => (
        <li key={i.chave} className="avoid-break">
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">{i.rotulo}</span>
            <span className="num shrink-0 font-medium">
              {dinheiro(i.valor)} <span className="text-xs font-normal text-muted">{soma > 0 ? `${Math.round((i.valor / soma) * 100)}%` : ""}</span>
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-surface-2">
            <div className="h-2 rounded-full" style={{ width: `${(i.valor / max) * 100}%`, background: cor }} />
          </div>
          {i.extra}
        </li>
      ))}
    </ul>
  );
}

/** Barra empilhada (ex.: pago / dá para pagar / falta). */
export function BarraEmpilhada({ partes }: { partes: { nome: string; valor: number; cor: string; textura?: boolean }[] }) {
  const total = partes.reduce((s, p) => s + Math.max(0, p.valor), 0);
  return (
    <div>
      <div className="flex h-5 w-full gap-[2px] overflow-hidden rounded-lg bg-surface-2">
        {total > 0 &&
          partes
            .filter((p) => p.valor > 0)
            .map((p) => (
              <div
                key={p.nome}
                title={`${p.nome}: ${dinheiro(p.valor)}`}
                style={{
                  width: `${(p.valor / total) * 100}%`,
                  background: p.textura ? `repeating-linear-gradient(45deg, ${p.cor}, ${p.cor} 4px, transparent 4px, transparent 8px)` : p.cor,
                  border: p.textura ? `1px solid ${p.cor}` : undefined,
                }}
                className="h-full first:rounded-l-lg last:rounded-r-lg"
              />
            ))}
      </div>
      <div className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-3">
        {partes.map((p) => (
          <div key={p.nome} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: p.textura ? `repeating-linear-gradient(45deg, ${p.cor}, ${p.cor} 2px, transparent 2px, transparent 4px)` : p.cor, border: p.textura ? `1px solid ${p.cor}` : undefined }}
            />
            <span className="text-muted">{p.nome}:</span>
            <span className="num font-medium">{dinheiro(p.valor)}</span>
            {total > 0 && <span className="text-muted">({Math.round((p.valor / total) * 100)}%)</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
