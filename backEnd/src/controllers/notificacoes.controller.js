// =============================================================
// === CONTROLLER DE NOTIFICAÇÕES (INBOX) ===
// =============================================================

const supabase = require('../config/database');

/**
 * Lista notificações do usuário logado
 */
async function listarMinhasNotificacoes(req, res) {
    try {
        const usuario_id = req.session.usuario.id;
        const { limit = 50, offset = 0, apenas_nao_lidas = false } = req.query;

        let query = supabase
            
            .from('notificacoes')
            .select('*', { count: 'exact' })
            .eq('usuario_id', usuario_id)
            .order('criado_em', { ascending: false });

        if (apenas_nao_lidas === 'true') {
            query = query.eq('visualizada', false);
        }

        if (limit) {
            query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
        }

        const { data, error, count } = await query;

        if (error) throw error;

        return res.json({
            success: true,
            data: data || [],
            total: count || 0
        });
    } catch (error) {
        console.error('Erro ao listar notificações:', error);
        return res.status(500).json({ success: false, error: 'Erro ao carregar notificações.' });
    }
}

/**
 * Conta notificações não lidas
 */
async function contarNaoLidas(req, res) {
    try {
        const usuario_id = req.session.usuario.id;

        const { count, error } = await supabase
            
            .from('notificacoes')
            .select('*', { count: 'exact', head: true })
            .eq('usuario_id', usuario_id)
            .eq('visualizada', false);

        if (error) throw error;

        return res.json({ success: true, count: count || 0 });
    } catch (error) {
        console.error('Erro ao contar notificações:', error);
        return res.status(500).json({ success: false, error: 'Erro ao contar notificações.' });
    }
}

/**
 * Marca uma notificação como visualizada
 */
async function marcarComoVisualizada(req, res) {
    try {
        const { id } = req.params;
        const usuario_id = req.session.usuario.id;

        const { error } = await supabase
            
            .from('notificacoes')
            .update({ visualizada: true })
            .eq('id', id)
            .eq('usuario_id', usuario_id);

        if (error) throw error;

        return res.json({ success: true, message: 'Notificação marcada como lida.' });
    } catch (error) {
        console.error('Erro ao marcar notificação:', error);
        return res.status(500).json({ success: false, error: 'Erro ao atualizar notificação.' });
    }
}

/**
 * Marca todas as notificações do usuário como visualizadas
 */
async function marcarTodasComoVisualizadas(req, res) {
    try {
        const usuario_id = req.session.usuario.id;

        const { error } = await supabase
            
            .from('notificacoes')
            .update({ visualizada: true })
            .eq('usuario_id', usuario_id)
            .eq('visualizada', false);

        if (error) throw error;

        return res.json({ success: true, message: 'Todas as notificações marcadas como lidas.' });
    } catch (error) {
        console.error('Erro ao marcar todas as notificações:', error);
        return res.status(500).json({ success: false, error: 'Erro ao atualizar notificações.' });
    }
}

/**
 * Distribui notificação para usuários baseados na configuração de permissões
 * Se usuario_id for informado, envia APENAS para aquele usuário (notificação direta)
 * @param {Object} params
 * @param {string} params.tipo - Tipo da notificação (Enum NOTIFICATION_TYPES)
 * @param {string} params.titulo - Título
 * @param {string} params.mensagem - Mensagem
 * @param {string} params.referencia_id - ID do objeto relacionado
 * @param {string} params.link - Link para ação
 * @param {Object} params.metadata - Metadados extras
 * @param {string} params.usuario_id - (Opcional) ID de um usuário alvo específico
 */
async function distribuirNotificacao({ tipo, titulo, mensagem, referencia_id, link, metadata, usuario_id }) {
    try {
        if (!tipo) throw new Error('Tipo de notificação é obrigatório');

        // CASO 1: Notificação Direta (apenas para um usuário)
        if (usuario_id) {
            console.log(`🔔 Enviando notificação direta [${tipo}] para usuário ${usuario_id}`);
            const { error: errInsert } = await supabase
                
                .from('notificacoes')
                .insert({
                    usuario_id,
                    tipo,
                    titulo,
                    mensagem,
                    referencia_id,
                    link,
                    metadata: metadata || {}
                });

            if (errInsert) throw errInsert;
            return;
        }

        // CASO 2: Distribuição por Nível/Permissão
        console.log(`🔔 Distribuindo notificação [${tipo}]: ${titulo}`);

        // 1. Identificar quais NÍVEIS permitem este tipo de notificação
        // Administrador sempre recebe (Hardcoded super user concept)
        const niveisPermitidos = ['administrador'];

        // Buscar configurações customizadas no banco
        const { data: configs } = await supabase
            .from('permissoes_config')
            .select('nivel, notificacoes');

        if (configs) {
            configs.forEach(config => {
                let allowedTypes = [];
                try {
                    allowedTypes = typeof config.notificacoes === 'string'
                        ? JSON.parse(config.notificacoes)
                        : config.notificacoes;
                } catch (e) { allowedTypes = []; }

                if (Array.isArray(allowedTypes) && allowedTypes.includes(tipo)) {
                    if (!niveisPermitidos.includes(config.nivel)) {
                        niveisPermitidos.push(config.nivel);
                    }
                }
            });
        }

        console.log(`   -> Níveis autorizados: ${niveisPermitidos.join(', ')}`);

        // 2. Buscar usuários que possuem esses níveis
        const { data: destinatarios, error: errDest } = await supabase
            
            .from('usuarios')
            .select('id')
            .in('permissoes', niveisPermitidos);

        if (errDest || !destinatarios || destinatarios.length === 0) {
            console.log('   -> Nenhum destinatário encontrado.');
            return;
        }

        console.log(`   -> Enviando para ${destinatarios.length} usuários.`);

        // 3. Preparar Bulk Insert
        const notificacoes = destinatarios.map(u => ({
            usuario_id: u.id,
            tipo,
            titulo,
            mensagem,
            referencia_id,
            link,
            metadata: metadata || {}
        }));

        // 4. Inserir no banco
        const { error: errInsert } = await supabase
            
            .from('notificacoes')
            .insert(notificacoes);

        if (errInsert) {
            console.error('Erro ao inserir notificações em lote:', errInsert);
        } else {
            console.log('   -> Notificações enviadas com sucesso.');
        }

    } catch (error) {
        console.error('Erro inesperado ao distribuir notificações:', error);
    }
}

// Manter alias para retrocompatibilidade se necessário, mas redirecionar para nova lógica
const gerarNotificacaoParaGestores = async (params) => {
    // Força o tipo se não vier (para chamadas legadas)
    const paramsFinais = { ...params, tipo: params.tipo || 'PLUG_RAPIDO' };
    return distribuirNotificacao(paramsFinais);
};

module.exports = {
    listarMinhasNotificacoes,
    contarNaoLidas,
    marcarComoVisualizada,
    marcarTodasComoVisualizadas,
    distribuirNotificacao,
    gerarNotificacaoParaGestores // Deprecado, mantido para evitar quebra imediata
};
