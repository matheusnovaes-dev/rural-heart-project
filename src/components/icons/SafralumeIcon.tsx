// Conjunto de 33 ícones personalizados da marca (pedido do Matheus
// 2026-10-11, arquivo original em círculos verde-escuro com o estilo da
// marca) — recortados em public/icons/*.png, cada um já com o próprio fundo
// circular, então NUNCA colocar dentro do chip colorido (bg-primary/10
// rounded-lg) que os ícones da lib usavam: o círculo já vem pronto na imagem.
export const SAFRALUME_ICONES = [
  "soja",
  "milho",
  "cafe",
  "trigo",
  "boi-gordo",
  "suino",
  "preco-alta",
  "preco-baixa",
  "preco",
  "saca",
  "porto",
  "frete",
  "geada",
  "chuva",
  "clima-sol",
  "ferrugem-asiatica",
  "janela-plantio",
  "sinal-venda",
  "calculadora-safra",
  "alerta",
  "lembrete",
  "relatorio",
  "dolar",
  "diesel",
  "bolsa-b3",
  "leilao",
  "equipe",
  "cooperativa",
  "consultor-mapa",
  "dado-oficial",
  "sinal-fraco",
  "paridade",
  "whatsapp",
] as const;

export type SafralumeIconeNome = (typeof SAFRALUME_ICONES)[number];

export function SafralumeIcon({
  nome,
  className,
  alt = "",
}: {
  nome: SafralumeIconeNome;
  className?: string;
  alt?: string;
}) {
  // lazy + decoding async: sem isso o React 19 emitia <link rel="preload"> pra
  // cada um destes PNGs (todos abaixo da dobra) no <head>, competindo com a
  // foto do hero na conexão lenta de quem chega do celular.
  return (
    <img
      src={`/icons/${nome}.png`}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
    />
  );
}

/**
 * Um componente pronto por ícone (ex: IconesSafralume.alerta), pra usar nos
 * lugares que esperam uma REFERÊNCIA de componente em vez de JSX já
 * renderizado — mesmo formato de um ícone da lucide-react (recebe
 * className), então serve de substituto direto onde o prop já aceitava
 * esse formato (ex: PageHeader `icon={IconesSafralume.alerta}`).
 */
export const IconesSafralume: Record<
  SafralumeIconeNome,
  (props: { className?: string }) => React.JSX.Element
> = Object.fromEntries(
  SAFRALUME_ICONES.map((nome) => [
    nome,
    ({ className }: { className?: string | undefined }) =>
      className === undefined ? (
        <SafralumeIcon nome={nome} />
      ) : (
        <SafralumeIcon nome={nome} className={className} />
      ),
  ]),
) as Record<SafralumeIconeNome, (props: { className?: string }) => React.JSX.Element>;
