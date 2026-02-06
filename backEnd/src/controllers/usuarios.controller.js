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
      
      .from('usuarios')
      .select('id, email_usuario, nome_usuario, permissoes, foto_perfil', { count: 'exact' })
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

    // Validar nível de permissão (obrigatório)
    if (permissoes === null || permissoes === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Nível de permissão é obrigatório. Use: administrador, gestor ou colaborador'
      });
    }

    const nivelNormalizado = typeof permissoes === 'string' ? permissoes.toLowerCase().trim() : null;

    if (!nivelNormalizado) {
      return res.status(400).json({
        success: false,
        error: 'Nível de permissão inválido'
      });
    }

    const permissoesNormalizadas = nivelNormalizado;

    // Verificar se o usuário existe
    const { data: usuarioExistente, error: checkError } = await supabase
      
      .from('usuarios')
      .select('id, email_usuario, nome_usuario, foto_perfil')
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
      
      .from('usuarios')
      .update({ permissoes: permissoesNormalizadas })
      .eq('id', id)
      .select('id, email_usuario, nome_usuario, permissoes, foto_perfil')
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

// POST - Criar novo usuário
async function criarUsuario(req, res) {
  try {
    const { email_usuario, nome_usuario, senha_login, permissoes, membro_id } = req.body;

    if (!email_usuario || !nome_usuario || !senha_login) {
      return res.status(400).json({
        success: false,
        error: 'Email, nome e senha são obrigatórios'
      });
    }

    // Validar nível de permissão (obrigatório)
    if (!permissoes || permissoes === null || permissoes === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Nível de permissão é obrigatório. Use: administrador, gestor ou colaborador'
      });
    }

    const nivelNormalizado = typeof permissoes === 'string' ? permissoes.toLowerCase().trim() : null;

    if (!nivelNormalizado) {
      return res.status(400).json({
        success: false,
        error: 'Nível de permissão inválido'
      });
    }

    const permissoesNormalizadas = nivelNormalizado;

    // Verificar se o email já existe
    const { data: usuarioExistente, error: checkError } = await supabase
      
      .from('usuarios')
      .select('id, foto_perfil')
      .eq('email_usuario', email_usuario)
      .maybeSingle();

    if (checkError) {
      console.error('Erro ao verificar email:', checkError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar email',
        details: checkError.message
      });
    }

    if (usuarioExistente) {
      return res.status(400).json({
        success: false,
        error: 'Email já cadastrado'
      });
    }

    // Criar usuário
    const { data: novoUsuario, error: insertError } = await supabase
      
      .from('usuarios')
      .insert({
        email_usuario,
        nome_usuario,
        senha_login,
        permissoes: permissoesNormalizadas
      })
      .select('id, email_usuario, nome_usuario, permissoes, foto_perfil')
      .single();

    if (insertError) {
      console.error('Erro ao criar usuário:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar usuário',
        details: insertError.message
      });
    }

    // Vincular membro se fornecido
    if (membro_id) {
      // Verificar se o membro existe
      const { data: membroExistente, error: checkMembroError } = await supabase
        
        .from('membro')
        .select('id, usuario_id')
        .eq('id', membro_id)
        .maybeSingle();

      if (checkMembroError) {
        console.error('Erro ao verificar membro:', checkMembroError);
      } else if (!membroExistente) {
        console.error(`Membro ${membro_id} não encontrado`);
      } else {
        // Atualizar o membro com o ID do usuário criado
        const { error: updateMembroError } = await supabase
          
          .from('membro')
          .update({ usuario_id: novoUsuario.id })
          .eq('id', membro_id);

        if (updateMembroError) {
          console.error('Erro ao vincular membro:', updateMembroError);
          // Não falhar a criação do usuário se o vínculo falhar
        } else {
          console.log(`✅ Membro ${membro_id} vinculado ao usuário ${novoUsuario.id}`);
        }
      }
    }

    console.log(`✅ Usuário criado: ${novoUsuario.email_usuario}`);

    return res.json({
      success: true,
      message: 'Usuário criado com sucesso',
      data: novoUsuario
    });
  } catch (error) {
    console.error('Erro inesperado ao criar usuário:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// PUT - Atualizar usuário completo
async function atualizarUsuario(req, res) {
  try {
    const { id } = req.params;
    const { email_usuario, nome_usuario, senha_login, permissoes, membro_id } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do usuário é obrigatório'
      });
    }

    // Verificar se o usuário existe
    const { data: usuarioExistente, error: checkError } = await supabase
      
      .from('usuarios')
      .select('id, email_usuario, nome_usuario, foto_perfil')
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

    // Preparar dados para atualização
    const dadosUpdate = {};

    if (email_usuario !== undefined) {
      // Verificar se o novo email já existe (se for diferente do atual)
      if (email_usuario !== usuarioExistente.email_usuario) {
        const { data: emailExistente, error: emailError } = await supabase
          
          .from('usuarios')
          .select('id')
          .eq('email_usuario', email_usuario)
          .maybeSingle();

        if (emailError) {
          return res.status(500).json({
            success: false,
            error: 'Erro ao verificar email',
            details: emailError.message
          });
        }

        if (emailExistente) {
          return res.status(400).json({
            success: false,
            error: 'Email já cadastrado'
          });
        }
      }
      dadosUpdate.email_usuario = email_usuario;
    }

    if (nome_usuario !== undefined) {
      dadosUpdate.nome_usuario = nome_usuario;
    }

    if (senha_login !== undefined && senha_login !== '') {
      dadosUpdate.senha_login = senha_login;
    }

    if (permissoes !== undefined) {
      // Validar nível de permissão (obrigatório)
      const nivelNormalizado = typeof permissoes === 'string' ? permissoes.toLowerCase().trim() : null;

      if (!nivelNormalizado) {
        return res.status(400).json({
          success: false,
          error: 'Nível de permissão inválido'
        });
      }

      dadosUpdate.permissoes = nivelNormalizado;
    }

    // Atualizar usuário
    const { data: usuarioAtualizado, error: updateError } = await supabase
      
      .from('usuarios')
      .update(dadosUpdate)
      .eq('id', id)
      .select('id, email_usuario, nome_usuario, permissoes, foto_perfil')
      .single();

    if (updateError) {
      console.error('Erro ao atualizar usuário:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar usuário',
        details: updateError.message
      });
    }

    // Gerenciar vínculo com membro
    // Sempre processar o vínculo, mesmo se membro_id for undefined (para garantir desvinculação)
    // Primeiro, desvincular qualquer membro que esteja vinculado a este usuário
    const { error: desvincularError } = await supabase
      
      .from('membro')
      .update({ usuario_id: null })
      .eq('usuario_id', id);

    if (desvincularError) {
      console.error('Erro ao desvincular membro:', desvincularError);
    }

    // Se um novo membro_id foi fornecido e não está vazio, vincular
    if (membro_id && membro_id !== '' && membro_id !== null) {
      // Verificar se o membro existe
      const { data: membroExistente, error: checkMembroError } = await supabase
        
        .from('membro')
        .select('id, usuario_id')
        .eq('id', membro_id)
        .maybeSingle();

      if (checkMembroError) {
        console.error('Erro ao verificar membro:', checkMembroError);
      } else if (!membroExistente) {
        console.error(`Membro ${membro_id} não encontrado`);
      } else {
        // Atualizar o membro com o ID do usuário sendo editado
        const { error: vincularError } = await supabase
          
          .from('membro')
          .update({ usuario_id: id })
          .eq('id', membro_id);

        if (vincularError) {
          console.error('Erro ao vincular membro:', vincularError);
        } else {
          console.log(`✅ Membro ${membro_id} vinculado ao usuário ${id}`);
        }
      }
    } else {
      // Se membro_id está vazio, null ou undefined, apenas desvincular (já feito acima)
      console.log(`✅ Membro desvinculado do usuário ${id} (usuario_id definido como null)`);
    }

    console.log(`✅ Usuário atualizado: ${usuarioAtualizado.email_usuario}`);

    return res.json({
      success: true,
      message: 'Usuário atualizado com sucesso',
      data: usuarioAtualizado
    });
  } catch (error) {
    console.error('Erro inesperado ao atualizar usuário:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// DELETE - Deletar usuário
async function deletarUsuario(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do usuário é obrigatório'
      });
    }

    // Verificar se o usuário existe
    const { data: usuarioExistente, error: checkError } = await supabase
      
      .from('usuarios')
      .select('id, email_usuario, nome_usuario, foto_perfil')
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

    // Deletar usuário
    const { error: deleteError } = await supabase
      
      .from('usuarios')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Erro ao deletar usuário:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar usuário',
        details: deleteError.message
      });
    }

    console.log(`✅ Usuário deletado: ${usuarioExistente.email_usuario}`);

    return res.json({
      success: true,
      message: 'Usuário deletado com sucesso'
    });
  } catch (error) {
    console.error('Erro inesperado ao deletar usuário:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar membros vinculados a um usuário
async function getMembrosPorUsuario(req, res) {
  try {
    const { usuarioId } = req.params;

    if (!usuarioId) {
      return res.status(400).json({
        success: false,
        error: 'ID do usuário é obrigatório'
      });
    }

    const { data: membros, error } = await supabase
      
      .from('membro')
      .select('id, nome, cpf, status')
      .eq('usuario_id', usuarioId);

    if (error) {
      console.error('Erro ao buscar membros:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar membros',
        details: error.message
      });
    }

    return res.json({
      success: true,
      data: membros || []
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar membros:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

module.exports = {
  getUsuarios,
  criarUsuario,
  atualizarUsuario,
  atualizarPermissoes,
  deletarUsuario,
  getMembrosPorUsuario
};

