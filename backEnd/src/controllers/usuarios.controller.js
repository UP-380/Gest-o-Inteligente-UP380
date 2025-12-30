// =============================================================
// === CONTROLLER DE USUÁRIOS ===
// =============================================================

const supabase = require('../config/database');

// GET - Listar todos os usuários
async function getUsuarios(req, res) {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .schema('up_gestaointeligente')
      .from('usuarios')
      .select('id, email_usuario, nome_usuario, permissoes', { count: 'exact' })
      .order('nome_usuario', { ascending: true });

    // Busca por nome ou email
    if (search && search.trim()) {
      const searchTerm = search.trim();
      const ilikePattern = `%${searchTerm}%`;
      query = query.or(`nome_usuario.ilike.${ilikePattern},email_usuario.ilike.${ilikePattern}`);
    }

    // Aplicar paginação
    if (limitNum > 0) {
      query = query.range(offset, offset + limitNum - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Erro ao buscar usuários:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar usuários',
        details: error.message
      });
    }

    console.log(`✅ Usuários encontrados: ${data?.length || 0} de ${count || 0} total`);

    return res.json({
      success: true,
      data: data || [],
      count: data?.length || 0,
      total: count || 0,
      page: pageNum,
      limit: limitNum
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar usuários:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// PUT - Atualizar permissões de um usuário
async function atualizarPermissoes(req, res) {
  try {
    const { id } = req.params;
    const { permissoes } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do usuário é obrigatório'
      });
    }

    // Validar nível de permissão
    const niveisValidos = ['administrador', 'gestor', 'colaborador', null];
    let permissoesNormalizadas = permissoes;

    if (permissoes !== null && permissoes !== undefined) {
      if (typeof permissoes === 'string') {
        const normalized = permissoes.toLowerCase().trim();
        if (!niveisValidos.includes(normalized)) {
          return res.status(400).json({
            success: false,
            error: 'Nível de permissão inválido. Use: administrador, gestor ou colaborador'
          });
        }
        permissoesNormalizadas = normalized;
      } else {
        return res.status(400).json({
          success: false,
          error: 'Permissões devem ser uma string ou null'
        });
      }
    }

    // Verificar se o usuário existe
    const { data: usuarioExistente, error: checkError } = await supabase
      .schema('up_gestaointeligente')
      .from('usuarios')
      .select('id, email_usuario, nome_usuario')
      .eq('id', id)
      .maybeSingle();

    if (checkError) {
      console.error('Erro ao verificar usuário:', checkError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar usuário',
        details: checkError.message
      });
    }

    if (!usuarioExistente) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    // Atualizar permissões
    const { data: usuarioAtualizado, error: updateError } = await supabase
      .schema('up_gestaointeligente')
      .from('usuarios')
      .update({ permissoes: permissoesNormalizadas })
      .eq('id', id)
      .select('id, email_usuario, nome_usuario, permissoes')
      .single();

    if (updateError) {
      console.error('Erro ao atualizar permissões:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar permissões',
        details: updateError.message
      });
    }

    console.log(`✅ Permissões atualizadas para usuário: ${usuarioAtualizado.email_usuario}`);

    return res.json({
      success: true,
      message: 'Permissões atualizadas com sucesso',
      data: usuarioAtualizado
    });
  } catch (error) {
    console.error('Erro inesperado ao atualizar permissões:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

module.exports = {
  getUsuarios,
  atualizarPermissoes
};

