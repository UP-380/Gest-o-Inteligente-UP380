// =============================================================
// === SERVIDOR PRINCIPAL - UP GESTÃO INTELIGENTE ===
// =============================================================

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const routes = require('./routes');
const { protectHTMLPages } = require('./middleware/auth');
const { getCachedData, setCachedData } = require('./config/cache');

const app = express();
const PORT = process.env.PORT || 4000;
const IS_PROD = process.env.NODE_ENV === 'production';

// Desabilitar logs em produção (mas manter console.error para debug)
// IMPORTANTE: Não desabilitar console.error para poder ver erros críticos
if (IS_PROD) {
  // Manter apenas console.error ativo para logs de erro
  const originalLog = console.log;
  console.log = function() {
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
// Em produção, aceitar qualquer origem (o nginx já faz o controle)
const allowedOrigins = IS_PROD 
  ? true // Aceitar qualquer origem em produção (nginx controla)
  : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:4000'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configurar sessões
app.use(session({
  secret: 'up-gestao-inteligente-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: IS_PROD, // true em produção (HTTPS), false em desenvolvimento
    httpOnly: true,
    sameSite: IS_PROD ? 'none' : 'lax', // 'none' em produção para funcionar com nginx proxy
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
    domain: IS_PROD ? undefined : undefined // Deixar undefined para funcionar com qualquer domínio
  }
}));

// Middleware para proteger páginas HTML
app.use(protectHTMLPages);

// Middleware para servir arquivos estáticos (durante migração)
app.use(express.static(path.join(__dirname, '../../')));

// Servir frontend React (quando build estiver pronto)
// Em produção, o nginx serve os arquivos estáticos, mas mantemos como fallback
app.use(express.static(path.join(__dirname, '../../frontEnd/dist')));

// Rota de health check (ANTES das outras rotas para garantir acesso)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
app.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor rodando em http://${HOST}:${PORT}`);
  console.log(`📡 Ambiente: ${IS_PROD ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'}`);
  console.log(`✅ Sistema de Cache ativo`);
});

