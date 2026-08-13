// Dinheiro que muda de conta tua não é gasto — é uma transferência.
//
// Este é o único sítio a editar quando o banco inventar uma descrição nova.
// O parser lê daqui e mais ninguém precisa de saber como o banco escreve.

/** Quem são os titulares — o banco identifica as transferências pelo nome. */
export const OWNERS = {
  eu: /aur[eé]lio/i,
  ela: /francisca/i,
};

/**
 * Uma transferência tem duas pernas: sai de uma conta e entra noutra. Se
 * importares os dois extratos, o mesmo movimento aparece duas vezes. Gravamos
 * só a perna de saída — a de entrada é o espelho e é descartada, senão o
 * dinheiro contava a dobrar.
 */
export type Leg =
  | { leg: "saida"; to: string | null } // to = null -> é conta tua, qual não sei
  | { leg: "entrada" }
  | null; // não é transferência

/**
 * Descrições que a app já descartava antes desta mudança e que ainda não
 * sabemos para onde vão (vault de poupança? comissão que é gasto a sério?).
 * Continuam descartadas de propósito: mudar isto mexia nos totais sem
 * decisão tua. Quando decidires, saem daqui para as listas de baixo.
 */
export const POR_DECIDIR =
  /(ARREDONDAMENTO DE TROCOS|REVOLUT BANK UAB|IMPOSTO SELO|COMISSAO COMPRAS FORA)/i;

/** Saídas com destino certo pela descrição. Primeira regra que bate ganha. */
const SAIDAS: Array<{ re: RegExp; to: string }> = [
  // Caixa -> Revolut: carregamento da wallet pelo cartão de débito.
  { re: /CAR WAL CRT DEB REVOL/i, to: "Revolut" },
];

/** Entradas que são o espelho de uma saída já registada no outro extrato. */
const ESPELHOS: RegExp[] = [
  // Revolut a receber da Caixa (o outro lado do "CAR WAL CRT DEB REVOL").
  /CARREGAMENTO COM CART/i,
  /TRF CXDAPP|TRF CAIXADIRECTA|TRF IMEDIATA/i,
];

/**
 * A app tem duas contabilidades separadas: a pessoal e a conjunta. O que passa
 * de uma para a outra não é transferência interna — é despesa num livro e
 * rendimento no outro, e é assim que tem de aparecer nos dois.
 */
export type Espaco = "pessoal" | "conjunta";

/**
 * Classifica um movimento do extrato.
 *
 * O espaço importa tanto como a descrição. O banco escreve a conta conjunta com
 * os dois nomes e a minha pessoal só com o meu, por isso a mesma linha
 * ("Transferência para AURELIO ...") quer dizer coisas opostas conforme o
 * extrato: no meu é dinheiro a mudar de bolso dentro do mesmo livro; no da
 * conjunta é dinheiro a sair de um livro para o outro.
 *
 * `kind` importa pela mesma razão: uma transferência interna aparece nos dois
 * extratos, e só a perna de saída é que se guarda.
 */
export function classifyTransfer(
  description: string,
  kind: "gasto" | "entrada",
  espaco: Espaco
): Leg {
  const d = description;

  // Do livro da conjunta não sai nada para outro bolso da própria conjunta:
  // tudo o que lhe entra ou sai atravessa a fronteira e é movimento a sério.
  if (espaco === "conjunta") return null;

  for (const r of SAIDAS) {
    if (r.re.test(d)) return kind === "gasto" ? { leg: "saida", to: r.to } : { leg: "entrada" };
  }

  for (const re of ESPELHOS) {
    if (re.test(d)) return kind === "entrada" ? { leg: "entrada" } : { leg: "saida", to: null };
  }

  const temEu = OWNERS.eu.test(d);
  const temEla = OWNERS.ela.test(d);

  // Os dois nomes juntos = a conta conjunta. Livro diferente: é gasto meu a
  // caminho da casa, e rendimento de lá — não é transferência.
  if (temEu && temEla) return null;

  // Só o meu nome = outra conta minha, no mesmo livro e importada dos dois
  // lados. A entrada é o espelho da saída e descarta-se.
  if (temEu) {
    return kind === "gasto" ? { leg: "saida", to: null } : { leg: "entrada" };
  }

  // Só o nome dela = banco fora da app. Movimento a sério nos dois sentidos.
  if (temEla) return null;

  return null;
}
