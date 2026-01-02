// =============================================================
// === ROTAS PRINCIPAIS ===
// =============================================================

const express = require('express');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const authController = require('../controllers/auth.controller');
const clientesController = require('../controllers/clientes.controller');
const tarefasController = require('../controllers/tarefas.controller');
const tarefaController = require('../controllers/tarefa.controller');
const subtarefaController = require('../controllers/subtarefa.controller');
const tipoTarefaController = require('../controllers/tipo-tarefa.controller');
const dashboardController = require('../controllers/dashboard.controller');
const colaboradoresController = require('../controllers/colaboradores.controller');
const custoColaboradorVigenciaController = require('../controllers/custo-membro-vigencia.controller');
const configCustoColaboradorController = require('../controllers/config-custo-membro.controller');
const atividadesController = require('../controllers/atividades.controller');
const produtosController = require('../controllers/produtos.controller');
const tipoAtividadeController = require('../controllers/tipo-atividade.controller');
const vinculadosController = require('../controllers/vinculados.controller');
const tempoEstimadoController = require('../controllers/tempo-estimado.controller');
const registroTempoController = require('../controllers/registro-tempo.controller');
const bancoController = require('../controllers/banco.controller');
const adquirenteController = require('../controllers/adquirente.controller');
const sistemaController = require('../controllers/sistema.controller');
const clienteContaBancariaController = require('../controllers/cliente-conta-bancaria.controller');
const clienteSistemaController = require('../controllers/cliente-sistema.controller');
const clienteAdquirenteController = require('../controllers/cliente-adquirente.controller');
const baseConhecimentoController = require('../controllers/base-conhecimento.controller');
const clienteSubtarefaObservacaoController = require('../controllers/cliente-subtarefa-observacao.controller');
const usuariosController = require('../controllers/usuarios.controller');
const permissoesConfigController = require('../controllers/permissoes-config.controller');
const apiClientes = require('../services/api-clientes');

// Registrar rotas do api-clientes.js
apiClientes.registrarRotasAPI(router, requireAuth);

// Rotas de autenticação
router.post('/api/login', authController.login);
router.post('/api/logout', authController.logout);
router.get('/api/auth/check', authController.checkAuth);
router.put('/api/auth/profile', requireAuth, authController.updateProfile);
router.get('/api/auth/preferencia-view-mode', requireAuth, authController.getPreferenciaViewMode);
router.put('/api/auth/preferencia-view-mode', requireAuth, authController.updatePreferenciaViewMode);
// Middleware para tratar erros do multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'Arquivo muito grande. Tamanho máximo: 15MB'
      });
    }
    return res.status(400).json({
      success: false,
      error: `Erro no upload: ${err.message}`
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      error: err.message || 'Erro ao processar arquivo'
    });
  }
  next();
};

router.post('/api/auth/upload-avatar', 
  requireAuth, 
  authController.upload.single('avatar'),
  handleMulterError,
  authController.uploadAvatar
);
router.get('/api/auth/custom-avatar-path', requireAuth, authController.getCustomAvatarPath);

// Rotas de clientes
router.get('/api/clientes-kamino', requireAuth, clientesController.getClientesKamino);
router.get('/api/clientes-incompletos-count', requireAuth, clientesController.getClientesIncompletosCount);
// IMPORTANTE: Rota genérica (listar) deve vir ANTES da específica (por ID)
router.get('/api/clientes', requireAuth, clientesController.getClientes);
router.get('/api/clientes/:id/custom-avatar-path', requireAuth, clientesController.getClienteCustomAvatarPath);
router.get('/api/clientes/:id', requireAuth, clientesController.getClientePorId);
router.put('/api/clientes/:id', requireAuth, clientesController.atualizarClientePorId);
router.delete('/api/clientes/:id', requireAuth, clientesController.deletarCliente);
router.post('/api/clientes/:clienteId/upload-foto', 
  requireAuth, 
  clientesController.uploadClienteFoto.single('foto'),
  handleMulterError,
  clientesController.uploadClienteFotoPerfil
);

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
router.put('/api/colaboradores/:id', requireAuth, colaboradoresController.atualizarColaborador);
router.delete('/api/colaboradores/:id', requireAuth, colaboradoresController.deletarColaborador);

// Rotas de Custo Colaborador Vigência (CRUD completo)
router.get('/api/custo-colaborador-vigencia', requireAuth, custoColaboradorVigenciaController.getCustosColaboradorVigencia);
router.get('/api/custo-colaborador-vigencia/mais-recente', requireAuth, custoColaboradorVigenciaController.getCustoMaisRecentePorMembroEPeriodo);
router.get('/api/custo-colaborador-vigencia/horas-contratadas', requireAuth, custoColaboradorVigenciaController.getHorasContratadasPorMembroEPeriodo);
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

// Rotas de Atividades (CRUD completo)
router.get('/api/atividades', requireAuth, atividadesController.getAtividades);
router.get('/api/atividades/:id', requireAuth, atividadesController.getAtividadePorId);
router.post('/api/atividades', requireAuth, atividadesController.criarAtividade);
router.put('/api/atividades/:id', requireAuth, atividadesController.atualizarAtividade);
router.delete('/api/atividades/:id', requireAuth, atividadesController.deletarAtividade);

// Rotas de Produtos (CRUD completo)
router.get('/api/produtos', requireAuth, produtosController.getProdutos);
router.get('/api/produtos-por-ids-numericos', requireAuth, produtosController.getProdutosPorIds);
router.get('/api/produtos/:id', requireAuth, produtosController.getProdutoPorId);
router.post('/api/produtos', requireAuth, produtosController.criarProduto);
router.put('/api/produtos/:id', requireAuth, produtosController.atualizarProduto);
router.delete('/api/produtos/:id', requireAuth, produtosController.deletarProduto);

// Rotas de Tipo de Atividade (CRUD completo)
router.get('/api/tipo-atividade', requireAuth, tipoAtividadeController.getTipoAtividades);
router.get('/api/tipo-atividade/por-clickup-id', requireAuth, tipoAtividadeController.getTipoAtividadePorClickupId);
router.get('/api/tipo-atividade/:id', requireAuth, tipoAtividadeController.getTipoAtividadePorId);
router.post('/api/tipo-atividade', requireAuth, tipoAtividadeController.criarTipoAtividade);
router.put('/api/tipo-atividade/:id', requireAuth, tipoAtividadeController.atualizarTipoAtividade);
router.delete('/api/tipo-atividade/:id', requireAuth, tipoAtividadeController.deletarTipoAtividade);


// Rotas de Vinculados (CRUD completo)
// IMPORTANTE: Rotas específicas devem vir ANTES de rotas com parâmetros
router.get('/api/tarefas-por-produtos', requireAuth, vinculadosController.getTarefasPorProdutos);
router.get('/api/tarefas-por-produto', requireAuth, vinculadosController.getTarefasPorProduto);
router.get('/api/tarefas-por-cliente', requireAuth, vinculadosController.getTarefasPorCliente);
router.get('/api/tarefas-por-cliente-produtos', requireAuth, vinculadosController.getTarefasPorClienteEProdutos);
router.get('/api/produtos-por-cliente', requireAuth, vinculadosController.getProdutosPorCliente);
router.get('/api/tarefas-por-tipo', requireAuth, vinculadosController.getTarefasPorTipo);
router.get('/api/subtarefas-por-tarefa', requireAuth, vinculadosController.getSubtarefasPorTarefa);
router.post('/api/vinculados/aplicar-heranca', requireAuth, vinculadosController.aplicarHeranca);
router.get('/api/vinculados', requireAuth, vinculadosController.getVinculados);
router.get('/api/vinculados/:id', requireAuth, vinculadosController.getVinculadoPorId);
router.post('/api/vinculados', requireAuth, vinculadosController.criarVinculado);
router.post('/api/vinculados/multiplos', requireAuth, vinculadosController.criarMultiplosVinculados);
router.put('/api/vinculados/:id', requireAuth, vinculadosController.atualizarVinculado);
router.delete('/api/vinculados/:id', requireAuth, vinculadosController.deletarVinculado);

// Rotas de Tempo Estimado (CRUD completo)
router.get('/api/tempo-estimado', requireAuth, tempoEstimadoController.getTempoEstimado);
router.get('/api/tempo-estimado/:id', requireAuth, tempoEstimadoController.getTempoEstimadoPorId);
router.post('/api/tempo-estimado', requireAuth, tempoEstimadoController.criarTempoEstimado);
router.put('/api/tempo-estimado/:id', requireAuth, tempoEstimadoController.atualizarTempoEstimado);
router.delete('/api/tempo-estimado/:id', requireAuth, tempoEstimadoController.deletarTempoEstimado);

// Rotas de Tempo Estimado por Agrupador
router.get('/api/tempo-estimado/agrupador/:agrupador_id', requireAuth, tempoEstimadoController.getTempoEstimadoPorAgrupador);
router.put('/api/tempo-estimado/agrupador/:agrupador_id', requireAuth, tempoEstimadoController.atualizarTempoEstimadoPorAgrupador);
router.delete('/api/tempo-estimado/agrupador/:agrupador_id', requireAuth, tempoEstimadoController.deletarTempoEstimadoPorAgrupador);
router.post('/api/tempo-estimado/tempo-realizado', requireAuth, tempoEstimadoController.getTempoRealizadoPorTarefasEstimadas);

// Rotas de Registro de Tempo
// IMPORTANTE: Rotas mais específicas devem vir ANTES das genéricas
router.post('/api/registro-tempo/iniciar', requireAuth, registroTempoController.iniciarRegistroTempo);
router.put('/api/registro-tempo/finalizar/:id', requireAuth, registroTempoController.finalizarRegistroTempo);
router.get('/api/registro-tempo/ativo', requireAuth, registroTempoController.getRegistroAtivo);
router.get('/api/registro-tempo/ativos', requireAuth, registroTempoController.getRegistrosAtivos);
router.get('/api/registro-tempo/realizado', requireAuth, registroTempoController.getTempoRealizado);
router.get('/api/registro-tempo/por-tempo-estimado', requireAuth, registroTempoController.getRegistrosPorTempoEstimado);
router.get('/api/registro-tempo/historico', requireAuth, registroTempoController.getHistoricoRegistros);
router.get('/api/registro-tempo/debug/sem-tarefa', requireAuth, registroTempoController.getRegistrosSemTarefa);
// Rota genérica consolidada (deve vir depois das específicas)
router.get('/api/registro-tempo', requireAuth, registroTempoController.getRegistrosTempo);
router.put('/api/registro-tempo/:id', requireAuth, registroTempoController.atualizarRegistroTempo);
router.delete('/api/registro-tempo/:id', requireAuth, registroTempoController.deletarRegistroTempo);

// Rotas de Banco (CRUD completo)
router.get('/api/bancos', requireAuth, bancoController.getBancos);
router.get('/api/bancos/:id', requireAuth, bancoController.getBancoPorId);
router.post('/api/bancos', requireAuth, bancoController.criarBanco);
router.put('/api/bancos/:id', requireAuth, bancoController.atualizarBanco);
router.delete('/api/bancos/:id', requireAuth, bancoController.deletarBanco);

// Rotas de Adquirente (CRUD completo)
router.get('/api/adquirentes', requireAuth, adquirenteController.getAdquirentes);
router.get('/api/adquirentes/:id', requireAuth, adquirenteController.getAdquirentePorId);
router.post('/api/adquirentes', requireAuth, adquirenteController.criarAdquirente);
router.put('/api/adquirentes/:id', requireAuth, adquirenteController.atualizarAdquirente);
router.delete('/api/adquirentes/:id', requireAuth, adquirenteController.deletarAdquirente);

// Rotas de Sistema (CRUD completo)
router.get('/api/sistemas', requireAuth, sistemaController.getSistemas);
router.get('/api/sistemas/:id', requireAuth, sistemaController.getSistemaPorId);
router.post('/api/sistemas', requireAuth, sistemaController.criarSistema);
router.put('/api/sistemas/:id', requireAuth, sistemaController.atualizarSistema);
router.delete('/api/sistemas/:id', requireAuth, sistemaController.deletarSistema);

// Rotas de Tarefa (cp_tarefa) (CRUD completo)
router.get('/api/tarefa', requireAuth, tarefaController.getTarefas);
router.get('/api/tarefa/:id', requireAuth, tarefaController.getTarefaPorId);
router.post('/api/tarefa', requireAuth, tarefaController.criarTarefa);
router.put('/api/tarefa/:id', requireAuth, tarefaController.atualizarTarefa);
router.delete('/api/tarefa/:id', requireAuth, tarefaController.deletarTarefa);

// Rotas de Subtarefa (cp_subtarefa) - CRUD completo
router.get('/api/subtarefa', requireAuth, subtarefaController.getSubtarefas);
router.get('/api/subtarefa/:id', requireAuth, subtarefaController.getSubtarefaPorId);
router.post('/api/subtarefa', requireAuth, subtarefaController.criarSubtarefa);
router.put('/api/subtarefa/:id', requireAuth, subtarefaController.atualizarSubtarefa);
router.delete('/api/subtarefa/:id', requireAuth, subtarefaController.deletarSubtarefa);

// Rotas de Tipo de Tarefa (cp_tarefa_tipo) (CRUD completo)
router.get('/api/tipo-tarefa', requireAuth, tipoTarefaController.getTipoTarefas);
router.get('/api/tipo-tarefa/:id', requireAuth, tipoTarefaController.getTipoTarefaPorId);
router.post('/api/tipo-tarefa', requireAuth, tipoTarefaController.criarTipoTarefa);
router.put('/api/tipo-tarefa/:id', requireAuth, tipoTarefaController.atualizarTipoTarefa);
router.delete('/api/tipo-tarefa/:id', requireAuth, tipoTarefaController.deletarTipoTarefa);

// Rotas de Cliente Conta Bancária (CRUD completo)
router.get('/api/clientes/:cliente_id/contas-bancarias', requireAuth, clienteContaBancariaController.getContasBancarias);
router.get('/api/clientes-contas-bancarias/:id', requireAuth, clienteContaBancariaController.getContaBancariaPorId);
router.post('/api/clientes-contas-bancarias', requireAuth, clienteContaBancariaController.criarContaBancaria);
router.put('/api/clientes-contas-bancarias/:id', requireAuth, clienteContaBancariaController.atualizarContaBancaria);
router.delete('/api/clientes-contas-bancarias/:id', requireAuth, clienteContaBancariaController.deletarContaBancaria);

// Rotas de Cliente Sistema (CRUD completo)
router.get('/api/clientes/:cliente_id/sistemas', requireAuth, clienteSistemaController.getSistemasCliente);
router.get('/api/clientes-sistemas/:id', requireAuth, clienteSistemaController.getSistemaClientePorId);
router.post('/api/clientes-sistemas', requireAuth, clienteSistemaController.criarSistemaCliente);
router.put('/api/clientes-sistemas/:id', requireAuth, clienteSistemaController.atualizarSistemaCliente);
router.delete('/api/clientes-sistemas/:id', requireAuth, clienteSistemaController.deletarSistemaCliente);

// Rotas de Cliente Adquirente (CRUD completo)
router.get('/api/clientes/:cliente_id/adquirentes', requireAuth, clienteAdquirenteController.getAdquirentesCliente);
router.get('/api/clientes-adquirentes/:id', requireAuth, clienteAdquirenteController.getAdquirenteClientePorId);
router.post('/api/clientes-adquirentes', requireAuth, clienteAdquirenteController.criarAdquirenteCliente);
router.put('/api/clientes-adquirentes/:id', requireAuth, clienteAdquirenteController.atualizarAdquirenteCliente);
router.delete('/api/clientes-adquirentes/:id', requireAuth, clienteAdquirenteController.deletarAdquirenteCliente);

// Rotas de Base de Conhecimento
router.get('/api/base-conhecimento/cliente/:cliente_id', requireAuth, baseConhecimentoController.getBaseConhecimentoCliente);

// Rotas de Observações Particulares de Subtarefas por Cliente
router.get('/api/cliente-subtarefa-observacao', requireAuth, clienteSubtarefaObservacaoController.getObservacao);
router.get('/api/cliente-subtarefa-observacao/cliente/:cliente_id', requireAuth, clienteSubtarefaObservacaoController.getObservacoesPorCliente);
router.post('/api/cliente-subtarefa-observacao', requireAuth, clienteSubtarefaObservacaoController.salvarObservacao);
router.put('/api/cliente-subtarefa-observacao', requireAuth, clienteSubtarefaObservacaoController.salvarObservacao);
router.delete('/api/cliente-subtarefa-observacao', requireAuth, clienteSubtarefaObservacaoController.deletarObservacao);

// Rotas de Usuários (Gestão de Permissões)
router.get('/api/usuarios', requireAuth, usuariosController.getUsuarios);
router.put('/api/usuarios/:id/permissoes', requireAuth, usuariosController.atualizarPermissoes);

// Rotas de Configurações de Permissões
router.get('/api/permissoes-config', requireAuth, permissoesConfigController.getPermissoesConfig);
router.put('/api/permissoes-config/:nivel', requireAuth, permissoesConfigController.atualizarPermissoesConfig);

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

router.get('/cadastro/clientes', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../../../carteira-clientes.html'));
});
router.get('/cadastro-clientes', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../../../carteira-clientes.html'));
}); // Mantido para compatibilidade
router.get('/gestao-clientes', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../../../carteira-clientes.html'));
}); // Mantido para compatibilidade

// Rota para a página de colaboradores - COM autenticação
router.get('/cadastro/colaboradores', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../../../dashboard.html'));
});
router.get('/cadastro-colaboradores', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../../../dashboard.html'));
}); // Mantido para compatibilidade
router.get('/gestao-colaboradores', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../../../dashboard.html'));
}); // Mantido para compatibilidade

module.exports = router;

