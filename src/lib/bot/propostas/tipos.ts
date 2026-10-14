/**
 * Tipos do "estudo de proposta": o que se lê de uma foto/PDF (ou do que o
 * produtor escreve) e o que se calcula em cima disso. Tudo aqui é dado puro;
 * a leitura (lerMidia.ts) e a conta (avaliar.ts) ficam em arquivos separados.
 */
export type UnidadeDoPreco =
  "saca" | "arroba" | "tonelada" | "kg" | "litro" | "outra" | "nao_informada";

export type FreteLido = "fob_retirado" | "cif_entregue" | "nao_informado";

export type TipoDeDocumento =
  | "proposta_de_compra"
  | "tabela_de_precos"
  | "conversa_com_propostas"
  | "anotacao_de_precos"
  | "outro";

export type PropostaLida = {
  comprador: string | null;
  produto: string | null;
  preco: number | null;
  unidade_do_preco: UnidadeDoPreco;
  quantidade: number | null;
  unidade_da_quantidade: UnidadeDoPreco | null;
  prazo_pagamento_dias: number | null;
  pagamento_texto: string | null;
  frete: FreteLido;
  local_entrega: string | null;
  umidade_max_pct: number | null;
  impureza_max_pct: number | null;
  validade: string | null;
  observacoes: string | null;
  trecho_lido: string;
};

export type LeituraDeMidia = {
  tipo_documento: TipoDeDocumento;
  legivel: boolean;
  confianca: "alta" | "media" | "baixa";
  motivo: string | null;
  data_documento: string | null;
  propostas: PropostaLida[];
  observacoes_gerais: string | null;
};

/** Mídia que o n8n baixou do WhatsApp e entregou ao cérebro. */
export type MidiaRecebida = {
  tipo: "image" | "document";
  mime: string;
  base64: string;
  nome?: string | null;
  legenda?: string | null;
};

/** Preço de mercado contra o qual a proposta é comparada. */
export type ReferenciaDeMercado = {
  preco: number;
  /** Peso da saca em kg (60, 50...); null quando o produto é vendido por arroba ou litro. */
  kgPorSaca: number | null;
  unidade: "saca" | "arroba" | "litro";
  data: string;
  fonte: string;
  /** Como a referência foi montada, em português ("média das praças de MT"). */
  rotulo: string;
  min: number | null;
  max: number | null;
  origem: "estado" | "media_das_pracas" | "praca";
  /** Referência montada com outros estados (o do produtor não tem preço recente): serve só como aproximação. */
  aproximada?: boolean;
  /** Faixa dos últimos ~90 dias do mesmo preço; null quando há poucos pontos. */
  faixa90d: { min: number; max: number; pontos: number } | null;
};

export type PropostaAvaliada = {
  indice: number;
  comprador: string | null;
  produto: string | null;
  precoLido: number | null;
  unidadeLida: UnidadeDoPreco;
  /** Preço convertido para a unidade da referência (saca/arroba); null se não deu pra converter. */
  preco: number | null;
  conversao: string | null;
  prazoDias: number | null;
  frete: FreteLido;
  localEntrega: string | null;
  /** Equivalente à vista, quando há prazo e taxa; senão igual a `preco`. */
  precoEfetivo: number | null;
  custoDoPrazo: number | null;
  diferenca: number | null;
  diferencaPct: number | null;
  /** Quantidade em sacas/arrobas, vinda da proposta ou do que o produtor informou. */
  quantidade: number | null;
  diferencaTotal: number | null;
  umidadeMax: number | null;
  impurezaMax: number | null;
  validade: string | null;
  validadeVencida: boolean;
  /** Valor longe demais do mercado: provável erro de leitura ou de unidade. */
  suspeita: boolean;
  alertas: string[];
  veredito: "acima" | "em_linha" | "um_pouco_abaixo" | "abaixo" | "indefinido";
};
