import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Document, Page, Text, View, Image, StyleSheet, pdf } from "@react-pdf/renderer";
import { FileDown, Loader2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useRequireCooperativa } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { culturas } from "@/config/culturas";

export const Route = createFileRoute("/dashboard/_layout/relatorios")({
  component: RelatoriosPage,
});

type PrecoRow = { produto: string; uf: string; preco: number; data_referencia: string };

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, fontFamily: "Helvetica" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  logo: { width: 40, height: 40, borderRadius: 20 },
  coopNome: { fontSize: 16, fontWeight: 700 },
  titulo: { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  subtitulo: { fontSize: 11, color: "#5B6459", marginBottom: 20 },
  table: {
    display: "flex",
    width: "auto",
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: "#E4DFCE",
  },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E4DFCE" },
  rowHeader: { backgroundColor: "#F1EBDD" },
  cell: { padding: 6, flex: 1, fontSize: 10 },
  cellHeader: { padding: 6, flex: 1, fontSize: 10, fontWeight: 700 },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 8, color: "#5B6459" },
});

function RelatorioDocument({
  coopNome,
  logoUrl,
  corPrimaria,
  culturaLabel,
  precos,
}: {
  coopNome: string;
  logoUrl: string | null;
  corPrimaria: string | null;
  culturaLabel: string;
  precos: PrecoRow[];
}) {
  const cor = corPrimaria ?? "#1F3D2B";
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {logoUrl && <Image src={logoUrl} style={styles.logo} />}
          <Text style={[styles.coopNome, { color: cor }]}>{coopNome}</Text>
        </View>
        <Text style={styles.titulo}>Relatório de preços · {culturaLabel}</Text>
        <Text style={styles.subtitulo}>
          Fonte: Conab · Gerado em {new Date().toLocaleDateString("pt-BR")}
        </Text>
        <View style={styles.table}>
          <View style={[styles.row, styles.rowHeader]}>
            <Text style={styles.cellHeader}>Produto</Text>
            <Text style={styles.cellHeader}>UF</Text>
            <Text style={styles.cellHeader}>Período</Text>
            <Text style={styles.cellHeader}>Preço (R$)</Text>
          </View>
          {precos.map((p, i) => (
            <View style={styles.row} key={i}>
              <Text style={styles.cell}>{p.produto}</Text>
              <Text style={styles.cell}>{p.uf}</Text>
              <Text style={styles.cell}>
                {new Date(p.data_referencia).toLocaleDateString("pt-BR")}
              </Text>
              <Text style={styles.cell}>
                {p.preco.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.footer}>
          {coopNome} via {siteConfig.name}: cenários de mercado com base em dados públicos da
          Conab. Não constitui recomendação de investimento.
        </Text>
      </Page>
    </Document>
  );
}

function RelatoriosPage() {
  const cooperativa = useRequireCooperativa();
  const [cultura, setCultura] = useState("soja");
  const [precos, setPrecos] = useState<PrecoRow[]>([]);
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("precos")
      .select("produto, uf, preco, data_referencia")
      .ilike("produto", `%${cultura}%`)
      .order("data_referencia", { ascending: false })
      .limit(50)
      .then(({ data }) => setPrecos(data ?? []));
  }, [cultura]);

  const culturaLabel = culturas.find((c) => c.value === cultura)?.label ?? cultura;

  if (!cooperativa) return null;

  async function baixarRelatorio() {
    setGerando(true);
    try {
      const blob = await pdf(
        <RelatorioDocument
          coopNome={cooperativa!.nome}
          logoUrl={cooperativa!.logo_url}
          corPrimaria={cooperativa!.cor_primaria}
          culturaLabel={culturaLabel}
          precos={precos}
        />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-precos-${cultura}-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setGerando(false);
    }
  }

  const seletorCultura = (
    <Select value={cultura} onValueChange={setCultura}>
      <SelectTrigger className="w-55">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {culturas.map((c) => (
          <SelectItem key={c.value} value={c.value}>
            {c.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={FileDown}
        title="Relatórios"
        description="PDF com a marca da sua cooperativa e os preços mais recentes por UF."
        action={seletorCultura}
      />
      <Card>
        <CardContent className="pt-6">
          {precos.length === 0 ? (
            <EmptyState
              icon={FileDown}
              title="Sem dados pra essa cultura"
              description={`Ainda não temos preço publicado de ${culturaLabel.toLowerCase()} pra montar o relatório. Tente outra cultura no seletor acima.`}
            />
          ) : (
            <Button onClick={baixarRelatorio} disabled={gerando}>
              {gerando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileDown className="size-4" />
              )}
              Baixar relatório em PDF
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
