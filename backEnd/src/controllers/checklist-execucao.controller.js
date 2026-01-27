const supabase = require('../config/database');

// GET - Buscar status do checklist de uma instância de tarefa
async function getChecklistStatus(req, res) {
    try {
        const { idInstancia } = req.params;

        if (!idInstancia) {
            return res.status(400).json({
                success: false,
                error: 'ID da instância é obrigatório'
            });
        }

        // Buscar apenas as subtarefas concluídas para esta instância
        const { data, error } = await supabase
            
            .from('checklist_execucao')
            .select('subtarefa_id')
            .eq('id_instancia_tarefa', idInstancia)
            .eq('concluida', true);

        if (error) {
            console.error('Erro ao buscar status do checklist:', error);
            return res.status(500).json({
                success: false,
                error: 'Erro ao buscar status do checklist'
            });
        }

        // Retornar lista de IDs concluídos
        const concluidas = (data || []).map(item => item.subtarefa_id);

        return res.json({
            success: true,
            concluidas
        });
    } catch (error) {
        console.error('Erro inesperado ao buscar checklist:', error);
        return res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
}

// POST - Alternar status de um item do checklist
async function toggleChecklistItem(req, res) {
    try {
        console.log('[Checklist] Toggle request:', req.body);
        const { idInstancia, subtarefaId, concluida } = req.body;

        if (!idInstancia || !subtarefaId) {
            return res.status(400).json({
                success: false,
                error: 'ID da instância e ID da subtarefa são obrigatórios'
            });
        }

        const concluidaBool = !!concluida; // Garantir boolean

        console.log('👤 [Checklist] Usuário na sessão:', req.session?.usuario);
        if (req.session?.usuario) {
            console.log('🆔 [Checklist] ID do Usuário:', req.session.usuario.id);
        } else {
            console.warn('⚠️ [Checklist] Usuário NÃO logado ou sessão expirada!');
        }

        // Usar upsert para criar ou atualizar o registro
        const { data, error } = await supabase
            
            .from('checklist_execucao')
            .upsert({
                id_instancia_tarefa: idInstancia,
                subtarefa_id: parseInt(subtarefaId, 10),
                concluida: concluidaBool,
                updated_at: new Date().toISOString(),
                // Se for novo, created_at será automático pelo default do banco
                // Se for update, data_conclusao pode ser atualizada
                data_conclusao: concluidaBool ? new Date().toISOString() : null,

                // ATENÇÃO: Se a coluna no banco for UUID e o ID do usuário for número, isso pode falhar.
                // A coluna deve ser alterada para TEXT se os IDs de usuário não forem UUIDs.
                usuario_conclusao: req.session?.usuario?.id ? String(req.session.usuario.id) : null
            }, {
                onConflict: 'id_instancia_tarefa, subtarefa_id'
            })
            .select()
            .single();

        if (error) {
            console.error('Erro ao atualizar item do checklist:', error);
            return res.status(500).json({
                success: false,
                error: 'Erro ao atualizar item do checklist',
                details: error.message
            });
        }

        return res.json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Erro inesperado ao atualizar checklist:', error);
        console.error('Stack:', error.stack);
        console.error('Body:', req.body);
        console.error('Session user:', req.session ? req.session.usuario : 'No session');
        return res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: error.message
        });
    }
}

module.exports = {
    getChecklistStatus,
    toggleChecklistItem
};
