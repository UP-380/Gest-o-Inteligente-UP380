const supabase = require('../config/database');

/**
 * Controller para gerenciar as configurações de status de tarefas
 * Permite CRUD completo das opções de status (chave, nome, icone, cor, etc)
 */

exports.getStatuses = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('tempo_estimado_config_status')
            .select('*')
            .order('criado_em', { ascending: true });

        if (error) throw error;

        return res.json({
            success: true,
            data: data || []
        });
    } catch (error) {
        console.error('❌ [CONFIG-STATUS] Erro ao buscar statuses:', error);
        return res.status(500).json({
            success: false,
            error: 'Erro ao buscar configurações de status',
            message: error.message
        });
    }
};

exports.getStatusById = async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('tempo_estimado_config_status')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        return res.json({
            success: true,
            data
        });
    } catch (error) {
        console.error('❌ [CONFIG-STATUS] Erro ao buscar status por ID:', error);
        return res.status(500).json({
            success: false,
            error: 'Erro ao buscar configuração de status',
            message: error.message
        });
    }
};

exports.criarStatus = async (req, res) => {
    try {
        const { nome, cor_texto, cor_fundo, cor_borda, icone } = req.body;

        if (!nome || !icone) {
            return res.status(400).json({
                success: false,
                error: 'Nome e Ícone são obrigatórios'
            });
        }

        // Gera uma chave amigável (Slug) a partir do nome se não for fornecida
        const chaveGerada = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, '_');

        const { data, error } = await supabase
            .from('tempo_estimado_config_status')
            .insert({
                chave: chaveGerada,
                nome,
                cor_texto,
                cor_fundo,
                cor_borda,
                icone
            })
            .select()
            .single();

        if (error) {
            console.error('❌ [CONFIG-STATUS] Erro Supabase ao criar:', error);
            return res.status(400).json({
                success: false,
                error: 'Erro no banco de dados',
                message: error.message,
                details: error.details
            });
        }

        return res.status(201).json({
            success: true,
            data
        });
    } catch (error) {
        console.error('❌ [CONFIG-STATUS] Erro interno ao criar status:', error);
        return res.status(500).json({
            success: false,
            error: 'Erro interno ao criar configuração de status',
            message: error.message
        });
    }
};

exports.atualizarStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, cor_texto, cor_fundo, cor_borda, icone } = req.body;

        const updateData = {
            nome,
            cor_texto,
            cor_fundo,
            cor_borda,
            icone,
            atualizado_em: new Date().toISOString()
        };


        const { data, error } = await supabase
            .from('tempo_estimado_config_status')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('❌ [CONFIG-STATUS] Erro Supabase ao atualizar:', error);
            return res.status(400).json({
                success: false,
                error: 'Erro ao atualizar no banco de dados',
                message: error.message
            });
        }

        return res.json({
            success: true,
            data
        });
    } catch (error) {
        console.error('❌ [CONFIG-STATUS] Erro interno ao atualizar status:', error);
        return res.status(500).json({
            success: false,
            error: 'Erro interno ao atualizar configuração de status',
            message: error.message
        });
    }
};

exports.deletarStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('tempo_estimado_config_status')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return res.json({
            success: true,
            message: 'Configuração de status removida com sucesso'
        });
    } catch (error) {
        console.error('❌ [CONFIG-STATUS] Erro ao deletar status:', error);
        return res.status(500).json({
            success: false,
            error: 'Erro ao remover configuração de status',
            message: error.message
        });
    }
};
