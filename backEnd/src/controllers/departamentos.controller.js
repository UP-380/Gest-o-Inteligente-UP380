// =============================================================
// === CONTROLLER DE DEPARTAMENTOS ===
// =============================================================

const apiClientes = require('../services/api-clientes');
const { supabase } = apiClientes;
const { sendSuccess, sendError, sendCreated, sendUpdated, sendDeleted, sendValidationError, sendNotFound } = require('../utils/responseHelper');

// === DEPARTAMENTOS ===

// GET - Listar todos os departamentos
async function getDepartamentos(req, res) {
    try {
        const { page = 1, limit = 50, search = '' } = req.query;
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const offset = (pageNum - 1) * limitNum;

        let query = supabase
            .from('departamentos')
            .select(`
        *,
        membros_count:departamento_membros(count)
      `, { count: 'exact' });

        if (search && search.trim()) {
            query = query.ilike('nome', `%${search.trim()}%`);
        }

        query = query.order('nome', { ascending: true });

        if (limitNum > 0) {
            query = query.range(offset, offset + limitNum - 1);
        }

        const { data, error, count } = await query;

        if (error) {
            console.error('Erro ao buscar departamentos:', error);
            return sendError(res, 500, 'Erro ao buscar departamentos', error.message);
        }

        // Format count (supabase returns array of objects with count property)
        const formattedData = data.map(dept => ({
            ...dept,
            colaboradores: dept.membros_count && dept.membros_count[0] ? dept.membros_count[0].count : 0
        }));

        return sendSuccess(res, 200, formattedData, null, {
            page: pageNum,
            limit: limitNum,
            total: count || 0,
            count: formattedData.length
        });
    } catch (error) {
        console.error('Erro inesperado ao buscar departamentos:', error);
        return sendError(res, 500, 'Erro interno do servidor', error.message);
    }
}

// GET - Buscar departamento por ID com detalhes
async function getDepartamentoPorId(req, res) {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('departamentos')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) {
            console.error('Erro ao buscar departamento:', error);
            return sendError(res, 500, 'Erro ao buscar departamento', error.message);
        }

        if (!data) {
            return sendNotFound(res, 'Departamento');
        }

        return sendSuccess(res, 200, data);
    } catch (error) {
        console.error('Erro inesperado ao buscar departamento:', error);
        return sendError(res, 500, 'Erro interno do servidor', error.message);
    }
}

// POST - Criar departamento
async function criarDepartamento(req, res) {
    try {
        const { nome, descricao, head, head_role, icon, color, icon_color, status } = req.body;

        if (!nome) {
            return sendValidationError(res, 'Nome do departamento é obrigatório');
        }

        const novoDept = {
            nome,
            descricao,
            head,
            head_role,
            icon: icon || 'fa-building',
            color: color || '#f1f5f9',
            icon_color: icon_color || '#475569',
            status: status || 'Ativo'
        };

        const { data, error } = await supabase
            .from('departamentos')
            .insert([novoDept])
            .select()
            .single();

        if (error) {
            console.error('Erro ao criar departamento:', error);
            return sendError(res, 500, 'Erro ao criar departamento', error.message);
        }

        return sendCreated(res, data, 'Departamento criado com sucesso');
    } catch (error) {
        console.error('Erro inesperado ao criar departamento:', error);
        return sendError(res, 500, 'Erro interno do servidor', error.message);
    }
}

// PUT - Atualizar departamento
async function atualizarDepartamento(req, res) {
    try {
        const { id } = req.params;
        const { nome, descricao, head, head_role, icon, color, icon_color, status } = req.body;

        const updates = {};
        if (nome !== undefined) updates.nome = nome;
        if (descricao !== undefined) updates.descricao = descricao;
        if (head !== undefined) updates.head = head;
        if (head_role !== undefined) updates.head_role = head_role;
        if (icon !== undefined) updates.icon = icon;
        if (color !== undefined) updates.color = color;
        if (icon_color !== undefined) updates.icon_color = icon_color;
        if (status !== undefined) updates.status = status;
        updates.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('departamentos')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Erro ao atualizar departamento:', error);
            return sendError(res, 500, 'Erro ao atualizar departamento', error.message);
        }

        return sendUpdated(res, data, 'Departamento atualizado com sucesso');
    } catch (error) {
        console.error('Erro inesperado ao atualizar departamento:', error);
        return sendError(res, 500, 'Erro interno do servidor', error.message);
    }
}

// DELETE - Deletar departamento
async function deletarDepartamento(req, res) {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('departamentos')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Erro ao deletar departamento:', error);
            return sendError(res, 500, 'Erro ao deletar departamento', error.message);
        }

        return sendDeleted(res, { id }, 'Departamento deletado com sucesso');
    } catch (error) {
        console.error('Erro inesperado ao deletar departamento:', error);
        return sendError(res, 500, 'Erro interno do servidor', error.message);
    }
}

// === MEMBROS DO DEPARTAMENTO ===

// GET - Listar membros de um departamento
async function getMembrosDepartamento(req, res) {
    try {
        const { id } = req.params; // ID do departamento

        // Buscar associação + dados do membro (join)
        const { data, error } = await supabase
            .from('departamento_membros')
            .select(`
        id,
        departamento_id,
        membro_id,
        cargo,
        status,
        data_entrada,
        email,
        membro:membro_id (
          id,
          nome,
          cpf
        )
      `)
            .eq('departamento_id', id);

        if (error) {
            console.error('Erro ao buscar membros do departamento:', error);
            return sendError(res, 500, 'Erro ao buscar membros', error.message);
        }

        // Formatar resposta para facilitar frontend (flattening)
        const formattedData = data.map(record => ({
            id: record.id, // ID da associação
            membro_id: record.membro_id,
            departamento_id: record.departamento_id,
            name: record.membro?.nome || 'Desconhecido', // Usar nome da tabela membro
            email: record.email, // Email pode estar na associação ou buscar de outro lugar se necessário
            role: record.cargo,
            status: record.status,
            joined: record.data_entrada
        }));

        return sendSuccess(res, 200, formattedData);
    } catch (error) {
        console.error('Erro inesperado ao buscar membros do departamento:', error);
        return sendError(res, 500, 'Erro interno do servidor', error.message);
    }
}

// POST - Adicionar membro ao departamento
async function addMembroDepartamento(req, res) {
    try {
        const { id } = req.params; // ID do departamento
        const { membro_id, cargo, email, status, data_entrada } = req.body;

        if (!membro_id) {
            return sendValidationError(res, 'ID do membro é obrigatório');
        }

        const { data, error } = await supabase
            .from('departamento_membros')
            .insert([{
                departamento_id: id,
                membro_id,
                cargo,
                email,
                status: status || 'Ativo',
                data_entrada
            }])
            .select()
            .single();

        if (error) {
            // Verificar se é duplicata
            if (error.code === '23505') { // Unique violation
                return sendError(res, 409, 'Este membro já está neste departamento');
            }
            console.error('Erro ao adicionar membro:', error);
            return sendError(res, 500, 'Erro ao adicionar membro', error.message);
        }

        return sendCreated(res, data, 'Membro adicionado com sucesso');
    } catch (error) {
        console.error('Erro inesperado ao adicionar membro:', error);
        return sendError(res, 500, 'Erro interno do servidor', error.message);
    }
}

// PUT - Atualizar dados do membro no departamento
async function updateMembroDepartamento(req, res) {
    try {
        const { id, membroId } = req.params; // id=dept, membroId=associação ID ou membro_id? Vamos usar ID da associação para ser preciso

        const { cargo, email, status, data_entrada } = req.body;

        // Vamos tentar atualizar pelo ID da associação primeiro.
        let query = supabase
            .from('departamento_membros')
            .update({
                cargo,
                email,
                status,
                data_entrada,
                updated_at: new Date().toISOString()
            })
            .eq('id', membroId) // Assumindo que membroId é o PK da tabela de associação
            .select();

        const { data, error } = await query;

        if (error) {
            console.error('Erro ao atualizar membro do departamento:', error);
            return sendError(res, 500, 'Erro ao atualizar membro', error.message);
        }

        if (!data || data.length === 0) {
            // Tentar como membro_id dentro do departamento
            const { data: data2, error: error2 } = await supabase
                .schema('up_gestaointeligente_dev')
                .from('departamento_membros')
                .update({
                    cargo,
                    email,
                    status,
                    data_entrada,
                    updated_at: new Date().toISOString()
                })
                .eq('departamento_id', id)
                .eq('membro_id', membroId)
                .select();

            if (error2) {
                return sendError(res, 500, 'Erro ao atualizar membro (pelo ID de membro)', error2.message);
            }

            if (!data2 || data2.length === 0) {
                return sendNotFound(res, 'Membro não encontrado neste departamento');
            }

            return sendUpdated(res, data2[0], 'Membro atualizado com sucesso');
        }

        return sendUpdated(res, data[0], 'Membro atualizado com sucesso');
    } catch (error) {
        console.error('Erro inesperado ao atualizar membro:', error);
        return sendError(res, 500, 'Erro interno do servidor', error.message);
    }
}

// DELETE - Remover membro do departamento
async function removeMembroDepartamento(req, res) {
    try {
        const { id, membroId } = req.params;

        // Tentar deletar por ID da associação
        let { error, count } = await supabase
            .from('departamento_membros')
            .delete({ count: 'exact' })
            .eq('id', membroId);

        if (error) {
            console.error('Erro ao remover membro:', error);
            return sendError(res, 500, 'Erro ao remover membro', error.message);
        }

        if (count === 0) {
            // Tentar como membro_id dentro do departamento
            const { error: error2 } = await supabase
                .schema('up_gestaointeligente_dev')
                .from('departamento_membros')
                .delete()
                .eq('departamento_id', id)
                .eq('membro_id', membroId);

            if (error2) {
                return sendError(res, 500, 'Erro ao remover membro', error2.message);
            }
        }

        return sendDeleted(res, null, 'Membro removido do departamento com sucesso');
    } catch (error) {
        console.error('Erro inesperado ao remover membro:', error);
        return sendError(res, 500, 'Erro interno do servidor', error.message);
    }
}

module.exports = {
    getDepartamentos,
    getDepartamentoPorId,
    criarDepartamento,
    atualizarDepartamento,
    deletarDepartamento,
    getMembrosDepartamento,
    addMembroDepartamento,
    updateMembroDepartamento,
    removeMembroDepartamento
};
