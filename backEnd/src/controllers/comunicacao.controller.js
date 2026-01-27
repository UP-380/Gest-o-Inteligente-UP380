
const supabase = require('../config/database');
const { distribuirNotificacao } = require('./notificacoes.controller');

// =============================================================
// === CONTROLLER DE COMUNICAÇÃO ===
// =============================================================

/**
 * Envia uma nova mensagem (CHAT, COMUNICADO, CHAMADO)
 */
async function enviarMensagem(req, res) {
    try {
        const criador_id = req.session.usuario.id;
        const { tipo, destinatario_id, titulo, conteudo, status_chamado, mensagem_pai_id, metadata } = req.body;

        if (!tipo || !conteudo) {
            return res.status(400).json({ success: false, error: 'Tipo e conteúdo são obrigatórios.' });
        }

        // 1. Inserir Mensagem
        const { data: mensagem, error } = await supabase
            
            .from('comunicacao_mensagens')
            .insert({
                tipo,
                criador_id,
                destinatario_id: destinatario_id || null, // Apenas para CHAT 1x1
                mensagem_pai_id: mensagem_pai_id || null,
                titulo: titulo || null,
                conteudo,
                status_chamado: status_chamado || (tipo === 'CHAMADO' ? 'ABERTO' : null),
                metadata: metadata || {}
            })
            .select()
            .single();

        if (error) throw error;

        // 2. Processar Destinatários e Notificações
        if (tipo === 'CHAT' && destinatario_id) {
            // Inserir leitura para o destinatário
            await supabase
                
                .from('comunicacao_leituras')
                .insert({ mensagem_id: mensagem.id, usuario_id: destinatario_id, lida: false });

            // Notificar apenas o destinatário
            await distribuirNotificacao({
                tipo: 'CHAT_MENSAGEM',
                titulo: 'Nova mensagem',
                mensagem: `Você recebeu uma mensagem de ${req.session.usuario.nome_usuario}`,
                referencia_id: mensagem.id,
                link: `/comunicacao?tab=chats&interlocutorId=${criador_id}`,
                usuario_id: destinatario_id
            });

        } else if (tipo === 'COMUNICADO') {
            // Lógica para comunicados: envia para todos os usuários
            const { data: usuarios } = await supabase.from('usuarios').select('id');
            if (usuarios && usuarios.length > 0) {
                const leituras = usuarios.map(u => ({ mensagem_id: mensagem.id, usuario_id: u.id, lida: false }));

                // Batch insert leituras
                await supabase.from('comunicacao_leituras').insert(leituras);

                // Notificar por broadcast (padrão do distribuirNotificacao sem usuario_id)
                await distribuirNotificacao({
                    tipo: 'COMUNICADO_NOVO',
                    titulo: 'Novo Comunicado',
                    mensagem: titulo || 'Um novo comunicado foi publicado.',
                    referencia_id: mensagem.id,
                    link: '/comunicacao?tab=comunicados'
                });
            }
        } else if (tipo === 'CHAMADO') {
            const isNovoChamado = !mensagem_pai_id;

            if (isNovoChamado) {
                // Notificar gestores sobre novo chamado
                await distribuirNotificacao({
                    tipo: 'CHAMADO_NOVO',
                    titulo: 'Novo Chamado Aberto',
                    mensagem: `${req.session.usuario.nome_usuario} abriu um chamado: ${titulo || (conteudo && conteudo.substring(0, 30)) + '...'}`,
                    referencia_id: mensagem.id,
                    link: '/comunicacao?tab=chamados'
                });
            } else {
                // É uma resposta. Notificar dono original e gestores.
                const { data: pai } = await supabase
                    
                    .from('comunicacao_mensagens')
                    .select('criador_id')
                    .eq('id', mensagem_pai_id)
                    .single();

                if (pai && pai.criador_id !== criador_id) {
                    await distribuirNotificacao({
                        tipo: 'CHAMADO_ATUALIZADO',
                        titulo: 'Resposta em seu Chamado',
                        mensagem: `${req.session.usuario.nome_usuario} respondeu ao seu chamado.`,
                        referencia_id: mensagem.id,
                        link: '/comunicacao?tab=chamados',
                        usuario_id: pai.criador_id
                    });
                }

                // Notificar outros interessados (gestores)
                await distribuirNotificacao({
                    tipo: 'CHAMADO_ATUALIZADO',
                    titulo: 'Movimentação em Chamado',
                    mensagem: `${req.session.usuario.nome_usuario} atualizou um chamado.`,
                    referencia_id: mensagem.id,
                    link: '/comunicacao?tab=chamados'
                });
            }
        }

        return res.json({ success: true, data: mensagem });

    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        return res.status(500).json({ success: false, error: 'Erro ao enviar mensagem.' });
    }
}

/**
 * Lista mensagens (Chat)
 */
async function listarMensagensChat(req, res) {
    try {
        const usuario_id = req.session.usuario.id;
        const { com_usuario } = req.query; // ID do outro usuário

        if (!com_usuario) return res.status(400).json({ success: false, error: 'Usuário alvo não informado.' });

        const { data, error } = await supabase
            
            .from('comunicacao_mensagens')
            .select('*')
            .eq('tipo', 'CHAT')
            .or(`and(criador_id.eq.${usuario_id},destinatario_id.eq.${com_usuario}),and(criador_id.eq.${com_usuario},destinatario_id.eq.${usuario_id})`)
            .order('created_at', { ascending: true });

        if (error) throw error;

        return res.json({ success: true, data });
    } catch (error) {
        console.error('Erro ao listar chat:', error);
        return res.status(500).json({ success: false, error: 'Erro ao listar chat.' });
    }
}



/**
 * Lista usuários com quem tive conversas recentes ou iniciais
 */
async function listarConversasRecentes(req, res) {
    try {
        const usuario_id = req.session.usuario.id;

        // Buscar todas as mensagens de chat onde sou criador ou destinatário
        const { data: mensagens, error } = await supabase
            
            .from('comunicacao_mensagens')
            .select(`
                id,
                criador_id,
                destinatario_id,
                conteudo,
                created_at,
                criador:criador_id(id, nome_usuario, foto_perfil),
                destinatario:destinatario_id(id, nome_usuario, foto_perfil)
            `)
            .eq('tipo', 'CHAT')
            .or(`criador_id.eq.${usuario_id},destinatario_id.eq.${usuario_id}`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Processar para agrupar por interlocutor
        const conversasMap = new Map();

        mensagens.forEach(msg => {
            const interlocutor = msg.criador_id === usuario_id ? msg.destinatario : msg.criador;
            // Se usuário foi deletado pode vir null
            if (!interlocutor) return;

            if (!conversasMap.has(interlocutor.id)) {
                conversasMap.set(interlocutor.id, {
                    usuario: interlocutor,
                    ultima_mensagem: msg
                });
            }
        });

        // Se a lista estiver vazia (ou para permitir iniciar novos), 
        // poderíamos listar todos os outros usuários do sistema.
        // Mas vamos retornar o histórico primeiro. 
        // O frontend pode ter um botão "Nova Conversa" que lista todos.

        const conversas = Array.from(conversasMap.values());
        return res.json({ success: true, data: conversas });

    } catch (error) {
        console.error('Erro ao listar conversas:', error);
        return res.status(500).json({ success: false, error: 'Erro ao listar conversas.' });
    }
}

/**
 * Lista Comunicados
 */
async function listarComunicados(req, res) {
    try {
        const usuario_id = req.session.usuario.id;

        // Buscar comunicados.
        // TODO: Filtrar por visibilidade (tabela leituras) ou global se for admin.
        // Por simplificação MVP: buscar todos os comunicados.

        const { data, error } = await supabase
            
            .from('comunicacao_mensagens')
            .select(`
                *,
                criador:criador_id(nome_usuario, foto_perfil)
            `)
            .eq('tipo', 'COMUNICADO')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return res.json({ success: true, data });
    } catch (error) {
        console.error('Erro ao listar comunicados:', error);
        return res.status(500).json({ success: false, error: 'Erro ao listar comunicados.' });
    }
}

/**
 * Lista Chamados
 */
async function listarChamados(req, res) {
    try {
        const usuario_id = req.session.usuario.id;
        const permissoes = req.session.usuario.permissoes;
        // Nota: permissoes aqui é a string/json do campo do banco. 
        // Ideal verificar se é gestor/admin.

        const isGestorOuAdmin = permissoes === 'administrador' || permissoes === 'gestor'; // Simplificado

        let query = supabase
            
            .from('comunicacao_mensagens')
            .select(`
                *,
                criador:criador_id(nome_usuario, foto_perfil)
            `)
            .eq('tipo', 'CHAMADO')
            .is('mensagem_pai_id', null) // Apenas tickets raiz
            .order('created_at', { ascending: false });

        if (!isGestorOuAdmin) {
            // Colaborador vê apenas seus chamados
            query = query.eq('criador_id', usuario_id);
        }

        const { data, error } = await query;

        if (error) throw error;

        return res.json({ success: true, data });

    } catch (error) {
        console.error('Erro ao listar chamados:', error);
        return res.status(500).json({ success: false, error: 'Erro ao listar chamados.' });
    }
}


/**
 * Lista as respostas de um chamado (Thread)
 */
async function listarRespostasChamado(req, res) {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            
            .from('comunicacao_mensagens')
            .select(`
                *,
                criador:criador_id(id, nome_usuario, foto_perfil)
            `)
            .or(`id.eq.${id},mensagem_pai_id.eq.${id}`)
            .order('created_at', { ascending: true });

        if (error) throw error;

        return res.json({ success: true, data });
    } catch (error) {
        console.error('Erro ao listar respostas do chamado:', error);
        return res.status(500).json({ success: false, error: 'Erro ao carregar conversa.' });
    }
}

/**
 * Atualiza o status de um chamado
 */
async function atualizarStatusChamado(req, res) {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const usuario_id = req.session.usuario.id;

        const { data: chamado, error: errorBusca } = await supabase
            
            .from('comunicacao_mensagens')
            .select('*')
            .eq('id', id)
            .single();

        if (errorBusca || !chamado) return res.status(404).json({ success: false, error: 'Chamado não encontrado.' });

        const { error } = await supabase
            
            .from('comunicacao_mensagens')
            .update({ status_chamado: status })
            .eq('id', id);

        if (error) throw error;

        // Notificar o criador sobre a mudança de status
        if (chamado.criador_id !== usuario_id) {
            await distribuirNotificacao({
                tipo: 'CHAMADO_ATUALIZADO',
                titulo: 'Status do Chamado Atualizado',
                mensagem: `O status do seu chamado foi alterado para: ${status}`,
                referencia_id: id,
                link: '/comunicacao?tab=chamados',
                usuario_id: chamado.criador_id
            });
        }

        return res.json({ success: true, message: 'Status atualizado com sucesso.' });
    } catch (error) {
        console.error('Erro ao atualizar status do chamado:', error);
        return res.status(500).json({ success: false, error: 'Erro ao atualizar status.' });
    }
}

/**
 * Marca uma mensagem como lida para o usuário atual
 */
async function marcarMensagemLida(req, res) {
    try {
        const { id } = req.params;
        const usuario_id = req.session.usuario.id;

        const { error } = await supabase
            
            .from('comunicacao_leituras')
            .update({ lida: true, data_leitura: new Date().toISOString() })
            .eq('mensagem_id', id)
            .eq('usuario_id', usuario_id);

        if (error) throw error;

        return res.json({ success: true });
    } catch (error) {
        console.error('Erro ao marcar como lida:', error);
        return res.status(500).json({ success: false, error: 'Erro ao processar leitura.' });
    }
}

/**
 * Busca o último comunicado destacado que o usuário ainda não leu
 */
async function listarComunicadoDestaque(req, res) {
    try {
        const usuario_id = req.session.usuario.id;

        // 1. Buscar o ID do último comunicado marcado como destacado
        const { data: mensagem, error } = await supabase
            
            .from('comunicacao_mensagens')
            .select('*, criador:criador_id(nome_usuario)')
            .eq('tipo', 'COMUNICADO')
            .filter('metadata->>destacado', 'eq', 'true')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;
        if (!mensagem) return res.json({ success: true, data: null });

        // 2. Verificar se o usuário já leu este comunicado
        const { data: leitura } = await supabase
            
            .from('comunicacao_leituras')
            .select('lida')
            .eq('mensagem_id', mensagem.id)
            .eq('usuario_id', usuario_id)
            .maybeSingle();

        if (leitura && leitura.lida) {
            return res.json({ success: true, data: null });
        }

        return res.json({ success: true, data: mensagem });
    } catch (error) {
        console.error('Erro ao buscar comunicado de destaque:', error);
        return res.status(500).json({ success: false, error: 'Erro ao carregar avisos.' });
    }
}

module.exports = {
    enviarMensagem,
    listarMensagensChat,
    listarConversasRecentes,
    listarComunicados,
    listarChamados,
    listarRespostasChamado,
    atualizarStatusChamado,
    marcarMensagemLida,
    listarComunicadoDestaque
};
