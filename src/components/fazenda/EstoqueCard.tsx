import { Lock, Warehouse } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { UpgradeButton } from "@/components/dashboard/UpgradeButton";
import { useCustosDaSafra } from "@/components/fazenda/useCustosDaSafra";
import {
  calcularEstoque,
  dataLonga,
  formatarQuantidade,
  formatarReais,
  margemPctNoPreco,
  mesmaCultura,
  numerosDoTexto,
  precoAlvoDaMargem,
} from "@/lib/fazenda.shared";
import { supabase } from "@/lib/supabase";

/** Vitrine do plano Prata para quem é Bronze: mostra o que o recurso faz e leva ao upgrade. */
export function EstoqueBloqueado({
  assinaturaId,
  asaasSubscriptionId,
}: {
  assinaturaId: string | null;
  asaasSubscriptionId: string | null;
}) {
  return (
    <Card data-testid="estoque-bloqueado" className="border-dashed">
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-center gap-2">
          <Lock className="size-4 text-muted-foreground" />
          <h2 className="font-display text-base font-semibold">Estoque e aviso de venda</h2>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
            Plano Prata
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Veja quantas sacas você ainda tem sem vender e quanto valem ao preço de hoje. Defina a sua
          meta de margem e receba um aviso no WhatsApp quando o preço chegar nela. Defina também um
          orçamento por categoria de gasto, com aviso ao passar de 80% e de 100%. Seus funcionários
          passam a anotar gasto, plantio e colheita direto pelo WhatsApp.
        </p>
        <UpgradeButton
          planoAlvo="prata"
          assinaturaId={assinaturaId}
          asaasSubscriptionId={asaasSubscriptionId}
        />
      </CardContent>
    </Card>
  );
}

/** Estoque de grãos, preço de hoje e meta de margem com aviso no WhatsApp (plano Prata e Ouro). */
export function EstoqueCard({
  produtor,
  versao,
  onInformarEstoque,
}: {
  produtor: { id: string; uf: string | null };
  versao: number;
  onInformarEstoque: () => void;
}) {
  const { areas, contas, registros, mercado, carregando, recarregar } = useCustosDaSafra(
    produtor,
    versao,
  );
  const culturas = useMemo(() => {
    const doCaderno = registros
      .filter(
        (r) =>
          ["colheita", "venda", "estoque"].includes(r.tipo) &&
          !!r.cultura &&
          /saca/i.test(r.unidade ?? ""),
      )
      .map((r) => r.cultura!.toLowerCase());
    return [...new Set([...doCaderno, ...areas.map((a) => a.cultura.toLowerCase())])];
  }, [registros, areas]);

  const itens = useMemo(
    () =>
      culturas
        .map((c) => {
          const est = calcularEstoque(registros, c);
          const area = areas.find((a) => mesmaCultura(a.cultura, c)) ?? null;
          const conta = contas.find((x) => mesmaCultura(x.area.cultura, c))?.conta ?? null;
          const preco = mercado[c]?.preco ?? null;
          return { cultura: c, est, area, conta, preco };
        })
        .filter((x) => x.est || x.area),
    [culturas, registros, areas, contas, mercado],
  );

  return (
    <Card data-testid="estoque">
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Warehouse className="size-4 text-muted-foreground" />
            <h2 className="font-display text-base font-semibold">Estoque e aviso de venda</h2>
          </div>
          <Button size="sm" variant="outline" onClick={onInformarEstoque}>
            Informar estoque
          </Button>
        </div>
        {carregando ? (
          <Skeleton className="h-24 w-full" />
        ) : itens.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Diga quantas sacas você tem guardadas (botão acima, ou no WhatsApp: “tenho 5.000 sacas
            de soja no armazém”) e eu calculo quanto falta vender. Com a área da cultura e os gastos
            lançados, você também define uma meta de margem e recebe o aviso quando o preço chegar
            nela.
          </p>
        ) : (
          <div className="space-y-4">
            {itens.map((x) => (
              <ItemDeEstoque key={x.cultura} {...x} onSalvou={recarregar} />
            ))}
            <p className="text-xs text-muted-foreground">
              Estoque = contagem mais recente, mais as colheitas e menos as vendas lançadas depois
              (vendas a receber também saem do estoque). O aviso sai no WhatsApp no máximo uma vez
              por dia. É conta com o que você lançou, não é recomendação de venda.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ItemDeEstoque({
  cultura,
  est,
  area,
  conta,
  preco,
  onSalvou,
}: {
  cultura: string;
  est: ReturnType<typeof calcularEstoque>;
  area: ReturnType<typeof useCustosDaSafra>["areas"][number] | null;
  conta: ReturnType<typeof useCustosDaSafra>["contas"][number]["conta"] | null;
  preco: { preco: number; uf: string } | null;
  onSalvou: () => void;
}) {
  const [meta, setMeta] = useState(
    area?.margem_alvo_pct ? String(area.margem_alvo_pct).replace(".", ",") : "",
  );
  const [salvando, setSalvando] = useState(false);
  // o aviso liga e desliga na hora; se o banco recusar, volta ao que estava
  const [avisoLocal, setAvisoLocal] = useState(area?.aviso_venda_ativo ?? true);
  useEffect(() => setAvisoLocal(area?.aviso_venda_ativo ?? true), [area?.aviso_venda_ativo]);
  const custo = conta?.custoPorSaca ?? null;
  const alvoNum = area?.margem_alvo_pct ?? null;
  const precoAlvo = custo !== null && alvoNum ? precoAlvoDaMargem(custo, alvoNum) : null;
  const margemHoje = custo !== null && preco ? margemPctNoPreco(custo, preco.preco) : null;

  async function salvarMeta(novo: number | null, aviso?: boolean) {
    if (!supabase || !area) return;
    setSalvando(true);
    const mudanca: Record<string, unknown> = {
      margem_alvo_pct: novo,
      atualizado_em: new Date().toISOString(),
    };
    if (aviso !== undefined) mudanca["aviso_venda_ativo"] = aviso;
    if (novo !== null && aviso === undefined) {
      mudanca["ultimo_aviso_em"] = null;
      mudanca["ultimo_aviso_preco"] = null;
    }
    const { error } = await supabase.from("fazenda_areas").update(mudanca).eq("id", area.id);
    setSalvando(false);
    if (error) {
      setAvisoLocal(area.aviso_venda_ativo);
      toast.error("Não foi possível salvar. Confira se o seu plano inclui esse recurso.");
      return;
    }
    toast.success(novo === null ? "Meta removida." : "Meta salva.");
    onSalvou();
  }

  function aoSalvar() {
    const n = numerosDoTexto(meta)[0] ?? null;
    if (n === null || n < 3 || n > 90) {
      toast.error("Informe uma meta entre 3% e 90%.");
      return;
    }
    salvarMeta(n);
  }

  return (
    <div className="rounded-lg border p-4" data-testid={`estoque-${cultura}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium capitalize">{cultura}</p>
        {est ? (
          <p className="font-mono text-xl font-semibold tabular-nums">
            {formatarQuantidade(est.sacas)}{" "}
            <span className="text-sm font-normal text-muted-foreground">sacas</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">sem contagem de estoque</p>
        )}
      </div>
      {est && (
        <p className="text-xs text-muted-foreground">
          {est.base === "contagem"
            ? `contagem de ${dataLonga(est.baseData!)}, mais ${formatarQuantidade(est.colhidas)} colhidas e menos ${formatarQuantidade(est.vendidas)} vendidas depois`
            : `${formatarQuantidade(est.colhidas)} colhidas e ${formatarQuantidade(est.vendidas)} vendidas na safra (sem contagem)`}
          {est.aReceber > 0
            ? ` · ${formatarQuantidade(est.aReceber)} das vendas ainda a receber`
            : ""}
        </p>
      )}
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Dado
          rotulo="Valor ao preço de hoje"
          valor={est && preco ? formatarReais(Math.round(est.sacas * preco.preco)) : "sem preço"}
          nota={preco ? `${formatarReais(preco.preco)} em ${preco.uf}` : undefined}
        />
        <Dado
          rotulo="Custo por saca"
          valor={custo !== null ? formatarReais(custo) : area ? "lance gastos" : "informe a área"}
        />
        <Dado
          rotulo="Margem hoje"
          valor={margemHoje !== null ? `${formatarQuantidade(margemHoje)}%` : "?"}
          bom={margemHoje !== null && alvoNum !== null && margemHoje >= alvoNum}
        />
        <Dado
          rotulo="Preço-alvo"
          valor={precoAlvo !== null ? formatarReais(precoAlvo) : alvoNum ? "?" : "defina a meta"}
          nota={alvoNum ? `meta de ${formatarQuantidade(alvoNum)}% de margem` : undefined}
        />
      </dl>
      {area ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          <label htmlFor={`meta-${cultura}`} className="text-sm">
            Meta de margem
          </label>
          <Input
            id={`meta-${cultura}`}
            inputMode="decimal"
            value={meta}
            onChange={(e) => setMeta(e.target.value)}
            placeholder="25"
            className="h-8 w-20"
            autoComplete="off"
          />
          <span className="text-sm text-muted-foreground">%</span>
          <Button size="sm" variant="outline" onClick={aoSalvar} disabled={salvando}>
            Salvar meta
          </Button>
          {alvoNum !== null && (
            <>
              <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--color-primary)]"
                  checked={avisoLocal}
                  onChange={(e) => {
                    setAvisoLocal(e.target.checked);
                    salvarMeta(alvoNum, e.target.checked);
                  }}
                  data-testid={`aviso-${cultura}`}
                />
                Avisar no WhatsApp
              </label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => salvarMeta(null)}
                disabled={salvando}
              >
                Tirar meta
              </Button>
            </>
          )}
        </div>
      ) : (
        <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
          Pra definir a meta de margem, informe a área de {cultura} no cartão “Custo por saca e
          margem”.
        </p>
      )}
    </div>
  );
}

function Dado({
  rotulo,
  valor,
  nota,
  bom,
}: {
  rotulo: string;
  valor: string;
  nota?: string | undefined;
  bom?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className={`font-mono text-base font-semibold tabular-nums ${bom ? "text-primary" : ""}`}>
        {valor}
      </dd>
      {nota && <p className="text-[11px] leading-tight text-muted-foreground">{nota}</p>}
    </div>
  );
}
