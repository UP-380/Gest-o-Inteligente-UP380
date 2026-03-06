const supabase = require('../config/database');
const { distribuirNotificacao, notificarClienteSSE } = require('./notificacoes.controller');
const { resolveAvatarUrl } = require('../utils/storage');
const { sendSuccess, sendError, sendCreated, sendDeleted, sendValidationError, sendNotFound } = require('../utils/responseHelper');

async function getChamadoRoot(sb, messageId) {
    const { data: m } = await sb.from('comunicacao_mensagens').select('id, mensagem_pai_id').eq('id', messageId).single();
    if (!m) return null;
    if (!m.mensagem_pai_id) return m.id;
    return getChamadoRoot(sb, m.mensagem_pai_id);
}

// =============================================================
// === CONTROLLER DE COMUNICAÇÃO ===
// =============================================================

/**
 * Envia uma nova mensagem (CHAT, COMUNICADO, CHAMADO)
 */
async function enviarMensagem(req, res) {
    try {
        const criador_id = req.session.usuario.id;
        const { tipo, destinatario_id, titulo, conteudo, status_chamado, mensagem_pai_id, metadata, prazo_desejado } = req.body;

        console.log('[COMUNICACAO] enviarMensagem:', { tipo, destinatario_id, criador_id });

        if (!tipo || !conteudo) {
            return sendValidationError(res, 'Tipo e conteúdo são obrigatórios.');
        }

        // 1. Verificar Permissões para Respostas de Chamados
        const tipoNormalizado = String(tipo || '').toUpperCase();
        if (mensagem_pai_id && tipoNormalizado === 'CHAMADO') {
            const rootId = await getChamadoRoot(supabase, mensagem_pai_id);
            const { data: rootTicket } = await supabase
                .from('comunicacao_mensagens')
                .select('criador_id, categoria_id, metadata, status_chamado')
                .eq('id', rootId)
                .single();

            if (rootTicket) {
                if (['ENCERRADO', 'CANCELADO', 'CONCLUIDO'].includes(rootTicket.status_chamado)) {
                    return sendError(res, 403, 'Este chamado está fechado para novas respostas.');
                }

                const normalizedPerms = String(req.session.usuario.permissoes || '').toLowerCase();
                const isGestorOuAdmin = normalizedPerms.includes('administrador') ||
                    normalizedPerms.includes('gestor') ||
                    req.session.usuario.nivel === 'administrador' ||
                    req.session.usuario.nivel === 'gestor';
                const isOwner = Number(rootTicket.criador_id) === Number(criador_id);

                // Buscar departamentos do autor da resposta
                const { data: colab } = await supabase
                    .from('membro')
                    .select('id, nome')
                    .eq('usuario_id', criador_id)
                    .single();

                let meusDeptos = [];
                if (colab) {
                    // 1. Departamentos onde é membro
                    const { data: deptosMembros } = await supabase
                        .from('departamento_membros')
                        .select('departamento_id')
                        .eq('membro_id', colab.id);

                    // 2. Departamentos onde é o responsável (HEAD)
                    // Como o frontend salva 'head' como string de nomes, buscamos por ID ou Nome
                    const { data: deptosHead } = await supabase
                        .from('departamentos')
                        .select('id')
                        .or(`head.eq.${colab.id},head.ilike.%${colab.nome}%`);

                    const idsMembros = (deptosMembros || []).map(d => d.departamento_id);
                    const idsHead = (deptosHead || []).map(d => d.id);

                    // Unir e remover duplicatas
                    meusDeptos = [...new Set([...idsMembros, ...idsHead])];
                }

                let deptoId = rootTicket.metadata?.departamento_id ? Number(rootTicket.metadata.departamento_id) : null;
                if (!deptoId && rootTicket.assunto_id) {
                    const { data: cat } = await supabase.from('cp_chamados_assuntos').select('departamento_id').eq('id', rootTicket.assunto_id).single();
                    deptoId = cat?.departamento_id;
                }

                const isSupport = isGestorOuAdmin || (deptoId && meusDeptos.map(Number).includes(Number(deptoId)));

                if (!isOwner && !isSupport) {
                    return sendError(res, 403, 'Você não tem permissão para enviar mensagens neste chamado.');
                }
            }
        }

        // 2. Gerar Número do Ticket se for um novo Chamado
        let ticket_numero = null;
        if (tipoNormalizado === 'CHAMADO' && !mensagem_pai_id) {
            try {
                const { data: lastTicket, error: errLast } = await supabase
                    .from('comunicacao_mensagens')
                    .select('ticket_numero')
                    .eq('tipo', 'CHAMADO')
                    .is('mensagem_pai_id', null)
                    .order('ticket_numero', { ascending: false })
                    .limit(1);

                if (!errLast) {
                    const lastNum = (lastTicket && lastTicket.length > 0) ? (lastTicket[0].ticket_numero || 0) : 0;
                    ticket_numero = lastNum + 1;
                } else {
                    console.error('[COMUNICACAO] Erro ao buscar último ticket_numero:', errLast);
                }
            } catch (errT) {
                console.error('[COMUNICACAO] Exceção ao buscar ticket_numero:', errT);
            }
        }

        // 3. Inserir Mensagem
        const messageData = {
            tipo,
            criador_id,
            destinatario_id: destinatario_id || null,
            mensagem_pai_id: mensagem_pai_id || null,
            titulo: titulo || null,
            conteudo,
            status_chamado: status_chamado || (tipo === 'CHAMADO' && !mensagem_pai_id ? 'ABERTO' : null),
            metadata: metadata || {},
            prazo_desejado: prazo_desejado || null,
            ticket_numero: ticket_numero
        };

        let { data: mensagem, error } = await supabase
            .from('comunicacao_mensagens')
            .insert(messageData)
            .select()
            .single();

        // Fallback se a coluna ticket_numero não existir no banco
        if (error && (error.message?.includes('ticket_numero') || error.code === '42703')) {
            console.warn('[COMUNICACAO] Coluna ticket_numero não encontrada. Tentando inserir sem ela.');
            delete messageData.ticket_numero;
            const retry = await supabase
                .from('comunicacao_mensagens')
                .insert(messageData)
                .select()
                .single();
            mensagem = retry.data;
            error = retry.error;
        }

        if (error) throw error;

        // 3. Processar Destinatários e Notificações (aceita CHAT ou chat)
        const tFinal = String(tipo || '').toUpperCase();
        if (tFinal === 'CHAT' && (destinatario_id != null && destinatario_id !== '')) {
            const destinatarioId = parseInt(destinatario_id, 10) || destinatario_id;
            console.log('[COMUNICACAO] CHAT: criando notificação para destinatario_id', destinatarioId);
            // Inserir leitura para o destinatário
            await supabase

                .from('comunicacao_leituras')
                .insert({ mensagem_id: mensagem.id, usuario_id: destinatarioId, lida: false });

            // Notificar apenas o destinatário (não falha o envio da mensagem se der erro)
            try {
                let remetenteFoto = null;
                try {
                    remetenteFoto = req.session.usuario.foto_perfil
                        ? await resolveAvatarUrl(req.session.usuario.foto_perfil, 'user')
                        : null;
                } catch (_) { /* ignora */ }
                await distribuirNotificacao({
                    tipo: 'CHAT_MENSAGEM',
                    titulo: 'Nova mensagem',
                    mensagem: (conteudo && String(conteudo).trim()) ? String(conteudo).trim().substring(0, 200) : 'Nova mensagem',
                    referencia_id: mensagem.id,
                    link: `/comunicacao?tab=chats&interlocutorId=${criador_id}`,
                    usuario_id: destinatarioId,
                    metadata: {
                        remetente_id: criador_id,
                        remetente_nome: req.session.usuario.nome_usuario || 'Usuário',
                        remetente_foto: remetenteFoto || null
                    }
                });
            } catch (errNotif) {
                console.error('[COMUNICACAO] Erro ao criar notificação de chat (mensagem já enviada):', errNotif?.message || errNotif);
            }
            console.log('[COMUNICACAO] Notificação de chat processada para usuario_id', destinatarioId);

        } else if (tipoNormalizado === 'COMUNICADO') {
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
        } else if (tipoNormalizado === 'CHAMADO') {
            const isNovoChamado = !mensagem_pai_id;

            if (isNovoChamado) {
                // Lógica de SLA e Assunto / Departamento
                const { categoria_id, departamento_id } = metadata || {};
                const assunto_id = categoria_id || null;
                let prazo_sla = null;
                let finalDepartamentoId = departamento_id || null;

                if (assunto_id) {
                    // Buscar SLA do assunto
                    const { data: catData } = await supabase
                        .from('cp_chamados_assuntos')
                        .select('sla_horas, departamento_id')
                        .eq('id', assunto_id)
                        .single();

                    if (catData) {
                        const horasSla = catData.sla_horas || 24;
                        prazo_sla = new Date();
                        prazo_sla.setHours(prazo_sla.getHours() + horasSla);
                        finalDepartamentoId = catData.departamento_id || finalDepartamentoId;

                        // Atualizar a mensagem com assunto_id e prazo_sla
                        await supabase
                            .from('comunicacao_mensagens')
                            .update({
                                assunto_id,
                                prazo_sla: prazo_sla.toISOString()
                            })
                            .eq('id', mensagem.id);

                        // Metadata extra para o front
                        mensagem.categoria_id = categoria_id;
                        mensagem.prazo_sla = prazo_sla.toISOString();
                    }
                } else if (finalDepartamentoId) {
                    // Se não tem categoria mas tem departamento, usamos um SLA padrão de 24h
                    const horasSla = 24;
                    prazo_sla = new Date();
                    prazo_sla.setHours(prazo_sla.getHours() + horasSla);

                    await supabase
                        .from('comunicacao_mensagens')
                        .update({
                            prazo_sla: prazo_sla.toISOString()
                        })
                        .eq('id', mensagem.id);

                    mensagem.prazo_sla = prazo_sla.toISOString();
                }

                // Notificar gestores sobre novo chamado
                await distribuirNotificacao({
                    tipo: 'CHAMADO_NOVO',
                    titulo: 'Novo Chamado Aberto',
                    mensagem: `${req.session.usuario.nome_usuario} abriu um chamado: ${titulo || (conteudo && conteudo.substring(0, 30)) + '...'}`,
                    referencia_id: mensagem.id,
                    link: '/comunicacao?tab=chamados',
                    departamento_id: finalDepartamentoId
                });
            } else {
                // É uma resposta. Notificar dono original e gestores do departamento específico.
                const chamadoRootId = await getChamadoRoot(supabase, mensagem_pai_id);

                // Buscar dados do chamado raiz (para pegar criador e categoria/departamento)
                const { data: rootTicket } = await supabase
                    .from('comunicacao_mensagens')
                    .select('criador_id, categoria_id')
                    .eq('id', chamadoRootId || mensagem_pai_id)
                    .single();

                if (rootTicket && rootTicket.criador_id !== criador_id) {
                    let remetenteFoto = null;
                    try {
                        remetenteFoto = req.session.usuario.foto_perfil
                            ? await resolveAvatarUrl(req.session.usuario.foto_perfil, 'user')
                            : null;
                    } catch (_) { /* ignora */ }

                    await distribuirNotificacao({
                        tipo: 'CHAMADO_ATUALIZADO',
                        titulo: 'Resposta em seu Chamado',
                        mensagem: (conteudo && String(conteudo).trim()) ? String(conteudo).trim().substring(0, 200) : `${req.session.usuario.nome_usuario} respondeu ao seu chamado.`,
                        referencia_id: String(chamadoRootId || mensagem_pai_id),
                        link: '/comunicacao?tab=chamados',
                        usuario_id: rootTicket.criador_id,
                        metadata: {
                            remetente_id: criador_id,
                            remetente_nome: req.session.usuario.nome_usuario || 'Usuário',
                            remetente_foto: remetenteFoto || null,
                            chamado_id: chamadoRootId || mensagem_pai_id
                        }
                    });
                }

                // Notificar gestores do departamento relacionado
                let deptoId = null;
                if (rootTicket?.assunto_id) {
                    const { data: cat } = await supabase
                        .from('cp_chamados_assuntos')
                        .select('departamento_id')
                        .eq('id', rootTicket.assunto_id)
                        .single();
                    deptoId = cat?.departamento_id;
                }

                await distribuirNotificacao({
                    tipo: 'CHAMADO_ATUALIZADO',
                    titulo: 'Movimentação em Chamado',
                    mensagem: `${req.session.usuario.nome_usuario} atualizou um chamado.`,
                    referencia_id: String(chamadoRootId || mensagem_pai_id),
                    link: '/comunicacao?tab=chamados',
                    departamento_id: deptoId
                });
            }
        }

        return sendCreated(res, mensagem, 'Mensagem enviada com sucesso.');

    } catch (error) {
        console.error('❌ [COMUNICACAO] Erro crítico ao enviar mensagem:', error);
        return sendError(res, 500, error.message || 'Erro ao enviar mensagem.', error.details || error);
    }
}

/**
 * Lista mensagens (Chat) com status de leitura para mensagens que eu enviei
 */
async function listarMensagensChat(req, res) {
    try {
        const usuario_id = req.session.usuario.id;
        const { com_usuario } = req.query; // ID do outro usuário

        if (!com_usuario) return sendValidationError(res, 'Usuário alvo não informado.');

        const { data, error } = await supabase

            .from('comunicacao_mensagens')
            .select('*')
            .eq('tipo', 'CHAT')
            .or(`and(criador_id.eq.${usuario_id},destinatario_id.eq.${com_usuario}),and(criador_id.eq.${com_usuario},destinatario_id.eq.${usuario_id})`)
            .order('created_at', { ascending: true });

        if (error) throw error;

        const mensagens = data || [];
        const idsEnviadasPorMim = mensagens.filter(m => Number(m.criador_id) === Number(usuario_id)).map(m => m.id);
        let leiturasMap = {};
        const comUsuarioNum = Number(com_usuario) || com_usuario;
        if (idsEnviadasPorMim.length > 0) {
            const { data: leituras, error: errLeituras } = await supabase
                .from('comunicacao_leituras')
                .select('mensagem_id, lida')
                .in('mensagem_id', idsEnviadasPorMim)
                .eq('usuario_id', comUsuarioNum);
            if (!errLeituras && leituras) {
                leituras.forEach(l => {
                    const lida = l.lida === true || l.lida === 't' || l.lida === 1 || String(l.lida || '').toLowerCase() === 'true';
                    leiturasMap[l.mensagem_id] = { lida: !!lida };
                });
            }
        }

        const dataComLeitura = mensagens.map(m => {
            const base = { ...m };
            if (Number(m.criador_id) === Number(usuario_id)) {
                const leitura = leiturasMap[m.id];
                base.lida_por_destinatario = leitura ? leitura.lida : false;
            }
            return base;
        });

        return sendSuccess(res, 200, dataComLeitura);
    } catch (error) {
        console.error('Erro ao listar chat:', error);
        return sendError(res, 500, 'Erro ao listar chat.', error.message);
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

        // Contar mensagens não lidas por conversa (mensagens que eu recebi e ainda não marquei como lidas)
        const idsMensagensRecebidas = (mensagens || [])
            .filter(m => Number(m.destinatario_id) === Number(usuario_id))
            .map(m => m.id);
        let idsLidas = new Set();
        if (idsMensagensRecebidas.length > 0) {
            const { data: leituras } = await supabase
                .from('comunicacao_leituras')
                .select('mensagem_id')
                .in('mensagem_id', idsMensagensRecebidas)
                .eq('usuario_id', usuario_id)
                .eq('lida', true);
            (leituras || []).forEach(l => idsLidas.add(l.mensagem_id));
        }
        const naoLidasPorCriador = {};
        mensagens.forEach(m => {
            if (Number(m.destinatario_id) !== Number(usuario_id)) return;
            if (idsLidas.has(m.id)) return;
            const criador = Number(m.criador_id);
            naoLidasPorCriador[criador] = (naoLidasPorCriador[criador] || 0) + 1;
        });

        const idsUltimasEnviadas = Array.from(conversasMap.values())
            .filter(c => Number(c.ultima_mensagem.criador_id) === Number(usuario_id))
            .map(c => c.ultima_mensagem.id);

        let ultimasLidasMap = {};
        if (idsUltimasEnviadas.length > 0) {
            const { data: leiturasUltimas } = await supabase
                .from('comunicacao_leituras')
                .select('mensagem_id, lida')
                .in('mensagem_id', idsUltimasEnviadas);
            if (leiturasUltimas) {
                leiturasUltimas.forEach(l => {
                    const isLida = String(l.lida || '').toLowerCase() === 'true' || l.lida === true || l.lida === 1;
                    ultimasLidasMap[l.mensagem_id] = isLida;
                });
            }
        }

        const conversas = Array.from(conversasMap.values()).map(c => {
            const result = {
                ...c,
                nao_lidas_count: naoLidasPorCriador[Number(c.usuario.id)] || 0
            };
            if (Number(c.ultima_mensagem.criador_id) === Number(usuario_id)) {
                result.ultima_mensagem.lida_por_destinatario = !!ultimasLidasMap[c.ultima_mensagem.id];
            }
            return result;
        });

        return sendSuccess(res, 200, conversas);

    } catch (error) {
        console.error('Erro ao listar conversas:', error);
        return sendError(res, 500, 'Erro ao listar conversas.', error.message);
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

        // Query simplificada para evitar erro 500 por falha de join/FK
        const { data, error } = await supabase
            .from('comunicacao_mensagens')
            .select('*')
            .eq('tipo', 'COMUNICADO')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('❌ Erro Supabase (listarComunicados):', error);
            throw error;
        }

        if (!data || data.length === 0) {
            return sendSuccess(res, 200, []);
        }

        // Buscar criadores separadamente
        const criadorIds = [...new Set(data.map(m => m.criador_id).filter(Boolean))];
        const { data: criadores } = await supabase
            .from('usuarios')
            .select('id, nome_usuario, foto_perfil')
            .in('id', criadorIds);

        const dataEnriquecida = data.map(msg => ({
            ...msg,
            criador: criadores?.find(c => c.id === msg.criador_id) || null
        }));

        return sendSuccess(res, 200, dataEnriquecida);
    } catch (error) {
        console.error('Erro ao listar comunicados:', error);
        return sendError(res, 500, 'Erro ao listar comunicados.', error.message);
    }
}

/**
 * Lista Chamados
 */
async function listarChamados(req, res) {
    try {
        const usuario_id = req.session.usuario.id;
        const permissoes = req.session.usuario.permissoes;

        // Verifica se é admin ou gestor de forma mais flexível
        const normalizedPerms = String(permissoes || '').toLowerCase();
        const isGestorOuAdmin = normalizedPerms.includes('administrador') ||
            normalizedPerms.includes('gestor') ||
            req.session.usuario.nivel === 'administrador' ||
            req.session.usuario.nivel === 'gestor';

        // Buscar departamentos do usuário para filtro/permissão
        const { data: colab } = await supabase
            .from('membro')
            .select('id, nome')
            .eq('usuario_id', usuario_id)
            .single();

        let meusDeptos = [];
        if (colab) {
            // 1. Departamentos onde é membro
            const { data: deptosMembros } = await supabase
                .from('departamento_membros')
                .select('departamento_id')
                .eq('membro_id', colab.id);

            // 2. Departamentos onde é o responsável (HEAD)
            // Como o frontend salva 'head' como string de nomes (ex: "João, Maria"),
            // buscamos onde o ID bate (legado/robusto) ou onde o nome aparece
            const { data: deptosHead } = await supabase
                .from('departamentos')
                .select('id')
                .or(`head.eq.${colab.id},head.ilike.%${colab.nome}%`);

            const idsMembros = (deptosMembros || []).map(d => d.departamento_id);
            const idsHead = (deptosHead || []).map(d => d.id);

            // Unir e remover duplicatas
            meusDeptos = [...new Set([...idsMembros, ...idsHead])];
        }

        // Query simplificada para evitar erro 500 por falha de join/FK
        let query = supabase
            .from('comunicacao_mensagens')
            .select('*', { count: 'exact' })
            .eq('tipo', 'CHAMADO')
            .is('mensagem_pai_id', null)
            .order('created_at', { ascending: false });

        // IDs dos assuntos dos departamentos do usuário (para filtro em memória)
        let idsAssuntosDepto = [];
        // Regra de Visualização:
        // 1. Admin/Gestor vê tudo
        // 2. Colaborador vê o que criou OU o que é do seu departamento
        if (!isGestorOuAdmin) {
            // Condição base: chamados criados pelo usuário
            let orConditions = `criador_id.eq.${usuario_id}`;

            // Se o usuário faz parte de departamentos, ele também vê chamados vinculados a esses departamentos
            if (meusDeptos.length > 0) {
                // 1. Chamados com assuntos que pertencem aos departamentos dele
                const { data: catIds } = await supabase
                    .from('cp_chamados_assuntos')
                    .select('id')
                    .in('departamento_id', meusDeptos);

                idsAssuntosDepto = (catIds || []).map(c => c.id);
                if (idsAssuntosDepto.length > 0) {
                    orConditions += `,assunto_id.in.(${idsAssuntosDepto.join(',')})`;
                }
                // 2. Filtro por metadata.departamento_id é aplicado em memória abaixo (evita sintaxe JSONB no .or do PostgREST)
            }

            query = query.or(orConditions);
        }

        const { data, error, count } = await query;
        if (error) throw error;

        let dataFiltered = data || [];
        // Para não-gestor: filtrar em memória chamados cujo metadata.departamento_id está em meusDeptos
        if (!isGestorOuAdmin && meusDeptos.length > 0 && dataFiltered.length > 0) {
            const deptoSet = new Set(meusDeptos.map(Number));
            const idsAssuntosSet = new Set(idsAssuntosDepto.map(Number));
            dataFiltered = dataFiltered.filter((ch) => {
                if (Number(ch.criador_id) === Number(usuario_id)) return true;
                const catId = ch.assunto_id || ch.categoria_id;
                if (catId && idsAssuntosSet.has(Number(catId))) return true;
                const metaDepto = ch.metadata && (ch.metadata.departamento_id ?? ch.metadata.departamento);
                if (metaDepto != null && deptoSet.has(Number(metaDepto))) return true;
                return false;
            });
        }

        if (!dataFiltered || dataFiltered.length === 0) {
            return sendSuccess(res, 200, []);
        }

        // --- ENRIQUECIMENTO MANUAL ---
        const criadorIds = [...new Set(dataFiltered.map(m => m.criador_id).filter(Boolean))];
        const catIds = [...new Set(dataFiltered.map(m => m.categoria_id).filter(Boolean))];

        // Buscar criadores
        const { data: criadores } = await supabase
            .from('usuarios')
            .select('id, nome_usuario, foto_perfil')
            .in('id', criadorIds);

        // Buscar assuntos e departamentos
        const { data: categorias } = await supabase
            .from('cp_chamados_assuntos')
            .select('*')
            .in('id', catIds);

        const deptoIdsFromCats = [...new Set(categorias?.map(c => c.departamento_id).filter(Boolean))];
        const { data: departamentos } = await supabase
            .from('departamentos')
            .select('id, nome')
            .in('id', deptoIdsFromCats);

        const categoriasComDepto = (categorias || []).map(cat => ({
            ...cat,
            departamento: departamentos?.find(d => d.id === cat.departamento_id) || null
        }));

        const chamadosBase = dataFiltered.map(ch => ({
            ...ch,
            criador: criadores?.find(c => c.id === ch.criador_id) || null,
            categoria: categoriasComDepto?.find(c => c.id === ch.categoria_id) || null
        }));

        // --- ENRIQUECIMENTO: Buscar quem respondeu por último ---
        const chamadosIds = dataFiltered.map(c => c.id);
        const responderMap = {};

        if (chamadosIds.length > 0) {
            // Buscar todas as mensagens que são respostas aos chamados listados
            const { data: replies, error: errReplies } = await supabase
                .from('comunicacao_mensagens')
                .select('mensagem_pai_id, criador_id, created_at, criador:criador_id(nome_usuario)')
                .in('mensagem_pai_id', chamadosIds)
                .order('created_at', { ascending: false });

            if (!errReplies && replies) {
                replies.forEach(r => {
                    // Se ainda não temos um respondedor para este chamado (como está ordenado DESC, o primeiro é o último)
                    if (!responderMap[r.mensagem_pai_id]) {
                        const chamOriginal = dataFiltered.find(c => c.id === r.mensagem_pai_id);
                        // Atribui se o criador da resposta for diferente do criador do chamado (suporte/gestor)
                        if (chamOriginal && Number(r.criador_id) !== Number(chamOriginal.criador_id)) {
                            responderMap[r.mensagem_pai_id] = r.criador?.nome_usuario;
                        }
                    }
                });
            }
        }

        const enrichedData = chamadosBase.map(cham => {
            const deptoId = cham.categoria?.departamento?.id || (cham.metadata?.departamento_id ? parseInt(cham.metadata.departamento_id, 10) : null);
            return {
                ...cham,
                pode_gerenciar: isGestorOuAdmin || (deptoId && meusDeptos.map(Number).includes(Number(deptoId))),
                respondido_por: responderMap[cham.id] || 'Não respondido'
            };
        });

        return sendSuccess(res, 200, enrichedData, null, { total: count ?? enrichedData.length });
    } catch (error) {
        console.error('Erro ao listar chamados:', error);
        // Inclui a mensagem real do erro para facilitar debug em VPS/produção
        return sendError(res, 500, 'Erro ao listar chamados.', error?.message || String(error));
    }
}

/**
 * Lista Assuntos de Chamados (Tópicos de Ajuda)
 */
async function listarCategorias(req, res) {
    try {
        const { data, error } = await supabase
            .from('cp_chamados_assuntos')
            .select('*, departamento:departamento_id(id, nome)')
            .eq('status', 'Ativo')
            .order('nome', { ascending: true });

        if (error) throw error;
        return sendSuccess(res, 200, data);
    } catch (error) {
        console.error('Erro ao listar assuntos:', error);
        return sendError(res, 500, 'Erro ao listar assuntos.', error.message);
    }
}

/**
 * Lista Templates de Resposta (Respostas Rápidas)
 */
async function listarTemplates(req, res) {
    try {
        console.log('[COMUNICACAO] listando templates...');
        const { data, error } = await supabase
            .from('cp_chamados_templates')
            .select('*')
            .order('titulo', { ascending: true });

        if (error) {
            console.error('[COMUNICACAO] Erro Supabase templates:', error);
            throw error;
        }
        console.log('[COMUNICACAO] templates encontrados:', data?.length || 0);
        return sendSuccess(res, 200, data);
    } catch (error) {
        console.error('Erro ao listar templates:', error);
        return sendError(res, 500, 'Erro ao listar respostas rápidas.', error.message);
    }
}


/**
 * Lista as respostas de um chamado (Thread)
 */
async function listarRespostasChamado(req, res) {
    try {
        const { id } = req.params;
        const usuario_id = req.session.usuario.id;
        const permissoes = req.session.usuario.permissoes;
        const normalizedPerms = String(permissoes || '').toLowerCase();
        const isGestorOuAdmin = normalizedPerms.includes('administrador') ||
            normalizedPerms.includes('gestor') ||
            req.session.usuario.nivel === 'administrador' ||
            req.session.usuario.nivel === 'gestor';


        const { data, error } = await supabase
            .from('comunicacao_mensagens')
            .select(`
                *,
                criador:criador_id(id, nome_usuario, foto_perfil),
                categoria:categoria_id(departamento_id)
            `)
            .or(`id.eq.${id},mensagem_pai_id.eq.${id}`)
            .order('created_at', { ascending: true });

        if (error) throw error;

        // Buscar departamentos do usuário para flag pode_gerenciar
        const { data: colab } = await supabase
            .from('colaboradores')
            .select('id')
            .eq('usuario_id', usuario_id)
            .single();

        let meusDeptos = [];
        if (colab) {
            // 1. Departamentos onde é membro
            const { data: deptosMembros } = await supabase
                .from('departamento_membros')
                .select('departamento_id')
                .eq('membro_id', colab.id);

            // 2. Departamentos onde é o responsável (HEAD)
            const { data: deptosHead } = await supabase
                .from('departamentos')
                .select('id')
                .eq('head', colab.id);

            const idsMembros = (deptosMembros || []).map(d => d.departamento_id);
            const idsHead = (deptosHead || []).map(d => d.id);

            meusDeptos = [...new Set([...idsMembros, ...idsHead])];
        }

        const enrichedData = data.map(msg => {
            if (msg.id === id || msg.id === String(id)) {
                const deptoId = msg.categoria?.departamento_id || (msg.metadata?.departamento_id ? parseInt(msg.metadata.departamento_id, 10) : null);
                return {
                    ...msg,
                    pode_gerenciar: isGestorOuAdmin || (deptoId && meusDeptos.map(Number).includes(Number(deptoId)))
                };
            }
            return msg;
        });

        return sendSuccess(res, 200, enrichedData);
    } catch (error) {
        console.error('Erro ao listar respostas do chamado:', error);
        return sendError(res, 500, 'Erro ao carregar conversa.', error.message);
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

        const normalizedPerms = String(req.session.usuario.permissoes || '').toLowerCase();
        const isGestorOuAdmin = normalizedPerms.includes('administrador') ||
            normalizedPerms.includes('gestor') ||
            req.session.usuario.nivel === 'administrador' ||
            req.session.usuario.nivel === 'gestor';

        // Buscar departamentos do usuário para filtro/permissão
        const { data: colab } = await supabase
            .from('colaboradores')
            .select('id')
            .eq('usuario_id', req.session.usuario.id)
            .single();

        let meusDeptos = [];
        if (colab) {
            // 1. Departamentos onde é membro
            const { data: deptosMembros } = await supabase
                .from('departamento_membros')
                .select('departamento_id')
                .eq('membro_id', colab.id);

            // 2. Departamentos onde é o responsável (HEAD)
            const { data: deptosHead } = await supabase
                .from('departamentos')
                .select('id')
                .eq('head', colab.id);

            const idsMembros = (deptosMembros || []).map(d => d.departamento_id);
            const idsHead = (deptosHead || []).map(d => d.id);

            meusDeptos = [...new Set([...idsMembros, ...idsHead])];
        }

        const { data: chamado, error: errorBusca } = await supabase
            .from('comunicacao_mensagens')
            .select('*, categoria:categoria_id(departamento_id)')
            .eq('id', id)
            .single();

        if (errorBusca || !chamado) return sendNotFound(res, 'Chamado');

        // Determinar papéis para permissão
        const isOwner = Number(chamado.criador_id) === Number(usuario_id);
        const deptoId = chamado.categoria?.departamento_id || (chamado.metadata?.departamento_id ? Number(chamado.metadata.departamento_id) : null);
        const isSupport = isGestorOuAdmin || (deptoId && meusDeptos.map(Number).includes(Number(deptoId)));

        // Regra: Apenas o dono ou suporte podem mudar status
        if (!isOwner && !isSupport) {
            return sendError(res, 403, 'Apenas o autor ou a equipe de suporte podem alterar o status.');
        }

        // Regra do Autor: Dono só pode Encerrar ou Cancelar
        if (isOwner && !isSupport) {
            // Se o chamado já foi finalizado (ENCERRADO/CANCELADO), o autor não pode mudar mais NADA
            if (['ENCERRADO', 'CANCELADO', 'CONCLUIDO'].includes(chamado.status_chamado)) {
                return sendError(res, 403, 'Este chamado já foi finalizado e seu status não pode mais ser alterado por você.');
            }

            if (!['ENCERRADO', 'CANCELADO'].includes(status)) {
                return sendError(res, 403, 'Como autor, você só tem permissão para ENCERRAR ou CANCELAR este chamado.');
            }
        }

        const { error } = await supabase

            .from('comunicacao_mensagens')
            .update({ status_chamado: status })
            .eq('id', id);

        if (error) throw error;

        const displayStatus = status === 'RESPONDIDO' ? 'EM PROCESSO' : status;

        // Inserir mensagem de SISTEMA no chat para transparência
        await supabase.from('comunicacao_mensagens').insert({
            tipo: 'CHAMADO', // Mantemos tipo CHAMADO mas com metadado ou conteudo indicando sistema
            mensagem_pai_id: id,
            criador_id: usuario_id,
            conteudo: `Status alterado para **${displayStatus}**`,
            metadata: { sistema: true, acao: 'STATUS_CHANGE', novo_status: status }
        });

        // Notificar interessados (Criador e Gestores do Departamento)
        // Reutilizamos o deptoId já calculado acima

        // 1. Notificar criador (sempre)
        if (chamado.criador_id !== usuario_id) {
            await distribuirNotificacao({
                tipo: 'CHAMADO_ATUALIZADO',
                titulo: 'Status do Chamado Atualizado',
                mensagem: `O status do seu chamado foi alterado para: ${displayStatus}`,
                referencia_id: id,
                link: '/comunicacao?tab=chamados',
                usuario_id: chamado.criador_id
            });
        }

        // 2. Notificar departamento (opcionalmente, se não for o próprio gestor do depto que mudou)
        await distribuirNotificacao({
            tipo: 'CHAMADO_ATUALIZADO',
            titulo: 'Status alterado',
            mensagem: `Chamado #${id} teve status alterado para ${displayStatus}`,
            referencia_id: id,
            link: '/comunicacao?tab=chamados',
            departamento_id: deptoId
        });

        return sendSuccess(res, 200, null, 'Status atualizado com sucesso.');
    } catch (error) {
        console.error('Erro ao atualizar status do chamado:', error);
        return sendError(res, 500, 'Erro ao atualizar status.', error.message);
    }
}

/**
 * Marca uma mensagem como lida para o usuário atual
 */
async function marcarMensagemLida(req, res) {
    try {
        const { id } = req.params;
        const usuario_id = req.session.usuario.id;

        // Primeiro tenta validar se existe registro de leitura
        const { data: existing, error: checkError } = await supabase
            .from('comunicacao_leituras')
            .select('id')
            .eq('mensagem_id', id)
            .eq('usuario_id', usuario_id)
            .maybeSingle();

        if (checkError) throw checkError;

        if (existing) {
            // Se existe, atualiza
            const { error } = await supabase
                .from('comunicacao_leituras')
                .update({ lida: true, data_leitura: new Date().toISOString() })
                .eq('id', existing.id);

            if (error) throw error;
        } else {
            // Se não existe, cria (Caso de usuários novos pós-envio)
            const { error } = await supabase
                .from('comunicacao_leituras')
                .insert({
                    mensagem_id: id,
                    usuario_id: usuario_id,
                    lida: true,
                    data_leitura: new Date().toISOString()
                });

            if (error) throw error;
        }

        return sendSuccess(res, 200);
    } catch (error) {
        console.error('Erro ao marcar como lida:', error);
        return sendError(res, 500, 'Erro ao processar leitura.', error.message);
    }
}

/**
 * Busca o último comunicado destacado que o usuário ainda não leu
 */
async function listarComunicadoDestaque(req, res) {
    try {
        const usuario_id = req.session.usuario.id;

        // 1. Buscar IDs das mensagens já lidas por este usuário
        const { data: lidas } = await supabase
            .from('comunicacao_leituras')
            .select('mensagem_id')
            .eq('usuario_id', usuario_id)
            .eq('lida', true);

        const idsLidas = lidas?.map(l => l.mensagem_id) || [];

        // 2. Buscar o comunicado mais recente que:
        // - Seja do tipo COMUNICADO
        // - Esteja marcado como destacado no metadata
        // - NÃO tenha sido lido ainda
        let query = supabase
            .from('comunicacao_mensagens')
            .select('*, criador:criador_id(nome_usuario)')
            .eq('tipo', 'COMUNICADO')
            .filter('metadata->>destacado', 'eq', 'true')
            .order('created_at', { ascending: false })
            .order('id', { ascending: false }); // Desempate se criados no mesmo ms

        if (idsLidas.length > 0) {
            // Se houver muitas lidas, o filtro 'in' pode ficar grande. 
            // Para o MVP funciona bem, mas em escala o ideal é um join ou subquery.
            query = query.not('id', 'in', `(${idsLidas.join(',')})`);
        }

        const { data: mensagem, error } = await query.limit(1).maybeSingle();

        if (error) throw error;

        return sendSuccess(res, 200, mensagem);
    } catch (error) {
        console.error('Erro ao buscar comunicado de destaque:', error);
        return sendError(res, 500, 'Erro ao carregar avisos.', error.message);
    }
}

/**
 * Atualiza o conteúdo de uma mensagem (Edição)
 * Permite editar a descrição do chamado ou respostas
 */
async function atualizarMensagem(req, res) {
    try {
        const { id } = req.params;
        const { conteudo, metadata } = req.body;
        const usuario_id = req.session.usuario.id;

        // 1. Verificar se a mensagem existe e pertence ao usuário
        const { data: mensagem, error: errorBusca } = await supabase
            .from('comunicacao_mensagens')
            .select('*')
            .eq('id', id)
            .single();

        if (errorBusca || !mensagem) {
            return sendNotFound(res, 'Mensagem');
        }

        if (mensagem.criador_id !== usuario_id) {
            return sendError(res, 403, 'Você só pode editar suas próprias mensagens.');
        }

        // 2. Atualizar
        const updateData = {
            conteudo,
            updated_at: new Date().toISOString() // Assumindo que existe trigger ou campo
        };

        // Se houver metadata para mergear (opcional)
        if (metadata) {
            updateData.metadata = { ...mensagem.metadata, ...metadata };
        }

        const { data: updated, error } = await supabase
            .from('comunicacao_mensagens')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return sendUpdated(res, updated, 'Mensagem atualizada com sucesso.');
    } catch (error) {
        console.error('Erro ao atualizar mensagem:', error);
        return sendError(res, 500, 'Erro ao atualizar mensagem.', error.message);
    }
}

/**
 * Confirma a data estimada de conclusão de um chamado pelo gestor
 */
async function confirmarEstimativaChamado(req, res) {
    try {
        const { id } = req.params;
        const { prazo_confirmado } = req.body;
        const usuario_id = req.session.usuario.id;

        if (!prazo_confirmado) {
            return sendValidationError(res, 'Data confirmada é obrigatória.');
        }

        // 1. Verificar se o chamado existe
        const { data: chamado, error: errorBusca } = await supabase
            .from('comunicacao_mensagens')
            .select('*')
            .eq('id', id)
            .single();

        if (errorBusca || !chamado) {
            return sendNotFound(res, 'Chamado');
        }

        // 2. Atualizar prazo_confirmado - Forçar meio-dia para evitar shifts de fuso horário
        const safePrazo = prazo_confirmado.includes('T') ? prazo_confirmado : `${prazo_confirmado}T12:00:00`;
        const { error } = await supabase
            .from('comunicacao_mensagens')
            .update({ prazo_confirmado: safePrazo })
            .eq('id', id);

        if (error) throw error;

        // 3. Inserir mensagem de SISTEMA no chat - Formatar manualmente para evitar shift de timezone
        const [y, m, d] = prazo_confirmado.split('-').map(Number);
        const formattedDate = `${d.toString().padStart(2, '0')}/${m.toString().padStart(2, '0')}/${y}`;
        await supabase.from('comunicacao_mensagens').insert({
            tipo: 'CHAMADO',
            mensagem_pai_id: id,
            criador_id: usuario_id,
            conteudo: `Prazo de conclusão confirmado/alterado para **${formattedDate}**`,
            metadata: { sistema: true, acao: 'ESTIMATIVA_CONFIRMADA', prazo_confirmado }
        });

        // 4. Notificar criador
        if (chamado.criador_id !== usuario_id) {
            await distribuirNotificacao({
                tipo: 'CHAMADO_ATUALIZADO',
                titulo: 'Prazo do Chamado Confirmado',
                mensagem: `O prazo do seu chamado foi definido para: ${formattedDate}`,
                referencia_id: id,
                link: '/comunicacao?tab=chamados',
                usuario_id: chamado.criador_id
            });
        }

        return sendSuccess(res, 200, null, 'Prazo confirmado com sucesso.');
    } catch (error) {
        console.error('Erro ao confirmar estimativa:', error);
        return sendError(res, 500, 'Erro ao confirmar estimativa.', error.message);
    }
}

/**
 * Atualiza a prioridade de um chamado
 */
async function atualizarPrioridadeChamado(req, res) {
    try {
        const { id } = req.params;
        const { prioridade } = req.body;
        const usuario_id = req.session.usuario.id;

        if (!prioridade) {
            return sendValidationError(res, 'Prioridade é obrigatória.');
        }

        // Buscar chamado e metadata atual
        const { data: chamado, error: errorBusca } = await supabase
            .from('comunicacao_mensagens')
            .select('metadata')
            .eq('id', id)
            .single();

        if (errorBusca || !chamado) {
            return sendNotFound(res, 'Chamado');
        }

        const existingMetadata = chamado.metadata || {};
        const oldPrioridade = existingMetadata.prioridade || 'BAIXA';

        // Se a prioridade não mudou, apenas retorna sucesso
        if (oldPrioridade === prioridade) {
            return sendSuccess(res, 200, null, 'Prioridade atualizada (sem alterações).');
        }

        const newMetadata = { ...existingMetadata, prioridade };

        // Atualizar no banco
        const { error } = await supabase
            .from('comunicacao_mensagens')
            .update({ metadata: newMetadata })
            .eq('id', id);

        if (error) throw error;


        return sendSuccess(res, 200, null, 'Prioridade atualizada com sucesso.');
    } catch (error) {
        console.error('Erro ao atualizar prioridade:', error);
        return sendError(res, 500, 'Erro ao atualizar prioridade.', error.message);
    }
}

/**
 * Assumir um chamado (designar responsável)
 */
async function assumirChamado(req, res) {
    try {
        const { id } = req.params;
        const { responsavel_id } = req.body; // Aceita responsavel_id personalizado do body
        const usuario_sessao_id = req.session.usuario.id;

        // Converter para número se for numérico
        const parsed_id = (responsavel_id && !isNaN(responsavel_id)) ? Number(responsavel_id) : responsavel_id;
        let target_id = parsed_id || usuario_sessao_id;
        let target_nome = '';

        // Se passamos um responsavel_id específico (via seletor), precisamos buscar o nome dele
        if (parsed_id) {
            // 1. Tenta buscar no usuarios primeiro (quem tem login)
            const { data: userObj } = await supabase
                .from('usuarios')
                .select('nome_usuario, nome')
                .eq('id', parsed_id)
                .maybeSingle();

            if (userObj) {
                target_nome = userObj.nome_usuario || userObj.nome || 'Usuário';
            } else {
                // 2. Se não achou no usuarios, tenta no membro (pelo ID do membro)
                const { data: membroObj } = await supabase
                    .from('membro')
                    .select('nome')
                    .eq('id', parsed_id)
                    .maybeSingle();

                if (membroObj) {
                    target_nome = membroObj.nome || 'Usuário';
                } else {
                    // 3. Fallback: Se ainda não achou, pode ser um usuario_id órfão ou vindo de outra tabela
                    const { data: fallbackObj } = await supabase
                        .from('membro')
                        .select('nome')
                        .eq('usuario_id', parsed_id)
                        .maybeSingle();

                    if (!fallbackObj) return sendNotFound(res, 'Responsável');
                    target_nome = fallbackObj.nome || 'Usuário';
                }
            }
        } else {
            // Caso contrário, usa o usuário logado (botão assumir normal)
            target_nome = req.session.usuario.nome_usuario || req.session.usuario.nome || 'Usuário';
        }

        const { data: chamado, error: errorBusca } = await supabase
            .from('comunicacao_mensagens')
            .select('metadata')
            .eq('id', id)
            .maybeSingle();

        if (errorBusca || !chamado) return sendNotFound(res, 'Chamado');

        const existingMetadata = chamado.metadata || {};
        const newMetadata = {
            ...existingMetadata,
            responsavel: target_nome,
            responsavel_id: target_id
        };

        const { error } = await supabase
            .from('comunicacao_mensagens')
            .update({ metadata: newMetadata })
            .eq('id', id);

        if (error) throw error;

        return sendSuccess(res, 200, { responsavel: target_nome, responsavel_id: target_id }, 'Responsável definido com sucesso.');
    } catch (error) {
        console.error('Erro ao assumir chamado:', error);
        return sendError(res, 500, 'Erro ao assumir chamado.', error.message);
    }
}

/**
 * Marca todos os comunicados como lidos para o usuário atual
 */
async function marcarTodosComunicadosLidos(req, res) {
    try {
        const usuario_id = req.session.usuario.id;

        // 1. Buscar todos os IDs de mensagens do tipo COMUNICADO
        const { data: comunicados, error: errBusca } = await supabase
            .from('comunicacao_mensagens')
            .select('id')
            .eq('tipo', 'COMUNICADO');

        if (errBusca) throw errBusca;
        if (!comunicados || comunicados.length === 0) return res.json({ success: true });

        const ids = comunicados.map(c => c.id);

        // 2. Para cada ID, garantir que existe um registro de leitura como LIDO
        // Em vez de fazer um por um, vamos usar o approach de:
        // - Marcar como lido os que já existem
        // - Opcional: Criar os que não existem (mas geralmente comunicados criam leituras para todos no disparo)

        const { error: errUpdate } = await supabase
            .from('comunicacao_leituras')
            .update({ lida: true, data_leitura: new Date().toISOString() })
            .in('mensagem_id', ids)
            .eq('usuario_id', usuario_id);

        if (errUpdate) throw errUpdate;

        return res.json({ success: true, message: 'Todos os comunicados marcados como lidos.' });
    } catch (error) {
        console.error('Erro ao marcar todos os comunicados como lidos:', error);
        return res.status(500).json({ success: false, error: 'Erro ao processar leituras.' });
    }
}

/**
 * Lista Tópicos de Ajuda (Categorias de Chamados) de forma paginada para o cadastro
 */
async function getAssuntosCompleto(req, res) {
    try {
        const { page = 1, limit = 20, search = '' } = req.query;
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const offset = (pageNum - 1) * limitNum;

        let query = supabase
            .from('cp_chamados_assuntos')
            .select('*, departamento:departamento_id(id, nome)', { count: 'exact' });

        if (search && search.trim()) {
            query = query.ilike('nome', `%${search.trim()}%`);
        }

        query = query.order('nome', { ascending: true });

        if (limitNum > 0) {
            query = query.range(offset, offset + limitNum - 1);
        }

        const { data, error, count } = await query;

        if (error) throw error;

        return sendSuccess(res, 200, data, null, {
            page: pageNum,
            limit: limitNum,
            total: count || 0,
            count: data.length
        });
    } catch (error) {
        console.error('Erro ao buscar assuntos completo:', error);
        return sendError(res, 500, 'Erro ao buscar assuntos.', error.message);
    }
}

/**
 * Busca um assunto por ID
 */
async function getAssuntoPorId(req, res) {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('cp_chamados_assuntos')
            .select('*, departamento:departamento_id(id, nome)')
            .eq('id', id)
            .maybeSingle();

        if (error) throw error;
        if (!data) return sendNotFound(res, 'Assunto');

        return sendSuccess(res, 200, data);
    } catch (error) {
        console.error('Erro ao buscar assunto por ID:', error);
        return sendError(res, 500, 'Erro ao buscar assunto.', error.message);
    }
}

/**
 * Cria um novo assunto
 */
async function criarAssunto(req, res) {
    try {
        const { nome, departamento_id, sla_horas, status, descricao } = req.body;

        if (!nome) return sendValidationError(res, 'Nome é obrigatório.');

        const { data, error } = await supabase
            .from('cp_chamados_assuntos')
            .insert({
                nome,
                departamento_id: departamento_id || null,
                sla_horas: sla_horas || 24,
                status: status || 'Ativo',
                descricao: descricao || ''
            })
            .select()
            .single();

        if (error) throw error;

        return sendCreated(res, data, 'Assunto criado com sucesso.');
    } catch (error) {
        console.error('Erro ao criar assunto:', error);
        return sendError(res, 500, 'Erro ao criar assunto.', error.message);
    }
}

/**
 * Atualiza um assunto existente
 */
async function atualizarAssunto(req, res) {
    try {
        const { id } = req.params;
        const { nome, departamento_id, sla_horas, status, descricao } = req.body;

        const updates = {};
        if (nome !== undefined) updates.nome = nome;
        if (departamento_id !== undefined) updates.departamento_id = departamento_id;
        if (sla_horas !== undefined) updates.sla_horas = sla_horas;
        if (status !== undefined) updates.status = status;
        if (descricao !== undefined) updates.descricao = descricao;

        const { data, error } = await supabase
            .from('cp_chamados_assuntos')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return sendSuccess(res, 200, data, 'Assunto atualizado com sucesso.');
    } catch (error) {
        console.error('Erro ao atualizar assunto:', error);
        return sendError(res, 500, 'Erro ao atualizar assunto.', error.message);
    }
}

/**
 * Deleta um assunto
 */
async function deletarAssunto(req, res) {
    try {
        const { id } = req.params;

        // Verificar se há mensagens usando este assunto
        const { count, error: errCheck } = await supabase
            .from('comunicacao_mensagens')
            .select('id', { count: 'exact', head: true })
            .eq('assunto_id', id);

        if (!errCheck && count > 0) {
            return sendError(res, 400, 'Não é possível excluir este assunto pois há chamados vinculados a ele. Tente desativá-lo.');
        }

        const { error } = await supabase
            .from('cp_chamados_assuntos')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return sendDeleted(res, { id }, 'Assunto excluído com sucesso.');
    } catch (error) {
        console.error('Erro ao excluir assunto:', error);
        return sendError(res, 500, 'Erro ao excluir assunto.', error.message);
    }
}

module.exports = {
    enviarMensagem,
    listarMensagensChat,
    listarConversasRecentes,
    listarComunicados,
    listarChamados,
    listarRespostasChamado,
    atualizarPrioridadeChamado,
    atualizarStatusChamado,
    marcarMensagemLida,
    listarComunicadoDestaque,
    atualizarMensagem,
    marcarTodosComunicadosLidos,
    listarCategorias,
    listarTemplates,
    confirmarEstimativaChamado,
    assumirChamado,
    getAssuntosCompleto,
    getAssuntoPorId,
    criarAssunto,
    atualizarAssunto,
    deletarAssunto
};
