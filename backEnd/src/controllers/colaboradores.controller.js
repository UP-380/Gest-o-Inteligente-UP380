// =============================================================
// === CONTROLLER DE COLABORADORES (MEMBROS) ===
// =============================================================

const apiClientes = require('../services/api-clientes');
const { supabase } = apiClientes;
const supabaseDirect = require('../config/database');
const { resolveAvatarUrl } = require('../utils/storage');
const { sendSuccess, sendError, sendCreated, sendUpdated, sendDeleted, sendValidationError, sendNotFound, sendConflict } = require('../utils/responseHelper');

// GET - Listar todos os colaboradores (com paginação opcional)
async function getColaboradores(req, res) {
  try {
    const { page = 1, limit = 50, search = '', status, ids } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .schema('up_gestaointeligente')
      .from('membro')
      .select('id, nome, usuario_id', { count: 'exact' });

    // Filtro por IDs (quando fornecido como array de query params)
    if (ids) {
      const idsArray = Array.isArray(ids) ? ids : [ids];
      const idsNumericos = idsArray.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
      if (idsNumericos.length > 0) {
        query = query.in('id', idsNumericos);
      }
    }

    // Filtro de status: 'todos' (ou não informado) = todos, 'ativo' = apenas ativos, 'inativo' = apenas inativos
    // IMPORTANTE: Quando status for 'todos' ou não informado, NÃO aplicar nenhum filtro de status
    // Isso permite mostrar TODOS os colaboradores (ativos e inativos)
    if (status && status !== 'todos') {
      if (status === 'inativo') {
        query = query.eq('status', 'inativo');
      } else if (status === 'ativo') {
        query = query.or('status.is.null,status.eq.ativo');
      }
    }
    // Se status for 'todos', undefined, null ou vazio, não aplicar filtro (mostrar TODOS - ativos e inativos)

    query = query.order('nome', { ascending: true });

    // Busca por nome ou CPF (apenas se não houver filtro por IDs)
    if (!ids && search && search.trim()) {
      const searchTerm = search.trim();
      const ilikePattern = `%${searchTerm}%`;

      // Buscar apenas por nome
      query = query.ilike('nome', ilikePattern);
    }

    // Aplicar paginação (apenas se não houver filtro por IDs)
    if (limitNum > 0 && !ids) {
      query = query.range(offset, offset + limitNum - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Erro ao buscar colaboradores:', error);
      return sendError(res, 500, 'Erro ao buscar colaboradores', error.message);
    }


    // Buscar foto_perfil dos usuários vinculados aos membros
    if (data && data.length > 0) {
      const usuarioIds = [...new Set(
        data
          .map(m => m.usuario_id)
          .filter(Boolean)
      )];

      if (usuarioIds.length > 0) {
        // Buscar usuarios por usuario_id
        const { data: usuarios, error: usuariosError } = await supabase
          .schema('up_gestaointeligente')
          .from('usuarios')
          .select('id, foto_perfil')
          .in('id', usuarioIds);

        if (!usuariosError && usuarios && usuarios.length > 0) {
          // Criar mapa para lookup rápido
          const usuarioMap = new Map();
          usuarios.forEach(usuario => {
            usuarioMap.set(String(usuario.id), usuario.foto_perfil);
          });

          // Adicionar foto_perfil a cada colaborador e resolver URLs customizadas
          // Primeiro, preparar lista de avatares customizados para resolver em paralelo
          const avataresParaResolver = [];
          data.forEach((colaborador, index) => {
            if (colaborador.usuario_id) {
              const fotoPerfil = usuarioMap.get(String(colaborador.usuario_id));
              if (fotoPerfil && fotoPerfil.startsWith('custom-')) {
                avataresParaResolver.push({ colaborador, fotoPerfil, index });
              } else if (fotoPerfil) {
                colaborador.foto_perfil = fotoPerfil;
              } else {
                colaborador.foto_perfil = null;
              }
            } else {
              colaborador.foto_perfil = null;
            }
          });

          // Resolver todas as URLs customizadas em paralelo
          if (avataresParaResolver.length > 0) {
            await Promise.all(
              avataresParaResolver.map(async ({ colaborador, fotoPerfil }) => {
                const resolvedUrl = await resolveAvatarUrl(fotoPerfil, 'user');
                colaborador.foto_perfil = resolvedUrl || fotoPerfil;
              })
            );
          }
        } else {
          // Se não encontrar usuarios, definir foto_perfil como null
          data.forEach(colaborador => {
            colaborador.foto_perfil = null;
          });
        }
      } else {
        // Se não houver usuario_ids, definir foto_perfil como null
        data.forEach(colaborador => {
          colaborador.foto_perfil = null;
        });
      }
    }

    return sendSuccess(res, 200, data || [], null, {
      page: pageNum,
      limit: limitNum,
      total: count || 0,
      count: data?.length || 0
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar colaboradores:', error);
    return sendError(res, 500, 'Erro interno do servidor', error.message);
  }
}

// GET - Buscar colaborador por ID
async function getColaboradorPorId(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return sendValidationError(res, 'ID do colaborador é obrigatório');
    }

    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('membro')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar colaborador:', error);
      return sendError(res, 500, 'Erro ao buscar colaborador', error.message);
    }

    if (!data) {
      return sendNotFound(res, 'Colaborador');
    }

    return sendSuccess(res, 200, data);
  } catch (error) {
    console.error('Erro inesperado ao buscar colaborador:', error);
    return sendError(res, 500, 'Erro interno do servidor', error.message);
  }
}

// POST - Criar novo colaborador
async function criarColaborador(req, res) {
  try {
    const { nome, cpf } = req.body;

    // Validações
    if (!nome || !nome.trim()) {
      return sendValidationError(res, 'Nome é obrigatório');
    }

    // Validar CPF se fornecido (formato básico)
    if (cpf && cpf.trim()) {
      const cpfLimpo = cpf.replace(/\D/g, '');
      if (cpfLimpo.length !== 11 && cpfLimpo.length !== 14) {
        return sendValidationError(res, 'CPF/CNPJ deve conter 11 ou 14 dígitos');
      }
    }

    // Verificar se CPF já existe (se fornecido)
    if (cpf && cpf.trim()) {
      const cpfLimpo = cpf.replace(/\D/g, '');
      const { data: existente, error: errorCheck } = await supabase
        .schema('up_gestaointeligente')
        .from('membro')
        .select('id, nome, cpf')
        .eq('cpf', cpfLimpo)
        .maybeSingle();

      if (errorCheck) {
        console.error('Erro ao verificar CPF:', errorCheck);
        return sendError(res, 500, 'Erro ao verificar CPF', errorCheck.message);
      }

      if (existente) {
        return sendConflict(res, 'CPF já cadastrado', null);
      }
    }

    // Preparar dados para inserção
    const dadosInsert = {
      nome: nome.trim(),
      cpf: cpf && cpf.trim() ? cpf.replace(/\D/g, '') : null
    };

    // Inserir no banco
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('membro')
      .insert([dadosInsert])
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar colaborador:', error);
      return sendError(res, 500, 'Erro ao criar colaborador', error.message);
    }

    return sendCreated(res, data, 'Colaborador criado com sucesso');
  } catch (error) {
    console.error('Erro inesperado ao criar colaborador:', error);
    return sendError(res, 500, 'Erro interno do servidor', error.message);
  }
}

// PUT - Atualizar colaborador
async function atualizarColaborador(req, res) {
  try {
    const { id } = req.params;
    const { nome, cpf, status } = req.body;

    if (!id) {
      return sendValidationError(res, 'ID do colaborador é obrigatório');
    }

    // Verificar se colaborador existe
    const { data: existente, error: errorCheck } = await supabase
      .schema('up_gestaointeligente')
      .from('membro')
      .select('id, nome, cpf')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar colaborador:', errorCheck);
      return sendError(res, 500, 'Erro ao verificar colaborador', errorCheck.message);
    }

    if (!existente) {
      return sendNotFound(res, 'Colaborador');
    }

    // Preparar dados para atualização
    const dadosUpdate = {};

    if (nome !== undefined) {
      if (!nome || !nome.trim()) {
        return sendValidationError(res, 'Nome não pode ser vazio');
      }
      dadosUpdate.nome = nome.trim();
    }

    if (cpf !== undefined) {
      if (cpf && cpf.trim()) {
        const cpfLimpo = cpf.replace(/\D/g, '');
        if (cpfLimpo.length !== 11 && cpfLimpo.length !== 14) {
          return sendValidationError(res, 'CPF/CNPJ deve conter 11 ou 14 dígitos');
        }

        // Verificar se CPF já existe em outro colaborador
        const { data: cpfExistente, error: errorCpf } = await supabase
          .schema('up_gestaointeligente')
          .from('membro')
          .select('id, nome')
          .eq('cpf', cpfLimpo)
          .neq('id', id)
          .maybeSingle();

        if (errorCpf) {
          console.error('Erro ao verificar CPF:', errorCpf);
          return sendError(res, 500, 'Erro ao verificar CPF', errorCpf.message);
        }

        if (cpfExistente) {
          return sendConflict(res, 'CPF já cadastrado para outro colaborador', null);
        }

        dadosUpdate.cpf = cpfLimpo;
      } else {
        dadosUpdate.cpf = null;
      }
    }

    if (status !== undefined && status !== null) {
      dadosUpdate.status = status.trim() || null;
      dadosUpdate.updated_at = new Date().toISOString();
    }

    // Se não há nada para atualizar
    if (Object.keys(dadosUpdate).length === 0) {
      return sendValidationError(res, 'Nenhum dado fornecido para atualização');
    }

    // Atualizar no banco
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('membro')
      .update(dadosUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar colaborador:', error);
      return sendError(res, 500, 'Erro ao atualizar colaborador', error.message);
    }

    return sendUpdated(res, data, 'Colaborador atualizado com sucesso');
  } catch (error) {
    console.error('Erro inesperado ao atualizar colaborador:', error);
    return sendError(res, 500, 'Erro interno do servidor', error.message);
  }
}

// DELETE - Deletar colaborador
async function deletarColaborador(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return sendValidationError(res, 'ID do colaborador é obrigatório');
    }

    // Verificar se colaborador existe
    const { data: existente, error: errorCheck } = await supabase
      .schema('up_gestaointeligente')
      .from('membro')
      .select('id, nome')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar colaborador:', errorCheck);
      return sendError(res, 500, 'Erro ao verificar colaborador', errorCheck.message);
    }

    if (!existente) {
      return sendNotFound(res, 'Colaborador');
    }

    // Verificar se há registros relacionados (opcional - pode ser ajustado conforme necessidade)
    // Por exemplo, verificar se há registros de tempo vinculados
    const { data: registrosTempo, error: errorRegistros } = await supabase
      .schema('up_gestaointeligente')
      .from('v_registro_tempo_vinculado')
      .select('id')
      .eq('usuario_id', id)
      .limit(1);

    if (errorRegistros) {
      console.warn('Aviso ao verificar registros relacionados:', errorRegistros);
    }

    if (registrosTempo && registrosTempo.length > 0) {
      return sendConflict(res, 'Não é possível deletar colaborador com registros de tempo vinculados', 'Existem registros de tempo associados a este colaborador. Remova os registros antes de deletar.');
    }

    // Deletar do banco
    const { error } = await supabase
      .schema('up_gestaointeligente')
      .from('membro')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar colaborador:', error);
      return sendError(res, 500, 'Erro ao deletar colaborador', error.message);
    }

    return sendDeleted(res, {
      id: existente.id,
      nome: existente.nome
    }, 'Colaborador deletado com sucesso');
  } catch (error) {
    console.error('Erro inesperado ao deletar colaborador:', error);
    return sendError(res, 500, 'Erro interno do servidor', error.message);
  }
}

// GET - Buscar tipos de contrato
async function getTiposContrato(req, res) {
  try {
    const { data, error } = await supabaseDirect
      .schema('up_gestaointeligente')
      .from('cp_tipo_contrato_membro')
      .select('id, nome')
      .order('nome', { ascending: true });

    if (error) {
      console.error('Erro ao buscar tipos de contrato:', error);
      return sendError(res, 500, 'Erro ao buscar tipos de contrato', error.message);
    }

    return sendSuccess(res, 200, data || [], null, {
      count: data?.length || 0
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar tipos de contrato:', error);
    return sendError(res, 500, 'Erro interno do servidor', error.message);
  }
}

// GET - Listar colaboradores com contagem de equipamentos ativos (para Gestão)
async function getColaboradoresComEquipamentos(req, res) {
  try {
    const defaultSchema = process.env.SUPABASE_DB_SCHEMA || 'up_gestaointeligente';
    const { schema = defaultSchema } = req.query;

    // 1. Buscar todos os colaboradores
    const { data: membros, error: memError } = await supabase
      .schema(schema)
      .from('membro')
      .select('id, nome, status, usuario_id')
      .order('nome', { ascending: true });

    if (memError) {
      throw memError;
    }

    // 2. Buscar fotos de perfil dos usuários vinculados
    const usuarioIds = [...new Set(membros.map(m => m.usuario_id).filter(Boolean))];
    const usuarioMap = new Map();

    if (usuarioIds.length > 0) {
      const { data: usuarios, error: uError } = await supabase
        .schema(schema)
        .from('usuarios')
        .select('id, foto_perfil')
        .in('id', usuarioIds);

      if (!uError && usuarios) {
        usuarios.forEach(u => usuarioMap.set(String(u.id), u.foto_perfil));
      }
    }

    // 2. Buscar contagem de equipamentos ativos para todos
    const { data: atribuicoes, error: atrError } = await supabase
      .from('cp_equipamento_atribuicoes')
      .select('colaborador_id')
      .is('data_devolucao', null);

    if (atrError) throw atrError;

    // 3. Mapear contagens
    const counts = {};
    atribuicoes.forEach(a => {
      counts[a.colaborador_id] = (counts[a.colaborador_id] || 0) + 1;
    });

    const result = await Promise.all(membros.map(async (m) => {
      let fotoPerfil = m.usuario_id ? usuarioMap.get(String(m.usuario_id)) : null;

      // Resolver avatar customizado se necessário
      if (fotoPerfil && fotoPerfil.startsWith('custom-')) {
        const resolvedUrl = await resolveAvatarUrl(fotoPerfil, 'user');
        fotoPerfil = resolvedUrl || fotoPerfil;
      }

      return {
        ...m,
        status: m.status || 'ativo',
        foto_perfil: fotoPerfil,
        qtd_equipamentos: counts[m.id] || 0
      };
    }));

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Erro ao buscar colaboradores com equipamentos:', error);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

// GET - Perfil do colaborador com detalhes de equipamentos
async function getPerfilColaboradorEquipamentos(req, res) {
  try {
    const { id } = req.params;
    const defaultSchema = process.env.SUPABASE_DB_SCHEMA || 'up_gestaointeligente';
    const { schema = defaultSchema } = req.query;

    // 1. Dados do colaborador
    const { data: membro, error: memError } = await supabase
      .schema(schema)
      .from('membro')
      .select('*')
      .eq('id', id)
      .single();

    if (memError) throw memError;

    // 2. Equipamentos vinculados (Atuais)
    const { data: atuais, error: errAtu } = await supabase
      .from('cp_equipamento_atribuicoes')
      .select(`
        *,
        cp_equipamentos (*)
      `)
      .eq('colaborador_id', id)
      .is('data_devolucao', null);

    // 3. Histórico (Devolvidos)
    const { data: historico, error: errHis } = await supabase
      .from('cp_equipamento_atribuicoes')
      .select(`
        *,
        cp_equipamentos (*)
      `)
      .eq('colaborador_id', id)
      .not('data_devolucao', 'is', null)
      .order('data_retirada', { ascending: false });

    return res.json({
      success: true,
      data: {
        membro,
        atuais: atuais || [],
        historico: historico || []
      }
    });
  } catch (error) {
    console.error('Erro ao buscar perfil do operador:', error);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

module.exports = {
  getTiposContrato,
  getColaboradores,
  getColaboradorPorId,
  criarColaborador,
  atualizarColaborador,
  deletarColaborador,
  getColaboradoresComEquipamentos,
  getPerfilColaboradorEquipamentos
};

