/**
 * Quem representa uma cooperativa ou corretora não deve virar "produtor" no cadastro pelo chat: o
 * painel da equipe (convidar produtores, risco climático agregado) é criado no site, na opção
 * "Represento uma cooperativa" do cadastro completo (a partir do plano Prata). O bot reconhece o
 * pedido por código, manda o caminho certo e avisa a equipe, porque cooperativa é lead de alto valor.
 */
import { MARCADOR_DE_CONTATO } from "@/lib/bot/contatoHumano";
import type { HistoricoLinha } from "@/lib/bot/prompt";

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const ORGANIZACAO = "(?:cooperativas?|corretoras?|cooperativa de [a-z ]{3,30})";

// Só o que deixa claro que a PESSOA representa/trabalha na organização. "Entrego na minha cooperativa"
// ou "vendo pra cooperativa" é produtor falando do comprador e fica de fora.
const PADROES = [
  new RegExp(`\\brepresent\\w*\\b.{0,25}\\b${ORGANIZACAO}`),
  new RegExp(`\\bsou\\s+(?:d[aoe]|de\\s+uma|da\\s+uma)\\s+${ORGANIZACAO}`),
  new RegExp(
    `\\b(?:trabalho|atuo|sou\\s+funcionari[oa])\\s+(?:n[aoe]|em|numa?|de\\s+uma?)\\s+${ORGANIZACAO}`,
  ),
  new RegExp(`\\b(?:cadastrar|registrar|criar|abrir)\\b.{0,20}\\b${ORGANIZACAO}`),
  new RegExp(`\\b(?:plano|painel|conta|cadastro)\\s+(?:pra|para|de)\\s+${ORGANIZACAO}`),
  /\bsou\s+(?:gerente|diretor|diretora|presidente|coordenador|coordenadora)\s+d[aeo]\b.{0,30}\b(?:cooperativa|corretora)/,
  /\bsou\s+(?:corretor|corretora)\s+de\s+(?:graos|cafe|gado|soja|milho)/,
  // "mudar meu cadastro para corretor" (achado 2026-10-15). "trocar de corretor" é do produtor e fica de fora.
  /\b(?:mudar|trocar|alterar|passar|converter)\b.{0,30}\b(?:cadastro|conta|perfil|plano)\b.{0,20}\b(?:para|pra)\s+(?:corretor|corretora|cooperativa)/,
];

export function ehInteresseDeCooperativa(texto: string): boolean {
  const t = semAcento(texto);
  return PADROES.some((p) => p.test(t));
}

export const LINK_CADASTRO_COOPERATIVA = "https://safralume.com.br/login?plano=prata";
const MARCA = "Represento uma cooperativa";

/**
 * @param jaRespondeu true quando a última resposta do bot já foi esta: não avisa a equipe de novo.
 */
export function respostaDeCooperativa(jaRespondeu: boolean): {
  resposta: string;
  precisa_humano: boolean;
} {
  if (jaRespondeu) {
    return {
      resposta: `Anotado! O caminho é o mesmo: crie sua conta em ${LINK_CADASTRO_COOPERATIVA} e escolha "${MARCA}". Se travar em algum passo, é só me falar aqui.`,
      precisa_humano: false,
    };
  }
  return {
    resposta: `Que bom ter você por aqui! 🌾 Pra cooperativa ou corretora o cadastro é pelo site, porque lá você cria o painel da equipe e convida seus produtores. Crie sua conta em ${LINK_CADASTRO_COOPERATIVA} e escolha "${MARCA}" (o teste grátis de 7 dias vale também). ${MARCADOR_DE_CONTATO} e alguém te chama aqui no WhatsApp pra ajudar no que precisar.`,
    precisa_humano: true,
  };
}

/** A última resposta do bot já foi a de cooperativa? */
export function ultimaFoiDeCooperativa(historico: HistoricoLinha[]): boolean {
  const ultima = [...historico]
    .sort((a, b) => b.ordem - a.ordem)
    .find((h) => h.role === "assistant")?.conteudo;
  return !!ultima && ultima.includes(`escolha "${MARCA}"`);
}
