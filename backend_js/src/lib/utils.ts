// src/lib/utils.ts

import type { Vigencia } from '../modules/gestao-capacidade/types.js';

/**
 * Retorna array de datas de feriados entre duas datas
 */
export async function getFeriados(dataInicio: string, dataFim: string): Promise<string[]> {
  // Implementação real depende da sua tabela de feriados
  // Exemplo estático:
  return ['2025-02-20']; // YYYY-MM-DD
}

/**
 * Calcula horas contratadas considerando finais de semana, feriados e folgas
 */
export function calcularHorasDisponiveis({
  data_inicio,
  data_fim,
  vigencia,
  ignorar_finais_semana,
  feriados,
  ignorar_folgas
}: {
  data_inicio: string;
  data_fim: string;
  vigencia?: Vigencia;
  ignorar_finais_semana?: boolean;
  feriados?: string[];
  ignorar_folgas?: boolean;
}): number {
  if (!vigencia || !vigencia.horascontratadasdia) return 0;

  const horasDia = Number(vigencia.horascontratadasdia);
  const start = new Date(data_inicio);
  const end = new Date(data_fim);

  let totalMs = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const diaStr = d.toISOString().slice(0, 10);
    const diaSemana = d.getDay();

    if (ignorar_finais_semana && (diaSemana === 0 || diaSemana === 6)) continue;
    if (feriados?.includes(diaStr)) continue;
    if (ignorar_folgas && false) continue; // aqui você pode implementar ferias/folgas

    totalMs += horasDia * 3600 * 1000;
  }

  return totalMs;
}
