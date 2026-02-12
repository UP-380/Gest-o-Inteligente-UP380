/**
 * Definição da rota OpenAPI para o endpoint de Gestão de Capacidade
 */
import { createRoute } from '@hono/zod-openapi';
import {
  gestaoCapacidadeBodySchemaDoc,
  gestaoCapacidadeResponseSchema,
  gestaoCapacidadeErrorSchema,
  gestaoCapacidadeInternalErrorSchema,
} from './schemas.js';

export const gestaoCapacidadeRoute = createRoute({
  method: 'post',
  path: '/gestao-capacidade',
  summary: 'Análise de Gestão de Capacidade',
  security: [{ BearerAuth: [] }],
  description: `Análise hierárquica de capacidade com comparação entre horas estimadas e realizadas.

### 📊 O que este endpoint faz?

Retorna uma análise completa de capacidade organizada em níveis hierárquicos configuráveis, permitindo visualizar horas estimadas vs realizadas em diferentes perspectivas.

### 🎯 Níveis Disponíveis

Configure a hierarquia usando o parâmetro \`ordem_niveis\` com qualquer combinação destes 5 níveis:

| Nível | Descrição |
|-------|-----------|
| **colaborador** | Agrupa por colaborador (recurso humano) |
| **cliente** | Agrupa por cliente (entidade contratante) |
| **produto** | Agrupa por produto/serviço |
| **tipo_tarefa** | Agrupa por categoria de trabalho |
| **tarefa** | Agrupa por tarefa específica |

**Exemplo de uso:**
- \`["cliente", "colaborador"]\` → Primeiro por cliente, depois por colaborador
- \`["colaborador", "tarefa"]\` → Primeiro por colaborador, depois por tarefa

### 📦 Estrutura da Resposta

**Campo \`data\`**: Objeto hierárquico aninhado seguindo \`ordem_niveis\`

**Resumo com totalizadores** (sempre incluído):
- \`resumo\` - Objeto com totais globais: \`total_tarefas\`, \`total_produtos\`, \`total_colaboradores\`

**Resumos agregados por nível** (um deles incluído conforme \`ordem_niveis[0]\`):
- \`resumo_colaboradores\` - Totais por colaborador
- \`resumo_clientes\` - Totais por cliente  
- \`resumo_produtos\` - Totais por produto
- \`resumo_tipos_tarefa\` - Totais por tipo
- \`resumo_tarefas\` - Totais por tarefa

**Métricas em cada nível:**
- \`horas_estimadas\` - Horas planejadas
- \`horas_realizadas\` - Horas trabalhadas
- \`horas_disponiveis\` - Horas disponíveis do colaborador
- \`percentual_utilizacao\` - % de utilização (realizadas/disponíveis)
- \`diferenca_horas\` - Diferença entre estimadas e realizadas

### 🔍 Filtros

Use os parâmetros opcionais para filtrar resultados:
- \`colaborador_id\` - Um ou mais colaboradores
- \`cliente_id\` - Um ou mais clientes
- \`produto_id\` - Um ou mais produtos
- \`tipo_tarefa_id\` - Um ou mais tipos
- \`tarefa_id\` - Uma ou mais tarefas

### ⚙️ Opções de Cálculo

- \`ignorar_finais_semana\` - Exclui sábados e domingos
- \`ignorar_feriados\` - Exclui feriados nacionais
- \`ignorar_folgas\` - Exclui folgas dos colaboradores`,
  tags: ['Gestão de Capacidade'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: gestaoCapacidadeBodySchemaDoc.refine(
            (data) => new Date(data.data_inicio) <= new Date(data.data_fim),
            { message: 'data_inicio deve ser anterior ou igual a data_fim', path: ['data_fim'] }
          ),
          examples: {
            basico: {
              summary: '📋 Exemplo Básico',
              description: 'Análise simples por colaborador e tarefa',
              value: {
                colaborador_id: 1,
                data_inicio: '2024-01-01',
                data_fim: '2024-01-31',
                ordem_niveis: ['colaborador', 'tarefa'],
              },
            },
            completo: {
              summary: '🎯 Exemplo Completo',
              description: 'Análise completa com todos os níveis e filtros',
              value: {
                colaborador_id: [1, 2],
                data_inicio: '2024-01-01',
                data_fim: '2024-01-31',
                ordem_niveis: ['cliente', 'colaborador', 'produto', 'tipo_tarefa', 'tarefa'],
                ignorar_finais_semana: true,
                ignorar_feriados: true,
                cliente_id: '123',
                produto_id: '456',
              },
            },
            filtros: {
              summary: '🔍 Com Filtros',
              description: 'Análise filtrando múltiplos clientes e produtos',
              value: {
                data_inicio: '2024-01-01',
                data_fim: '2024-01-31',
                ordem_niveis: ['cliente', 'produto'],
                cliente_id: ['123', '456'],
                produto_id: ['789', '101'],
              },
            },
          },
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Análise de capacidade retornada com sucesso',
      content: {
        'application/json': {
          schema: gestaoCapacidadeResponseSchema,
          example: {
            success: true,
            data: {
              'cliente_123': {
                'colaborador_1': {
                  'produto_456': {
                    'tipo_tarefa_789': {
                      'tarefa_101': {
                        horas_estimadas: 40,
                        horas_realizadas: 35,
                        horas_disponiveis: 160,
                        percentual_utilizacao: 21.88,
                        diferenca_horas: -5,
                      },
                    },
                  },
                },
              },
            },
            resumo: {
              total_tarefas: 5,
              total_produtos: 3,
              total_colaboradores: 2,
            },
            resumo_colaboradores: {
              'colaborador_1': {
                total_horas_estimadas: 40,
                total_horas_realizadas: 35,
                total_horas_disponiveis: 160,
                percentual_utilizacao: 21.88,
              },
            },
            resumo_clientes: {
              'cliente_123': {
                total_horas_estimadas: 40,
                total_horas_realizadas: 35,
                total_horas_disponiveis: 160,
                percentual_utilizacao: 21.88,
              },
            },
            resumo_produtos: {
              'produto_456': {
                total_horas_estimadas: 40,
                total_horas_realizadas: 35,
                total_horas_disponiveis: 160,
                percentual_utilizacao: 21.88,
              },
            },
            resumo_tipos_tarefa: {
              'tipo_tarefa_789': {
                total_horas_estimadas: 40,
                total_horas_realizadas: 35,
                total_horas_disponiveis: 160,
                percentual_utilizacao: 21.88,
              },
            },
            resumo_tarefas: {
              'tarefa_101': {
                horas_estimadas: 40,
                horas_realizadas: 35,
                horas_disponiveis: 160,
                percentual_utilizacao: 21.88,
                diferenca_horas: -5,
              },
            },
          },
        },
      },
    },
    400: {
      description: 'Erro de validação nos parâmetros de entrada',
      content: {
        'application/json': {
          schema: gestaoCapacidadeErrorSchema,
          example: {
            success: false,
            error: 'Validação falhou',
            details: {
              data_fim: ['data_inicio deve ser anterior ou igual a data_fim'],
              data_inicio: ['Formato esperado: YYYY-MM-DD'],
            },
            formErrors: [],
          },
        },
      },
    },
    500: {
      description: 'Erro interno do servidor',
      content: {
        'application/json': {
          schema: gestaoCapacidadeInternalErrorSchema,
          example: {
            success: false,
            error: 'Erro interno do servidor ao processar a requisição',
          },
        },
      },
    },
  },
});
