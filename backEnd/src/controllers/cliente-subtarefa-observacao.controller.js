// =============================================================
// === CONTROLLER DE OBSERVAÇÕES PARTICULARES DE SUBTAREFAS POR CLIENTE ===
// =============================================================

const supabase = require('../config/database');

// GET - Buscar observação de uma subtarefa para um cliente
async function getObservacao(req, res) {
  try {
    const { cliente_id, subtarefa_id } = req.query;

    if (!cliente_id || !subtarefa_id) {
      return res.status(400).json({
        success: false,
        error: 'cliente_id e subtarefa_id são obrigatórios'
      });
    }

    const { data, error } = await supabase
      
      .from('cliente_subtarefa_observacao')
      .select('*')
      .eq('cliente_id', cliente_id)
      .eq('subtarefa_id', subtarefa_id)
      .maybeSingle();

    if (error) {
      console.error('❌ Erro ao buscar observação:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar observação',
        details: error.message
      });
    }

    return res.json({
      success: true,
      data: data || null
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao buscar observação:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar todas as observações de um cliente
async function getObservacoesPorCliente(req, res) {
  try {
    const { cliente_id } = req.params;

    if (!cliente_id) {
      return res.status(400).json({
        success: false,
        error: 'cliente_id é obrigatório'
      });
    }

    const { data, error } = await supabase
      
      .from('cliente_subtarefa_observacao')
      .select('*')
      .eq('cliente_id', cliente_id);

    if (error) {
      console.error('❌ Erro ao buscar observações:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar observações',
        details: error.message
      });
    }

    // Criar um mapa subtarefa_id -> observacao para facilitar o uso
    const observacoesMap = {};
    (data || []).forEach(obs => {
      observacoesMap[obs.subtarefa_id] = obs.observacao;
    });

    return res.json({
      success: true,
      data: data || [],
      map: observacoesMap
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao buscar observações:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// POST/PUT - Criar ou atualizar observação
async function salvarObservacao(req, res) {
  try {
    const { cliente_id, subtarefa_id, observacao } = req.body;

    if (!cliente_id || !subtarefa_id) {
      return res.status(400).json({
        success: false,
        error: 'cliente_id e subtarefa_id são obrigatórios'
      });
    }

    // Verificar se já existe
    const { data: existente, error: errorExistente } = await supabase
      
      .from('cliente_subtarefa_observacao')
      .select('id')
      .eq('cliente_id', cliente_id)
      .eq('subtarefa_id', subtarefa_id)
      .maybeSingle();

    if (errorExistente && errorExistente.code !== 'PGRST116') {
      console.error('❌ Erro ao verificar observação existente:', errorExistente);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar observação existente',
        details: errorExistente.message
      });
    }

    const dadosObservacao = {
      cliente_id: String(cliente_id).trim(),
      subtarefa_id: parseInt(subtarefa_id, 10),
      observacao: observacao || null,
      updated_at: new Date().toISOString()
    };

    let result;
    if (existente) {
      // Atualizar
      const { data, error } = await supabase
        
        .from('cliente_subtarefa_observacao')
        .update(dadosObservacao)
        .eq('id', existente.id)
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao atualizar observação:', error);
        return res.status(500).json({
          success: false,
          error: 'Erro ao atualizar observação',
          details: error.message
        });
      }

      result = data;
    } else {
      // Criar
      dadosObservacao.created_at = new Date().toISOString();
      const { data, error } = await supabase
        
        .from('cliente_subtarefa_observacao')
        .insert([dadosObservacao])
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao criar observação:', error);
        return res.status(500).json({
          success: false,
          error: 'Erro ao criar observação',
          details: error.message
        });
      }

      result = data;
    }

    return res.json({
      success: true,
      data: result,
      message: existente ? 'Observação atualizada com sucesso' : 'Observação criada com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao salvar observação:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// DELETE - Deletar observação
async function deletarObservacao(req, res) {
  try {
    const { cliente_id, subtarefa_id } = req.query;

    if (!cliente_id || !subtarefa_id) {
      return res.status(400).json({
        success: false,
        error: 'cliente_id e subtarefa_id são obrigatórios'
      });
    }

    const { error } = await supabase
      
      .from('cliente_subtarefa_observacao')
      .delete()
      .eq('cliente_id', cliente_id)
      .eq('subtarefa_id', subtarefa_id);

    if (error) {
      console.error('❌ Erro ao deletar observação:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar observação',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Observação deletada com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao deletar observação:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

module.exports = {
  getObservacao,
  getObservacoesPorCliente,
  salvarObservacao,
  deletarObservacao
};

