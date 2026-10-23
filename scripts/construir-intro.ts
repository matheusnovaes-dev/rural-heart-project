/**
 * Gera o pacote separado da abertura 3D (public/intro/lavoura-<hash>.js) e grava o nome em
 * src/components/landing/introArquivo.ts (usado pelo script do head). Rodar SEMPRE que mexer em
 * src/components/landing/desktop/introLavoura*.ts ou qualidade.ts:  bun run build:intro
 */
import { readdirSync, rmSync, writeFileSync } from "fs";

const PASTA = "public/intro";
for (const f of (() => {
  try {
    return readdirSync(PASTA);
  } catch {
    return [];
  }
})())
  rmSync(`${PASTA}/${f}`);
const r = await Bun.build({
  entrypoints: ["src/components/landing/desktop/introLavouraEntrada.ts"],
  outdir: PASTA,
  target: "browser",
  format: "esm",
  minify: true,
  naming: "lavoura-[hash].[ext]",
});
if (!r.success) {
  console.error(r.logs);
  process.exit(1);
}
const nome = r.outputs[0]!.path.split("/").pop()!;
writeFileSync(
  "src/components/landing/introArquivo.ts",
  `// Gerado por scripts/construir-intro.ts (bun run build:intro). Não editar à mão.\nexport const ARQUIVO_INTRO_3D = "/intro/${nome}";\n`,
);
console.log("ok", `/intro/${nome}`, Math.round(r.outputs[0]!.size / 1024), "KB");
