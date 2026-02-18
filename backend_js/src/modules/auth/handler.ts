/**
 * Handler para obter o token único da API
 */
import type { Context } from 'hono';
import { getApiToken } from '../../lib/jwt.js';

export async function generateTokenHandler(c: Context) {
  try {
    // Retornar o token único configurado no backend
    const token = await getApiToken();

    return c.json(
      {
        success: true,
        token,
        message: 'Token único da API. Use este token em todas as requisições protegidas.',
        usage: 'Authorization: Bearer <token>',
      },
      200 as const
    );
  } catch (error) {
    console.error('[AUTH-TOKEN] Erro ao obter token:', error);
    const message = error instanceof Error ? error.message : 'Erro interno ao obter token';
    return c.json(
      {
        success: false,
        error: 'Erro ao obter token',
        message,
      },
      500 as const
    );
  }
}
