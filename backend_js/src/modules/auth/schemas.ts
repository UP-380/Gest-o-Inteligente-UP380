/**
 * Schemas Zod para autenticação e geração de tokens
 */
import { z } from '@hono/zod-openapi';

/**
 * Schema para resposta do token único
 */
export const generateTokenResponseSchema = z.object({
  success: z.boolean(),
  token: z.string().describe('Token único da API'),
  message: z.string().optional().describe('Mensagem informativa'),
  usage: z.string().optional().describe('Como usar o token'),
});

/**
 * Schema para resposta de erro de autenticação
 */
export const authErrorSchema = z.object({
  success: z.boolean(),
  error: z.string(),
  message: z.string().optional(),
});
