const CENTRO = 100;
const RAIO = 80;

// Mesmos limiares de src/lib/sinalVenda.ts (LIMITE_POSICAO_BAIXO/ALTO) — o
// gauge tem que concordar com o texto que ele ilustra, nunca ter um limiar
// próprio que poderia divergir se um dos dois mudar sozinho no futuro.
const LIMITE_BAIXO = 30;
const LIMITE_ALTO = 70;

function pontoNoArco(anguloGraus: number, raio: number) {
  const rad = (anguloGraus * Math.PI) / 180;
  return { x: CENTRO + raio * Math.cos(rad), y: CENTRO - raio * Math.sin(rad) };
}

// Semicírculo de 180°: 0% de posição = ponta esquerda (ângulo 180°), 100% =
// ponta direita (ângulo 0°), passando por cima — por isso sempre
// large-arc-flag 0 (arco menor) e sweep-flag 1 (sentido horário na tela).
function arco(anguloInicio: number, anguloFim: number, raio: number) {
  const p1 = pontoNoArco(anguloInicio, raio);
  const p2 = pontoNoArco(anguloFim, raio);
  return `M ${p1.x},${p1.y} A ${raio},${raio} 0 0,1 ${p2.x},${p2.y}`;
}

const anguloDoLimiar = (limiarPct: number) => 180 - (limiarPct / 100) * 180;

/**
 * Velocímetro do "Sinal de venda": traduz a posição do preço de hoje dentro
 * da faixa dos últimos 90 dias (0-100, já calculada em
 * InsightsPanel/calcularPosicao) num gauge de 3 zonas, em vez de só texto.
 * Pedido do Matheus 2026-10-09 — "Sinal de venda" é o insight mais
 * sofisticado do painel (cruza posição + futuros B3 + clima), mas até aqui
 * só aparecia como frase.
 */
export function SinalVendaGauge({ posicao }: { posicao: number }) {
  const posicaoClampada = Math.max(0, Math.min(100, posicao));
  const anguloAgulha = 180 - (posicaoClampada / 100) * 180;
  const ponta = pontoNoArco(anguloAgulha, RAIO - 18);
  const anguloBaixo = anguloDoLimiar(LIMITE_BAIXO);
  const anguloAlto = anguloDoLimiar(LIMITE_ALTO);

  return (
    <svg viewBox="0 0 200 115" className="h-20 w-full" aria-hidden="true">
      <path
        d={arco(180, anguloBaixo, RAIO)}
        stroke="var(--destructive)"
        strokeWidth="14"
        strokeLinecap="round"
        fill="none"
        opacity={0.8}
      />
      <path
        d={arco(anguloBaixo, anguloAlto, RAIO)}
        stroke="var(--muted-foreground)"
        strokeWidth="14"
        strokeLinecap="round"
        fill="none"
        opacity={0.3}
      />
      <path
        d={arco(anguloAlto, 0, RAIO)}
        stroke="var(--primary)"
        strokeWidth="14"
        strokeLinecap="round"
        fill="none"
        opacity={0.8}
      />
      <line
        x1={CENTRO}
        y1={CENTRO}
        x2={ponta.x}
        y2={ponta.y}
        stroke="var(--foreground)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx={CENTRO} cy={CENTRO} r="5" fill="var(--foreground)" />
      <text x="14" y="112" className="fill-muted-foreground text-[9px] font-semibold uppercase">
        Baixo
      </text>
      <text
        x="186"
        y="112"
        textAnchor="end"
        className="fill-muted-foreground text-[9px] font-semibold uppercase"
      >
        Alto
      </text>
    </svg>
  );
}
