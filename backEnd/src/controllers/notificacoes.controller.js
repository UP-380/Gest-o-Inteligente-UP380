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
            .schema('up_gestaointeligente')
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
            .schema('up_gestaointeligente')
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
            .schema('up_gestaointeligente')
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
            .schema('up_gestaointeligente')
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
 * FUNÇÃO INTERNA (Exportada para outros controllers)
 * Gera notificações para todos os gestores/admins
 */
async function gerarNotificacaoParaGestores({ tipo, titulo, mensagem, referencia_id, link, metadata }) {
    try {
        // 1. Buscar todos os gestores e administradores
        const { data: gestores, error: errGestores } = await supabase
            .schema('up_gestaointeligente')
            .from('usuarios')
            .select('id')
            .in('permissoes', ['administrador', 'gestor']);

        if (errGestores || !gestores) {
            console.error('Erro ao buscar gestores para notificação:', errGestores);
            return;
        }

        // 2. Preparar Bulk Insert
        const notificacoes = gestores.map(g => ({
            usuario_id: g.id,
            tipo,
            titulo,
            mensagem,
            referencia_id,
            link,
            metadata
        }));

        // 3. Inserir no banco
        const { error: errInsert } = await supabase
            .schema('up_gestaointeligente')
            .from('notificacoes')
            .insert(notificacoes);

        if (errInsert) {
            console.error('Erro ao inserir notificações em lote:', errInsert);
        }
    } catch (error) {
        console.error('Erro inesperado ao gerar notificações:', error);
    }
}

module.exports = {
    listarMinhasNotificacoes,
    contarNaoLidas,
    marcarComoVisualizada,
    marcarTodasComoVisualizadas,
    gerarNotificacaoParaGestores
};
