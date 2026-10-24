import type { Plugin } from "vite";

/**
 * Só em desenvolvimento: as ferramentas do TanStack (vindas do @lovable.dev/vite-tanstack-config) põem um atributo
 * `data-tsd-source` em todo JSX, e o React Three Fiber trata qualquer atributo com hífen como caminho de propriedade 3D
 * ("data.tsd.source"), o que quebra a cena das páginas legais. Aqui o atributo sai dos arquivos 3D (pasta legal3d). Em
 * produção o atributo nunca existe; este plugin não faz nada no build.
 */
export function semFonteNo3d(): Plugin {
  return {
    name: "safralume:sem-fonte-no-3d",
    apply: "serve",
    transform(code, id) {
      if (!/\/legal3d\//.test(id) || !code.includes("data-tsd-source")) return null;
      return {
        code: code
          .replace(/\s+data-tsd-source="[^"]*"/g, "")
          .replace(/"data-tsd-source":\s*"[^"]*",?/g, ""),
        map: null,
      };
    },
  };
}
