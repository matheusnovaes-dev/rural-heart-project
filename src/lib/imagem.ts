/**
 * Recorta a imagem em quadrado (pelo centro) e reduz para `lado` px, devolvendo um arquivo leve (WebP, ou JPEG onde o
 * navegador não gera WebP). Respeita a rotação da câmera do celular. Tudo no navegador: a foto original, que pode ter
 * vários MB, nunca é enviada.
 */
export async function reduzirParaQuadrado(
  arquivo: File,
  lado = 512,
): Promise<{ blob: Blob; extensao: "webp" | "jpg" }> {
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  try {
    const menor = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - menor) / 2;
    const sy = (bitmap.height - menor) / 2;
    const tela = document.createElement("canvas");
    tela.width = lado;
    tela.height = lado;
    const ctx = tela.getContext("2d");
    if (!ctx) throw new Error("sem canvas");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, sx, sy, menor, menor, 0, 0, lado, lado);
    const gerar = (tipo: string, qualidade: number) =>
      new Promise<Blob | null>((resolve) => tela.toBlob(resolve, tipo, qualidade));
    const webp = await gerar("image/webp", 0.85);
    if (webp && webp.type === "image/webp") return { blob: webp, extensao: "webp" };
    const jpg = await gerar("image/jpeg", 0.88);
    if (!jpg) throw new Error("não consegui gerar a imagem");
    return { blob: jpg, extensao: "jpg" };
  } finally {
    bitmap.close();
  }
}
