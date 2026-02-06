// =============================================================
// === CONTROLLER DE TAREFAS ===
// =============================================================

const supabase = require('../config/database');
const apiClientes = require('../services/api-clientes');
const { getProdutosPorIds, getProdutosPorClickupIds } = apiClientes;

// ========================================
// === GET /api/tarefas-incompletas ===
// ========================================
async function getTarefasIncompletas(req, res) {
  try {
    console.log('🔍 [TAREFAS INCOMPLETAS] Buscando tarefas com campos null...');
    
    // Buscar tarefas que têm pelo menos um campo null
    // Usar múltiplas queries e combinar os resultados
    const [result1, result2, result3] = await Promise.all([
      // Tarefas sem dt_inicio
      supabase
        
        .from('tarefa')
        .select('id,tarefa_nome,dt_inicio,dt_vencimento,cliente_id,url,created_at')
        .is('dt_inicio', null),
      
      // Tarefas sem dt_vencimento
      supabase
        
        .from('tarefa')
        .select('id,tarefa_nome,dt_inicio,dt_vencimento,cliente_id,url,created_at')
        .is('dt_vencimento', null),
      
      // Tarefas sem cliente_id
      supabase
        
        .from('tarefa')
        .select('id,tarefa_nome,dt_inicio,dt_vencimento,cliente_id,url,created_at')
        .is('cliente_id', null)
    ]);

    // Combinar resultados e remover duplicatas
    const tarefasMap = new Map();
    
    [result1, result2, result3].forEach((result, index) => {
      if (result.error) {
        console.error(`❌ Erro na query ${index + 1}:`, result.error);
      } else {
        (result.data || []).forEach(tarefa => {
          if (!tarefasMap.has(tarefa.id)) {
            tarefasMap.set(tarefa.id, tarefa);
          }
        });
      }
    });

    const data = Array.from(tarefasMap.values());
    console.log(`✅ [TAREFAS INCOMPLETAS] Encontradas ${data.length} tarefas incompletas`);

    // Buscar todos os clientes para mapear IDs para nomes
    const { data: todosClientes, error: clientesError } = await supabase
      
      .from('cp_cliente')
      .select('id, nome');

    if (clientesError) {
      console.error('❌ [TAREFAS INCOMPLETAS] Erro ao buscar clientes:', clientesError);
    }

    const clientesMap = {};
    if (!clientesError && todosClientes) {
      todosClientes.forEach(cliente => {
        const idStr = String(cliente.id).trim();
        clientesMap[idStr] = cliente.nome;
        // Também mapear com diferentes formatos para garantir
        clientesMap[idStr.toLowerCase()] = cliente.nome;
        clientesMap[idStr.toUpperCase()] = cliente.nome;
      });
    }
    
    console.log(`📋 [TAREFAS INCOMPLETAS] Mapeados ${Object.keys(clientesMap).length} clientes (total de clientes: ${todosClientes?.length || 0})`);

    // Primeiro, coletar todos os cliente_ids únicos de todas as tarefas
    const todosClienteIds = new Set();
    data.forEach(t => {
      if (t.cliente_id !== null && t.cliente_id !== undefined) {
        const clienteIdStr = String(t.cliente_id).trim();
        if (clienteIdStr !== '' && clienteIdStr.toLowerCase() !== 'null') {
          const clienteIds = clienteIdStr.split(',').map(id => id.trim()).filter(Boolean);
          clienteIds.forEach(id => todosClienteIds.add(id));
        }
      }
    });
    
    console.log(`📋 [TAREFAS INCOMPLETAS] Total de cliente_ids únicos encontrados: ${todosClienteIds.size}`);
    
    // Buscar todos os clientes que não estão no mapa inicial
    const clienteIdsParaBuscar = Array.from(todosClienteIds).filter(id => {
      return !clientesMap[id] && 
             !clientesMap[id.toLowerCase()] && 
             !clientesMap[id.toUpperCase()] &&
             !todosClientes?.find(c => {
               const cId = String(c.id).trim();
               return cId === id || cId.toLowerCase() === id.toLowerCase();
             });
    });
    
    if (clienteIdsParaBuscar.length > 0) {
      console.log(`🔍 [TAREFAS INCOMPLETAS] Buscando ${clienteIdsParaBuscar.length} clientes que não estão no mapa inicial`);
      
      // Buscar em lotes para evitar queries muito grandes
      const batchSize = 50;
      for (let i = 0; i < clienteIdsParaBuscar.length; i += batchSize) {
        const batch = clienteIdsParaBuscar.slice(i, i + batchSize);
        
        try {
          const { data: clientesBatch, error: batchError } = await supabase
            
            .from('cp_cliente')
            .select('id, nome')
            .in('id', batch);
          
          if (batchError) {
            console.error(`❌ [TAREFAS INCOMPLETAS] Erro no batch ${Math.floor(i/batchSize) + 1}:`, batchError);
          }
          
          if (!batchError && clientesBatch) {
            clientesBatch.forEach(cliente => {
              const idStr = String(cliente.id).trim();
              clientesMap[idStr] = cliente.nome;
              clientesMap[idStr.toLowerCase()] = cliente.nome;
              clientesMap[idStr.toUpperCase()] = cliente.nome;
            });
            console.log(`✅ [TAREFAS INCOMPLETAS] Encontrados ${clientesBatch.length} clientes no batch ${Math.floor(i/batchSize) + 1}`);
          }
        } catch (err) {
          console.error(`❌ [TAREFAS INCOMPLETAS] Erro ao buscar batch de clientes:`, err);
        }
      }
    }

    const items = data.map((t) => {
      // Processar cliente_id - pode ser um único ID ou múltiplos separados por ", "
      let clientes = [];
      
      // Verificar se cliente_id existe e não é vazio/null
      const clienteIdRaw = t.cliente_id;
      if (clienteIdRaw !== null && clienteIdRaw !== undefined) {
        const clienteIdStr = String(clienteIdRaw).trim();
        
        // Verificar se não é string vazia ou "null"
        if (clienteIdStr !== '' && clienteIdStr.toLowerCase() !== 'null') {
          const clienteIds = clienteIdStr.split(',').map(id => id.trim()).filter(Boolean);
          
          if (clienteIds.length > 0) {
            clientes = clienteIds.map(clienteId => {
              const clienteIdTrim = clienteId.trim();
              
              // Tentar encontrar o cliente no mapa (com diferentes formatos)
              let nome = clientesMap[clienteIdTrim] || 
                         clientesMap[clienteIdTrim.toLowerCase()] || 
                         clientesMap[clienteIdTrim.toUpperCase()] ||
                         null;
              
              // Se não encontrou, buscar diretamente no array de clientes
              if (!nome && todosClientes) {
                const clienteEncontrado = todosClientes.find(c => {
                  const cId = String(c.id).trim();
                  return cId === clienteIdTrim || 
                         cId.toLowerCase() === clienteIdTrim.toLowerCase() ||
                         cId === clienteIdTrim.toLowerCase() ||
                         cId === clienteIdTrim.toUpperCase();
                });
                if (clienteEncontrado) {
                  nome = clienteEncontrado.nome;
                  // Adicionar ao mapa para próximas buscas
                  clientesMap[clienteIdTrim] = nome;
                  clientesMap[clienteIdTrim.toLowerCase()] = nome;
                  clientesMap[clienteIdTrim.toUpperCase()] = nome;
                }
              }
              
              if (!nome) {
                console.log(`⚠️ [TAREFAS INCOMPLETAS] Cliente não encontrado para ID: "${clienteIdTrim}" (tarefa: ${t.id})`);
                nome = `Cliente #${clienteIdTrim}`;
              }
              
              return { id: clienteIdTrim, nome };
            });
          }
        }
      }
      
      // Log para debug se não encontrou clientes mas tem cliente_id
      if (clientes.length === 0 && clienteIdRaw) {
        console.log(`⚠️ [TAREFAS INCOMPLETAS] Tarefa ${t.id} tem cliente_id="${clienteIdRaw}" mas não foi mapeado`);
      }

      return {
        id: t.id,
        nome: t.tarefa_nome || t.nome || 'Sem nome',
        url: t.url || null,
        dt_inicio: t.dt_inicio || null,
        dt_vencimento: t.dt_vencimento || null,
        cliente_id: t.cliente_id || null,
        clientes: clientes, // Array de objetos { id, nome }
        created_at: t.created_at || null,
        missing: [
          !t.dt_inicio ? 'dt_inicio' : null,
          !t.dt_vencimento ? 'dt_vencimento' : null,
          !t.cliente_id ? 'cliente_id' : null,
        ].filter(Boolean),
      };
    });

    // Ordenar por created_at (mais recentes primeiro)
    items.sort((a, b) => {
      if (!a.created_at && !b.created_at) return 0;
      if (!a.created_at) return 1;
      if (!b.created_at) return -1;
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      return dateB.getTime() - dateA.getTime();
    });

    console.log(`✅ [TAREFAS INCOMPLETAS] Retornando ${items.length} tarefas processadas`);
    res.json({ success: true, data: items, count: items.length });
  } catch (err) {
    console.error('❌ [TAREFAS INCOMPLETAS] Erro:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ========================================
// === GET /api/tarefas-por-ids ===
// ========================================
async function getTarefasPorIds(req, res) {
  try {
    const { ids } = req.query;
    
    if (!ids) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetro "ids" é obrigatório. Use: ?ids=id1,id2,id3'
      });
    }

    // Converter string de IDs separados por vírgula em array e remover duplicatas
    const tarefaIds = [...new Set(
      String(ids)
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0)
    )];

    if (tarefaIds.length === 0) {
      return res.json({
        success: true,
        data: {},
        count: 0
      });
    }

    // Buscar da tabela cp_tarefa, coluna 'nome'
    const { data: tarefas, error: tarefasError } = await supabase
      
      .from('cp_tarefa')
      .select('id, nome')
      .in('id', tarefaIds);

    if (tarefasError) {
      console.error('Erro ao buscar tarefas por IDs:', tarefasError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar tarefas',
        details: tarefasError.message
      });
    }

    // Criar mapa de ID -> nome
    const tarefasMap = {};
    (tarefas || []).forEach(tarefa => {
      tarefasMap[tarefa.id] = tarefa.nome || null;
    });

    res.json({
      success: true,
      data: tarefasMap,
      count: Object.keys(tarefasMap).length
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar tarefas por IDs:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// ========================================
// === GET /api/produtos-por-ids ===
// ========================================
async function getProdutosPorIdsEndpoint(req, res) {
  try {
    const { ids } = req.query;
    
    if (!ids) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetro "ids" é obrigatório. Use: ?ids=id1,id2,id3'
      });
    }

    // Converter string de IDs separados por vírgula em array e remover duplicatas
    const clickupIds = [...new Set(
      String(ids)
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0)
    )];

    if (clickupIds.length === 0) {
      return res.json({
        success: true,
        data: {},
        count: 0
      });
    }

    // Buscar produtos por clickup_id (não por id)
    const produtos = await getProdutosPorClickupIds(clickupIds);

    // Criar mapa de clickup_id -> nome
    const produtosMap = {};
    produtos.forEach(produto => {
      if (produto && produto.clickup_id) {
        produtosMap[String(produto.clickup_id).trim()] = produto.nome || null;
      }
    });

    res.json({
      success: true,
      data: produtosMap,
      count: Object.keys(produtosMap).length
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar produtos por clickup_ids:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

module.exports = {
  getTarefasIncompletas,
  getTarefasPorIds,
  getProdutosPorIdsEndpoint
};

