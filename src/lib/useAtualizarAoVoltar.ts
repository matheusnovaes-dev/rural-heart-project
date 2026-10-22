import { useEffect, useRef } from "react";

/**
 * Mantém uma tela em dia com o que muda fora dela (ex.: o produtor anota um gasto pelo WhatsApp com o painel aberto).
 * Chama `atualizar` quando a aba volta a ficar visível ou a janela recebe foco, e a cada `intervaloMs` enquanto a aba está
 * visível. Aba escondida não consulta nada (economiza bateria e banco), e duas chamadas seguidas respeitam `minimoMs`.
 * Quem chama deve fazer a atualização silenciosa (sem esqueleto) e só trocar o estado se algo mudou de verdade.
 */
export function useAtualizarAoVoltar(
  atualizar: () => void,
  { intervaloMs = 30_000, minimoMs = 8_000 }: { intervaloMs?: number; minimoMs?: number } = {},
) {
  const ref = useRef(atualizar);
  ref.current = atualizar;

  useEffect(() => {
    let ultima = Date.now();
    const talvez = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - ultima < minimoMs) return;
      ultima = Date.now();
      ref.current();
    };
    const timer = window.setInterval(talvez, intervaloMs);
    document.addEventListener("visibilitychange", talvez);
    window.addEventListener("focus", talvez);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", talvez);
      window.removeEventListener("focus", talvez);
    };
  }, [intervaloMs, minimoMs]);
}

/** Só as colunas que entram na assinatura: a conferência periódica baixa o mínimo. */
export const COLUNAS_DA_ASSINATURA =
  "id, valor, quantidade, situacao, vence_em, ocorrido_em, descricao, categoria, cultura, talhao";

/** Assinatura curta de uma lista de lançamentos: muda quando entra, sai ou é alterado algum campo que aparece na tela. */
type CamposDaAssinatura = {
  id: string;
  valor?: number | null;
  quantidade?: number | null;
  situacao?: string | null;
  vence_em?: string | null;
  ocorrido_em?: string | null;
  descricao?: string | null;
  categoria?: string | null;
  cultura?: string | null;
  talhao?: string | null;
};

export function assinaturaDosRegistros(
  listas: ReadonlyArray<ReadonlyArray<CamposDaAssinatura>>,
): string {
  return listas
    .map((l) =>
      l
        .map((r) =>
          [
            r.id,
            r.valor,
            r.quantidade,
            r.situacao,
            r.vence_em,
            r.ocorrido_em,
            r.descricao,
            r.categoria,
            r.cultura,
            r.talhao,
          ].join("|"),
        )
        .join(";"),
    )
    .join("#");
}
