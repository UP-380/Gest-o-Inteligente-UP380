// =============================================================
// === SERVIDOR PRINCIPAL - UP GESTÃO INTELIGENTE ===
// =============================================================

// Carregar variáveis de ambiente PRIMEIRO (antes de qualquer outro módulo)
require('dotenv').config();

// Validar variáveis de ambiente críticas
// Aceitar ambos os nomes: SUPABASE_SERVICE_KEY ou SUPABASE_SERVICE_ROLE_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const requiredVars = {
  'SUPABASE_URL': process.env.SUPABASE_URL,
  'SUPABASE_SERVICE_KEY': supabaseServiceKey
};
const missingVars = Object.entries(requiredVars)
  .filter(([name, value]) => !value)
  .map(([name]) => name === 'SUPABASE_SERVICE_KEY' ? 'SUPABASE_SERVICE_KEY (ou SUPABASE_SERVICE_ROLE_KEY)' : name);

if (missingVars.length > 0) {
  console.error('❌ ERRO CRÍTICO: Variáveis de ambiente obrigatórias não encontradas:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('   Configure estas variáveis no arquivo .env.production');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const routes = require('./routes');
const { protectHTMLPages } = require('./middleware/auth');
const { getCachedData, setCachedData } = require('./config/cache');

const { requestTelemetry } = require('./middleware/telemetry');

const app = express();
const PORT = process.env.PORT || 4000;
const IS_PROD = process.env.NODE_ENV === 'production';

// ========================================
// === TELEMETRIA E MONITORAMENTO ===
// ========================================
// Deve ser o primeiro middleware para medir o tempo total da request
app.use(requestTelemetry);

// Desabilitar logs em produção (mas manter console.error para debug)
// IMPORTANTE: Não desabilitar console.error para poder ver erros críticos
if (IS_PROD) {
  // Manter apenas console.error ativo para logs de erro
  const originalLog = console.log;
  console.log = function () {
    // Em produção, ainda logar erros e informações críticas
    if (arguments[0] && typeof arguments[0] === 'string' &&
      (arguments[0].includes('❌') || arguments[0].includes('🚀') || arguments[0].includes('✅'))) {
      originalLog.apply(console, arguments);
    }
  };
}

// ========================================
// === MIDDLEWARE ===
// ========================================

// Configurar CORS para permitir credenciais do frontEnd
// Em produção, aceitar qualquer origem (o nginx já faz o controle de domínio)
const allowedOrigins = IS_PROD
  ? true // Aceitar qualquer origem em produção (nginx controla o domínio)
  : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:4000'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400 // Cache preflight por 24 horas
}));
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Configurar sessões
// Gerar SESSION_SECRET automaticamente se não estiver definida (apenas em produção)
let SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET && IS_PROD) {
  // Gerar uma chave forte automaticamente usando crypto
  const crypto = require('crypto');
  SESSION_SECRET = crypto.randomBytes(32).toString('hex');
  // Aviso informativo (não crítico, pois foi gerado automaticamente)
  console.error('ℹ️  INFO: SESSION_SECRET gerada automaticamente.');
  console.error('   Para manter sessões entre reinícios, configure SESSION_SECRET no .env.production');
} else if (!SESSION_SECRET) {
  SESSION_SECRET = 'up-gestao-inteligente-secret-key-2024-fallback';
  console.error('⚠️  AVISO: SESSION_SECRET não definida. Usando valor padrão (NÃO RECOMENDADO PARA PRODUÇÃO)');
}

// Configurar trust proxy para funcionar corretamente com nginx
app.set('trust proxy', 1); // Confiar no primeiro proxy (nginx)

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    // Em produção, usar secure apenas se realmente estiver em HTTPS (nginx já faz isso)
    // O trust proxy permite que o Express detecte HTTPS através do X-Forwarded-Proto
    secure: IS_PROD ? 'auto' : false, // 'auto' detecta HTTPS automaticamente via proxy
    httpOnly: true,
    sameSite: 'lax', // 'lax' funciona melhor com proxy reverso (nginx)
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
    domain: undefined, // Deixar undefined para funcionar com qualquer domínio
    path: '/' // Garantir que o cookie seja válido para todo o site
  },
  name: 'upgi.sid' // Nome específico para evitar conflitos
}));

// Middleware para proteger páginas HTML
app.use(protectHTMLPages);

// Middleware para servir arquivos estáticos (durante migração)
app.use(express.static(path.join(__dirname, '../../')));

// Servir frontend React (quando build estiver pronto)
// Em produção, o nginx serve os arquivos estáticos, mas mantemos como fallback
app.use(express.static(path.join(__dirname, '../../frontEnd/dist')));

// REMOVIDO: Código antigo de criação de diretórios de upload
// Agora os avatares são armazenados no Supabase Storage, não no filesystem
// if (IS_PROD) { ... }

// Rota de health check (ANTES das outras rotas para garantir acesso)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Diagnóstico de ambiente (qual schema/URL o processo está usando) – útil para investigar TEST vs PROD
app.get('/api/debug-env', (req, res) => {
  const schema = process.env.SUPABASE_DB_SCHEMA || '(não definido, fallback: up_gestaointeligente)';
  const url = process.env.SUPABASE_URL || '';
  const supabaseUrlMasked = url ? `${url.slice(0, 30)}...${url.slice(-15)}` : '(não definido)';
  res.json({
    schema,
    supabaseUrlMasked,
    nodeEnv: process.env.NODE_ENV || '(não definido)',
    timestamp: new Date().toISOString()
  });
});

// Registrar rotas
app.use('/', routes);

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  console.error('❌ Erro não tratado:', err);
  res.status(500).json({
    success: false,
    error: 'Erro interno do servidor',
    message: IS_PROD ? undefined : err.message
  });
});

// Iniciar servidor
// IMPORTANTE: Em Docker, deve escutar em 0.0.0.0 para aceitar conexões de outros containers
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST);

