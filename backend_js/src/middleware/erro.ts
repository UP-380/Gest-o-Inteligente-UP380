import type { Context } from 'hono';
import { ZodError } from 'zod';
import type { ZodIssue } from 'zod';

export interface ErroApp {
  code?: string;
  message: string;
  status?: number;
}

/**
 * Middleware global de tratamento de erros.
 */
export function erroHandler(err: unknown, c: Context) {
  console.error(err);

  // Erros de validação do Zod (incluindo do OpenAPIHono)
  if (err instanceof ZodError) {
    const issues = err.flatten();
    return c.json(
      {
        success: false,
        error: 'Validação falhou',
        details: issues.fieldErrors,
        formErrors: issues.formErrors,
      },
      400 as const
    );
  }

  // Erros de validação do OpenAPIHono (formato diferente)
  if (err && typeof err === 'object' && 'issues' in err) {
    const zodIssues = (err as { issues: ZodIssue[] }).issues;
    const zodError = new ZodError(zodIssues);
    const issues = zodError.flatten();
    return c.json(
      {
        success: false,
        error: 'Validação falhou',
        details: issues.fieldErrors,
        formErrors: issues.formErrors,
      },
      400 as const
    );
  }

  if (err && typeof err === 'object' && 'code' in err) {
    const e = err as { code?: string; message?: string; details?: string };
    if (e.code === 'PGRST116') {
      return c.json({ error: 'Recurso não encontrado' }, 404 as const);
    }
    if (e.code === '23505') {
      return c.json({ error: 'Registro duplicado', details: e.details }, 409 as const);
    }
    if (e.code === '23503') {
      return c.json({ error: 'Referência inválida (FK)', details: e.details }, 400 as const);
    }
  }

  const msg = err instanceof Error ? err.message : 'Erro interno do servidor';
  return c.json({ error: msg }, 500 as const);
}

/**
 * Envolve resposta em formato padrão { data, paginacao? }.
 */
export function respostaOk<T>(c: Context, data: T, status: number = 200) {
  return c.json({ data }, status as const);
}

export function respostaCriado<T>(c: Context, data: T) {
  return c.json({ data }, 201 as const);
}
