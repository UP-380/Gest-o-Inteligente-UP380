// =============================================================
// === CONTROLLER DE NOTIFICAÇÕES (INBOX) ===
// =============================================================

const supabase = require('../config/database');

// Conexões SSE por usuário (userId -> Set de res) para push em tempo real
const sseConnections = new Map();

/**
 * Envia evento para um usuário via SSE (push em tempo real)
 * @param {string|number} userId - ID do usuário
 * @param {object} payload - Objeto a enviar (ex: { type: 'notification' })
 */
function notificarClienteSSE(userId, payload) {
    const uid = String(userId);
    const connections = sseConnections.get(uid);
    if (!connections || connections.size === 0) return;
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const line = `data: ${data}\n\n`;
    connections.forEach((res) => {
        try {
            res.write(line);
            if (typeof res.flush === 'function') res.flush();
        } catch (err) {
            connections.delete(res);
        }
    });
}

/**
 * Stream SSE: mantém conexão aberta e envia eventos quando há nova notificação
 */
async function getNotificacoesStream(req, res) {
    const rawId = req.session?.usuario?.id;
    if (rawId == null || rawId === '') {
        return res.status(401).json({ success: false, error: 'Não autorizado.' });
    }

    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const usuario_id = Number(rawId) || rawId;
    const uid = String(usuario_id);
    if (!sseConnections.has(uid)) {
        sseConnections.set(uid, new Set());
    }
    sseConnections.get(uid).add(res);

    const keepAlive = setInterval(() => {
        try {
            res.write(': keepalive\n\n');
        } catch (_) {
            clearInterval(keepAlive);
        }
    }, 25000);

    req.on('close', () => {
        clearInterval(keepAlive);
        const set = sseConnections.get(uid);
        if (set) {
            set.delete(res);
            if (set.size === 0) sseConnections.delete(uid);
        }
    });

    try {
        res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
        if (typeof res.flush === 'function') res.flush();
    } catch (_) {}
}

/**
 * Lista notificações do usuário logado
 */
async function listarMinhasNotificacoes(req, res) {
    try {
        const rawId = req.session.usuario.id;
        const usuario_id = Number(rawId) || rawId;
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
 * Conta notificações não lidas.
 * Sempre responde 200 com count (0 quando sem sessão ou em caso de falha), para o sininho não quebrar.
 */
async function contarNaoLidas(req, res) {
    try {
        const rawId = req.session?.usuario?.id;
        if (rawId == null || rawId === '') {
            return res.status(200).json({ success: true, count: 0 });
        }
        const usuario_id = Number(rawId) || rawId;

        const { count, error } = await supabase

            .from('notificacoes')
            .select('*', { count: 'exact', head: true })
            .eq('usuario_id', usuario_id)
            .eq('visualizada', false);

        if (error) throw error;

        return res.status(200).json({ success: true, count: count ?? 0 });
    } catch (error) {
        console.warn('Contagem de notificações (fallback 0):', error?.message || error);
        return res.status(200).json({ success: true, count: 0 });
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
 * Marca uma notificação como não visualizada
 */
async function marcarComoNaoVisualizada(req, res) {
    try {
        const { id } = req.params;
        const usuario_id = req.session.usuario.id;

        const { error } = await supabase
            .from('notificacoes')
            .update({ visualizada: false })
            .eq('id', id)
            .eq('usuario_id', usuario_id);

        if (error) throw error;

        return res.json({ success: true, message: 'Notificação marcada como não lida.' });
    } catch (error) {
        console.error('Erro ao desmarcar notificação:', error);
        return res.status(500).json({ success: false, error: 'Erro ao desmarcar notificação.' });
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
 * ÚNICO PONTO DE CRIAÇÃO DE NOTIFICAÇÕES.
 * Todos os tipos passam por aqui e usam a mesma lógica:
 * - insert com visualizada: false, titulo/mensagem/link/referencia_id/metadata seguros
 * - após insert: notificarClienteSSE(usuario_id) para cada destinatário (sino + SSE)
 *
 * Tipos tratados: CHAT_MENSAGEM, COMUNICADO_NOVO, CHAMADO_NOVO, CHAMADO_ATUALIZADO, PLUG_RAPIDO
 *
 * @param {Object} params
 * @param {string} params.tipo - Tipo da notificação (Enum NOTIFICATION_TYPES)
 * @param {string} params.titulo - Título
 * @param {string} params.mensagem - Mensagem
 * @param {string} params.referencia_id - ID do objeto relacionado
 * @param {string} params.link - Link para ação
 * @param {Object} params.metadata - Metadados extras
 * @param {string|number} params.usuario_id - (Opcional) ID de um usuário alvo → notificação direta (CASO 1). Sem isso → distribuição por nível (CASO 2)
 */
async function distribuirNotificacao({ tipo, titulo, mensagem, referencia_id, link, metadata, usuario_id }) {
    try {
        if (!tipo) throw new Error('Tipo de notificação é obrigatório');

        // CASO 1: Notificação Direta (apenas para um usuário) — ex.: chat, resposta de chamado
        // Sempre envia: quem recebeu a mensagem/chamado deve receber a notificação
        if (usuario_id != null && usuario_id !== '') {
            const uid = parseInt(usuario_id, 10) || String(usuario_id);
            console.log(`🔔 Enviando notificação direta [${tipo}] para usuário ${uid}`);
            const row = {
                usuario_id: uid,
                tipo,
                titulo: titulo || '',
                mensagem: mensagem || '',
                referencia_id: referencia_id ?? null,
                link: link ?? null,
                metadata: metadata && typeof metadata === 'object' ? metadata : {},
                visualizada: false
            };
            const { data: inserted, error: errInsert } = await supabase

                .from('notificacoes')
                .insert(row)
                .select('id')
                .maybeSingle();

            if (errInsert) {
                console.error('Erro ao inserir notificação:', errInsert.message || errInsert, row);
                throw errInsert;
            }
            console.log('🔔 Notificação criada id=', inserted?.id, 'usuario_id=', uid);
            notificarClienteSSE(uid, { type: 'notification' });
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

        // 3. Preparar Bulk Insert (mesma estrutura do chat: visualizada, campos seguros)
        const notificacoes = destinatarios.map(u => ({
            usuario_id: Number(u.id) || u.id,
            tipo,
            titulo: titulo || '',
            mensagem: mensagem || '',
            referencia_id: referencia_id ?? null,
            link: link ?? null,
            metadata: metadata && typeof metadata === 'object' ? metadata : {},
            visualizada: false
        }));

        // 4. Inserir no banco
        const { error: errInsert } = await supabase

            .from('notificacoes')
            .insert(notificacoes);

        if (errInsert) {
            console.error('Erro ao inserir notificações em lote:', errInsert.message || errInsert);
        } else {
            console.log('   -> Notificações enviadas com sucesso:', destinatarios.length);
            destinatarios.forEach((u) => notificarClienteSSE(u.id, { type: 'notification' }));
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
    getNotificacoesStream,
    marcarComoVisualizada,
    marcarComoNaoVisualizada,
    marcarTodasComoVisualizadas,
    distribuirNotificacao,
    gerarNotificacaoParaGestores,
    notificarClienteSSE
};
