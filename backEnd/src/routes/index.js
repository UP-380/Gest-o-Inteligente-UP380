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
const custoColaboradorVigenciaController = require('../controllers/custo-membro-vigencia.controller');
const configCustoColaboradorController = require('../controllers/config-custo-membro.controller');
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
router.get('/api/gestao-clientes', requireAuth, clientesController.getCarteiraClientes);
// IMPORTANTE: Rotas mais específicas devem vir ANTES das genéricas
router.put('/api/clientes/:id/inativar', requireAuth, clientesController.inativarCliente);
router.put('/api/clientes/:id/ativar', requireAuth, clientesController.ativarCliente);
router.put('/api/clientes/:id', requireAuth, clientesController.atualizarClientePorId);
router.put('/api/cliente-dados/:nomeClienteClickup', requireAuth, clientesController.atualizarClientePorNomeClickup);

// Rotas de tarefas
router.get('/api/tarefas-incompletas', requireAuth, tarefasController.getTarefasIncompletas);
router.get('/api/tarefas-por-ids', requireAuth, tarefasController.getTarefasPorIds);

// Rotas de produtos
router.get('/api/produtos-por-ids', requireAuth, tarefasController.getProdutosPorIdsEndpoint);

// Rotas de dashboard
router.get('/api/dashboard-clientes', requireAuth, dashboardController.getDashboardClientes);
router.get('/api/relatorios-clientes', requireAuth, dashboardController.getDashboardClientes);
router.get('/api/dashboard-colaboradores', requireAuth, dashboardController.getDashboardColaboradores);
router.get('/api/relatorios-colaboradores', requireAuth, dashboardController.getDashboardColaboradores);
router.get('/api/debug-tarefa/:tarefaId', requireAuth, dashboardController.debugTarefa);

// Rotas de Colaboradores (CRUD completo)
// IMPORTANTE: Rotas mais específicas devem vir ANTES das genéricas
router.get('/api/tipos-contrato', requireAuth, colaboradoresController.getTiposContrato);
router.get('/api/colaboradores', requireAuth, colaboradoresController.getColaboradores);
router.get('/api/colaboradores/:id', requireAuth, colaboradoresController.getColaboradorPorId);
router.post('/api/colaboradores', requireAuth, colaboradoresController.criarColaborador);
router.put('/api/colaboradores/:id/inativar', requireAuth, colaboradoresController.inativarColaborador);
router.put('/api/colaboradores/:id/ativar', requireAuth, colaboradoresController.ativarColaborador);
router.put('/api/colaboradores/:id', requireAuth, colaboradoresController.atualizarColaborador);
router.delete('/api/colaboradores/:id', requireAuth, colaboradoresController.deletarColaborador);

// Rotas de Custo Colaborador Vigência (CRUD completo)
router.get('/api/custo-colaborador-vigencia', requireAuth, custoColaboradorVigenciaController.getCustosColaboradorVigencia);
router.get('/api/custo-colaborador-vigencia/:id', requireAuth, custoColaboradorVigenciaController.getCustoColaboradorVigenciaPorId);
router.get('/api/custo-colaborador-vigencia/membro/:membro_id', requireAuth, custoColaboradorVigenciaController.getCustosPorMembro);
router.post('/api/custo-colaborador-vigencia', requireAuth, custoColaboradorVigenciaController.criarCustoColaboradorVigencia);
router.put('/api/custo-colaborador-vigencia/:id', requireAuth, custoColaboradorVigenciaController.atualizarCustoColaboradorVigencia);
router.delete('/api/custo-colaborador-vigencia/:id', requireAuth, custoColaboradorVigenciaController.deletarCustoColaboradorVigencia);

// Rotas de Configuração de Custo Colaborador (CRUD completo)
router.get('/api/config-custo-colaborador', requireAuth, configCustoColaboradorController.getConfigCustoColaborador);
router.get('/api/config-custo-colaborador/mais-recente', requireAuth, configCustoColaboradorController.getConfigCustoColaboradorMaisRecente);
router.get('/api/config-custo-colaborador/:id', requireAuth, configCustoColaboradorController.getConfigCustoColaboradorPorId);
router.post('/api/config-custo-colaborador', requireAuth, configCustoColaboradorController.criarConfigCustoColaborador);
router.put('/api/config-custo-colaborador/:id', requireAuth, configCustoColaboradorController.atualizarConfigCustoColaborador);
router.delete('/api/config-custo-colaborador/:id', requireAuth, configCustoColaboradorController.deletarConfigCustoColaborador);

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
    } else if (typeof colaboradorId === 'string' && colaboradorId.includes(',')) {
      // String separada por vírgulas (fallback)
      colaboradorIdsParaBuscar = colaboradorId.split(',').map(id => id.trim()).filter(Boolean);
    } else {
      // Valor único
      colaboradorIdsParaBuscar = [colaboradorId];
    }

    // Usar array se múltiplos, ou valor único se apenas um (para compatibilidade com a função)
    const colaboradorIdParam = colaboradorIdsParaBuscar.length === 1 ? colaboradorIdsParaBuscar[0] : colaboradorIdsParaBuscar;
    
    
    const clientes = await apiClientes.getClientesPorColaborador(colaboradorIdParam, periodoInicio || null, periodoFim || null);


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
router.get('/gestao-clientes', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../../../carteira-clientes.html'));
});

module.exports = router;

