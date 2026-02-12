/**
 * Utilitários para geração e validação de tokens JWT
 * Sistema simplificado: token único configurável no backend
 */

export interface TokenPayload {
  sub: string; // Subject (ID do usuário ou identificador do token)
  type: 'api' | 'user'; // Tipo de token
  iat: number; // Issued at
  exp: number; // Expiration
  [key: string]: unknown;
}

// Chave secreta para assinar tokens (em produção, usar variável de ambiente)
// IMPORTANTE: Mude esta chave em produção!
const JWT_SECRET = process.env.JWT_SECRET || 'sua-chave-secreta-super-segura-mude-em-producao-minimo-32-caracteres-para-seguranca';

// Token único pré-configurado (gerado uma vez e reutilizado)
// Se não definido, será gerado automaticamente na primeira execução
let cachedToken: string | null = null;

/**
 * Converte string para ArrayBuffer
 */
function stringToArrayBuffer(str: string): ArrayBuffer {
  return new TextEncoder().encode(str);
}

/**
 * Converte ArrayBuffer para string base64url
 */
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Converte base64url para ArrayBuffer
 */
function base64UrlToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Gera uma chave de criptografia HMAC a partir do secret
 */
async function getCryptoKey(): Promise<CryptoKey> {
  const keyData = stringToArrayBuffer(JWT_SECRET);
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Codifica payload JWT para base64url
 */
function encodePayload(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload);
  return arrayBufferToBase64Url(stringToArrayBuffer(json));
}

/**
 * Decodifica base64url para payload JWT
 */
function decodePayload(base64: string): Record<string, unknown> {
  const json = new TextDecoder().decode(base64UrlToArrayBuffer(base64));
  return JSON.parse(json);
}

/**
 * Gera um token JWT
 */
export async function generateToken(
  payload: Omit<TokenPayload, 'iat' | 'exp'>,
  expiresIn?: string | number
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // Calcular expiração
  let exp: number;
  if (expiresIn) {
    if (typeof expiresIn === 'string') {
      // Parse strings como "1h", "7d", "30d", "10y"
      const match = expiresIn.match(/^(\d+)([hdmsy])$/);
      if (match) {
        const [, value, unit] = match;
        const multipliers: Record<string, number> = {
          s: 1,
          m: 60,
          h: 3600,
          d: 86400,
          y: 86400 * 365,
        };
        exp = now + parseInt(value, 10) * (multipliers[unit] || 3600);
      } else {
        exp = now + 3600; // Default 1 hora
      }
    } else {
      exp = now + expiresIn;
    }
  } else {
    exp = now + 86400 * 365 * 10; // Default 10 anos (token permanente)
  }

  const jwtPayload: TokenPayload = {
    ...payload,
    iat: now,
    exp,
  };

  // Header JWT
  const header = { alg: 'HS256', typ: 'JWT' };

  // Codificar header e payload
  const encodedHeader = encodePayload(header);
  const encodedPayload = encodePayload(jwtPayload);

  // Assinar
  const key = await getCryptoKey();
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    stringToArrayBuffer(`${encodedHeader}.${encodedPayload}`)
  );

  const encodedSignature = arrayBufferToBase64Url(signature);

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

/**
 * Valida e decodifica um token JWT
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    // Verificar assinatura
    const key = await getCryptoKey();
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlToArrayBuffer(encodedSignature),
      stringToArrayBuffer(`${encodedHeader}.${encodedPayload}`)
    );

    if (!isValid) {
      return null; // Assinatura inválida
    }

    // Decodificar payload
    const payload = decodePayload(encodedPayload) as TokenPayload;

    // Verificar expiração
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Token expirado
    }

    return payload;
  } catch (error) {
    console.error('Erro ao verificar token:', error);
    return null;
  }
}

/**
 * Gera o token único da API (configurável via variável de ambiente)
 * Se API_TOKEN estiver definido, usa esse token diretamente
 * Caso contrário, gera um token JWT baseado em API_TOKEN_IDENTIFIER
 */
export async function getApiToken(): Promise<string> {
  // Se já temos o token em cache, retorna
  if (cachedToken) {
    return cachedToken;
  }

  // Verificar se há um token pré-configurado via variável de ambiente
  const preConfiguredToken = process.env.API_TOKEN;
  if (preConfiguredToken) {
    cachedToken = preConfiguredToken;
    console.log('[JWT] Usando token pré-configurado via API_TOKEN');
    return cachedToken;
  }

  // Se não há token pré-configurado, gerar um novo baseado no identificador
  const identifier = process.env.API_TOKEN_IDENTIFIER || 'upmap-api';
  const expiresIn = process.env.API_TOKEN_EXPIRES_IN || '10y'; // 10 anos (praticamente permanente)

  console.log(`[JWT] Gerando novo token único para: ${identifier}`);
  const token = await generateToken(
    {
      sub: identifier,
      type: 'api',
    },
    expiresIn
  );

  cachedToken = token;
  console.log('[JWT] Token único gerado com sucesso');
  console.log(`[JWT] Token: ${token}`);
  console.log('[JWT] Configure API_TOKEN no .env para usar este token permanentemente');

  return token;
}

/**
 * Gera um token de API (função auxiliar para endpoint de geração)
 */
export async function generateApiToken(
  identifier: string,
  expiresIn: string | number = '30d'
): Promise<{ token: string; expiresAt: Date }> {
  const payload = {
    sub: identifier,
    type: 'api' as const,
  };

  const token = await generateToken(payload, expiresIn);

  // Calcular data de expiração
  const expiresAt = new Date();
  if (typeof expiresIn === 'string') {
    const match = expiresIn.match(/^(\d+)([hdmsy])$/);
    if (match) {
      const [, value, unit] = match;
      const multipliers: Record<string, number> = {
        s: 1000,
        m: 60000,
        h: 3600000,
        d: 86400000,
        y: 86400000 * 365,
      };
      expiresAt.setTime(
        expiresAt.getTime() + parseInt(value, 10) * (multipliers[unit] || 86400000)
      );
    } else {
      expiresAt.setTime(expiresAt.getTime() + 30 * 86400000); // 30 dias
    }
  } else {
    expiresAt.setTime(expiresAt.getTime() + expiresIn * 1000);
  }

  return { token, expiresAt };
}
