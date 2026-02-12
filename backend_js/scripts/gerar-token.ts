#!/usr/bin/env bun
/**
 * Script para gerar o token único da API
 * Execute: bun run scripts/gerar-token.ts
 */

import { generateToken } from '../src/lib/jwt.js';

async function main() {
  const identifier = process.env.API_TOKEN_IDENTIFIER || 'upmap-api';
  const expiresIn = process.env.API_TOKEN_EXPIRES_IN || '10y'; // 10 anos

  console.log('🔐 Gerando token único para a API...\n');
  console.log(`Identificador: ${identifier}`);
  console.log(`Expiração: ${expiresIn}\n`);

  const token = await generateToken(
    {
      sub: identifier,
      type: 'api',
    },
    expiresIn
  );

  console.log('✅ Token gerado com sucesso!\n');
  console.log('📋 Adicione esta linha ao seu arquivo .env:\n');
  console.log(`API_TOKEN=${token}\n`);
  console.log('🔒 Ou use diretamente nas requisições:\n');
  console.log(`Authorization: Bearer ${token}\n`);
}

main().catch(console.error);
