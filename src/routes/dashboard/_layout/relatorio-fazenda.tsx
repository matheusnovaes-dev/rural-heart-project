import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { useCustosDaSafra } from "@/components/fazenda/useCustosDaSafra";
import { useRequireProdutor } from "@/lib/auth";
import { temAcessoPrata, useAssinatura } from "@/lib/planos";
import {
  COLUNAS_REGISTRO,
  ROTULO_TIPO,
  calcularEstoque,
  dataLonga,
  margemPctNoPreco,
  mesmaCultura,
  precoAlvoDaMargem,
  formatarQuantidade,
  formatarReais,
  fraseDeVencimento,
  hojeBrasilia,
  intervaloDoPeriodo,
  resumir,
  resumirPendencias,
  type PeriodoCaderno,
  type RegistroFazenda,
} from "@/lib/fazenda.shared";
import { supabase } from "@/lib/supabase";

const PERIODOS_VALIDOS: PeriodoCaderno[] = ["mes", "mes_passado", "safra", "ano", "tudo"];

export const Route = createFileRoute("/dashboard/_layout/relatorio-fazenda")({
  head: () => ({ meta: [{ title: "Relatório da fazenda | Safralume" }] }),
  validateSearch: (s: Record<string, unknown>): { periodo: PeriodoCaderno } => ({
    periodo: PERIODOS_VALIDOS.includes(s["periodo"] as PeriodoCaderno)
      ? (s["periodo"] as PeriodoCaderno)
      : "safra",
  }),
  component: RelatorioPage,
});

// Na impressão só o relatório aparece: tudo que está direto no body (o painel) some.
const ESTILO = `
.rel-tela{position:fixed;inset:0;z-index:100;overflow:auto;background:#e9e7df}
.rel-folha{background:#fff;color:#16301f;max-width:820px;margin:0 auto;padding:36px 40px;font-size:13px;line-height:1.45}
.rel-folha h1{font-size:24px;font-weight:800;letter-spacing:-.02em}
.rel-folha h2{font-size:14px;font-weight:700;margin:22px 0 8px;padding-bottom:4px;border-bottom:2px solid #16301f}
.rel-folha table{width:100%;border-collapse:collapse;font-size:12px}
.rel-folha th{text-align:left;font-weight:600;color:#5b6b60;border-bottom:1px solid #c9c4b4;padding:5px 6px}
.rel-folha td{padding:5px 6px;border-bottom:1px solid #eee9dc;vertical-align:top}
.rel-folha .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.rel-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}
.rel-kpi{border:1px solid #d8d3c3;border-radius:8px;padding:10px 12px}
.rel-kpi b{display:block;font-size:18px;font-variant-numeric:tabular-nums}
.rel-nota{margin-top:18px;font-size:11px;color:#5b6b60}
@media print{
  @page{size:A4;margin:14mm}
  body{background:#fff !important}
  body > *:not(.rel-print){display:none !important}
  .rel-tela{position:static;overflow:visible;background:#fff}
  .rel-folha{max-width:none;padding:0}
  .rel-barra{display:none !important}
  .rel-folha h2{break-after:avoid}
  .rel-folha tr{break-inside:avoid}
  .rel-folha thead{display:table-header-group}
}
`;

function RelatorioPage() {
  const produtor = useRequireProdutor();
  const { periodo } = Route.useSearch();
  const [montado, setMontado] = useState(false);
  const [registros, setRegistros] = useState<RegistroFazenda[]>([]);
  const [pendentes, setPendentes] = useState<RegistroFazenda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const intervalo = intervaloDoPeriodo(periodo);

  useEffect(() => setMontado(true), []);

  useEffect(() => {
    if (!supabase || !produtor) return;
    let cancelado = false;
    (async () => {
      const [a, b] = await Promise.all([
        supabase!
          .from("fazenda_registros")
          .select(COLUNAS_REGISTRO)
          .eq("produtor_id", produtor.id)
          .is("apagado_em", null)
          .eq("situacao", "realizado")
          .gte("ocorrido_em", intervalo.desde)
          .lte("ocorrido_em", intervalo.ate)
          .order("ocorrido_em", { ascending: true })
          .order("criado_em", { ascending: true })
          .limit(5000),
        supabase!
          .from("fazenda_registros")
          .select(COLUNAS_REGISTRO)
          .eq("produtor_id", produtor.id)
          .is("apagado_em", null)
          .eq("situacao", "pendente")
          .order("vence_em", { ascending: true })
          .limit(500),
      ]);
      if (cancelado) return;
      setRegistros((a.data ?? []) as unknown as RegistroFazenda[]);
      setPendentes((b.data ?? []) as unknown as RegistroFazenda[]);
      setCarregando(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [produtor, intervalo.desde, intervalo.ate]);

  const resumo = useMemo(() => resumir(registros), [registros]);
  const pend = useMemo(() => resumirPendencias(pendentes), [pendentes]);
  const custos = useCustosDaSafra(
    { id: produtor?.id ?? "", uf: produtor?.uf ?? null },
    carregando ? 0 : 1,
  );

  const { plano } = useAssinatura();
  const estoques = useMemo(() => {
    if (!temAcessoPrata(plano)) return [];
    const culturas = [
      ...new Set(
        custos.registros
          .filter(
            (r) =>
              ["colheita", "venda", "estoque"].includes(r.tipo) &&
              !!r.cultura &&
              /saca/i.test(r.unidade ?? ""),
          )
          .map((r) => r.cultura!.toLowerCase()),
      ),
    ];
    return culturas
      .map((c) => {
        const est = calcularEstoque(custos.registros, c);
        const conta = custos.contas.find((x) => mesmaCultura(x.area.cultura, c));
        const preco = custos.mercado[c]?.preco?.preco ?? null;
        const custo = conta?.conta.custoPorSaca ?? null;
        const meta = conta?.area.margem_alvo_pct ?? null;
        return {
          c,
          est,
          preco,
          custo,
          meta,
          alvo: custo !== null && meta ? precoAlvoDaMargem(custo, meta) : null,
          margem: custo !== null && preco ? margemPctNoPreco(custo, preco) : null,
        };
      })
      .filter((x) => x.est);
  }, [plano, custos.registros, custos.contas, custos.mercado]);

  if (!produtor || !montado) return null;
  const totalGastos = Math.max(1, resumo.gastos);

  const folha = (
    <div className="rel-print rel-tela" data-testid="relatorio">
      <div className="rel-barra sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-white/95 px-4 py-2.5 backdrop-blur">
        <Button size="sm" variant="ghost" asChild>
          <Link to="/dashboard/fazenda">
            <ArrowLeft className="size-4" />
            Voltar ao caderno
          </Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-4" />
          Imprimir ou salvar em PDF
        </Button>
      </div>
      <style>{ESTILO}</style>
      <div className="rel-folha">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
          }}
        >
          <div>
            <h1>Relatório da fazenda</h1>
            <p style={{ color: "#5b6b60" }}>
              {produtor.nome}
              {produtor.uf ? ` · ${produtor.uf}` : ""}
              {produtor.cultura_principal ? ` · ${produtor.cultura_principal}` : ""}
            </p>
          </div>
          <div style={{ textAlign: "right", fontSize: 12, color: "#5b6b60" }}>
            <b style={{ color: "#16301f" }}>Safralume</b>
            <br />
            Gerado em {dataLonga(hojeBrasilia())}
          </div>
        </div>
        <p style={{ marginTop: 10 }}>
          <b>Período:</b> {intervalo.rotulo} ({dataLonga(intervalo.desde)} a{" "}
          {dataLonga(intervalo.ate)})
        </p>

        {carregando ? (
          <p style={{ marginTop: 20 }}>Carregando...</p>
        ) : (
          <>
            <div className="rel-kpis">
              <div className="rel-kpi">
                Gastos <b>{formatarReais(resumo.gastos)}</b>
                {resumo.nGastos} {resumo.nGastos === 1 ? "lançamento" : "lançamentos"}
              </div>
              <div className="rel-kpi">
                Vendas <b>{formatarReais(resumo.vendas)}</b>
                {resumo.nVendas} {resumo.nVendas === 1 ? "venda" : "vendas"}
              </div>
              <div className="rel-kpi">
                Resultado <b>{formatarReais(resumo.resultado)}</b>
                vendas menos gastos
              </div>
            </div>

            {resumo.porCategoria.length > 0 && (
              <>
                <h2>Gastos por categoria</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Categoria</th>
                      <th className="num">Lançamentos</th>
                      <th className="num">Total</th>
                      <th className="num">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumo.porCategoria.map((c) => (
                      <tr key={c.categoria}>
                        <td>{c.categoria}</td>
                        <td className="num">{c.n}</td>
                        <td className="num">{formatarReais(c.total)}</td>
                        <td className="num">
                          {formatarQuantidade((c.total / totalGastos) * 100)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {resumo.porCultura.length > 0 && (
              <>
                <h2>Por cultura</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Cultura</th>
                      <th className="num">Gastos</th>
                      <th className="num">Vendas</th>
                      <th className="num">Vendido</th>
                      <th className="num">Preço médio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumo.porCultura.map((c) => (
                      <tr key={c.cultura}>
                        <td>{c.cultura}</td>
                        <td className="num">{formatarReais(c.gasto)}</td>
                        <td className="num">{formatarReais(c.venda)}</td>
                        <td className="num">
                          {c.quantidadeVendida > 0
                            ? `${formatarQuantidade(c.quantidadeVendida)} ${c.unidadeVenda ?? ""}`
                            : ""}
                        </td>
                        <td className="num">
                          {c.precoMedioVenda ? formatarReais(c.precoMedioVenda) : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {resumo.porTalhao.length > 0 && (
              <>
                <h2>Gastos por talhão</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Talhão</th>
                      <th>Culturas</th>
                      <th className="num">Lançamentos</th>
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumo.porTalhao.map((t) => (
                      <tr key={t.chave}>
                        <td>{t.talhao}</td>
                        <td>{t.culturas.join(", ")}</td>
                        <td className="num">{t.nGastos}</td>
                        <td className="num">{formatarReais(t.gasto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {custos.contas.length > 0 && (
              <>
                <h2>Custo por saca e margem ({custos.rotulo})</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Cultura</th>
                      <th className="num">Área</th>
                      <th className="num">Gastos</th>
                      <th className="num">Produção</th>
                      <th className="num">Custo/saca</th>
                      <th className="num">Preço hoje</th>
                      <th className="num">Margem/saca</th>
                    </tr>
                  </thead>
                  <tbody>
                    {custos.contas.map(({ area, conta, mercado }) => (
                      <tr key={area.id}>
                        <td style={{ textTransform: "capitalize" }}>{area.cultura}</td>
                        <td className="num">{formatarQuantidade(area.area_ha)} ha</td>
                        <td className="num">{formatarReais(conta.gastos)}</td>
                        <td className="num">
                          {conta.sacas ? `${formatarQuantidade(conta.sacas)} sc` : ""}
                          {conta.sacasOrigem
                            ? ` (${conta.sacasOrigem === "conab" ? "Conab" : conta.sacasOrigem})`
                            : ""}
                        </td>
                        <td className="num">
                          {conta.custoPorSaca !== null ? formatarReais(conta.custoPorSaca) : ""}
                        </td>
                        <td className="num">
                          {mercado?.preco ? formatarReais(mercado.preco.preco) : ""}
                        </td>
                        <td className="num">
                          {conta.margemPorSaca !== null ? formatarReais(conta.margemPorSaca) : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="rel-nota" style={{ marginTop: 6 }}>
                  Estimativa: considera só os gastos lançados no caderno. Arrendamento, juros e o
                  que não foi anotado ficam de fora.
                </p>
              </>
            )}

            {estoques.length > 0 && (
              <>
                <h2>Estoque e meta de margem</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Cultura</th>
                      <th className="num">Estoque</th>
                      <th className="num">Valor hoje</th>
                      <th className="num">Custo/saca</th>
                      <th className="num">Margem hoje</th>
                      <th className="num">Meta</th>
                      <th className="num">Preço-alvo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estoques.map((x) => (
                      <tr key={x.c}>
                        <td style={{ textTransform: "capitalize" }}>{x.c}</td>
                        <td className="num">{formatarQuantidade(x.est!.sacas)} sc</td>
                        <td className="num">
                          {x.preco ? formatarReais(Math.round(x.est!.sacas * x.preco)) : ""}
                        </td>
                        <td className="num">{x.custo !== null ? formatarReais(x.custo) : ""}</td>
                        <td className="num">
                          {x.margem !== null ? `${formatarQuantidade(x.margem)}%` : ""}
                        </td>
                        <td className="num">{x.meta ? `${formatarQuantidade(x.meta)}%` : ""}</td>
                        <td className="num">{x.alvo ? formatarReais(x.alvo) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {(pend.aPagar.length > 0 || pend.aReceber.length > 0) && (
              <>
                <h2>A pagar e a receber</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Descrição</th>
                      <th>Vencimento</th>
                      <th className="num">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...pend.aReceber, ...pend.aPagar].map((p) => (
                      <tr key={p.registro.id}>
                        <td>{p.tipo === "a_receber" ? "A receber" : "A pagar"}</td>
                        <td>
                          {p.registro.tipo === "venda"
                            ? `Venda${p.registro.cultura ? ` de ${p.registro.cultura.toLowerCase()}` : ""}`
                            : p.registro.descricao}
                        </td>
                        <td>
                          {dataLonga(p.vencimento)} ({fraseDeVencimento(p.dias, p.vencimento)})
                        </td>
                        <td className="num">{formatarReais(p.registro.valor ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <h2>Lançamentos do período ({registros.length})</h2>
            {registros.length === 0 ? (
              <p>Nenhum lançamento no período.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>Descrição</th>
                    <th>Detalhes</th>
                    <th className="num">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((r) => (
                    <tr key={r.id}>
                      <td className="num">{dataLonga(r.ocorrido_em)}</td>
                      <td>{ROTULO_TIPO[r.tipo]}</td>
                      <td>{r.descricao}</td>
                      <td>
                        {[
                          r.categoria,
                          r.cultura,
                          r.talhao,
                          r.quantidade !== null && r.unidade
                            ? `${formatarQuantidade(r.quantidade)} ${r.unidade}${r.preco_unitario ? ` a ${formatarReais(r.preco_unitario)}` : ""}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </td>
                      <td className="num">
                        {r.valor !== null
                          ? `${r.tipo === "gasto" ? "− " : r.tipo === "venda" ? "+ " : ""}${formatarReais(r.valor)}`
                          : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <p className="rel-nota">
              Valores lançados pelo próprio produtor no Caderno da fazenda do Safralume. Este
              relatório não é documento contábil nem fiscal. Não emite nota e não substitui a
              contabilidade.
            </p>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(folha, document.body);
}
