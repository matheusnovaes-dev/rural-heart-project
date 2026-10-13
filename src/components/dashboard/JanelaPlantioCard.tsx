import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrocarCulturaDialog } from "@/components/dashboard/TrocarCulturaDialog";
import { SafralumeIcon } from "@/components/icons/SafralumeIcon";
import { supabase } from "@/lib/supabase";
import {
  consultarJanelaPlantio,
  culturaParaZarc,
  type ResultadoJanelaPlantio,
} from "@/lib/plantio";
import type { Produtor } from "@/lib/auth";

/** Risco climático oficial do decêndio: 3 faixas simples, mesma lógica de
 * "chuva alta/média/baixa" já usada no card de clima. null = nenhuma
 * variante de cultivar/solo recomenda plantio nesse período. */
function faixaDeRisco(pct: number | null): { texto: string; classe: string } {
  if (pct == null) return { texto: "Não recomendado", classe: "bg-destructive/10 text-red-800" };
  if (pct <= 20) return { texto: `${pct}% de risco`, classe: "bg-primary/10 text-primary" };
  if (pct <= 40) return { texto: `${pct}% de risco`, classe: "bg-cta/10 text-cta-foreground" };
  return { texto: `${pct}% de risco`, classe: "bg-destructive/10 text-red-800" };
}

/** Resposta direta pra "posso plantar agora?", antes dos números. */
function veredito(resultado: Extract<ResultadoJanelaPlantio, { disponivel: true }>): {
  titulo: string;
  detalhe: string | null;
  classe: string;
} {
  const hoje = resultado.risco_climatico_hoje_pct;
  const proximas = resultado.proximas_janelas.slice(1);
  const melhor = proximas
    .filter((j) => j.risco_climatico_pct != null)
    .sort((a, b) => (a.risco_climatico_pct as number) - (b.risco_climatico_pct as number))[0];
  const esperar =
    melhor && (hoje == null || (melhor.risco_climatico_pct as number) < hoje)
      ? `Se puder esperar, ${melhor.periodo} tem risco de ${melhor.risco_climatico_pct}%.`
      : null;
  if (hoje == null) {
    return {
      titulo: "Agora não é recomendado plantar",
      detalhe: esperar,
      classe: "text-red-800",
    };
  }
  if (hoje <= 20) {
    return { titulo: "Boa época para plantar agora", detalhe: null, classe: "text-primary" };
  }
  if (hoje <= 40) {
    return {
      titulo: "Dá para plantar agora, com risco médio",
      detalhe: esperar,
      classe: "text-cta-foreground",
    };
  }
  return {
    titulo: "Risco alto agora, o melhor é esperar",
    detalhe: esperar,
    classe: "text-red-800",
  };
}

/**
 * Janela de plantio oficial (ZARC/MAPA) direto no painel — a mesma consulta
 * que já roda testada no bot do WhatsApp (src/lib/plantio.ts), só que sem
 * precisar perguntar pro bot. Só cobre soja, milho, algodão, arroz e
 * feijão (culturas com Tábua de Risco anual); pra qualquer outra cultura o
 * card simplesmente não aparece. Precisa do município cadastrado — sem ele,
 * mostra o mesmo convite que a página de clima já usa em vez de inventar
 * uma cidade.
 */
export function JanelaPlantioCard({ produtor }: { produtor: Produtor }) {
  const culturaZarc = culturaParaZarc(produtor.cultura_principal);
  const [resultado, setResultado] = useState<ResultadoJanelaPlantio | null | undefined>(undefined);

  useEffect(() => {
    if (!supabase || !culturaZarc || !produtor.uf || !produtor.municipio) return;
    let ativo = true;
    consultarJanelaPlantio(supabase, {
      produto: culturaZarc,
      uf: produtor.uf,
      municipio: produtor.municipio,
    })
      .then((r) => ativo && setResultado(r))
      .catch(() => ativo && setResultado(null));
    return () => {
      ativo = false;
    };
  }, [culturaZarc, produtor.uf, produtor.municipio]);

  if (!culturaZarc || !produtor.uf) return null;

  return (
    <Card className="gap-3 border-border/80 shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="px-4 pt-4 pb-3">
        <CardTitle className="flex items-center gap-2.5 font-display text-base font-semibold text-foreground">
          <SafralumeIcon nome="janela-plantio" className="size-8" />
          Janela de plantio
        </CardTitle>
        <CardDescription>
          Risco de clima pra plantar, pelo zoneamento oficial do Ministério da Agricultura (ZARC).
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        {!produtor.municipio ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-muted-foreground">
              Precisamos da sua cidade pra consultar a janela de plantio certa.
            </p>
            <TrocarCulturaDialog
              produtor={produtor}
              trigger={
                <button type="button" className="text-sm font-medium text-primary hover:underline">
                  Informar minha cidade
                </button>
              }
            />
          </div>
        ) : resultado === undefined ? (
          <Skeleton className="h-24 w-full" />
        ) : resultado === null || !resultado.disponivel ? (
          <p className="text-sm text-muted-foreground">
            Ainda não temos o zoneamento de risco (ZARC) pra {produtor.municipio}/{produtor.uf}.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <p className={`text-base font-semibold text-balance ${veredito(resultado).classe}`}>
                {veredito(resultado).titulo}
              </p>
              {veredito(resultado).detalhe && (
                <p className="mt-0.5 text-sm text-foreground">{veredito(resultado).detalhe}</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Agora ({resultado.periodo_atual})
              </p>
              <span
                className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-sm font-semibold ${faixaDeRisco(resultado.risco_climatico_hoje_pct).classe}`}
              >
                {faixaDeRisco(resultado.risco_climatico_hoje_pct).texto}
              </span>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold text-foreground">Próximas janelas</p>
              <ul className="flex flex-col gap-1">
                {resultado.proximas_janelas.slice(1).map((j) => (
                  <li key={j.periodo} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{j.periodo}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${faixaDeRisco(j.risco_climatico_pct).classe}`}
                    >
                      {faixaDeRisco(j.risco_climatico_pct).texto}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-xs text-muted-foreground">
              Fonte: ZARC, do Ministério da Agricultura, para a safra vigente. Não é estimativa de
              produtividade ou colheita, só o risco de clima da época de plantio.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
