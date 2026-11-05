"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Banco } from "./types";
import { bancoVazio, CONFIG_PADRAO } from "./defaults";
import { aplicarOps, type Op } from "./ops";

type Modo = "carregando" | "local" | "nuvem" | "erro";

interface Ctx {
  banco: Banco;
  modo: Modo;
  erro: string;
  salvando: boolean;
  aplicar: (ops: Op[], msg?: string) => Promise<void>;
  recarregar: () => Promise<void>;
  aviso: (msg: string, tipo?: "ok" | "erro") => void;
}

const DadosCtx = createContext<Ctx | null>(null);
const CHAVE_LOCAL = "gj-banco-v1";

function lerLocal(): Banco {
  try {
    const raw = localStorage.getItem(CHAVE_LOCAL);
    if (raw) {
      const b = JSON.parse(raw) as Banco;
      return { ...bancoVazio(), ...b, config: { ...CONFIG_PADRAO, ...b.config } };
    }
  } catch {
    /* ignora */
  }
  return bancoVazio();
}

function salvarLocal(b: Banco) {
  try {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify(b));
  } catch {
    /* ignora */
  }
}

export function DadosProvider({ children }: { children: React.ReactNode }) {
  const [banco, setBanco] = useState<Banco>(() => bancoVazio());
  const [modo, setModo] = useState<Modo>("carregando");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "erro"; id: number } | null>(null);
  const modoRef = useRef<Modo>("carregando");
  const bancoRef = useRef(banco);
  const trocarBanco = useCallback((b: Banco) => {
    bancoRef.current = b;
    setBanco(b);
  }, []);

  const aviso = useCallback((msg: string, tipo: "ok" | "erro" = "ok") => {
    const id = Date.now();
    setToast({ msg, tipo, id });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 2800);
  }, []);

  const recarregar = useCallback(async () => {
    try {
      const res = await fetch("/api/dados", { cache: "no-store" });
      if (res.status === 401) {
        // sessão expirada: vai para o login (mas nunca recarrega a própria tela de login)
        if (window.location.pathname !== "/login") window.location.replace("/login");
        return;
      }
      const json = (await res.json()) as { modo: string; banco?: Banco; erro?: string };
      if (json.modo === "nuvem" && json.banco) {
        trocarBanco(json.banco);
        setModo("nuvem");
        modoRef.current = "nuvem";
      } else if (json.modo === "local") {
        trocarBanco(lerLocal());
        setModo("local");
        modoRef.current = "local";
      } else {
        setErro(json.erro ?? "Erro ao carregar dados");
        setModo("erro");
        modoRef.current = "erro";
      }
    } catch {
      // sem internet: usa o que tiver salvo localmente
      if (modoRef.current === "carregando") {
        trocarBanco(lerLocal());
        setModo("local");
        modoRef.current = "local";
        setErro("Sem conexão — mostrando dados salvos neste aparelho.");
      }
    }
  }, [trocarBanco]);

  useEffect(() => {
    // Na tela de login ainda não há sessão: não busca dados (evitava o loop de recarregar)
    if (window.location.pathname === "/login") return;
    // carga inicial dos dados (assíncrona)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    recarregar();
    const aoVoltar = () => {
      if (document.visibilityState === "visible" && modoRef.current === "nuvem") recarregar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [recarregar]);

  const aplicar = useCallback(
    async (ops: Op[], msg?: string) => {
      if (!ops.length) return;
      const novo = aplicarOps(bancoRef.current, ops);
      trocarBanco(novo);
      if (modoRef.current !== "nuvem") {
        salvarLocal(novo);
        if (msg) aviso(msg);
        return;
      }
      setSalvando(true);
      try {
        const res = await fetch("/api/dados", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ops }),
        });
        if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { erro?: string }).erro ?? "Falha ao salvar");
        if (msg) aviso(msg);
      } catch (e) {
        aviso(`Não foi possível salvar: ${(e as Error).message}`, "erro");
        await recarregar();
      } finally {
        setSalvando(false);
      }
    },
    [aviso, recarregar, trocarBanco],
  );

  const valor = useMemo(() => ({ banco, modo, erro, salvando, aplicar, recarregar, aviso }), [banco, modo, erro, salvando, aplicar, recarregar, aviso]);

  return (
    <DadosCtx.Provider value={valor}>
      {children}
      {toast && (
        <div
          role="status"
          className={`no-print fixed left-1/2 z-[60] -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6 ${
            toast.tipo === "erro" ? "bg-danger text-white" : "bg-ink text-surface"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </DadosCtx.Provider>
  );
}

export function useDados(): Ctx {
  const c = useContext(DadosCtx);
  if (!c) throw new Error("useDados fora do DadosProvider");
  return c;
}
