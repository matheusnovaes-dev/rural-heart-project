/**
 * Nomes de pessoas vindos de lugares sujos: perfil do WhatsApp ("😍LEIDE E JANDER🥰", "🔱D.Alveres🔱",
 * "Bia❤"), formulário opcional ("Produtor" quando a pessoa pula o campo). Servem para cumprimentar
 * ("Oi, Leide!") e para a cobrança (nome completo no CPF), então:
 *  - saudação: primeiro nome limpo, sem emoji;
 *  - cobrança: nome completo digitado pela própria pessoa na tela de pagamento.
 */
const NOME_GENERICO = /^(produtor|produtora|visitante|cliente|usuario|usuaria|amigo|amiga)$/i;
// Nome de propriedade ou empresa não é nome de pessoa: "Fazenda Boa Vista" não vira "Oi, Fazenda!".
const COMECA_COMO_EMPRESA =
  /^(fazenda|sitio|chacara|agro|agropecuaria|agricola|comercial|cooperativa|coop|grupo|loja|casa|armazem|transportadora)$/i;

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Tira emoji e símbolos, fica só com letras, espaço, hífen, apóstrofo e ponto. Null se não sobrar nome. */
export function limparNome(bruto: string | null | undefined): string | null {
  if (!bruto) return null;
  let s = bruto
    .normalize("NFC")
    .replace(/[^\p{L}\p{M}\s.'’-]/gu, " ")
    .replace(/\s*[.'’-]{2,}\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.'’-]+|[.'’-]+$/g, "")
    .trim();
  const letras = s.replace(/[^\p{L}]/gu, "");
  if (letras.length < 2) return null;
  // Tudo em maiúscula ("LEIDE E JANDER") ou tudo em minúscula vira Nome Próprio.
  if (s === s.toUpperCase() || s === s.toLowerCase()) {
    s = s
      .toLowerCase()
      .replace(/(^|[\s'’-])(\p{L})/gu, (_m, sep: string, c: string) => sep + c.toUpperCase());
  }
  if (NOME_GENERICO.test(s)) return null;
  return s;
}

/** Primeiro nome para cumprimentar, ou null se o texto não parece nome de pessoa. */
export function primeiroNome(bruto: string | null | undefined): string | null {
  const limpo = limparNome(bruto);
  if (!limpo) return null;
  const p = limpo.split(" ")[0]!;
  if (p.replace(/[^\p{L}]/gu, "").length < 2) return null;
  if (COMECA_COMO_EMPRESA.test(semAcento(p))) return null;
  return p;
}

/** Nome completo aceitável para cobrança: pelo menos duas palavras com pelo menos duas letras. */
export function nomeCompletoValido(bruto: string | null | undefined): boolean {
  const limpo = limparNome(bruto);
  if (!limpo) return false;
  const palavras = limpo.split(" ").filter((w) => w.replace(/[^\p{L}]/gu, "").length >= 2);
  return palavras.length >= 2;
}

/**
 * Decide o nome a usar na conversa. O nome do cadastro vence quando é de pessoa; senão cai no do
 * perfil do WhatsApp. `gravar` = vale gravar o nome do perfil no cadastro (só quando o cadastro
 * está sem nome útil: "Produtor", vazio ou só emoji). Nunca sobrescreve um nome que a pessoa digitou.
 */
export function resolverNome(
  nomeCadastro: string | null | undefined,
  nomeDoPerfil: string | null | undefined,
): { nome: string; gravar: boolean } {
  const doCadastro = primeiroNome(nomeCadastro) ? limparNome(nomeCadastro) : null;
  if (doCadastro) return { nome: doCadastro, gravar: false };
  const doPerfil = primeiroNome(nomeDoPerfil) ? limparNome(nomeDoPerfil) : null;
  if (doPerfil) return { nome: doPerfil, gravar: true };
  return { nome: "", gravar: false };
}
