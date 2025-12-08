// =============================================================
// === CONTROLLER DE VINCULAÇÕES ===
// =============================================================

const supabase = require('../config/database');

// Mapeamento de tipos para nomes de tabelas
const TIPO_PARA_TABELA = {
  'produto': 'cp_produto',
  'atividade': 'cp_atividade',
  'tipo-atividade': 'cp_atividade_tipo'
};

// GET - Listar todas as vinculações (com paginação opcional)
async function getVinculacoes(req, res) {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .schema('up_gestaointeligente')
      .from('cp_vinculacao')
      .select('id, cp_atividade, cp_produto, cp_atividade_tipo', { count: 'exact' })
      .order('id', { ascending: false });

    // Busca desabilitada por enquanto (não há campo de texto para buscar)
    // if (search && search.trim()) {
    //   const searchTerm = search.trim();
    //   const ilikePattern = `%${searchTerm}%`;
    //   query = query.ilike('catalogos_vinculados', ilikePattern);
    // }

    // Aplicar paginação
    if (limitNum > 0) {
      query = query.range(offset, offset + limitNum - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('❌ Erro ao buscar vinculações:', error);
      console.error('❌ Detalhes do erro:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar vinculações',
        details: error.message
      });
    }

    console.log(`✅ Vinculações encontradas: ${data?.length || 0} de ${count || 0} total`);

    return res.json({
      success: true,
      data: data || [],
      count: data?.length || 0,
      total: count || 0,
      page: pageNum,
      limit: limitNum
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar vinculações:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar vinculação por ID
async function getVinculacaoPorId(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da vinculação é obrigatório'
      });
    }

    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_vinculacao')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar vinculação:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar vinculação',
        details: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Vinculação não encontrada'
      });
    }

    return res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar vinculação:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// POST - Criar nova vinculação
async function criarVinculacao(req, res) {
  try {
    const { cp_atividade, cp_produto, cp_atividade_tipo } = req.body;

    // Preparar dados para inserção (valores booleanos, default false)
    const dadosVinculacao = {
      cp_atividade: cp_atividade === true || cp_atividade === 'true',
      cp_produto: cp_produto === true || cp_produto === 'true',
      cp_atividade_tipo: cp_atividade_tipo === true || cp_atividade_tipo === 'true'
    };

    // Inserir no banco
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_vinculacao')
      .insert(dadosVinculacao)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao criar vinculação:', error);
      console.error('❌ Detalhes do erro:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar vinculação',
        details: error.message
      });
    }

    console.log('✅ Vinculação criada com sucesso:', data);

    return res.status(201).json({
      success: true,
      data,
      message: 'Vinculação criada com sucesso!'
    });
  } catch (error) {
    console.error('Erro inesperado ao criar vinculação:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// PUT - Atualizar vinculação
async function atualizarVinculacao(req, res) {
  try {
    const { id } = req.params;
    const { cp_atividade, cp_produto, cp_atividade_tipo } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da vinculação é obrigatório'
      });
    }

    // Preparar dados para atualização (valores booleanos, default false)
    const dadosVinculacao = {
      cp_atividade: cp_atividade === true || cp_atividade === 'true',
      cp_produto: cp_produto === true || cp_produto === 'true',
      cp_atividade_tipo: cp_atividade_tipo === true || cp_atividade_tipo === 'true'
    };

    // Verificar se a vinculação existe
    const { data: existingData, error: checkError } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_vinculacao')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (checkError) {
      console.error('Erro ao verificar vinculação:', checkError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar vinculação',
        details: checkError.message
      });
    }

    if (!existingData) {
      return res.status(404).json({
        success: false,
        error: 'Vinculação não encontrada'
      });
    }

    // Atualizar
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_vinculacao')
      .update(dadosVinculacao)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao atualizar vinculação:', error);
      console.error('❌ Detalhes do erro:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar vinculação',
        details: error.message
      });
    }

    console.log('✅ Vinculação atualizada com sucesso:', data);

    return res.json({
      success: true,
      data,
      message: 'Vinculação atualizada com sucesso!'
    });
  } catch (error) {
    console.error('Erro inesperado ao atualizar vinculação:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// DELETE - Deletar vinculação
async function deletarVinculacao(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da vinculação é obrigatório'
      });
    }

    // Verificar se a vinculação existe
    const { data: existingData, error: checkError } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_vinculacao')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (checkError) {
      console.error('Erro ao verificar vinculação:', checkError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar vinculação',
        details: checkError.message
      });
    }

    if (!existingData) {
      return res.status(404).json({
        success: false,
        error: 'Vinculação não encontrada'
      });
    }

    // Deletar
    const { error } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_vinculacao')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ Erro ao deletar vinculação:', error);
      console.error('❌ Detalhes do erro:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar vinculação',
        details: error.message
      });
    }

    console.log('✅ Vinculação deletada com sucesso');

    return res.json({
      success: true,
      message: 'Vinculação deletada com sucesso!'
    });
  } catch (error) {
    console.error('Erro inesperado ao deletar vinculação:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

module.exports = {
  getVinculacoes,
  getVinculacaoPorId,
  criarVinculacao,
  atualizarVinculacao,
  deletarVinculacao,
  TIPO_PARA_TABELA // Exportar para uso no frontend se necessário
};

