/**
 * Schemas Zod para validação e documentação OpenAPI
 * do endpoint de Gestão de Capacidade
 */
import { z } from '@hono/zod-openapi';

// ============================================================================
// Schemas Base
// ============================================================================

/** Enum para níveis hierárquicos */
export const ordemNiveisEnum = z.enum([
  'colaborador',
  'cliente',
  'produto',
  'tipo_tarefa',
  'tarefa',
]);

/** Validação de data no formato YYYY-MM-DD */
export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato esperado: YYYY-MM-DD');

// ============================================================================
// Schemas de Transformação (para validação)
// ============================================================================

/**
 * Aceita número ou string (converte string para número)
 * Aceita valor único ou array, sempre retorna array
 */
export const colaboradorIdOrArraySchema = z
  .union([
    z.number().int().positive(),
    z.string().transform((s) => {
      const n = parseInt(s, 10);
      if (isNaN(n) || n <= 0) {
        throw new Error('colaborador_id deve ser um número positivo');
      }
      return n;
    }),
    z.array(
      z.union([
        z.number().int().positive(),
        z.string().transform((s) => {
          const n = parseInt(s, 10);
          if (isNaN(n) || n <= 0) {
            throw new Error('colaborador_id deve ser um número positivo');
          }
          return n;
        }),
      ])
    ),
  ])
  .optional()
  .transform((val) =>
    val == null ? undefined : Array.isArray(val) ? val : [val]
  );

/**
 * Aceita string ou array de strings
 * Sempre retorna array ou undefined
 */
export const stringOrArraySchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((val) =>
    val == null ? undefined : Array.isArray(val) ? val : [val]
  );

// ============================================================================
// Schema Principal de Validação
// ============================================================================

/**
 * Schema para validação do body da requisição
 * Inclui transformações e validações customizadas
 */
export const gestaoCapacidadeBodySchema = z
  .object({
    colaborador_id: colaboradorIdOrArraySchema,
    data_inicio: dateStringSchema,
    data_fim: dateStringSchema,
    ordem_niveis: z
      .array(ordemNiveisEnum)
      .optional()
      .default(['cliente', 'colaborador', 'produto', 'tipo_tarefa', 'tarefa']),
    ignorar_finais_semana: z.boolean().optional().default(false),
    ignorar_feriados: z.boolean().optional().default(false),
    ignorar_folgas: z.boolean().optional().default(false),
    cliente_id: stringOrArraySchema,
    produto_id: stringOrArraySchema,
    tipo_tarefa_id: stringOrArraySchema,
    tarefa_id: stringOrArraySchema,
  })
  .refine(
    (data) => new Date(data.data_inicio) <= new Date(data.data_fim),
    {
      message: 'data_inicio deve ser anterior ou igual a data_fim',
      path: ['data_fim'],
    }
  );

// ============================================================================
// Schema para Documentação OpenAPI
// ============================================================================

/**
 * Schema para documentação OpenAPI
 * Usa tipos específicos sem transformações para melhor documentação
 */
export const gestaoCapacidadeBodySchemaDoc = z.object({
  colaborador_id: z
    .union([
      z.number().int().positive(),
      z.string(),
      z.array(z.union([z.number().int().positive(), z.string()])),
    ])
    .optional()
    .describe(
      'ID do colaborador ou array de IDs. Aceita número ou string (converte string para número). Exemplo: 1, "1", [1, 2], ["1", "2"]'
    ),
  data_inicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe(
      'Data de início do período de análise no formato YYYY-MM-DD. Exemplo: "2024-01-01"'
    ),
  data_fim: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe(
      'Data de fim do período de análise no formato YYYY-MM-DD. Deve ser maior ou igual a data_inicio. Exemplo: "2024-01-31"'
    ),
  ordem_niveis: z
    .array(ordemNiveisEnum)
    .optional()
    .default(['cliente', 'colaborador', 'produto', 'tipo_tarefa', 'tarefa'])
    .describe(
      'Ordem dos níveis na hierarquia de agrupamento. Define como os dados serão organizados no campo "data" da resposta. Você pode usar qualquer combinação dos 5 níveis, na ordem desejada. Exemplos: ["cliente", "colaborador"] agrupa primeiro por cliente, depois por colaborador. ["colaborador", "tarefa"] agrupa por colaborador e depois por tarefa. Valores possíveis: colaborador, cliente, produto, tipo_tarefa, tarefa. Padrão: ["cliente", "colaborador", "produto", "tipo_tarefa", "tarefa"]'
    ),
  ignorar_finais_semana: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'Se true, exclui sábados e domingos dos cálculos de horas disponíveis. Padrão: false'
    ),
  ignorar_feriados: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'Se true, exclui feriados nacionais dos cálculos de horas disponíveis. Padrão: false'
    ),
  ignorar_folgas: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'Se true, exclui folgas dos colaboradores dos cálculos de horas disponíveis. Padrão: false'
    ),
  cliente_id: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe(
      'ID do cliente ou array de IDs para filtrar os resultados. Exemplo: "123" ou ["123", "456"]'
    ),
  produto_id: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe(
      'ID do produto ou array de IDs para filtrar os resultados. Exemplo: "123" ou ["123", "456"]'
    ),
  tipo_tarefa_id: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe(
      'ID do tipo de tarefa ou array de IDs para filtrar os resultados. Exemplo: "123" ou ["123", "456"]'
    ),
  tarefa_id: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe(
      'ID da tarefa ou array de IDs para filtrar os resultados. Exemplo: "123" ou ["123", "456"]'
    ),
});

// ============================================================================
// Schemas de Resposta
// ============================================================================

/** Schema do objeto resumo com totalizadores globais */
export const gestaoCapacidadeResumoSchema = z.object({
  total_tarefas: z.number().describe('Total de tarefas distintas no período'),
  total_produtos: z.number().describe('Total de produtos distintos no período'),
  total_clientes: z.number().describe('Total de clientes distintos no período'),
  total_colaboradores: z.number().describe('Total de colaboradores distintos no período'),
});

/** Schema do período filtrado e dias considerados */
export const gestaoCapacidadePeriodoSchema = z.object({
  data_inicio: z.string().describe('Data inicial do período filtrado (YYYY-MM-DD)'),
  data_fim: z.string().describe('Data final do período filtrado (YYYY-MM-DD)'),
  quantidade_dias: z.number().describe('Quantidade de dias no período considerando dias úteis, feriados e folgas conforme parâmetros'),
  ignorar_finais_semana: z.boolean().describe('Se finais de semana foram excluídos do cálculo'),
  ignorar_feriados: z.boolean().describe('Se feriados foram excluídos do cálculo'),
  ignorar_folgas: z.boolean().describe('Se folgas dos colaboradores foram consideradas'),
});

/** Schema para resposta de sucesso */
export const gestaoCapacidadeResponseSchema = z.object({
  success: z.boolean(),
  periodo: gestaoCapacidadePeriodoSchema.describe('Período filtrado e quantidade de dias considerada'),
  data: z.record(z.string(), z.any()),
  resumo: gestaoCapacidadeResumoSchema.describe('Totalizadores globais: Total de Tarefas, Produtos e Colaboradores'),
  resumo_colaboradores: z.record(z.string(), z.any()).optional(),
  resumo_clientes: z.record(z.string(), z.any()).optional(),
  resumo_produtos: z.record(z.string(), z.any()).optional(),
  resumo_tipos_tarefa: z.record(z.string(), z.any()).optional(),
  resumo_tarefas: z.record(z.string(), z.any()).optional(),
});

/** Schema para resposta de erro de validação */
export const gestaoCapacidadeErrorSchema = z.object({
  success: z.boolean(),
  error: z.string(),
  details: z.record(z.string(), z.array(z.string())).optional(),
  formErrors: z.array(z.string()).optional(),
});

/** Schema para resposta de erro interno */
export const gestaoCapacidadeInternalErrorSchema = z.object({
  success: z.boolean(),
  error: z.string(),
});
