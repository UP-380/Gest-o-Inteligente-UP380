// =============================================================
// === CONTROLLER DE EQUIPAMENTOS ===
// =============================================================

const supabase = require('../config/database');

// GET - Listar equipamentos com paginação e busca
async function getEquipamentos(req, res) {
    try {
        const { page = 1, limit = 5, search = '' } = req.query;
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const offset = (pageNum - 1) * limitNum;

        let query = supabase
            .from('cp_equipamentos')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false });

        // Aplicar busca (case insensitive)
        if (search) {
            // Busca em nome, marca ou modelo
            query = query.or(`nome.ilike.%${search}%,marca.ilike.%${search}%,modelo.ilike.%${search}%`);
        }

        // Aplicar paginação
        if (limitNum > 0) {
            query = query.range(offset, offset + limitNum - 1);
        }

        const { data, error, count } = await query;

        if (error) {
            console.error('❌ Erro ao buscar equipamentos:', error);
            return res.status(500).json({
                success: false,
                error: 'Erro ao buscar equipamentos',
                details: error.message
            });
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
        console.error('Erro inesperado ao buscar equipamentos:', error);
        return res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            details: error.message
        });
    }
}

// GET - Buscar equipamento por ID
async function getEquipamentoPorId(req, res) {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'ID do equipamento é obrigatório'
            });
        }

        const { data, error } = await supabase
            .from('cp_equipamentos')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) {
            console.error('Erro ao buscar equipamento:', error);
            return res.status(500).json({
                success: false,
                error: 'Erro ao buscar equipamento',
                details: error.message
            });
        }

        if (!data) {
            return res.status(404).json({
                success: false,
                error: 'Equipamento não encontrado'
            });
        }

        return res.json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error('Erro inesperado ao buscar equipamento:', error);
        return res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            details: error.message
        });
    }
}

// POST - Criar novo equipamento
async function criarEquipamento(req, res) {
    try {
        const {
            nome,
            tipo,
            marca,
            modelo,
            numero_serie,
            data_aquisicao,
            foto,
            status
        } = req.body;

        // Validação básica
        if (!nome || !tipo) {
            return res.status(400).json({
                success: false,
                error: 'Nome e Tipo são obrigatórios'
            });
        }

        // Função auxiliar para limpar valores
        const cleanValue = (value) => {
            if (value === undefined || value === null || value === '') {
                return null;
            }
            const trimmed = String(value).trim();
            return trimmed === '' ? null : trimmed;
        };

        const dadosInsert = {
            nome: cleanValue(nome),
            tipo: cleanValue(tipo),
            marca: cleanValue(marca),
            modelo: cleanValue(modelo),
            numero_serie: cleanValue(numero_serie),
            data_aquisicao: cleanValue(data_aquisicao),
            foto: cleanValue(foto),
            status: cleanValue(status) || 'ativo'
        };

        const { data, error } = await supabase
            .from('cp_equipamentos')
            .insert([dadosInsert])
            .select()
            .single();

        if (error) {
            console.error('Erro ao criar equipamento:', error);
            return res.status(500).json({
                success: false,
                error: 'Erro ao criar equipamento',
                details: error.message
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Equipamento criado com sucesso',
            data: data
        });
    } catch (error) {
        console.error('Erro inesperado ao criar equipamento:', error);
        return res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            details: error.message
        });
    }
}

// PUT - Atualizar equipamento
async function atualizarEquipamento(req, res) {
    try {
        const { id } = req.params;
        const {
            nome,
            tipo,
            marca,
            modelo,
            numero_serie,
            data_aquisicao,
            foto,
            status
        } = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'ID do equipamento é obrigatório'
            });
        }

        // Função auxiliar para limpar valores
        const cleanValue = (value) => {
            if (value === undefined || value === null || value === '') {
                return null;
            }
            const trimmed = String(value).trim();
            return trimmed === '' ? null : trimmed;
        };

        const dadosUpdate = {};
        if (nome !== undefined) dadosUpdate.nome = cleanValue(nome);
        if (tipo !== undefined) dadosUpdate.tipo = cleanValue(tipo);
        if (marca !== undefined) dadosUpdate.marca = cleanValue(marca);
        if (modelo !== undefined) dadosUpdate.modelo = cleanValue(modelo);
        if (numero_serie !== undefined) dadosUpdate.numero_serie = cleanValue(numero_serie);
        if (data_aquisicao !== undefined) dadosUpdate.data_aquisicao = cleanValue(data_aquisicao);
        if (foto !== undefined) dadosUpdate.foto = cleanValue(foto);
        if (status !== undefined) dadosUpdate.status = cleanValue(status);

        if (Object.keys(dadosUpdate).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Nenhum dado fornecido para atualização'
            });
        }

        const { data, error } = await supabase
            .from('cp_equipamentos')
            .update(dadosUpdate)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Erro ao atualizar equipamento:', error);
            return res.status(500).json({
                success: false,
                error: 'Erro ao atualizar equipamento',
                details: error.message
            });
        }

        return res.json({
            success: true,
            message: 'Equipamento atualizado com sucesso',
            data: data
        });
    } catch (error) {
        console.error('Erro inesperado ao atualizar equipamento:', error);
        return res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            details: error.message
        });
    }
}

// DELETE - Remover equipamento
async function deletarEquipamento(req, res) {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'ID do equipamento é obrigatório'
            });
        }

        const { error } = await supabase
            .from('cp_equipamentos')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Erro ao deletar equipamento:', error);
            return res.status(500).json({
                success: false,
                error: 'Erro ao deletar equipamento',
                details: error.message
            });
        }

        return res.json({
            success: true,
            message: 'Equipamento removido com sucesso'
        });
    } catch (error) {
        console.error('Erro inesperado ao deletar equipamento:', error);
        return res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            details: error.message
        });
    }
}

module.exports = {
    getEquipamentos,
    getEquipamentoPorId,
    criarEquipamento,
    atualizarEquipamento,
    deletarEquipamento
};
