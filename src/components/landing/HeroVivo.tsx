import { MIDIA } from "@/assets/midia";

/**
 * Camadas vivas do fundo do hero (só o fundo: os textos não mudam). Tudo é CSS e só mexe em transform e opacidade
 * (composto na GPU, sem JavaScript, sem recalcular layout), então funciona igual no celular e no desktop:
 *  - HeroTrigo: a metade de baixo da foto (a lavoura) duplicada e balançando de leve, como vento passando no trigo;
 *  - HeroLuz: brilho suave do sol no horizonte (pulsando devagar) e poeira de grãos subindo.
 *    (Raios de sol e nuvens de luz foram testados e removidos: viravam faixas e um "furo" em forma de estrela.)
 * No desktop com a máquina boa o WebGL (vento na foto e partículas) assume o lugar do balanço e da poeira em CSS
 * (a classe "lenis" no <html> esconde essas duas). Quem prefere menos movimento vê tudo parado.
 */
/**
 * Céu à deriva (celular): a foto duplicada, recortada só até a linha das árvores e com a borda de baixo esmaecida, desliza
 * devagar de lado por cima da foto parada. Como a cópia cobre o céu inteiro e some antes do horizonte, as nuvens se
 * movem sem aparecer duas vezes. Fica DENTRO da camada com paralaxe da foto (mesma geometria) e usa unidades de contêiner
 * para achar o horizonte em qualquer tela. No desktop o shader de vento faz o mesmo na própria textura.
 */
export function HeroCeu() {
  return (
    <div aria-hidden="true" className="hero-ceu pointer-events-none absolute inset-0">
      <img
        src={MIDIA.hero828}
        srcSet={`${MIDIA.hero828} 828w, ${MIDIA.hero1920} 1920w`}
        sizes="100vw"
        alt=""
        decoding="async"
        loading="lazy"
        className="hero-ceu-img absolute inset-y-0 inset-x-[-6%] h-full w-[112%] max-w-none object-cover object-[50%_62%]"
      />
    </div>
  );
}

export function HeroTrigo() {
  return (
    <div
      aria-hidden="true"
      className="hero-trigo pointer-events-none absolute inset-x-0 top-[48%] bottom-[-14%] overflow-hidden"
    >
      <img
        src={MIDIA.hero828}
        srcSet={`${MIDIA.hero828} 828w, ${MIDIA.hero1920} 1920w`}
        sizes="100vw"
        alt=""
        decoding="async"
        loading="lazy"
        className="hero-trigo-img absolute inset-x-[-4%] top-[-48%] h-[208%] w-[108%] max-w-none object-cover object-[50%_62%]"
      />
    </div>
  );
}

// posição horizontal (%), tamanho (px), duração (s), atraso (s), deslocamento lateral (px)
const POEIRA = [
  [8, 3, 16, 0, 24],
  [24, 4, 18, 9, 30],
  [33, 2, 24, 2, -26],
  [49, 2, 22, 6, -14],
  [57, 4, 17, 1, 28],
  [72, 3, 20, 5, 18],
  [80, 4, 18, 14, -30],
  [88, 2, 25, 8, 16],
  [94, 3, 21, 3, -20],
] as const;

export function HeroLuz() {
  return (
    <div
      aria-hidden="true"
      className="hero-luz pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="hero-sol" />
      <div className="hero-poeira">
        {POEIRA.map(([x, t, d, a, l], i) => (
          <span
            key={i}
            style={{
              left: `${x}%`,
              width: t,
              height: t,
              animationDuration: `${d}s`,
              animationDelay: `-${a}s`,
              ["--vai" as string]: `${l}px`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
