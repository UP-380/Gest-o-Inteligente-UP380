/**
 * Tipos TypeScript para o endpoint de Gestão de Capacidade
 */
import type { z } from '@hono/zod-openapi';
import type { gestaoCapacidadeBodySchema } from './schemas.js';

// ============================================================================
// Tipos derivados dos Schemas
// ============================================================================

/** Tipo do body da requisição após validação */
export type GestaoCapacidadeBody = z.infer<typeof gestaoCapacidadeBodySchema>;

// ============================================================================
// Interfaces de Dados do Banco
// ============================================================================

/** Dados de um membro/colaborador */
export interface Membro {
  id: number;
  usuario_id?: number | null;
  nome: string;
}

/** Registro de tempo realizado */
export interface RegistroTempo {
  id?: string;
  usuario_id: number;
  tempo_realizado?: number | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  cliente_id?: string;
  produto_id?: string;
  tipo_tarefa_id?: string;
  tarefa_id?: string;
}

/** Regra de tempo estimado */
export interface EstimadoRegra {
  id: string;
  responsavel_id: number;
  tempo_estimado_dia: number;
  data_inicio?: string;
  data_fim?: string;
  incluir_finais_semana?: boolean;
  cliente_id?: string;
  produto_id?: string;
  tipo_tarefa_id?: string;
  tarefa_id?: string;
}

/** Vigência de um colaborador */
export interface Vigencia {
  membro_id: number;
  dt_vigencia: string;
  horascontratadasdia?: number;
  custo_hora?: string | number;
  custohora?: string | number;
  tipocontratoid?: number;
}

// ============================================================================
// Interfaces de Estruturas Internas
// ============================================================================

/** Mapa de nomes por ID */
export interface NomeMap {
  [id: string]: string;
}

/** Dados de um card na hierarquia */
export interface CardData {
  id: number;
  nome: string;
  horas_contratadas_ms: number;
  total_estimado_ms: number;
  total_realizado_ms: number;
  horas_estimadas: number;
  horas_realizadas: number;
  horas_disponiveis: number;
  percentual_utilizacao: number;
  diferenca_horas: number;
}
