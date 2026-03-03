const supabase = require('../config/database');

const SCHEMA = process.env.SUPABASE_DB_SCHEMA || 'up_gestaointeligente';
const SCHEMA_PUBLIC = 'public';

// Usar o client padrão (schema do config) primeiro; fallback para schema explícito e depois public
function table(schema = null) {
    if (schema === null) {
        return supabase.from('checklist_execucao');
    }
    return supabase.schema(schema).from('checklist_execucao');
}

function isRelationNotFound(err) {
    const msg = (err && err.message) ? String(err.message) : '';
    return /relation.*does not exist|schema.*does not exist|permission denied/i.test(msg);
}

// GET /api/checklist/debug - verifica se a tabela está acessível (diagnóstico)
async function debugChecklist(req, res) {
    try {
        const results = { defaultSchema: null, publicSchema: null, configSchema: SCHEMA };
        const { data: d1, error: e1 } = await table(null).select('id').limit(1);
        results.defaultSchema = e1 ? { error: e1.message, code: e1.code } : { ok: true, count: (d1 || []).length };
        if (e1 && isRelationNotFound(e1)) {
            const { data: d2, error: e2 } = await table(SCHEMA_PUBLIC).select('id').limit(1);
            results.publicSchema = e2 ? { error: e2.message } : { ok: true, count: (d2 || []).length };
        }
        return res.json({ success: true, debug: results });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}

// GET - Buscar status do checklist de uma instância de tarefa
async function getChecklistStatus(req, res) {
    try {
        const idInstancia = req.params.idInstancia != null ? String(req.params.idInstancia).trim() : '';

        if (!idInstancia) {
            return res.status(400).json({
                success: false,
                error: 'ID da instância é obrigatório'
            });
        }

        let data, error;
        const res1 = await table(null).select('subtarefa_id').eq('id_instancia_tarefa', idInstancia).eq('concluida', true);
        data = res1.data;
        error = res1.error;
        if (error && isRelationNotFound(error)) {
            const res2 = await table(SCHEMA).select('subtarefa_id').eq('id_instancia_tarefa', idInstancia).eq('concluida', true);
            data = res2.data;
            error = res2.error;
        }
        if (error && isRelationNotFound(error)) {
            const res3 = await table(SCHEMA_PUBLIC).select('subtarefa_id').eq('id_instancia_tarefa', idInstancia).eq('concluida', true);
            data = res3.data;
            error = res3.error;
        }
        if (error) {
            console.error('Erro ao buscar status do checklist:', error);
            return res.status(500).json({
                success: false,
                error: 'Erro ao buscar status do checklist',
                details: error.message
            });
        }

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

// POST - Alternar status de um item do checklist (insert ou update, sem depender de UNIQUE constraint)
async function toggleChecklistItem(req, res) {
    try {
        console.log('[Checklist] Toggle request:', req.body);
        const rawId = req.body.idInstancia;
        const idInstancia = rawId != null && rawId !== '' ? String(rawId).trim() : '';
        const subtarefaId = req.body.subtarefaId;
        const concluida = req.body.concluida;

        if (!idInstancia || subtarefaId == null || subtarefaId === '') {
            return res.status(400).json({
                success: false,
                error: 'ID da instância e ID da subtarefa são obrigatórios'
            });
        }

        const concluidaBool = !!concluida;
        const subtarefaIdNum = parseInt(subtarefaId, 10);
        if (Number.isNaN(subtarefaIdNum)) {
            return res.status(400).json({
                success: false,
                error: 'ID da subtarefa inválido'
            });
        }

        const now = new Date().toISOString();
        const payload = {
            id_instancia_tarefa: idInstancia,
            subtarefa_id: subtarefaIdNum,
            concluida: concluidaBool,
            updated_at: now
        };
        if (concluidaBool) payload.data_conclusao = now;
        if (req.session?.usuario?.id) payload.usuario_conclusao = String(req.session.usuario.id);

        // 1) Buscar registro existente: client padrão (config) → schema explícito → public
        let selectResult = await table(null).select('id').eq('id_instancia_tarefa', idInstancia).eq('subtarefa_id', subtarefaIdNum).maybeSingle();
        let usedTable = () => table(null);
        if (selectResult.error && isRelationNotFound(selectResult.error)) {
            selectResult = await table(SCHEMA).select('id').eq('id_instancia_tarefa', idInstancia).eq('subtarefa_id', subtarefaIdNum).maybeSingle();
            if (!selectResult.error) usedTable = () => table(SCHEMA);
        }
        if (selectResult.error && isRelationNotFound(selectResult.error)) {
            selectResult = await table(SCHEMA_PUBLIC).select('id').eq('id_instancia_tarefa', idInstancia).eq('subtarefa_id', subtarefaIdNum).maybeSingle();
            if (!selectResult.error) usedTable = () => table(SCHEMA_PUBLIC);
        }
        const existing = selectResult.data;
        const selectError = selectResult.error;

        if (selectError) {
            console.error('Erro ao buscar registro do checklist:', selectError);
            return res.status(500).json({
                success: false,
                error: 'Erro ao buscar registro do checklist',
                details: selectError.message
            });
        }

        const tbl = usedTable;

        if (existing && existing.id != null) {
            // RPC com parâmetros na ordem que o schema cache espera: (p_concluida, p_id)
            const { error: rpcError } = await supabase.schema(SCHEMA).rpc('checklist_update_concluida', {
                p_concluida: concluidaBool,
                p_id: existing.id
            });
            if (rpcError) {
                const isFunctionNotFound = /could not find the function|schema cache/i.test(rpcError.message || '');
                if (isFunctionNotFound) {
                    // Fallback: UPDATE direto (requer que a tabela não use upsert no UPDATE)
                    const updateResult = await tbl().update({ concluida: concluidaBool }).eq('id', existing.id);
                    if (updateResult.error) {
                        console.error('Erro ao atualizar item do checklist (fallback):', updateResult.error);
                        return res.status(500).json({
                            success: false,
                            error: 'Erro ao atualizar item do checklist',
                            details: updateResult.error.message
                        });
                    }
                    return res.json({ success: true, data: { id: existing.id, concluida: concluidaBool } });
                }
                console.error('Erro ao atualizar item do checklist (RPC):', rpcError);
                return res.status(500).json({
                    success: false,
                    error: 'Erro ao atualizar item do checklist',
                    details: rpcError.message
                });
            }
            return res.json({ success: true, data: { id: existing.id, concluida: concluidaBool } });
        }

        const insertResult = await tbl().insert(payload).select().maybeSingle();
        if (insertResult.error) {
            console.error('Erro ao inserir item do checklist:', insertResult.error);
            return res.status(500).json({
                success: false,
                error: 'Erro ao inserir item do checklist',
                details: insertResult.error.message
            });
        }
        return res.json({ success: true, data: insertResult.data });
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
    toggleChecklistItem,
    debugChecklist
};
