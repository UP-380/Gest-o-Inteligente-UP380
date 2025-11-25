// =============================================================
// === SERVIDOR DASHBOARD CLIENTES (PORTA 4001) ===
// =============================================================

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT_DASHBOARD_CLIENTES || 4001;

// Importar funções e registrar rotas do api-clientes.js
const apiClientes = require('../services/api-clientes');
const { 
  registrarRotasAPI, 
  supabase, 
  getProdutosPorIds, 
  getMembrosPorIds, 
  getMembrosPorCliente, 
  getClientesPorColaborador 
} = apiClientes;

// Middleware
app.use(cors({
  origin: ['http://localhost:4000', 'http://127.0.0.1:4000', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../../')));

console.log('✅ Backend Dashboard Clientes configurado');

// ========================================
// === REGISTRAR ROTAS DO API-CLIENTES.JS ===
// ========================================
registrarRotasAPI(app, null); // null = sem autenticação (backend separado)

// ========================================
// === ENDPOINTS ESPECÍFICOS DO DASHBOARD ===
// ========================================

// Endpoint: Registros de tempo por período com tarefas relacionadas (OTIMIZADO)
app.get('/api/registro-tempo-periodo', async (req, res) => {
  try {
    const { dataInicio, dataFim, colaboradorId, clienteId } = req.query;

    // Validar: precisa de período sempre
    if (!dataInicio || !dataFim) {
      return res.status(400).json({ 
        success: false, 
        error: 'Data de início e data de fim são obrigatórias' 
      });
    }

    // Construir query base
    const inicioISO = new Date(`${dataInicio}T00:00:00.000Z`);
    const fimISO = new Date(`${dataFim}T23:59:59.999Z`);
    
    const inicioStr = inicioISO.toISOString();
    const fimStr = fimISO.toISOString();
    
    // Converter colaboradorId para número
    const colaboradorIdNum = colaboradorId ? parseInt(colaboradorId, 10) : null;
    
    // Converter clienteId para string (pode ser UUID ou texto)
    const clienteIdStr = clienteId ? String(clienteId).trim() : null;
    
    // Construir query base
    let query = supabase
      .schema('up_gestaointeligente')
      .from('registro_tempo')
      .select('*')
      .not('data_inicio', 'is', null)
      .not('data_fim', 'is', null);

    // FILTRO DE CLIENTE: Filtrar por cliente_id
    if (clienteIdStr) {
      query = query.eq('cliente_id', clienteIdStr);
    }

    // FILTRO DE COLABORADOR: Filtrar por colaborador (usuario_id)
    if (colaboradorIdNum && !isNaN(colaboradorIdNum)) {
      query = query.eq('usuario_id', colaboradorIdNum);
    }

    // Lógica: Registro se sobrepõe se:
    // 1. data_inicio está dentro do período, OU
    // 2. data_fim está dentro do período, OU
    // 3. registro cobre todo o período (começa antes e termina depois)
    const orConditions = [
      `and(data_inicio.gte.${inicioStr},data_inicio.lte.${fimStr})`,
      `and(data_fim.gte.${inicioStr},data_fim.lte.${fimStr})`,
      `and(data_inicio.lte.${inicioStr},data_fim.gte.${fimStr})`
    ].join(',');

    query = query.or(orConditions);

    const { data: registrosFiltrados, error } = await query;

    if (error) {
      console.error('Erro ao buscar registros de tempo:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro ao buscar registros de tempo' 
      });
    }

    if (!registrosFiltrados || registrosFiltrados.length === 0) {
      return res.json({ 
        success: true, 
        data: [], 
        count: 0 
      });
    }

    // Extrair IDs únicos de tarefas e usuários
    const tarefaIds = [...new Set(registrosFiltrados.map(r => r.tarefa_id).filter(Boolean))];
    const usuarioIds = [...new Set(registrosFiltrados.map(r => r.usuario_id).filter(Boolean))];

    // Buscar tarefas em paralelo
    const { data: tarefas, error: tarefasError } = await supabase
      .schema('up_gestaointeligente')
      .from('tarefa')
      .select('*')
      .in('id', tarefaIds);

    if (tarefasError) {
      console.error('Erro ao buscar tarefas:', tarefasError);
    }

    // Criar mapa de tarefas
    const tarefasMap = new Map();
    (tarefas || []).forEach(tarefa => {
      tarefasMap.set(tarefa.id, tarefa);
    });

    // Buscar produtos únicos das tarefas
    const produtoIds = [...new Set((tarefas || []).map(t => t.produto_id).filter(Boolean))];
    
    // Buscar membros e produtos em paralelo
    const [membros, produtos] = await Promise.all([
      getMembrosPorIds(usuarioIds),
      getProdutosPorIds(produtoIds)
    ]);

    // Criar mapa de produtos
    const produtosMap = new Map();
    produtos.forEach(produto => {
      produtosMap.set(produto.id, produto);
    });

    // Criar mapa de membros (múltiplos formatos de ID)
    const membrosMap = new Map();
    membros.forEach(membro => {
      if (!membro) return;
      const membroId = membro.id;
      membrosMap.set(membroId, membro);
      membrosMap.set(String(membroId).trim(), membro);
      const membroIdNum = parseInt(String(membroId), 10);
      if (!isNaN(membroIdNum)) {
        membrosMap.set(membroIdNum, membro);
      }
    });

    // Vincular tarefas, produtos e membros aos registros
    const registrosComTarefas = registrosFiltrados.map(registro => {
      const tarefa = tarefasMap.get(registro.tarefa_id);
      const produto = tarefa && tarefa.produto_id ? produtosMap.get(tarefa.produto_id) : null;
      const membro = membrosMap.get(registro.usuario_id) || 
                     membrosMap.get(String(registro.usuario_id).trim()) ||
                     membrosMap.get(parseInt(registro.usuario_id, 10)) ||
                     null;

      return {
        ...registro,
        tarefa: tarefa ? { ...tarefa, produto: produto || null } : null,
        membro: membro || null
      };
    });

    res.json({ 
      success: true, 
      data: registrosComTarefas, 
      count: registrosComTarefas.length 
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar registros de tempo com tarefas:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// Endpoint: Buscar membros (colaboradores) que têm registros em um cliente específico
app.get('/api/membros-por-cliente', async (req, res) => {
  try {
    const { clienteId, periodoInicio, periodoFim } = req.query;

    if (!clienteId) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID do cliente é obrigatório' 
      });
    }

    const membros = await getMembrosPorCliente(clienteId, periodoInicio || null, periodoFim || null);

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

// Endpoint: Buscar clientes que têm registros de um colaborador específico
app.get('/api/clientes-por-colaborador', async (req, res) => {
  try {
    const { colaboradorId, periodoInicio, periodoFim } = req.query;

    if (!colaboradorId) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID do colaborador é obrigatório' 
      });
    }

    const clientes = await getClientesPorColaborador(colaboradorId, periodoInicio || null, periodoFim || null);

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

// ========================================
// === INICIAR SERVIDOR ===
// ========================================
app.listen(PORT, () => {
  console.log(`🚀 Servidor Dashboard Clientes rodando em http://localhost:${PORT}`);
  console.log(`📡 API disponível em http://localhost:${PORT}/api/`);
});

