/**
 * Handler para o endpoint de Health Check
 */
import type { Context } from 'hono';

export function healthHandler(c: Context) {
  return c.json(
    { status: 'ok', timestamp: new Date().toISOString() },
    200 as const
  );
}
