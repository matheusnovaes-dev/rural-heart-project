import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CheckCircle2, Loader2 } from "lucide-react";

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
import { buildWhatsAppLink } from "@/config/site";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const leadSchema = z.object({
  name: z.string().min(2, "Digite seu nome completo"),
  whatsapp: z
    .string()
    .min(10, "Digite um WhatsApp válido com DDD")
    .regex(/^[\d\s()+-]+$/, "Use apenas números, espaços e símbolos de telefone"),
  crop: z.string().min(1, "Selecione sua cultura principal"),
});

type LeadFormValues = z.infer<typeof leadSchema>;

const cropOptions = [
  { value: "soja", label: "Soja" },
  { value: "milho", label: "Milho" },
  { value: "outra", label: "Outra cultura" },
];

export function LeadForm({ className }: { className?: string }) {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: { name: "", whatsapp: "", crop: "" },
  });

  async function onSubmit(values: LeadFormValues) {
    setStatus("submitting");

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from("leads").insert({
        name: values.name,
        whatsapp: values.whatsapp,
        crop: values.crop,
      });

      if (error) {
        console.error("Failed to save lead", error);
        setStatus("error");
        return;
      }
    }

    setStatus("success");

    const cropLabel = cropOptions.find((c) => c.value === values.crop)?.label ?? values.crop;
    const message = `Olá! Sou ${values.name}, produtor de ${cropLabel}. Quero testar o Safralume grátis por 7 dias.`;
    window.open(buildWhatsAppLink(message), "_blank", "noopener,noreferrer");
  }

  if (status === "success") {
    return (
      <div
        className={`flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-6 py-8 text-center ${className ?? ""}`}
      >
        <CheckCircle2 className="size-10 text-primary" />
        <p className="text-lg font-semibold text-foreground">Recebemos seus dados!</p>
        <p className="text-sm text-muted-foreground">
          Abrimos o WhatsApp para você continuar a conversa. Se não abriu, fale com a gente por lá
          mesmo.
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={`flex flex-col gap-4 ${className ?? ""}`}
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome completo</FormLabel>
              <FormControl>
                <Input placeholder="Seu nome" autoComplete="name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="whatsapp"
          render={({ field }) => (
            <FormItem>
              <FormLabel>WhatsApp</FormLabel>
              <FormControl>
                <Input placeholder="(00) 00000-0000" type="tel" autoComplete="tel" {...field} />
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

        <Button
          type="submit"
          size="lg"
          disabled={status === "submitting"}
          className="bg-cta text-cta-foreground hover:bg-cta/90 mt-2"
        >
          {status === "submitting" ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Enviando...
            </>
          ) : (
            "Testar grátis por 7 dias"
          )}
        </Button>

        {status === "error" && (
          <p className="text-sm text-destructive">
            Não conseguimos salvar seus dados agora, mas você já pode falar com a gente no WhatsApp.
          </p>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Sem cartão de crédito. Cancele quando quiser.
        </p>
      </form>
    </Form>
  );
}
