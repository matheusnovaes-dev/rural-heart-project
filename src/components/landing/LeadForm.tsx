import { useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { normalizarWhatsapp } from "@/lib/telefone";
import { useAuth } from "@/lib/auth";
import { pricingPlans } from "@/config/site";
import { ufs } from "@/config/ufs";
import { enviarBoasVindasWhatsApp } from "@/lib/notificacoes.server";
import { trackCadastroConcluido, trackCadastroIniciado } from "@/lib/metaPixel";
import { trackConversaoServidor } from "@/lib/metaCapi.server";

const leadSchema = z.object({
  name: z.string().min(2, "Digite seu nome completo"),
  whatsapp: z
    .string()
    .min(10, "Digite um WhatsApp válido com DDD")
    .regex(/^[\d\s()+-]+$/, "Use apenas números, espaços e símbolos de telefone"),
  crop: z.string().min(1, "Selecione sua cultura principal"),
  uf: z.string().min(2, "Selecione seu estado"),
  plano: z.enum(["bronze", "prata", "ouro"]),
});

type LeadFormValues = z.infer<typeof leadSchema>;

const cropOptions = [
  { value: "soja", label: "Soja" },
  { value: "milho", label: "Milho" },
  { value: "outra", label: "Outra cultura" },
];

export function LeadForm({ className }: { className?: string }) {
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [erroMsg, setErroMsg] = useState("");
  const [cadastroJaExiste, setCadastroJaExiste] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const jaTrackouInicioRef = useRef(false);

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: { name: "", whatsapp: "", crop: "", uf: "", plano: "bronze" },
  });

  // Etapa 1 pede só o WhatsApp, pra reduzir a fricção de encarar 5 campos
  // de uma vez assim que a pessoa chega vinda de um anúncio. Só valida o
  // campo whatsapp (não o formulário inteiro) antes de liberar a etapa 2.
  // O cadastro em si continua sendo um único submit no fim, sem nenhuma
  // mudança na lógica de criação de conta abaixo.
  async function avancarParaEtapa2() {
    const valido = await form.trigger("whatsapp");
    if (!valido) return;
    if (!jaTrackouInicioRef.current) {
      jaTrackouInicioRef.current = true;
      const whatsapp = normalizarWhatsapp(form.getValues("whatsapp"));
      trackCadastroIniciado();
      // O query builder do supabase-js só dispara o fetch quando algo
      // consome a Promise (await ou .then) — um "void" sozinho nunca chega
      // a mandar a requisição (achado real: isso já tinha quebrado em
      // silêncio o log de falha e o insert em "leads", ver correções nos
      // dois). .then() em vez de await de propósito: log é best-effort e
      // não pode atrasar a transição pra etapa 2. Limite conhecido: se a
      // pessoa recarregar a página na mesma fração de segundo do clique, o
      // navegador cancela essa requisição em voo (testado sendBeacon como
      // alternativa, mas o CORS do Supabase bloqueia por causa do
      // Access-Control-Allow-Origin "*" combinado com credentials). Caso
      // raro e sem impacto no cadastro em si, que é sempre aguardado.
      supabase
        ?.from("cadastro_iniciados")
        .insert({ whatsapp })
        .then(() => {});
    }
    setStep(2);
  }

  // Antes, quando o cadastro falhava aqui, a pessoa só via o toast de erro
  // e isso se perdia pra sempre — sem nenhum jeito de saber depois quantas
  // tentativas reais de cadastro estavam quebrando, e em qual etapa.
  // Fire-and-forget de propósito: um erro ao logar o erro não pode travar
  // a experiência de quem já está tendo um problema.
  async function logarFalhaCadastro(
    etapa: "auth" | "produtor" | "assinatura",
    erro: string,
    whatsapp?: string,
  ) {
    // Precisa de await de verdade — sem isso, o insert nunca chega a sair
    // (query builder do supabase-js é lazy, só dispara ao ser consumido).
    await supabase?.from("cadastro_falhas").insert({ origem: "leadform", etapa, erro, whatsapp });
  }

  async function onSubmit(values: LeadFormValues) {
    // Proteção extra: o form fica dentro de uma única tag <form>, então um
    // Enter no campo da etapa 1 poderia disparar submit nativo antes da
    // pessoa ver os campos da etapa 2. Isso bloqueia esse caminho mesmo se
    // o Enter escapar do onKeyDown da etapa 1.
    if (step !== 2) return;
    if (!isSupabaseConfigured || !supabase) return;
    setStatus("submitting");
    setErroMsg("");
    setCadastroJaExiste(false);

    // Preenchendo esse formulário já é o cadastro inteiro — sem e-mail/senha
    // pra pedir, gera uma conta técnica a partir do próprio WhatsApp (único
    // por produtor) só pra existir uma sessão logada. A pessoa nunca
    // precisa saber desse e-mail/senha: ela já sai daqui direto pro painel.
    const whatsapp = normalizarWhatsapp(values.whatsapp);
    const email = `lead-${whatsapp}@safralume.app`;
    const senha = crypto.randomUUID();

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: senha,
    });
    if (authError || !authData.user) {
      await logarFalhaCadastro("auth", authError?.message ?? "sem usuário retornado", values.whatsapp);
      setErroMsg(
        authError?.message.includes("already registered")
          ? "Esse WhatsApp já tem um teste iniciado. Chama no WhatsApp pra gente ajudar a recuperar o acesso."
          : "Não conseguimos iniciar seu teste agora. Chama no WhatsApp pra gente ajudar.",
      );
      setStatus("error");
      return;
    }

    // signUp() às vezes resolve antes da sessão estar de fato "commitada"
    // no cliente — sem isso, o insert seguinte pode sair sem autenticação
    // e falhar por RLS de forma intermitente. Fixa a sessão explicitamente
    // antes de continuar.
    if (authData.session) {
      await supabase.auth.setSession({
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
      });
    }

    const { data: produtor, error: produtorError } = await supabase
      .from("produtores")
      .insert({
        user_id: authData.user.id,
        nome: values.name,
        whatsapp,
        cultura_principal: values.crop || null,
        uf: values.uf || null,
      })
      .select("id")
      .single();
    if (produtorError || !produtor) {
      await logarFalhaCadastro("produtor", produtorError?.message ?? "sem produtor retornado", whatsapp);
      // 23505 = esse WhatsApp já tem cadastro (quase sempre feito pela
      // própria conversa do bot, sem login). Diz isso e aponta o caminho que
      // funciona (criar acesso em /login, que reaproveita o cadastro), em
      // vez de um erro genérico. Sai da conta técnica que o signUp acabou
      // de abrir, pra não deixar o navegador logado numa conta vazia.
      if (produtorError?.code === "23505") {
        await supabase.auth.signOut();
        setCadastroJaExiste(true);
        setErroMsg("");
      } else {
        setErroMsg("Não conseguimos salvar seu cadastro agora. Chama no WhatsApp pra gente ajudar.");
      }
      setStatus("error");
      return;
    }

    const { error: assinaturaError } = await supabase
      .from("assinaturas")
      .insert({ produtor_id: produtor.id, plano: values.plano });
    if (assinaturaError) {
      await logarFalhaCadastro("assinatura", assinaturaError.message, whatsapp);
      setErroMsg("Não conseguimos configurar seu teste agora. Chama no WhatsApp pra gente ajudar.");
      setStatus("error");
      return;
    }

    // Best-effort: mantém o registro pra acompanhamento/analytics, mas não
    // pode atrasar o redirecionamento pro dashboard — por isso .then() em
    // vez de await (precisa de um dos dois pra sair de verdade, ver
    // comentário em logarFalhaCadastro; erro aqui é ignorado de propósito).
    supabase
      .from("leads")
      .insert({ name: values.name, whatsapp: values.whatsapp, crop: values.crop })
      .then(() => {});

    // Também best-effort: quem se cadastra precisa saber que existe um
    // WhatsApp pra chamar — em vez de esperar ela descobrir sozinha, o bot
    // já chama primeiro se apresentando.
    void enviarBoasVindasWhatsApp({
      data: { nome: values.name, whatsapp, plano: values.plano },
    });

    // Conversão de verdade pro Meta Ads: este formulário é o CTA principal
    // da Hero (âncora #comece) — o caminho que a maioria do tráfego de
    // anúncio realmente usa pra se cadastrar, diferente do /onboarding
    // (só quem passa pela seção de Planos). Achado 2026-09-17: o fix de
    // Pixel+CAPI de dias atrás só cobria o /onboarding — esse formulário
    // aqui completava o cadastro inteiro (auth+produtor+assinatura) sem
    // NUNCA disparar o evento, o que por si só explicava o "zero eventos
    // de Cadastro completo" no Meta apesar de cadastros reais acontecendo.
    const eventId = crypto.randomUUID();
    const valorPlano = pricingPlans.find((p) => p.id === values.plano)?.price;
    trackCadastroConcluido({ plano: values.plano, valor: valorPlano, eventId });
    void trackConversaoServidor({
      data: { eventId, plano: values.plano, valor: valorPlano, whatsapp },
    });

    // O AuthProvider já buscou o perfil (produtor) reagindo ao signUp() —
    // ANTES de este código ter criado a linha em `produtores`. Sem recarregar
    // agora, o guard do /dashboard ainda vê "sem produtor" e manda pro
    // /onboarding, mesmo com o cadastro já criado com sucesso.
    await refresh();
    navigate({ to: "/dashboard" });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={`flex flex-col gap-4 ${className ?? ""}`}
      >
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span
            className={`h-1 flex-1 rounded-full ${step >= 1 ? "bg-primary" : "bg-border"}`}
          />
          <span
            className={`h-1 flex-1 rounded-full ${step >= 2 ? "bg-primary" : "bg-border"}`}
          />
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {step === 1 ? (
            <motion.div
              key="etapa-1"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-4"
            >
              <FormField
                control={form.control}
                name="whatsapp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="(00) 00000-0000"
                        type="tel"
                        autoComplete="tel"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void avancarParaEtapa2();
                          }
                        }}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="button"
                size="lg"
                onClick={() => void avancarParaEtapa2()}
                className="bg-cta text-cta-foreground hover:bg-cta/90 mt-2"
              >
                Continuar
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Sem cartão de crédito. Cancele quando quiser.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="etapa-2"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-4"
            >
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" />
                Voltar
              </button>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Seu nome" autoComplete="name" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="crop"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cultura principal</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione sua cultura" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {cropOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="uf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado (UF)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione seu estado" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ufs.map((uf) => (
                          <SelectItem key={uf.value} value={uf.value}>
                            {uf.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="plano"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plano pra testar</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione o plano" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {pricingPlans.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} (R$ {p.price}/mês)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                size="lg"
                disabled={status === "submitting"}
                className="bg-cta text-cta-foreground hover:bg-cta/90 mt-2"
              >
                {status === "submitting" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Preparando seu painel...
                  </>
                ) : (
                  "Testar grátis por 7 dias"
                )}
              </Button>

              {status === "error" && cadastroJaExiste && (
          <p className="text-sm text-destructive">
            Esse WhatsApp já tem um cadastro feito pela conversa. Pra abrir o painel,{" "}
            <Link
              to="/login"
              search={{ plano: form.getValues("plano") }}
              className="font-medium underline underline-offset-2"
            >
              crie seu acesso aqui
            </Link>{" "}
            com este mesmo WhatsApp: o cadastro e o teste grátis são mantidos.
          </p>
        )}
        {status === "error" && !cadastroJaExiste && (
          <p className="text-sm text-destructive">{erroMsg}</p>
        )}

              <p className="text-center text-xs text-muted-foreground">
                Sem cartão de crédito. Cancele quando quiser.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </Form>
  );
}
