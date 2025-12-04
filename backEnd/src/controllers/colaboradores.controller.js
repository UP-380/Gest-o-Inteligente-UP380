// =============================================================
// === CONTROLLER DE COLABORADORES (MEMBROS) ===
// =============================================================

const apiClientes = require('../services/api-clientes');
const { supabase } = apiClientes;
const supabaseDirect = require('../config/database');

// GET - Listar todos os colaboradores (com paginação opcional)
async function getColaboradores(req, res) {
  try {
    const { page = 1, limit = 50, search = '', status } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .schema('up_gestaointeligente')
      .from('membro')
      .select('id, nome, cpf', { count: 'exact' });
    
    // Se status for 'inativo', filtrar apenas inativos
    // Caso contrário, mostrar apenas ativos (comportamento padrão)
    if (status === 'inativo') {
      query = query.eq('status', 'inativo');
    } else {
      query = query.or('status.is.null,status.eq.ativo');
    }
    
    query = query.order('nome', { ascending: true });

    // Busca por nome ou CPF
    if (search && search.trim()) {
      const searchTerm = search.trim();
      const ilikePattern = `%${searchTerm}%`;
      
      // Remover caracteres não numéricos do termo de busca para CPF
      const cpfSearch = searchTerm.replace(/\D/g, '');
      
      if (cpfSearch.length >= 3) {
        // Se o termo de busca contém números suficientes, buscar por nome OU CPF
        const cpfPattern = `%${cpfSearch}%`;
        query = query.or(`nome.ilike.${ilikePattern},cpf.ilike.${cpfPattern}`);
      } else {
        // Se não tem números suficientes, buscar apenas por nome
        query = query.ilike('nome', ilikePattern);
      }
    }

    // Aplicar paginação
    if (limitNum > 0) {
      query = query.range(offset, offset + limitNum - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('❌ Erro ao buscar colaboradores:', error);
      console.error('❌ Detalhes do erro:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar colaboradores',
        details: error.message
      });
    }

    // Buscar salário base mais recente de cada colaborador
    if (data && data.length > 0) {
      const membroIds = data.map(m => m.id);
      
      // Buscar todas as vigências dos membros com salário base
      const { data: vigencias, error: errorVigencias } = await supabase
        .schema('up_gestaointeligente')
        .from('custo_membro_vigencia')
        .select('membro_id, salariobase, dt_vigencia, id')
        .in('membro_id', membroIds)
        .not('salariobase', 'is', null);

      if (!errorVigencias && vigencias && vigencias.length > 0) {
        // Ordenar vigências por dt_vigencia (mais recente primeiro) e depois por id (desempate)
        vigencias.sort((a, b) => {
          // Comparar por data de vigência (mais recente primeiro)
          const dataA = new Date(a.dt_vigencia);
          const dataB = new Date(b.dt_vigencia);
          if (dataB.getTime() !== dataA.getTime()) {
            return dataB.getTime() - dataA.getTime(); // Descendente
          }
          // Se as datas forem iguais, usar id como critério de desempate (maior id = mais recente)
          return (b.id || 0) - (a.id || 0);
        });

        // Criar um mapa com o salário base mais recente de cada membro
        // Como o array está ordenado por dt_vigencia descendente, a primeira ocorrência
        // de cada membro_id será a mais recente
        const salarioPorMembro = new Map();
        vigencias.forEach(v => {
          // Só adiciona se ainda não tiver um registro para este membro_id
          // Isso garante que pegamos apenas o primeiro (mais recente) de cada membro
          if (!salarioPorMembro.has(v.membro_id)) {
            salarioPorMembro.set(v.membro_id, v.salariobase);
          }
        });

        // Adicionar salário base a cada colaborador
        data.forEach(colaborador => {
          colaborador.salariobase = salarioPorMembro.get(colaborador.id) || null;
        });
      } else {
        // Se não houver vigências ou houver erro, definir salariobase como null para todos
        data.forEach(colaborador => {
          colaborador.salariobase = null;
        });
      }
    }



    return res.json({
      success: true,
      data: data || [],
      count: data?.length || 0,
      total: count || 0,
      page: pageNum,
      limit: limitNum
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar colaboradores:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar colaborador por ID
async function getColaboradorPorId(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do colaborador é obrigatório'
      });
    }

    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('membro')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar colaborador:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar colaborador',
        details: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Colaborador não encontrado'
      });
    }

    return res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar colaborador:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// POST - Criar novo colaborador
async function criarColaborador(req, res) {
  try {
    const { nome, cpf } = req.body;

    // Validações
    if (!nome || !nome.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Nome é obrigatório'
      });
    }

    // Validar CPF se fornecido (formato básico)
    if (cpf && cpf.trim()) {
      const cpfLimpo = cpf.replace(/\D/g, '');
      if (cpfLimpo.length !== 11) {
        return res.status(400).json({
          success: false,
          error: 'CPF deve conter 11 dígitos'
        });
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
        return res.status(500).json({
          success: false,
          error: 'Erro ao verificar CPF',
          details: errorCheck.message
        });
      }

      if (existente) {
        return res.status(409).json({
          success: false,
          error: 'CPF já cadastrado',
          data: {
            id: existente.id,
            nome: existente.nome
          }
        });
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
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar colaborador',
        details: error.message
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Colaborador criado com sucesso',
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao criar colaborador:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// PUT - Atualizar colaborador
async function atualizarColaborador(req, res) {
  try {
    const { id } = req.params;
    const { nome, cpf } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do colaborador é obrigatório'
      });
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
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar colaborador',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Colaborador não encontrado'
      });
    }

    // Preparar dados para atualização
    const dadosUpdate = {};

    if (nome !== undefined) {
      if (!nome || !nome.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Nome não pode ser vazio'
        });
      }
      dadosUpdate.nome = nome.trim();
    }

    if (cpf !== undefined) {
      if (cpf && cpf.trim()) {
        const cpfLimpo = cpf.replace(/\D/g, '');
        if (cpfLimpo.length !== 11 && cpfLimpo.length !== 14) {
          return res.status(400).json({
            success: false,
            error: 'CPF/CNPJ deve conter 11 ou 14 dígitos'
          });
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
          return res.status(500).json({
            success: false,
            error: 'Erro ao verificar CPF',
            details: errorCpf.message
          });
        }

        if (cpfExistente) {
          return res.status(409).json({
            success: false,
            error: 'CPF já cadastrado para outro colaborador',
            data: {
              id: cpfExistente.id,
              nome: cpfExistente.nome
            }
          });
        }

        dadosUpdate.cpf = cpfLimpo;
      } else {
        dadosUpdate.cpf = null;
      }
    }

    // Se não há nada para atualizar
    if (Object.keys(dadosUpdate).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum dado fornecido para atualização'
      });
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
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar colaborador',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Colaborador atualizado com sucesso',
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao atualizar colaborador:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// PUT - Inativar colaborador
async function inativarColaborador(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do colaborador é obrigatório'
      });
    }

    // Verificar se colaborador existe
    const { data: existente, error: errorCheck } = await supabase
      .schema('up_gestaointeligente')
      .from('membro')
      .select('id, nome, status')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar colaborador:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar colaborador',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Colaborador não encontrado'
      });
    }

    // Verificar se já está inativo
    if (existente.status === 'inativo') {
      return res.status(400).json({
        success: false,
        error: 'Colaborador já está inativo'
      });
    }

    // Atualizar status para inativo
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('membro')
      .update({ 
        status: 'inativo',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao inativar colaborador:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao inativar colaborador',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Colaborador inativado com sucesso',
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao inativar colaborador:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// PUT - Ativar colaborador
async function ativarColaborador(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do colaborador é obrigatório'
      });
    }

    // Verificar se colaborador existe
    const { data: existente, error: errorCheck } = await supabase
      .schema('up_gestaointeligente')
      .from('membro')
      .select('id, nome, status')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar colaborador:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar colaborador',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Colaborador não encontrado'
      });
    }

    // Verificar se já está ativo
    if (existente.status === 'ativo' || existente.status === null) {
      return res.status(400).json({
        success: false,
        error: 'Colaborador já está ativo'
      });
    }

    // Atualizar status para ativo
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('membro')
      .update({ 
        status: 'ativo',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao ativar colaborador:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao ativar colaborador',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Colaborador ativado com sucesso',
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao ativar colaborador:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// DELETE - Deletar colaborador
async function deletarColaborador(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do colaborador é obrigatório'
      });
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
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar colaborador',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Colaborador não encontrado'
      });
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
      return res.status(409).json({
        success: false,
        error: 'Não é possível deletar colaborador com registros de tempo vinculados',
        message: 'Existem registros de tempo associados a este colaborador. Remova os registros antes de deletar.'
      });
    }

    // Deletar do banco
    const { error } = await supabase
      .schema('up_gestaointeligente')
      .from('membro')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar colaborador:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar colaborador',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Colaborador deletado com sucesso',
      data: {
        id: existente.id,
        nome: existente.nome
      }
    });
  } catch (error) {
    console.error('Erro inesperado ao deletar colaborador:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
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
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar tipos de contrato',
        details: error.message
      });
    }

    return res.json({
      success: true,
      data: data || [],
      count: data?.length || 0
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar tipos de contrato:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

module.exports = {
  getTiposContrato,
  getColaboradores,
  getColaboradorPorId,
  criarColaborador,
  atualizarColaborador,
  inativarColaborador,
  ativarColaborador,
  deletarColaborador
};

