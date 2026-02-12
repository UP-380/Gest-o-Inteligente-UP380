/**
 * Barrel export para o endpoint de Gestão de Capacidade
 * 
 * Exporta tudo que é necessário para usar este endpoint:
 * - Route: definição da rota OpenAPI
 * - Handler: lógica do handler
 * - Schemas: schemas Zod (opcional, para uso externo)
 * - Types: tipos TypeScript (opcional, para uso externo)
 */
export { gestaoCapacidadeRoute } from './route.js';
export { cardsHandler } from './handler.js';

// Re-exportar schemas e types para uso externo se necessário
export * from './schemas.js';
export * from './types.js';
