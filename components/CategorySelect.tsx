"use client";

import { CATEGORIES, goalCategory, goalNameOf, isGoalCategory } from "@/lib/categories";

/**
 * Categorias normais + os objetivos ativos, em grupos separados.
 * Escolher um objetivo manda o dinheiro desse movimento direto para a meta.
 */
export default function CategorySelect({
  value,
  onChange,
  goals,
  className = "select sel-cell",
  ariaLabel = "Categoria",
  includeAll = false,
}: {
  value: string;
  onChange: (v: string) => void;
  goals: string[];
  className?: string;
  ariaLabel?: string;
  /** Acrescenta a opção "todas" — para a barra de filtros. */
  includeAll?: boolean;
}) {
  // Um movimento antigo pode apontar para um objetivo já apagado. Sem isto o
  // select mostrava outra categoria qualquer e a próxima gravação perdia-a.
  const orfa =
    value && !includeAll && !CATEGORIES.includes(value as never) && !goals.includes(goalNameOf(value) ?? "")
      ? value
      : null;

  return (
    <select className={className} aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)}>
      {includeAll && <option value="all">Todas as categorias</option>}
      <optgroup label="Categorias">
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </optgroup>
      {goals.length > 0 && (
        <optgroup label="Objetivos">
          {goals.map((g) => (
            <option key={g} value={goalCategory(g)}>
              🎯 {g}
            </option>
          ))}
        </optgroup>
      )}
      {orfa && (
        <optgroup label="Já não existe">
          <option value={orfa}>{isGoalCategory(orfa) ? `🎯 ${goalNameOf(orfa)}` : orfa}</option>
        </optgroup>
      )}
    </select>
  );
}
