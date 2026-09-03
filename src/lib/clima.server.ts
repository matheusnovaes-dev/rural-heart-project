import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { buscarMunicipio, buscarPrevisao, buscarPrevisaoPorCoordenadas } from "@/lib/clima";

/**
 * Wrappers server-side das buscas de clima — o dashboard chamava CPTEC/
 * Open-Meteo direto do navegador do produtor, sujeito à mesma instabilidade
 * de rede externa que já foi corrigida do lado do bot (retry, timeout,
 * fallback CPTEC→Open-Meteo em src/lib/clima.ts), só que sem nenhuma
 * dessas proteções quando a chamada sai do browser. Rodar aqui (Cloudflare
 * Workers) dá pro dashboard a mesma robustez que o bot já tem.
 */
export const buscarPrevisaoServidor = createServerFn({ method: "GET" })
  .validator(z.object({ uf: z.string() }))
  .handler(async ({ data }) => buscarPrevisao(data.uf));

export const buscarPrevisaoPorCoordenadasServidor = createServerFn({ method: "GET" })
  .validator(z.object({ lat: z.number(), lon: z.number() }))
  .handler(async ({ data }) => buscarPrevisaoPorCoordenadas(data.lat, data.lon));

export const buscarMunicipioServidor = createServerFn({ method: "GET" })
  .validator(z.object({ nome: z.string(), nomeCompletoUf: z.string() }))
  .handler(async ({ data }) => buscarMunicipio(data.nome, data.nomeCompletoUf));
