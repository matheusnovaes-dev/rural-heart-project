/**
 * CPF e CNPJ: validação pelos dígitos verificadores e máscara. O texto que a pessoa escreve ao assinar pelo WhatsApp (ver
 * bot/checkoutWhatsapp.ts) não pode ir para a OpenAI nas próximas mensagens: o histórico do modelo passa por mascararDocumentos.
 */
export const soDigitos = (t: string) => t.replace(/\D/g, "");

export function cpfValido(cpf: string): boolean {
  const d = soDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const tamanho of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(d[i]) * (tamanho + 1 - i);
    const dv = ((soma * 10) % 11) % 10;
    if (dv !== Number(d[tamanho])) return false;
  }
  return true;
}

export function cnpjValido(cnpj: string): boolean {
  const d = soDigitos(cnpj);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (base: string, pesos: number[]) => {
    const soma = base.split("").reduce((s, c, i) => s + Number(c) * pesos[i]!, 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  return calc(d.slice(0, 12), p1) === Number(d[12]) && calc(d.slice(0, 13), p2) === Number(d[13]);
}

export const documentoValido = (t: string) => cpfValido(t) || cnpjValido(t);

/** Troca CPF/CNPJ VÁLIDOS por "[documento]" (histórico enviado ao modelo e texto salvo): documento não vai para a OpenAI. */
export function mascararDocumentos(texto: string): string {
  return texto.replace(/\d[\d./-]{9,17}\d/g, (m) => (documentoValido(m) ? "[documento]" : m));
}
