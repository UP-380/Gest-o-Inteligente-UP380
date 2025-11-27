// =============================================================
// === ROTAS PRINCIPAIS ===
// =============================================================

const express = require('express');
const path = require('path');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const authController = require('../controllers/auth.controller');
const clientesController = require('../controllers/clientes.controller');
const tarefasController = require('../controllers/tarefas.controller');
const dashboardController = require('../controllers/dashboard.controller');
const colaboradoresController = require('../controllers/colaboradores.controller');
const custoMembroVigenciaController = require('../controllers/custo-membro-vigencia.controller');
const apiClientes = require('../services/api-clientes');

// Registrar rotas do api-clientes.js
apiClientes.registrarRotasAPI(router, requireAuth);

// Rotas de autenticação
router.post('/api/login', authController.login);
router.post('/api/logout', authController.logout);
router.get('/api/auth/check', authController.checkAuth);

// Rotas de clientes
router.get('/api/clientes-kamino', requireAuth, clientesController.getClientesKamino);
router.get('/api/clientes-incompletos-count', requireAuth, clientesController.getClientesIncompletosCount);
router.get('/api/carteira-clientes', requireAuth, clientesController.getCarteiraClientes);
router.put('/api/clientes/:id/inativar', requireAuth, clientesController.inativarCliente);
router.put('/api/clientes/:id/ativar', requireAuth, clientesController.ativarCliente);

// Rotas de tarefas
router.get('/api/tarefas-incompletas', requireAuth, tarefasController.getTarefasIncompletas);
router.get('/api/tarefas-por-ids', requireAuth, tarefasController.getTarefasPorIds);

// Rotas de dashboard
router.get('/api/dashboard-clientes', requireAuth, dashboardController.getDashboardClientes);

// Rotas de Colaboradores (CRUD completo)
router.get('/api/colaboradores', requireAuth, colaboradoresController.getColaboradores);
router.get('/api/colaboradores/:id', requireAuth, colaboradoresController.getColaboradorPorId);
router.post('/api/colaboradores', requireAuth, colaboradoresController.criarColaborador);
router.put('/api/colaboradores/:id', requireAuth, colaboradoresController.atualizarColaborador);
router.delete('/api/colaboradores/:id', requireAuth, colaboradoresController.deletarColaborador);

// Rotas de Custo Membro Vigência (CRUD completo)
router.get('/api/custo-membro-vigencia', requireAuth, custoMembroVigenciaController.getCustosMembroVigencia);
router.get('/api/custo-membro-vigencia/:id', requireAuth, custoMembroVigenciaController.getCustoMembroVigenciaPorId);
router.get('/api/custo-membro-vigencia/membro/:membro_id', requireAuth, custoMembroVigenciaController.getCustosPorMembro);
router.post('/api/custo-membro-vigencia', requireAuth, custoMembroVigenciaController.criarCustoMembroVigencia);
router.put('/api/custo-membro-vigencia/:id', requireAuth, custoMembroVigenciaController.atualizarCustoMembroVigencia);
router.delete('/api/custo-membro-vigencia/:id', requireAuth, custoMembroVigenciaController.deletarCustoMembroVigencia);

// Rotas adicionais do dashboard (membros e colaboradores)
router.get('/api/membros-por-cliente', requireAuth, async (req, res) => {
  try {
    const { clienteId, periodoInicio, periodoFim } = req.query;

    if (!clienteId) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID do cliente é obrigatório' 
      });
    }

    // Processar clienteId - pode vir como array (múltiplos parâmetros) ou valor único
    let clienteIdsParaBuscar = [];
    if (Array.isArray(clienteId)) {
      clienteIdsParaBuscar = clienteId.map(id => String(id).trim()).filter(Boolean);
    } else if (typeof clienteId === 'string' && clienteId.includes(',')) {
      // Fallback: se for string com vírgulas
      clienteIdsParaBuscar = clienteId.split(',').map(id => id.trim()).filter(Boolean);
    } else {
      clienteIdsParaBuscar = [String(clienteId).trim()];
    }

    if (clienteIdsParaBuscar.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID do cliente é obrigatório' 
      });
    }

    // Usar array se múltiplos, ou valor único se apenas um
    const clienteIdParam = clienteIdsParaBuscar.length === 1 ? clienteIdsParaBuscar[0] : clienteIdsParaBuscar;
    const membros = await apiClientes.getMembrosPorCliente(clienteIdParam, periodoInicio || null, periodoFim || null);

    res.json({ 
      success: true, 
      data: membros || [],
      count: (membros || []).length
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar membros por cliente:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

router.get('/api/clientes-por-colaborador', requireAuth, async (req, res) => {
  try {
    const { colaboradorId, periodoInicio, periodoFim } = req.query;

    if (!colaboradorId) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID do colaborador é obrigatório' 
      });
    }

    // Processar colaboradorId - pode vir como array (múltiplos parâmetros na query string) ou valor único
    let colaboradorIdsParaBuscar = [];
    if (Array.isArray(colaboradorId)) {
      // Múltiplos colaboradores enviados como parâmetros repetidos
      colaboradorIdsParaBuscar = colaboradorId;
      console.log(`🔍 [ROTA] Múltiplos colaboradores recebidos:`, colaboradorIdsParaBuscar);
    } else if (typeof colaboradorId === 'string' && colaboradorId.includes(',')) {
      // String separada por vírgulas (fallback)
      colaboradorIdsParaBuscar = colaboradorId.split(',').map(id => id.trim()).filter(Boolean);
      console.log(`🔍 [ROTA] Colaboradores recebidos como string separada por vírgulas:`, colaboradorIdsParaBuscar);
    } else {
      // Valor único
      colaboradorIdsParaBuscar = [colaboradorId];
      console.log(`🔍 [ROTA] Colaborador único recebido:`, colaboradorIdsParaBuscar);
    }

    // Usar array se múltiplos, ou valor único se apenas um (para compatibilidade com a função)
    const colaboradorIdParam = colaboradorIdsParaBuscar.length === 1 ? colaboradorIdsParaBuscar[0] : colaboradorIdsParaBuscar;
    
    console.log(`🔍 [ROTA] Buscando clientes para ${colaboradorIdsParaBuscar.length} colaborador(es)`);
    
    const clientes = await apiClientes.getClientesPorColaborador(colaboradorIdParam, periodoInicio || null, periodoFim || null);

    console.log(`✅ [ROTA] Retornando ${(clientes || []).length} clientes para ${colaboradorIdsParaBuscar.length} colaborador(es)`);

    res.json({ 
      success: true, 
      data: clientes || [],
      count: (clientes || []).length
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar clientes por colaborador:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// Rota para servir a página de login (durante migração)
router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../login.html'));
});

// Redirecionamentos (durante migração para React)
router.get('/dashboard.clientes.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../../../dashboard.clientes.html'));
});

router.get('/dashboard.html', requireAuth, (req, res) => {
  return res.redirect('/painel');
});

// Bloquear acesso direto à URL antiga
router.get('/cadastro-cliente.html', (req, res) => {
  return res.status(404).send('');
});

// Rota para a página principal (index) - sem autenticação
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../index.html'));
});

// Rota para o painel - COM autenticação
router.get('/painel', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../../../dashboard.html'));
});

// Rota para a página de carteira de clientes - COM autenticação
router.get('/carteira-clientes', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../../../carteira-clientes.html'));
});

module.exports = router;

