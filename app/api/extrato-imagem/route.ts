import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
// Ler um print demora mais do que o limite normal de uma função na Vercel.
export const maxDuration = 60;

const MEDIA = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
type Media = (typeof MEDIA)[number];

/** 5 MB — acima disto o pedido fica lento e a Vercel corta-o. */
const MAX_BYTES = 5 * 1024 * 1024;

const SYSTEM = `És um leitor de extratos bancários portugueses. Recebes a imagem de
um extrato ou de uma lista de movimentos e devolves os movimentos que lá estão.

Regras:
- Lê TODOS os movimentos visíveis, de cima para baixo.
- "amount" é sempre positivo. O sinal vive no "kind".
- "kind" é "gasto" quando o dinheiro saiu e "entrada" quando entrou. Guia-te pelo
  sinal ou pela cor: um valor a verde ou com "+" é entrada.
- "date" em formato YYYY-MM-DD. Se a imagem não mostrar o ano, usa o ano indicado
  na mensagem.
- "description" é o texto do movimento como aparece, sem inventar nem abreviar.
- NÃO inventes movimentos. Se um valor ou uma data estiverem ilegíveis, não
  adivinhes: deixa esse movimento de fora e escreve-o em "avisos".
- Se a imagem não for um extrato, devolve a lista vazia e explica em "avisos".`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["movimentos", "avisos"],
  properties: {
    movimentos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "description", "amount", "kind"],
        properties: {
          date: { type: "string", description: "YYYY-MM-DD" },
          description: { type: "string" },
          amount: { type: "number", description: "sempre positivo" },
          kind: { type: "string", enum: ["gasto", "entrada"] },
        },
      },
    },
    avisos: {
      type: "array",
      items: { type: "string" },
      description: "o que ficou por ler ou levantou duvidas",
    },
  },
} as const;

type Lido = {
  movimentos: Array<{ date: string; description: string; amount: number; kind: "gasto" | "entrada" }>;
  avisos: string[];
};

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Falta a ANTHROPIC_API_KEY no servidor." }, { status: 501 });
  }

  let body: { image?: string; mediaType?: string; ano?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Pedido invalido." }, { status: 400 });
  }

  const { image, mediaType, ano } = body;
  if (!image || !mediaType) {
    return NextResponse.json({ error: "Falta a imagem." }, { status: 400 });
  }
  if (!MEDIA.includes(mediaType as Media)) {
    return NextResponse.json(
      { error: `Formato nao suportado: ${mediaType}. Usa PNG, JPEG, WEBP ou GIF.` },
      { status: 415 }
    );
  }
  // base64 cresce ~4/3 face ao ficheiro original
  if ((image.length * 3) / 4 > MAX_BYTES) {
    return NextResponse.json({ error: "Imagem demasiado grande (maximo 5 MB)." }, { status: 413 });
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 16000,
      system: SYSTEM,
      // Extrair nao e raciocinio dificil: esforco medio le igual e custa menos.
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType as Media, data: image } },
            {
              type: "text",
              text: `Le os movimentos deste extrato.${ano ? ` Se faltar o ano, assume ${ano}.` : ""}`,
            },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "O modelo recusou ler esta imagem." }, { status: 422 });
    }

    const texto = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const lido = JSON.parse(texto) as Lido;

    // O que vem de fora nunca entra sem ser verificado.
    const movimentos = (lido.movimentos ?? []).filter(
      (m) =>
        /^\d{4}-\d{2}-\d{2}$/.test(m.date) &&
        typeof m.amount === "number" &&
        m.amount > 0 &&
        (m.kind === "gasto" || m.kind === "entrada") &&
        !!m.description?.trim()
    );

    return NextResponse.json({
      movimentos,
      avisos: lido.avisos ?? [],
      descartados: (lido.movimentos?.length ?? 0) - movimentos.length,
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "A ANTHROPIC_API_KEY nao e valida." }, { status: 401 });
    }
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Demasiados pedidos. Tenta daqui a pouco." }, { status: 429 });
    }
    if (e instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `Erro da API (${e.status}).` }, { status: 502 });
    }
    return NextResponse.json({ error: "Nao consegui ler a imagem." }, { status: 500 });
  }
}
