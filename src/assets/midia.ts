// URLs das imagens e vídeos da landing, importadas pelo bundler (?url): saem com hash no nome em /assets/, o que dá
// cache de 1 ano com "immutable" (a hospedagem só faz isso para /assets) e troca automática quando o arquivo muda.
import hero640 from "@/assets/hero-field-640.webp?url";
import hero1000Webp from "@/assets/hero-field-1000.webp?url";
import hero1000Jpg from "@/assets/hero-field-1000.jpg?url";
import logo from "@/assets/logo-icon.webp?url";
import posterComoFunciona from "@/assets/como-funciona-poster.webp?url";
import soja640 from "@/assets/soybean-field-640.webp?url";
import sojaWebp from "@/assets/soybean-field.webp?url";
import sojaJpg from "@/assets/soybean-field.jpg?url";
import videoDesktop from "@/assets/como-funciona-desktop.mp4?url";
import videoMobile from "@/assets/como-funciona-mobile.mp4?url";

export const MIDIA = {
  hero640,
  hero1000Webp,
  hero1000Jpg,
  logo,
  posterComoFunciona,
  soja640,
  sojaWebp,
  sojaJpg,
  /** 1920x1080, para telas largas */
  videoDesktop,
  /** 864x1080 (corte 4:5 do centro, resolução nativa da fonte), para celular */
  videoMobile,
} as const;
