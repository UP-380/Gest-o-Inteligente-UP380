import { describe, expect, test } from 'bun:test';
import app from '../../src/app';

describe('API', () => {
  test('GET /health retorna 200', async () => {
    const res = await app.request('http://localhost/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });
});
