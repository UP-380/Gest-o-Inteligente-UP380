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

// POST - Atribuir equipamento a um colaborador
async function atribuirEquipamento(req, res) {
    try {
        const { equipamento_id, colaborador_id, observacoes } = req.body;
        const admin_id = req.session?.usuario?.id; // Usando o id da sessão

        if (!equipamento_id || !colaborador_id) {
            return res.status(400).json({
                success: false,
                error: 'Equipamento e Colaborador são obrigatórios'
            });
        }

        // 1. Verificar se o equipamento está disponível
        const { data: equip, error: equipError } = await supabase
            .from('cp_equipamentos')
            .select('status')
            .eq('id', equipamento_id)
            .single();

        if (equipError || !equip) {
            return res.status(404).json({ success: false, error: 'Equipamento não encontrado' });
        }

        if (equip.status === 'manutencao') {
            return res.status(400).json({
                success: false,
                error: 'Este equipamento está em manutenção e não pode ser atribuído no momento.'
            });
        }

        if (equip.status === 'em uso') {
            return res.status(400).json({
                success: false,
                error: 'Este equipamento já está em uso.'
            });
        }

        // 2. Criar atribuição
        const { data: atribuicao, error: atrError } = await supabase
            .from('cp_equipamento_atribuicoes')
            .insert([{
                equipamento_id,
                colaborador_id,
                observacoes,
                criado_por: admin_id || null
            }])
            .select()
            .single();

        if (atrError) {
            console.error('Erro ao criar atribuição:', atrError);
            return res.status(500).json({
                success: false,
                error: `Erro ao atribuir equipamento: ${atrError.message || 'Erro desconhecido'}`
            });
        }

        // 3. Atualizar status do equipamento
        await supabase
            .from('cp_equipamentos')
            .update({ status: 'em uso' })
            .eq('id', equipamento_id);

        // 4. Registrar ocorrência de entrega automaticamente
        await supabase
            .from('cp_equipamento_ocorrencias')
            .insert([{
                equipamento_id,
                colaborador_id,
                tipo: 'ENTREGA',
                descricao: `Equipamento atribuído. Obs: ${observacoes || 'Nenhuma'}`
            }]);

        return res.status(201).json({
            success: true,
            message: 'Equipamento atribuído com sucesso',
            data: atribuicao
        });
    } catch (error) {
        console.error('Erro inesperado ao atribuir equipamento:', error);
        return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
}

// POST - Devolver equipamento (Check-in)
async function devolverEquipamento(req, res) {
    try {
        const { equipamento_id, descricao_estado, fotos } = req.body;

        if (!equipamento_id) {
            return res.status(400).json({ success: false, error: 'ID do equipamento é obrigatório' });
        }

        // 1. Finalizar atribuição ativa
        const { data: atrAtiva, error: atrError } = await supabase
            .from('cp_equipamento_atribuicoes')
            .update({ data_devolucao: new Date().toISOString() })
            .eq('equipamento_id', equipamento_id)
            .is('data_devolucao', null)
            .select()
            .maybeSingle();

        // 2. Atualizar status do equipamento para 'ativo' (estoque)
        await supabase
            .from('cp_equipamentos')
            .update({ status: 'ativo' })
            .eq('id', equipamento_id);

        // 3. Registrar ocorrência de devolução com estado
        await supabase
            .from('cp_equipamento_ocorrencias')
            .insert([{
                equipamento_id,
                colaborador_id: atrAtiva?.colaborador_id,
                tipo: 'DEVOLUCAO',
                descricao: descricao_estado || 'Equipamento devolvido ao estoque.',
                fotos: fotos || []
            }]);

        return res.json({
            success: true,
            message: 'Equipamento devolvido com sucesso'
        });
    } catch (error) {
        console.error('Erro inesperado ao devolver equipamento:', error);
        return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
}

// POST - Registrar nova ocorrência (Danos, Observação, etc)
async function registrarOcorrencia(req, res) {
    try {
        const { equipamento_id, tipo, descricao, fotos, colaborador_id } = req.body;

        if (!equipamento_id || !tipo) {
            return res.status(400).json({ success: false, error: 'Dados obrigatórios ausentes' });
        }

        const { data, error } = await supabase
            .from('cp_equipamento_ocorrencias')
            .insert([{
                equipamento_id,
                tipo,
                descricao,
                fotos: fotos || [],
                colaborador_id
            }])
            .select()
            .single();

        if (error) {
            console.error('Erro ao registrar ocorrência:', error);
            return res.status(500).json({ success: false, error: 'Erro ao registrar ocorrência' });
        }

        // Se o tipo for 'DANOS' ou 'MANUTENCAO', talvez queira mudar o status do equipamento
        if (tipo === 'MANUTENCAO') {
            await supabase
                .from('cp_equipamentos')
                .update({ status: 'manutencao' })
                .eq('id', equipamento_id);
        }

        return res.status(201).json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Erro inesperado ao registrar ocorrência:', error);
        return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
}

// GET - Buscar histórico (Atribuições e Ocorrências)
async function getHistoricoEquipamento(req, res) {
    try {
        const { id } = req.params;

        // Buscar atribuições
        const { data: atribuicoes, error: errAtr } = await supabase
            .from('cp_equipamento_atribuicoes')
            .select('*')
            .eq('equipamento_id', id)
            .order('data_retirada', { ascending: false });

        // Buscar ocorrências
        const { data: ocorrencias, error: errOco } = await supabase
            .from('cp_equipamento_ocorrencias')
            .select('*')
            .eq('equipamento_id', id)
            .order('data_ocorrencia', { ascending: false });

        return res.json({
            success: true,
            data: {
                atribuicoes: atribuicoes || [],
                ocorrencias: ocorrencias || []
            }
        });
    } catch (error) {
        console.error('Erro ao buscar histórico:', error);
        return res.status(500).json({ success: false, error: 'Erro interno' });
    }
}

// GET - Estatísticas para o Dashboard
async function getDashboardStats(req, res) {
    try {
        // Totais por status
        const { data: statusCounts, error: errorStatus } = await supabase
            .from('cp_equipamentos')
            .select('status');

        if (errorStatus) throw errorStatus;

        const stats = {
            total: statusCounts.length,
            em_uso: statusCounts.filter(e => e.status === 'em uso').length,
            manutencao: statusCounts.filter(e => e.status === 'manutencao').length,
            estoque: statusCounts.filter(e => e.status === 'ativo' || !e.status).length
        };

        // Atividades recentes (últimas 5 ocorrências)
        const { data: recentes, error: errorRec } = await supabase
            .from('cp_equipamento_ocorrencias')
            .select(`
                *,
                cp_equipamentos (nome, tipo)
            `)
            .order('data_ocorrencia', { ascending: false })
            .limit(20);

        if (errorRec) throw errorRec;

        // Buscar nomes dos colaboradores para as atividades recentes
        let atividadesComNomes = recentes || [];
        const colabIds = [...new Set(recentes?.map(r => r.colaborador_id).filter(Boolean))];

        if (colabIds.length > 0) {
            const { data: membros, error: mErr } = await supabase
                .schema('up_gestaointeligente_dev')
                .from('membro')
                .select('id, nome')
                .in('id', colabIds);

            if (!mErr && membros) {
                const membrosMap = Object.fromEntries(membros.map(m => [m.id, m.nome]));
                atividadesComNomes = recentes.map(r => ({
                    ...r,
                    colaborador_nome: membrosMap[r.colaborador_id] || 'N/A'
                }));
            }
        }

        return res.json({
            success: true,
            data: {
                stats,
                atividades: atividadesComNomes
            }
        });
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        return res.status(500).json({ success: false, error: 'Erro interno' });
    }
}

module.exports = {
    getEquipamentos,
    getEquipamentoPorId,
    criarEquipamento,
    atualizarEquipamento,
    deletarEquipamento,
    atribuirEquipamento,
    devolverEquipamento,
    registrarOcorrencia,
    getHistoricoEquipamento,
    getDashboardStats
};
