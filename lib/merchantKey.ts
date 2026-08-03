// Normaliza a descrição de um movimento para uma "chave de comerciante",
// para a memória saber que "PINGO D" e "PINGO DOCE RIBA AVE" são o mesmo sítio.

const NOISE =
  /\b(COMPRAS?|COMPRA|CDEB|DEB|CRT|CARTAO|PAGAMENTO|COM|TRF|MBWAY|TFI|TRANSFERENCIA|PARA|LEVANTAMENTO|ATUAL|PT|LDA|UNIP)\b/g;

export function cleanDesc(d: string): string {
  let s = d.toUpperCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  s = s.replace(/[^A-Z0-9 ]/g, " ");
  s = s.replace(/\b\d+\b/g, " ");
  s = s.replace(NOISE, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

export function merchantKey(desc: string): string {
  const c = cleanDesc(desc);
  const words = c.split(" ").filter((w) => w.length >= 2);
  if (words.length === 0) return c || desc.trim().toUpperCase();
  // Palavra distintiva (>=4 letras) chega como chave; senão junta duas.
  if (words[0].length >= 4) return words[0];
  return words.slice(0, 2).join(" ");
}
