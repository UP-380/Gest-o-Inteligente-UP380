import type { Context, Next } from 'hono';
import { verifyToken } from '../lib/jwt.js';

/**
 * Middleware de autenticação JWT.
 * Valida tokens JWT no header Authorization: Bearer <token>
 */
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  let userId: string | undefined;
  let tokenType: 'api' | 'user' | undefined;
  let tokenPayload: { sub: string; type: 'api' | 'user' } | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);

    if (token) {
      // Validar JWT
      const payload = await verifyToken(token);

      if (payload) {
        userId = payload.sub;
        tokenType = payload.type;
        tokenPayload = { sub: payload.sub, type: payload.type };
      }
    }
  }

  // Fallback: aceitar X-User-Id do proxy Node (confiável, rede interna)
  if (!userId) {
    const proxyUserId = c.req.header('X-User-Id');
    if (proxyUserId) {
      userId = proxyUserId;
      tokenType = 'user';
      tokenPayload = { sub: proxyUserId, type: 'user' };
    }
  }

  // Armazenar informações do token no contexto
  c.set('userId', userId);
  c.set('tokenType', tokenType);
  c.set('tokenPayload', tokenPayload);

  await next();
}

/**
 * Exige que o usuário esteja autenticado. Retorna 401 se não estiver.
 */
export async function requireAuth(c: Context, next: Next) {
  const userId = c.get('userId');
  if (!userId) {
    return c.json(
      {
        success: false,
        error: 'Não autorizado',
        message: 'Token JWT inválido ou ausente. Use: Authorization: Bearer <token>',
      },
      401 as const
    );
  }
  await next();
}

/**
 * Exige que seja um token de API (não token de usuário)
 */
export async function requireApiToken(c: Context, next: Next) {
  const tokenType = c.get('tokenType');
  if (tokenType !== 'api') {
    return c.json(
      {
        success: false,
        error: 'Token inválido',
        message: 'Esta rota requer um token de API',
      },
      403 as const
    );
  }
  await next();
}
