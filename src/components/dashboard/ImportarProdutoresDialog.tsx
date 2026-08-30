import { useState } from "react";
import { AlertTriangle, Check, Loader2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { enviarBoasVindasWhatsApp } from "@/lib/notificacoes.server";
import { parseLinhas, type LinhaImportada } from "@/lib/importarProdutores";

type ResultadoLinha = LinhaImportada & { status: "pendente" | "ok" | "duplicado" | "falhou" };

export function ImportarProdutoresDialog({
  cooperativaId,
  onDone,
}: {
  cooperativaId: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState("");
  const [linhas, setLinhas] = useState<LinhaImportada[] | null>(null);
  const [resultados, setResultados] = useState<ResultadoLinha[] | null>(null);
  const [importando, setImportando] = useState(false);

  function analisar() {
    setLinhas(parseLinhas(texto));
    setResultados(null);
  }

  function reiniciar() {
    setTexto("");
    setLinhas(null);
    setResultados(null);
  }

  async function confirmarImportacao() {
    if (!supabase || !linhas) return;
    const validas = linhas.filter((l) => !l.erro);
    if (validas.length === 0) return;

    setImportando(true);
    const emAndamento: ResultadoLinha[] = linhas.map((l) => ({ ...l, status: "pendente" }));
    setResultados(emAndamento);

    // Uma linha por vez (não em lote): um INSERT com várias linhas falha
    // inteiro se UMA violar a constraint de WhatsApp duplicado — separado,
    // um duplicado não trava a importação dos outros 200.
    for (const linha of validas) {
      if (!supabase) break;
      const { error } = await supabase.from("produtores").insert({
        cooperativa_id: cooperativaId,
        nome: linha.nome,
        whatsapp: linha.whatsapp,
        cultura_principal: linha.cultura,
        uf: linha.uf,
      });

      const status: ResultadoLinha["status"] = error
        ? error.code === "23505"
          ? "duplicado"
          : "falhou"
        : "ok";

      if (status === "ok") {
        void enviarBoasVindasWhatsApp({
          data: { nome: linha.nome, whatsapp: linha.whatsapp, cooperativaId },
        });
      }

      setResultados((prev) =>
        (prev ?? emAndamento).map((r) => (r.linha === linha.linha ? { ...r, status } : r)),
      );
    }

    setImportando(false);
    onDone();
  }

  const totalOk = resultados?.filter((r) => r.status === "ok").length ?? 0;
  const totalDuplicado = resultados?.filter((r) => r.status === "duplicado").length ?? 0;
  const totalFalhou = resultados?.filter((r) => r.status === "falhou").length ?? 0;
  const terminou = resultados != null && !importando && totalOk + totalDuplicado + totalFalhou > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          if (terminou) onDone();
          reiniciar();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Upload className="size-4" />
          Importar planilha
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar produtores</DialogTitle>
        </DialogHeader>

        {!linhas ? (
          <div className="flex flex-col gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="import-texto">Cole as linhas do Excel/Google Sheets</Label>
              <Textarea
                id="import-texto"
                rows={8}
                placeholder={"Nome\tWhatsApp\tCultura\tUF\nJoão Silva\t(37) 99999-0000\tSoja\tMG"}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Ordem das colunas: Nome, WhatsApp, Cultura (opcional), UF (opcional). Cabeçalho é
                opcional — se colar direto do Excel, a primeira linha com "nome"/"whatsapp" é
                detectada e ignorada.
              </p>
            </div>
            <Button onClick={analisar} disabled={!texto.trim()} className="mt-1">
              Conferir antes de importar
            </Button>
          </div>
        ) : !resultados ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                <strong className="text-foreground">{linhas.length}</strong> linha
                {linhas.length === 1 ? "" : "s"} encontrada{linhas.length === 1 ? "" : "s"}
                {linhas.some((l) => l.erro) &&
                  ` · ${linhas.filter((l) => l.erro).length} com problema`}
              </span>
              <button
                type="button"
                onClick={reiniciar}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                Colar de novo
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.linha} className="border-b border-border last:border-0">
                      <td className="p-2 text-muted-foreground">{l.linha}</td>
                      <td className="p-2">{l.nome || "—"}</td>
                      <td className="p-2 font-mono">{l.whatsapp || "—"}</td>
                      <td className="p-2">
                        {l.erro ? (
                          <span className="flex items-center gap-1 text-destructive">
                            <AlertTriangle className="size-3" />
                            {l.erro}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-primary">
                            <Check className="size-3" />
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              onClick={confirmarImportacao}
              disabled={linhas.every((l) => l.erro) || importando}
            >
              Importar {linhas.filter((l) => !l.erro).length} produtor
              {linhas.filter((l) => !l.erro).length === 1 ? "" : "es"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <tbody>
                  {resultados.map((r) => (
                    <tr key={r.linha} className="border-b border-border last:border-0">
                      <td className="p-2">{r.nome || "—"}</td>
                      <td className="p-2">
                        {r.status === "pendente" && (
                          <Loader2 className="size-3 animate-spin text-muted-foreground" />
                        )}
                        {r.status === "ok" && (
                          <Badge variant="default" className="text-[10px]">
                            Importado
                          </Badge>
                        )}
                        {r.status === "duplicado" && (
                          <Badge variant="secondary" className="text-[10px]">
                            Já existia
                          </Badge>
                        )}
                        {r.status === "falhou" && (
                          <Badge variant="destructive" className="text-[10px]">
                            Falhou
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {terminou ? (
              <>
                <p className="text-sm text-foreground">
                  <strong>{totalOk}</strong> importado{totalOk === 1 ? "" : "s"}
                  {totalDuplicado > 0 && ` · ${totalDuplicado} já existia(m)`}
                  {totalFalhou > 0 && ` · ${totalFalhou} falharam`}
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setOpen(false);
                    onDone();
                    reiniciar();
                  }}
                >
                  <X className="size-4" />
                  Fechar
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Importando, um por um…</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
