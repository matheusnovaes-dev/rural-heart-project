/**
 * O nome da marca em duas cores: "Safra" na cor do texto e "lume" no laranja de destaque (o do sol do símbolo e dos botões).
 * O corte acompanha o próprio nome (safra + lume). O texto continua sendo "Safralume" para leitores de tela e busca.
 */
export function NomeMarca() {
  return (
    <>
      Safra<span className="text-[#ee942b]">lume</span>
    </>
  );
}
