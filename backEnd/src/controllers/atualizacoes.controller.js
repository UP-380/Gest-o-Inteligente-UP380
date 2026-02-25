
const supabase = require('../config/database');

/**
 * Verifica e publica notas que estavam agendadas e chegaram na data/hora
 */
async function publicarNotasAgendadas() {
    try {
        const agora = new Date();

        // Buscar notas não anunciadas que já deveriam estar publicadas
        const { data: notasPendentes, error } = await supabase
            .from('base_conhecimento_atualizacoes')
            .select('*')
            .eq('anunciado', false)
            .lte('data_publicacao', agora.toISOString());

        if (error) {
            console.error('Erro ao buscar notas agendadas:', error);
            return;
        }

        if (!notasPendentes || notasPendentes.length === 0) return;

        console.log(`[SCHEDULE] Publicando ${notasPendentes.length} notas agendadas...`);

        // Importar aqui para evitar dependência circular
        const { distribuirNotificacao } = require('./notificacoes.controller');

        for (const nota of notasPendentes) {
            try {
                // 0. Evitar processamento duplicado se outra requisição já estiver tratando esta nota
                // Verificamos se já existe um comunicado para esta nota_id
                const { data: existente } = await supabase
                    .from('comunicacao_mensagens')
                    .select('id')
                    .filter('metadata->>origem', 'eq', 'notas_atualizacao')
                    .filter('metadata->>nota_id', 'eq', String(nota.id))
                    .maybeSingle();

                if (existente) {
                    console.log(`[SCHEDULE] Nota ${nota.id} já possui comunicado. Marcando como anunciada.`);
                    await supabase
                        .from('base_conhecimento_atualizacoes')
                        .update({ anunciado: true })
                        .eq('id', nota.id);
                    continue;
                }

                // 1. Criar Comunicado
                const { data: mensagem, error: errorComunicado } = await supabase
                    .from('comunicacao_mensagens')
                    .insert({
                        tipo: 'COMUNICADO',
                        criador_id: nota.usuario_id,
                        titulo: `Atualização: ${nota.titulo}`,
                        conteudo: nota.conteudo || '',
                        metadata: {
                            destacado: true,
                            origem: 'notas_atualizacao',
                            nota_id: nota.id
                        },
                        created_at: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (!errorComunicado && mensagem) {
                    // 2. Criar registros de leitura
                    const { data: usuarios } = await supabase.from('usuarios').select('id');
                    if (usuarios && usuarios.length > 0) {
                        const leituras = usuarios.map(u => ({
                            mensagem_id: mensagem.id,
                            usuario_id: u.id,
                            lida: false
                        }));
                        await supabase.from('comunicacao_leituras').insert(leituras);

                        // 3. Notificar
                        await distribuirNotificacao({
                            tipo: 'COMUNICADO_NOVO',
                            titulo: 'Nova Atualização do Sistema',
                            mensagem: nota.titulo,
                            referencia_id: mensagem.id,
                            link: '/base-conhecimento/notas-atualizacao'
                        });
                    }
                }

                // 4. Marcar como anunciada
                await supabase
                    .from('base_conhecimento_atualizacoes')
                    .update({ anunciado: true })
                    .eq('id', nota.id);

            } catch (errPublish) {
                console.error(`Erro ao publicar nota ${nota.id}:`, errPublish);
            }
        }
    } catch (err) {
        console.error('Erro global em publicarNotasAgendadas:', err);
    }
}

// GET - Listar todas as atualizações
async function listarAtualizacoes(req, res) {
    try {
        const isAdmin = req.session?.usuario?.permissoes === 'administrador';
        const agora = new Date();

        // Tenta publicar notas agendadas antes de listar (Lazy publishing)
        publicarNotasAgendadas().catch(e => console.error('Erro no checkout de agendamentos:', e));

        let query = supabase
            .from('base_conhecimento_atualizacoes')
            .select('id, titulo, conteudo, data_publicacao, created_at, updated_at, usuario_id, anunciado')
            .order('data_publicacao', { ascending: false });

        // Se não for admin, oculta notas futuras
        if (!isAdmin) {
            query = query.lte('data_publicacao', agora.toISOString());
        }

        const { data, error } = await query;

        if (error) {
            console.error('Erro ao listar atualizações:', error);
            return res.status(500).json({
                success: false,
                error: 'Erro ao buscar atualizações',
                details: error.message
            });
        }

        return res.json({
            success: true,
            data: data || []
        });
    } catch (error) {
        console.error('Erro ao listar atualizações:', error);
        return res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            details: error.message
        });
    }
}

// GET - Buscar uma atualização por ID
async function getAtualizacaoPorId(req, res) {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ success: false, error: 'ID é obrigatório' });
        }

        const { data, error } = await supabase
            .from('base_conhecimento_atualizacoes')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            return res.status(500).json({ success: false, error: 'Erro ao buscar atualização', details: error.message });
        }

        if (!data) {
            return res.status(404).json({ success: false, error: 'Atualização não encontrada' });
        }

        return res.json({ success: true, data });
    } catch (error) {
        console.error('Erro ao buscar atualização por ID:', error);
        return res.status(500).json({ success: false, error: 'Erro interno do servidor', details: error.message });
    }
}


// POST - Criar nova atualização
async function criarAtualizacao(req, res) {
    try {
        const usuarioId = req.session?.usuario?.id;
        // Permissão de admin deve ser verificada no middleware da rota, mas aqui garantimos que temos um usuário
        if (!usuarioId) {
            return res.status(401).json({ success: false, error: 'Não autenticado' });
        }

        let { titulo, conteudo, data_publicacao } = req.body || {};

        if (!titulo || !titulo.trim()) {
            return res.status(400).json({ success: false, error: 'Título é obrigatório' });
        }

        const agora = new Date();
        const dataPub = data_publicacao ? new Date(data_publicacao) : new Date();

        // Agendamento simplificado por DATA (ignorando horas para o localhost e UX simplificado)
        // Comparamos apenas as datas no formato YYYY-MM-DD
        const dataHojeStr = agora.toISOString().split('T')[0];
        const dataPubStr = dataPub.toISOString().split('T')[0];

        // Se a data de publicação for estritamente posterior a hoje, é agendado
        const isAgendado = dataPubStr > dataHojeStr;

        console.log(`[DEBUG] Criando nota. Pub: ${dataPubStr}, Hoje: ${dataHojeStr}, isAgendado: ${isAgendado}`);

        const { data, error } = await supabase
            .from('base_conhecimento_atualizacoes')
            .insert({
                titulo: titulo.trim(),
                conteudo: conteudo || '',
                usuario_id: usuarioId,
                data_publicacao: dataPub.toISOString(),
                anunciado: !isAgendado // Se não for agendado, será anunciado agora
            })
            .select()
            .single();

        if (error) {
            console.error('Erro ao criar atualização:', error);
            return res.status(500).json({ success: false, error: 'Erro ao criar atualização', details: error.message });
        }

        // --- INTEGRAÇÃO COM AVISOS/CHAT ---
        // Só dispara se NÃO for agendado
        if (!isAgendado) {
            try {
                // 1. Criar Comunicado em comunicacao_mensagens
                const { data: mensagem, error: errorComunicado } = await supabase
                    .from('comunicacao_mensagens')
                    .insert({
                        tipo: 'COMUNICADO',
                        criador_id: usuarioId,
                        titulo: `Atualização: ${titulo.trim()}`,
                        conteudo: conteudo || '',
                        metadata: {
                            destacado: true,
                            origem: 'notas_atualizacao',
                            nota_id: data.id
                        },
                        created_at: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (!errorComunicado && mensagem) {
                    // 2. Criar registros de leitura para todos os usuários
                    const { data: usuarios } = await supabase.from('usuarios').select('id');
                    if (usuarios && usuarios.length > 0) {
                        const leituras = usuarios.map(u => ({
                            mensagem_id: mensagem.id,
                            usuario_id: u.id,
                            lida: false
                        }));
                        await supabase.from('comunicacao_leituras').insert(leituras);

                        // 3. Notificar via sistema de notificações
                        const { distribuirNotificacao } = require('./notificacoes.controller');
                        await distribuirNotificacao({
                            tipo: 'COMUNICADO_NOVO',
                            titulo: 'Nova Atualização do Sistema',
                            mensagem: titulo.trim(),
                            referencia_id: mensagem.id,
                            link: '/base-conhecimento/notas-atualizacao'
                        });
                    }
                }
            } catch (errAviso) {
                console.error('Erro ao enviar aviso de atualização:', errAviso);
                // Não bloqueia a resposta de sucesso da criação da nota
            }
        }

        return res.status(201).json({ success: true, data });
    } catch (error) {
        console.error('Erro ao criar atualização:', error);
        return res.status(500).json({ success: false, error: 'Erro interno do servidor', details: error.message });
    }
}

// PUT - Atualizar atualização existente
async function atualizarAtualizacao(req, res) {
    try {
        const { id } = req.params;
        const { titulo, conteudo, data_publicacao } = req.body || {};

        if (!id) {
            return res.status(400).json({ success: false, error: 'ID é obrigatório' });
        }

        const updateData = {};
        if (titulo !== undefined) updateData.titulo = titulo.trim();
        if (conteudo !== undefined) updateData.conteudo = conteudo;
        if (data_publicacao !== undefined) {
            updateData.data_publicacao = data_publicacao;
            // Se mover para o futuro, vira rascunho (agendado). Se for passado/agora, vira publicado.
            // Agendamento simplificado por DATA
            const dataPub = new Date(data_publicacao);
            const dataHojeStr = new Date().toISOString().split('T')[0];
            const dataPubStr = dataPub.toISOString().split('T')[0];
            updateData.anunciado = dataPubStr <= dataHojeStr;
        }
        updateData.updated_at = new Date();

        const { data, error } = await supabase
            .from('base_conhecimento_atualizacoes')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Erro ao atualizar atualização:', error);
            return res.status(500).json({ success: false, error: 'Erro ao atualizar', details: error.message });
        }

        // --- ATUALIZAR AVISO/CHAT ---
        try {
            // Buscar mensagem vinculada
            const { data: mensagem } = await supabase
                .from('comunicacao_mensagens')
                .select('id, metadata')
                .filter('metadata->>origem', 'eq', 'notas_atualizacao')
                .filter('metadata->>nota_id', 'eq', String(id))
                .maybeSingle();

            // Se o comunicado já existe, apenas atualiza título/conteúdo
            if (mensagem) {
                if (titulo !== undefined || conteudo !== undefined) {
                    const updateMensagem = {};
                    if (titulo !== undefined) updateMensagem.titulo = `Atualização: ${titulo.trim()}`;
                    if (conteudo !== undefined) updateMensagem.conteudo = conteudo;

                    await supabase
                        .from('comunicacao_mensagens')
                        .update(updateMensagem)
                        .eq('id', mensagem.id);
                }
            }
            // Se não existe comunicado e a nota ESTÁ anunciada agora (ou acaba de ser), cria o comunicado pela primeira vez
            else if (data.anunciado) {
                const { data: novaMensagem, error: errorComunicado } = await supabase
                    .from('comunicacao_mensagens')
                    .insert({
                        tipo: 'COMUNICADO',
                        criador_id: data.usuario_id,
                        titulo: `Atualização: ${data.titulo}`,
                        conteudo: data.conteudo || '',
                        metadata: {
                            destacado: true,
                            origem: 'notas_atualizacao',
                            nota_id: data.id
                        },
                        created_at: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (!errorComunicado && novaMensagem) {
                    const { data: usuarios } = await supabase.from('usuarios').select('id');
                    if (usuarios && usuarios.length > 0) {
                        const leituras = usuarios.map(u => ({
                            mensagem_id: novaMensagem.id,
                            usuario_id: u.id,
                            lida: false
                        }));
                        await supabase.from('comunicacao_leituras').insert(leituras);

                        const { distribuirNotificacao } = require('./notificacoes.controller');
                        await distribuirNotificacao({
                            tipo: 'COMUNICADO_NOVO',
                            titulo: 'Nova Atualização do Sistema',
                            mensagem: data.titulo,
                            referencia_id: novaMensagem.id,
                            link: '/base-conhecimento/notas-atualizacao'
                        });
                    }
                }
            }
        } catch (errAviso) {
            console.error('Erro ao atualizar aviso de atualização:', errAviso);
        }

        return res.json({ success: true, data });
    } catch (error) {
        console.error('Erro ao atualizar atualização:', error);
        return res.status(500).json({ success: false, error: 'Erro interno do servidor', details: error.message });
    }
}

// DELETE - Excluir atualização
async function excluirAtualizacao(req, res) {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ success: false, error: 'ID é obrigatório' });
        }

        const { error } = await supabase
            .from('base_conhecimento_atualizacoes')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Erro ao excluir atualização:', error);
            return res.status(500).json({ success: false, error: 'Erro ao excluir', details: error.message });
        }

        return res.json({ success: true, message: 'Atualização excluída com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir atualização:', error);
        return res.status(500).json({ success: false, error: 'Erro interno do servidor', details: error.message });
    }
}

module.exports = {
    listarAtualizacoes,
    getAtualizacaoPorId,
    criarAtualizacao,
    atualizarAtualizacao,
    excluirAtualizacao,
    publicarNotasAgendadas
};
