// =============================================================
// === CONTROLLER DE ATRIBUIÇÕES PENDENTES (PLUG RÁPIDO) ===
// =============================================================
// TICKET 4: DOCUMENTAÇÃO DE RELACIONAMENTOS (Sem FK Rígida)
// As tabelas 'atribuicoes_pendentes' e 'registro_tempo_pendente' possuem relações LÓGICAS com:
// - usuarios (usuario_id)
// - cp_cliente (cliente_id)
// - tarefa (tarefa_id)
// - cp_produto (produto_id)
// Decisão de design: Não impor FKs nesta fase para flexibilidade.
// =============================================================

const supabase = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const notificacoesController = require('./notificacoes.controller');
const { NOTIFICATION_TYPES } = require('../constants/notificationTypes');

// ========================================
// === CRIAÇÃO E GESTÃO ===
// ========================================

/**
 * Cria uma nova atribuição pendente (Plug Rápido)
 * Pode opcionalmente já iniciar o registro de tempo (cronômetro)
 */
async function criarAtribuicaoPendente(req, res) {
    try {
        const {
            cliente_id,
            produto_id,
            tarefa_id,
            data_inicio,
            data_fim,
            tempo_estimado_dia,
            iniciar_timer,
            nova_tarefa_criada, // Flag opcional vinda do front
            comentario_colaborador // Novo campo para casos sem tarefa definida
        } = req.body;

        const usuario_id = req.session.usuario.id; // Usuário logado é OBRIGATORIAMENTE o criador/responsável

        // Validações básicas
        const missingFields = [];

        // Se NÃO houver comentário, os IDs são obrigatórios
        if (!comentario_colaborador) {
            if (!cliente_id) missingFields.push('cliente_id');
            if (!produto_id) missingFields.push('produto_id');
            if (!tarefa_id) missingFields.push('tarefa_id');
        } else if (comentario_colaborador.length < 5) {
            return res.status(400).json({ success: false, error: 'O comentário deve ter pelo menos 5 caracteres.' });
        }

        if (!data_inicio) missingFields.push('data_inicio');
        if (!data_fim) missingFields.push('data_fim');
        if (tempo_estimado_dia === undefined || tempo_estimado_dia === null) missingFields.push('tempo_estimado_dia');

        if (missingFields.length > 0) {
            console.error('Campos faltando no Plug Rápido:', missingFields, req.body);
            return res.status(400).json({ success: false, error: `Campos obrigatórios faltando: ${missingFields.join(', ')}` });
        }

        console.log('📝 [Plug Rápido] Criando atribuição pendente:', {
            tarefa_id,
            nova_tarefa_criada: !!nova_tarefa_criada
        });

        // 0. Validação de duplicidade: mesma configuração (cliente, produto, tarefa, responsável, data) já existe (PENDENTE ou APROVADA)
        let query = supabase

            .from('atribuicoes_pendentes')
            .select('id, status')
            .eq('usuario_id', usuario_id)
            .in('status', ['PENDENTE', 'APROVADA'])
            .eq('data_inicio', data_inicio)
            .eq('data_fim', data_fim);

        if (comentario_colaborador) {
            query = query.eq('comentario_colaborador', comentario_colaborador);
        } else {
            if (cliente_id) query = query.eq('cliente_id', cliente_id);
            if (produto_id) query = query.eq('produto_id', produto_id);
            if (tarefa_id) query = query.eq('tarefa_id', tarefa_id);
        }

        const { data: existentes, error: erroCheck } = await query.limit(1);
        const existente = existentes && existentes.length > 0 ? existentes[0] : null;

        if (existente) {
            // Se já existe APROVADA: sempre bloquear
            if (existente.status === 'APROVADA') {
                return res.status(400).json({
                    success: false,
                    error: 'Essa configuração de atribuição já existe.'
                });
            }
            // Se já existe PENDENTE e o usuário pediu para iniciar timer, tentar iniciar o timer se não houver um
            if (iniciar_timer) {
                const { data: registroAh, error: erroAh } = await supabase

                    .from('registro_tempo_pendente')
                    .select('id')
                    .eq('atribuicao_pendente_id', existente.id)
                    .is('data_fim', null)
                    .maybeSingle();

                if (!registroAh) {
                    console.log('🔄 [Plug Rápido] Recuperando solicitação existente: Iniciando timer pendente...');

                    const { data: novoTimer, error: erroTimer } = await supabase

                        .from('registro_tempo_pendente')
                        .insert({
                            atribuicao_pendente_id: existente.id,
                            usuario_id,
                            tarefa_id: tarefa_id || null,
                            data_inicio: new Date().toISOString(),
                            status: 'PENDENTE'
                        })
                        .select()
                        .single();

                    if (erroTimer) {
                        console.error('❌ Erro ao recuperar timer:', erroTimer);
                        return res.status(400).json({
                            success: false,
                            error: 'Erro ao iniciar cronômetro. Verifique se a tarefa é obrigatória no banco de dados.'
                        });
                    }

                    return res.status(201).json({
                        success: true,
                        data: {
                            atribuicao: existente,
                            registroTempo: novoTimer
                        },
                        message: 'Cronômetro iniciado para a solicitação existente.'
                    });
                }
            }

            return res.status(400).json({
                success: false,
                error: 'Essa configuração de atribuição já existe.'
            });
        }

        // 1. Criar a atribuição pendente (Com auditoria da intenção original)
        // Sanitização: Converter strings vazias para null para evitar erro de tipo no Postgres (bigint/integer)
        const db_cliente_id = cliente_id || null;
        const db_produto_id = produto_id || null;
        const db_tarefa_id = tarefa_id || null;

        const { data: atribuicao, error: erroAtribuicao } = await supabase

            .from('atribuicoes_pendentes')
            .insert({
                usuario_id,

                // Dados atuais (podem ser alterados posteriormente pelo gestor)
                cliente_id: db_cliente_id,
                produto_id: db_produto_id,
                tarefa_id: db_tarefa_id,

                // Dados originais (Auditoria - Nunca devem ser alterados)
                cliente_id_original: db_cliente_id,
                produto_id_original: db_produto_id,
                tarefa_id_original: db_tarefa_id,

                data_inicio,
                data_fim,
                tempo_estimado_dia,
                status: 'PENDENTE',
                nova_tarefa_criada: nova_tarefa_criada || false,
                comentario_colaborador
            })
            .select()
            .single();

        if (erroAtribuicao) {
            console.error('Erro ao criar atribuição pendente:', erroAtribuicao);
            return res.status(500).json({ success: false, error: 'Erro ao criar atribuição pendente.' });
        }

        let registroTempo = null;

        // 2. Se solicitado, iniciar o timer
        if (iniciar_timer) {
            // [NOVO] Finalizar outros registros ativos antes de iniciar
            try {
                const agora = new Date().toISOString();

                // Finalizar registros normais
                const { data: ativosNormais } = await supabase
                    .from('registro_tempo')
                    .select('id, data_inicio')
                    .eq('usuario_id', usuario_id)
                    .is('data_fim', null);

                if (ativosNormais) {
                    for (const reg of ativosNormais) {
                        const tempoRealizado = Math.max(0, new Date(agora).getTime() - new Date(reg.data_inicio).getTime());
                        await supabase.from('registro_tempo').update({ data_fim: agora, tempo_realizado: tempoRealizado }).eq('id', reg.id);
                    }
                }

                // Finalizar outros registros pendentes
                const { data: ativosPendentes } = await supabase
                    .from('registro_tempo_pendente')
                    .select('id')
                    .eq('usuario_id', usuario_id)
                    .is('data_fim', null);

                if (ativosPendentes) {
                    for (const reg of ativosPendentes) {
                        await supabase.from('registro_tempo_pendente').update({ data_fim: agora }).eq('id', reg.id);
                    }
                }
            } catch (e) { console.error('Erro ao parar timers anteriores:', e); }

            const { data: registro, error: erroRegistro } = await supabase
                .from('registro_tempo_pendente')
                .insert({
                    atribuicao_pendente_id: atribuicao.id,
                    usuario_id,
                    tarefa_id: db_tarefa_id,
                    data_inicio: new Date().toISOString(),
                    status: 'PENDENTE'
                })
                .select()
                .single();

            if (erroRegistro) {
                console.error('Erro ao iniciar timer pendente:', erroRegistro);
                // Não falha a requisição inteira, mas avisa
            } else {
                registroTempo = registro;
            }
        }

        // --- GERAÇÃO DE NOTIFICAÇÕES (Sistema Inbox) ---
        try {
            // Buscar nomes para a mensagem
            let nomeCliente = 'Cliente não definido';
            if (cliente_id) {
                const { data: nomes } = await supabase
                    .from('cp_cliente')
                    .select('nome')
                    .eq('id', cliente_id)
                    .single();
                if (nomes) nomeCliente = nomes.nome;
            }
            const nomeUsuario = req.session.usuario.nome_usuario;

            // Alterado para usar o novo método de distribuição
            await notificacoesController.distribuirNotificacao({
                tipo: NOTIFICATION_TYPES.PLUG_RAPIDO,
                titulo: comentario_colaborador ? 'Plug sem Tarefa Definida' : 'Novo Plug Rápido',
                mensagem: comentario_colaborador
                    ? `${nomeUsuario} plugou sem tarefa: "${comentario_colaborador.substring(0, 30)}..."`
                    : `${nomeUsuario} solicitou Plug em ${nomeCliente}`,
                referencia_id: atribuicao.id,
                link: `/aprovacoes-pendentes?id=${atribuicao.id}`,
                metadata: {
                    usuario_id,
                    usuario_nome: nomeUsuario,
                    cliente_id,
                    cliente_nome: nomeCliente
                }
            });
        } catch (errNotif) {
            console.error('Erro ao disparar notificações de Plug Rápido:', errNotif);
        }

        return res.status(201).json({
            success: true,
            data: {
                atribuicao,
                registroTempo
            },
            message: 'Atribuição pendente criada com sucesso.'
        });

    } catch (error) {
        console.error('Erro no criarAtribuicaoPendente:', error);
        return res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
    }
}

/**
 * Lista atribuições pendentes do usuário logado
 */
async function listarMinhasPendentes(req, res) {
    try {
        const usuario_id = req.session.usuario.id;

        const { data: pendentes, error } = await supabase

            .from('atribuicoes_pendentes')
            .select('*')
            .eq('usuario_id', usuario_id)
            .eq('status', 'PENDENTE')
            .order('criado_em', { ascending: false });

        if (error) throw error;

        // Manual fetching of related data
        if (!pendentes || pendentes.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const clienteIds = [...new Set(pendentes.map(p => p.cliente_id).filter(Boolean))];
        const produtoIds = [...new Set(pendentes.map(p => p.produto_id).filter(Boolean))];
        const tarefaIds = [...new Set(pendentes.map(p => p.tarefa_id).filter(Boolean))];

        const [clientesRes, produtosRes, tarefasRes] = await Promise.all([
            clienteIds.length > 0 ? supabase.from('cp_cliente').select('id, nome').in('id', clienteIds) : { data: [] },
            produtoIds.length > 0 ? supabase.from('cp_produto').select('id, nome').in('id', produtoIds) : { data: [] },
            tarefaIds.length > 0 ? supabase.from('cp_tarefa').select('id, nome').in('id', tarefaIds) : { data: [] }
        ]);

        const clientesMap = new Map((clientesRes.data || []).map(c => [String(c.id), c]));
        const produtosMap = new Map((produtosRes.data || []).map(p => [String(p.id), p]));
        const tarefasMap = new Map((tarefasRes.data || []).map(t => [String(t.id), t]));

        // Buscar tempo acumulado para cada atribuição
        const atribuicoesComTempo = await Promise.all(pendentes.map(async (attr) => {
            const { data: tempos } = await supabase

                .from('registro_tempo_pendente')
                .select('data_inicio, data_fim')
                .eq('atribuicao_pendente_id', attr.id);

            let totalMs = 0;
            let timerAtivo = false;

            if (tempos) {
                tempos.forEach(t => {
                    if (!t.data_fim) {
                        timerAtivo = true;
                    }
                    const inicio = new Date(t.data_inicio).getTime();
                    const fim = t.data_fim ? new Date(t.data_fim).getTime() : Date.now();
                    totalMs += (fim - inicio);
                });
            }

            // Formatar tempo hh:mm:ss
            const totalSegundos = Math.floor(totalMs / 1000);
            const horas = Math.floor(totalSegundos / 3600);
            const minutos = Math.floor((totalSegundos % 3600) / 60);
            const segundos = totalSegundos % 60;
            const tempoRealizadoFmt = `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;

            return {
                ...attr,
                cliente: clientesMap.get(String(attr.cliente_id)) || { nome: 'N/A' },
                produto: produtosMap.get(String(attr.produto_id)) || { nome: 'N/A' },
                tarefa: tarefasMap.get(String(attr.tarefa_id)) || { nome: 'N/A' },
                tempo_realizado_ms: totalMs,
                tempo_realizado_formatado: tempoRealizadoFmt,
                timer_ativo: timerAtivo
            };
        }));

        return res.json({ success: true, data: atribuicoesComTempo });

    } catch (error) {
        console.error('Erro ao listar pendentes:', error);
        return res.status(500).json({ success: false, error: 'Erro ao listar atribuições pendentes.' });
    }
}

/**
 * Lista configurações de atribuição já existentes (PENDENTE + APROVADA) do usuário logado.
 * Usado pelo front para bloquear duplicidade antes de salvar (mesmo cliente, produto, tarefa, data).
 */
async function listarConfiguracoesExistentes(req, res) {
    try {
        const usuario_id = req.session.usuario.id;

        const { data: listas, error } = await supabase

            .from('atribuicoes_pendentes')
            .select('cliente_id, produto_id, tarefa_id, data_inicio, data_fim, comentario_colaborador')
            .eq('usuario_id', usuario_id)
            .in('status', ['PENDENTE', 'APROVADA']);

        if (error) throw error;

        const data = listas || [];
        return res.json({ success: true, data });
    } catch (error) {
        console.error('Erro ao listar configurações existentes:', error);
        return res.status(500).json({ success: false, error: 'Erro ao listar configurações.' });
    }
}

/**
 * Lista pendentes para aprovação (Apenas GESTOR)
 */
async function listarPendentesParaAprovacao(req, res) {
    try {
        const { data: pendentes, error } = await supabase

            .from('atribuicoes_pendentes')
            .select('*')
            .eq('status', 'PENDENTE')
            .order('criado_em', { ascending: true });

        if (error) throw error;

        if (!pendentes || pendentes.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const clienteIds = [...new Set(pendentes.map(p => p.cliente_id).filter(Boolean))];
        const produtoIds = [...new Set(pendentes.map(p => p.produto_id).filter(Boolean))];
        const tarefaIds = [...new Set(pendentes.map(p => p.tarefa_id).filter(Boolean))];
        const usuarioIds = [...new Set(pendentes.map(p => p.usuario_id).filter(Boolean))];

        const [clientesRes, produtosRes, tarefasRes, usuariosRes] = await Promise.all([
            clienteIds.length > 0 ? supabase.from('cp_cliente').select('id, nome').in('id', clienteIds) : { data: [] },
            produtoIds.length > 0 ? supabase.from('cp_produto').select('id, nome').in('id', produtoIds) : { data: [] },
            tarefaIds.length > 0 ? supabase.from('cp_tarefa').select('id, nome').in('id', tarefaIds) : { data: [] },
            usuarioIds.length > 0 ? supabase.from('usuarios').select('id, nome_usuario, foto_perfil').in('id', usuarioIds) : { data: [] }
        ]);

        const clientesMap = new Map((clientesRes.data || []).map(c => [String(c.id), c]));
        const produtosMap = new Map((produtosRes.data || []).map(p => [String(p.id), p]));
        const tarefasMap = new Map((tarefasRes.data || []).map(t => [String(t.id), t]));
        const usuariosMap = new Map((usuariosRes.data || []).map(u => [String(u.id), u]));

        // Buscar tempos acumulados para TODAS as pendências listadas (Otimizado)
        const pendentesIds = pendentes.map(p => p.id);
        const { data: todosTempos } = await supabase

            .from('registro_tempo_pendente')
            .select('atribuicao_pendente_id, data_inicio, data_fim')
            .in('atribuicao_pendente_id', pendentesIds);

        // Agrupar tempos por atribuição id
        const temposMap = new Map();
        if (todosTempos) {
            todosTempos.forEach(t => {
                const id = String(t.atribuicao_pendente_id);
                const inicio = new Date(t.data_inicio).getTime();
                const fim = t.data_fim ? new Date(t.data_fim).getTime() : Date.now();
                const diff = fim - inicio;

                temposMap.set(id, (temposMap.get(id) || 0) + diff);
            });
        }

        const dataEnriched = pendentes.map(p => {
            const totalMs = temposMap.get(String(p.id)) || 0;
            const totalSegundos = Math.floor(totalMs / 1000);
            const h = Math.floor(totalSegundos / 3600);
            const m = Math.floor((totalSegundos % 3600) / 60);
            const s = totalSegundos % 60;
            const tempoFmt = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

            return {
                ...p,
                usuario: usuariosMap.get(String(p.usuario_id)) || { nome_usuario: 'Desconhecido' },
                cliente: clientesMap.get(String(p.cliente_id)) || { nome: 'N/A' },
                produto: produtosMap.get(String(p.produto_id)) || { nome: 'N/A' },
                tarefa: tarefasMap.get(String(p.tarefa_id)) || { nome: 'N/A' },
                tempo_realizado_ms: totalMs,
                tempo_realizado_formatado: tempoFmt
            };
        });

        return res.json({ success: true, data: dataEnriched });
    } catch (error) {
        console.error('Erro ao listar para aprovação:', error);
        return res.status(500).json({ success: false, error: 'Erro interno.' });
    }
}

// ========================================
// === APROVAÇÃO ===
// ========================================

// ========================================
// === APROVAÇÃO ===
// ========================================

// ========================================
// === APROVAÇÃO ===
// ========================================

/**
 * Aprova uma atribuição pendente.
 * REGRAS RÍGIDAS:
 * 1. Data e Responsável são IMUTÁVEIS (pegos do registro original)
 * 2. Cliente, Produto, Tarefa e Estimativa podem ser editados pelo gestor
 * 3. Migração de tempo deve ser normalizada (buscar tipo_tarefa correto)
 * 4. Status vira APROVADA e dados finais são salvos na pendência
 * 
 * CORREÇÃO DE FKs (Ticket 500 Error):
 * - historico_atribuicoes e tempo_estimado_regra usam membro_id (responsavel_id)
 * - registro_tempo usa usuario_id (usuarios.id)
 * - Precisamos converter usuario_id -> membro_id para as tabelas de histórico/regra
 */
async function aprovarAtribuicao(req, res) {
    try {
        const { id } = req.params;
        const {
            cliente_id,
            produto_id,
            tarefa_id,
            tempo_estimado_dia // Pode ser alterado pelo gestor
        } = req.body;

        const gestor_usuario_id = req.session.usuario.id;

        // 1. Buscar a atribuição pendente original
        const { data: pendente, error: erroBusca } = await supabase

            .from('atribuicoes_pendentes')
            .select('*')
            .eq('id', id)
            .single();

        if (erroBusca || !pendente) {
            return res.status(404).json({ success: false, error: 'Atribuição pendente não encontrada.' });
        }

        if (pendente.status !== 'PENDENTE') {
            return res.status(400).json({ success: false, error: 'Esta atribuição já foi processada.' });
        }

        // Definir dados finais (Aprovados)
        // Regra: Usar body se fornecido (edição), senão original
        const dadosFinais = {
            cliente_id: cliente_id || pendente.cliente_id,
            produto_id: produto_id || pendente.produto_id,
            tarefa_id: tarefa_id || pendente.tarefa_id,
            tempo_estimado_dia: tempo_estimado_dia || pendente.tempo_estimado_dia,

            // IMUTÁVEIS (Regra de Negócio)
            usuario_id: pendente.usuario_id, // ID da tabela USUARIOS
            data_inicio: pendente.data_inicio,
            data_fim: pendente.data_fim
        };

        // VALIDAÇÃO CRÍTICA: Se era um plug sem tarefa, agora OBRIGATORIAMENTE precisa ter IDs
        if (!dadosFinais.cliente_id || !dadosFinais.produto_id || !dadosFinais.tarefa_id) {
            return res.status(400).json({
                success: false,
                error: 'Para aprovar, você deve preencher Cliente, Produto e Tarefa.'
            });
        }

        // --- RESOLUÇÃO DE MEMBRO_ID ---
        // As tabelas historico_atribuicoes e tempo_estimado_regra exigem IDs da tabela MEMBRO,
        // mas nós temos IDs da tabela USUARIOS. Precisamos fazer a conversão.

        // Buscar Membro ID do Responsável
        const { data: membroResponsavel, error: errMembroResp } = await supabase

            .from('membro')
            .select('id')
            .eq('usuario_id', dadosFinais.usuario_id)
            .limit(1)
            .maybeSingle();

        if (errMembroResp || !membroResponsavel) {
            console.error('Erro ao buscar membro para usuário:', dadosFinais.usuario_id, errMembroResp);
            return res.status(400).json({
                success: false,
                error: 'Usuário responsável não possui cadastro de membro vinculado. Necessário vincular em Colaboradores.'
            });
        }
        const responsavel_membro_id = membroResponsavel.id;

        // Buscar Membro ID do Gestor (para auditoria criador)
        const { data: membroGestor, error: errMembroGestor } = await supabase

            .from('membro')
            .select('id')
            .eq('usuario_id', gestor_usuario_id)
            .limit(1)
            .maybeSingle();

        // Se gestor não tiver membro, fallback para o próprio responsável ou null (mas geralmente tem)
        // historico_atribuicoes exige usuario_criador_id NOT NULL e FK membro
        if (!membroGestor) {
            return res.status(400).json({
                success: false,
                error: 'Você (Gestor) não possui cadastro de membro vinculado. Contate o administrador.'
            });
        }
        const gestor_membro_id = membroGestor.id;

        // 2. Criar Agrupador ID
        const agrupador_id = uuidv4();

        // 3. Criar Historico de Atribuição (Oficial) - Usa membro_id | origem Plug Rápido
        const { error: erroHistorico } = await supabase

            .from('historico_atribuicoes')
            .insert({
                agrupador_id,
                cliente_id: dadosFinais.cliente_id,
                responsavel_id: responsavel_membro_id, // FK membro
                usuario_criador_id: gestor_membro_id,  // FK membro (quem aprovou/criou o oficial)
                produto_ids: [dadosFinais.produto_id],
                tarefas: [{ tarefa_id: dadosFinais.tarefa_id, tempo_estimado_dia: dadosFinais.tempo_estimado_dia }],
                data_inicio: dadosFinais.data_inicio,
                data_fim: dadosFinais.data_fim,
                is_plug_rapido: true,
                created_at: new Date().toISOString()
            });

        if (erroHistorico) {
            console.error('Erro ao inserir historico:', erroHistorico);
            throw erroHistorico;
        }

        // 4. Criar Regra de Tempo Estimado - Usa membro_id

        // Buscar/Descobrir tipo_tarefa_id para a tarefa FINAL
        let tipo_tarefa_id = null;
        if (dadosFinais.tarefa_id) {
            const { data: vinculo } = await supabase

                .from('vinculados') // Tenta buscar em vinculados primeiro
                .select('tarefa_tipo_id')
                .eq('tarefa_id', dadosFinais.tarefa_id)
                .limit(1)
                .maybeSingle();

            if (vinculo && vinculo.tarefa_tipo_id) {
                tipo_tarefa_id = vinculo.tarefa_tipo_id;
            } else {
                // Fallback: tabela tarefa
                const { data: tarefa } = await supabase

                    .from('cp_tarefa')
                    .select('tipo_tarefa_id')
                    .eq('id', dadosFinais.tarefa_id)
                    .single();
                if (tarefa) tipo_tarefa_id = tarefa.tipo_tarefa_id;
            }
        }

        const { error: erroRegra } = await supabase

            .from('tempo_estimado_regra')
            .insert({
                agrupador_id,
                cliente_id: dadosFinais.cliente_id,
                produto_id: dadosFinais.produto_id,
                tarefa_id: dadosFinais.tarefa_id,
                responsavel_id: responsavel_membro_id, // FK membro (assumido pela lógica do sistema)
                data_inicio: dadosFinais.data_inicio,
                data_fim: dadosFinais.data_fim,
                tempo_estimado_dia: dadosFinais.tempo_estimado_dia,
                tipo_tarefa_id,
                incluir_finais_semana: true,
                incluir_feriados: true,
                is_plug_rapido: true,
                created_by: gestor_membro_id // membro_id do criador
            });

        if (erroRegra) {
            console.error('Erro ao inserir regra:', erroRegra);
            throw erroRegra;
        }

        // 5. Migrar Registro de Tempo Pendente -> Registro Tempo Oficial
        // NORMALIZAÇÃO: Usar os dados finais aprovados, não o que estava no pendente
        // NOTA: Tabela registro_tempo usa USUARIO_ID (tabela usuarios), então usamos dadosFinais.usuario_id
        const { data: registrosPendentes } = await supabase

            .from('registro_tempo_pendente')
            .select('*')
            .eq('atribuicao_pendente_id', id);

        if (registrosPendentes && registrosPendentes.length > 0) {
            const registrosParaInserir = registrosPendentes.map(reg => {
                // Calcular tempo_realizado se houver data_fim (materialização do tempo)
                let tempo_realizado = null;
                if (reg.data_inicio && reg.data_fim) {
                    const inicio = new Date(reg.data_inicio).getTime();
                    const fim = new Date(reg.data_fim).getTime();
                    tempo_realizado = Math.max(0, fim - inicio);
                }

                return {
                    id: uuidv4(), // Gerar ID manualmente pois o banco não tem default
                    usuario_id: dadosFinais.usuario_id, // Tabela USUARIOS (Correto para registro_tempo)
                    tarefa_id: dadosFinais.tarefa_id,   // Tarefa aprovada
                    cliente_id: dadosFinais.cliente_id, // Cliente aprovado
                    produto_id: dadosFinais.produto_id, // Produto aprovado
                    tipo_tarefa_id: tipo_tarefa_id,     // Tipo calculado corretamente (campo correto é tipo_tarefa_id)
                    data_inicio: reg.data_inicio,
                    data_fim: reg.data_fim,
                    tempo_realizado,
                    bloqueado: false // TICKET 2: Bloqueio removido por solicitação do usuário
                };
            });

            console.log('DEBUG: payload insert registro_tempo:', JSON.stringify(registrosParaInserir, null, 2));

            const { error: erroMigracao } = await supabase

                .from('registro_tempo')
                .insert(registrosParaInserir);

            if (erroMigracao) {
                console.error('Erro registro_tempo insert:', erroMigracao);
                throw erroMigracao;
            }

            // [FIX] Remover registros da tabela pendente para evitar duplicação em getRegistrosAtivos
            // Como já foram migrados para a tabela oficial, não precisam mais existir na pendente
            const idsParaDeletar = registrosPendentes.map(r => r.id);
            if (idsParaDeletar.length > 0) {
                const { error: erroDelete } = await supabase

                    .from('registro_tempo_pendente')
                    .delete()
                    .in('id', idsParaDeletar);

                if (erroDelete) {
                    console.error('Erro ao limpar registro_tempo_pendente:', erroDelete);
                    // Não lançar erro fatal, pois a migração principal já ocorreu
                }
            }
        }

        // 6. Atualizar status da pendência e persistir valores FINAIS
        // Isso garante histórico do que foi efetivamente aprovado
        const { error: erroUpdate } = await supabase

            .from('atribuicoes_pendentes')
            .update({
                status: 'APROVADA',
                aprovado_em: new Date().toISOString(),
                aprovado_por: gestor_usuario_id, // Mantemos ID de usuário aqui para saber login

                // Gravar os dados finais na própria tabela para auditoria fácil
                cliente_id: dadosFinais.cliente_id,
                produto_id: dadosFinais.produto_id,
                tarefa_id: dadosFinais.tarefa_id,
                tempo_estimado_dia: dadosFinais.tempo_estimado_dia
            })
            .eq('id', id);

        if (erroUpdate) throw erroUpdate;

        res.json({ success: true, message: 'Atribuição aprovada e processada com sucesso.' });

    } catch (error) {
        console.error('Erro na aprovação:', error);
        res.status(500).json({ success: false, error: 'Falha ao processar aprovação.' });
    }
}

// ========================================
// === CONTROLE DE TIMER PENDENTE ===
// ========================================

async function iniciarTimerPendente(req, res) {
    try {
        const { atribuicao_pendente_id } = req.body;
        const usuario_id = req.session.usuario.id;

        // 1. Finalizar qualquer timer ativo para este usuário (normal ou pendente)
        // Isso garante que apenas UM timer esteja ativo por vez.
        try {
            const agora = new Date().toISOString();

            // Finalizar registros normais
            const { data: ativosNormais } = await supabase
                .from('registro_tempo')
                .select('id, data_inicio')
                .eq('usuario_id', usuario_id)
                .is('data_fim', null);

            if (ativosNormais) {
                for (const reg of ativosNormais) {
                    const tempoRealizado = Math.max(0, new Date(agora).getTime() - new Date(reg.data_inicio).getTime());
                    await supabase.from('registro_tempo').update({ data_fim: agora, tempo_realizado: tempoRealizado }).eq('id', reg.id);
                }
            }

            // Finalizar outros registros pendentes
            const { data: ativosPendentes } = await supabase
                .from('registro_tempo_pendente')
                .select('id')
                .eq('usuario_id', usuario_id)
                .is('data_fim', null);

            if (ativosPendentes) {
                for (const reg of ativosPendentes) {
                    await supabase.from('registro_tempo_pendente').update({ data_fim: agora }).eq('id', reg.id);
                }
            }
        } catch (e) {
            console.error('Erro ao parar timers anteriores:', e);
        }

        // 2. Buscar detalhes da atribuição para consistência
        const { data: atribuicao } = await supabase

            .from('atribuicoes_pendentes')
            .select('tarefa_id')
            .eq('id', atribuicao_pendente_id)
            .single();

        if (!atribuicao) {
            return res.status(404).json({ success: false, error: 'Atribuição não encontrada.' });
        }

        // 3. Iniciar novo timer
        const { data: novoRegistro, error } = await supabase

            .from('registro_tempo_pendente')
            .insert({
                atribuicao_pendente_id: atribuicao_pendente_id,
                usuario_id,
                tarefa_id: atribuicao.tarefa_id,
                data_inicio: new Date().toISOString(),
                status: 'PENDENTE'
            })
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, data: novoRegistro });

    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: 'Erro ao iniciar timer.' });
    }
}

async function pararTimerPendente(req, res) {
    try {
        const { atribuicao_pendente_id } = req.body;
        const usuario_id = req.session.usuario.id;

        const { data: registroAberto } = await supabase

            .from('registro_tempo_pendente')
            .select('id')
            .eq('atribuicao_pendente_id', atribuicao_pendente_id)
            .eq('usuario_id', usuario_id)
            .is('data_fim', null)
            .maybeSingle();

        if (!registroAberto) {
            return res.status(404).json({ success: false, error: 'Nenhum timer ativo para esta atribuição.' });
        }

        const { error } = await supabase

            .from('registro_tempo_pendente')
            .update({ data_fim: new Date().toISOString() })
            .eq('id', registroAberto.id);


        if (error) throw error;
        res.json({ success: true });

    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: 'Erro ao parar timer.' });
    }
}


/**
 * Edita um registro pendente (Plug Rápido) pelo próprio colaborador
 * Atualiza registro_tempo_pendente (timer) e atribuicoes_pendentes (config)
 */
async function editarPendentePeloColaborador(req, res) {
    try {
        const { id: registroId } = req.params;
        const usuario_id = req.session?.usuario?.id;
        if (!usuario_id) {
            return res.status(401).json({ success: false, error: 'Não autenticado.' });
        }

        const {
            data_inicio,
            data_fim,
            cliente_id,
            produto_id,
            tarefa_id,
            periodo_inicio,
            periodo_fim,
            tempo_estimado_ms,
            tempo_estimado_dia
        } = req.body;

        if (!registroId) {
            return res.status(400).json({ success: false, error: 'ID do registro é obrigatório.' });
        }

        // Buscar registro e validar propriedade
        const { data: registro, error: errReg } = await supabase
            .from('registro_tempo_pendente')
            .select('id, usuario_id, atribuicao_pendente_id')
            .eq('id', registroId)
            .single();

        if (errReg || !registro) {
            return res.status(404).json({ success: false, error: 'Registro pendente não encontrado.' });
        }
        if (Number(registro.usuario_id) !== Number(usuario_id)) {
            return res.status(403).json({ success: false, error: 'Só é possível editar seus próprios registros pendentes.' });
        }

        const attrId = registro.atribuicao_pendente_id;
        if (!attrId) {
            return res.status(400).json({ success: false, error: 'Atribuição vinculada não encontrada.' });
        }

        // Atualizar registro_tempo_pendente (timer)
        const updatesRegistro = {};
        if (data_inicio) updatesRegistro.data_inicio = data_inicio;
        if (data_fim) updatesRegistro.data_fim = data_fim;
        if (tarefa_id !== undefined) updatesRegistro.tarefa_id = tarefa_id || null;

        if (Object.keys(updatesRegistro).length > 0) {
            const { error: errUpdReg } = await supabase
                .from('registro_tempo_pendente')
                .update(updatesRegistro)
                .eq('id', registroId);
            if (errUpdReg) {
                console.error('Erro ao atualizar registro_tempo_pendente:', errUpdReg);
                return res.status(500).json({ success: false, error: 'Erro ao atualizar registro de tempo.' });
            }
        }

        // Atualizar atribuicoes_pendentes (config Plug Rápido)
        const updatesAttr = {};
        if (cliente_id !== undefined) updatesAttr.cliente_id = cliente_id || null;
        if (produto_id !== undefined) updatesAttr.produto_id = produto_id || null;
        if (tarefa_id !== undefined) updatesAttr.tarefa_id = tarefa_id || null;
        if (periodo_inicio) updatesAttr.data_inicio = `${periodo_inicio}T00:00:00`;
        if (periodo_fim) updatesAttr.data_fim = `${periodo_fim}T23:59:59`;

        const tempoEst = tempo_estimado_ms ?? tempo_estimado_dia;
        if (tempoEst !== undefined && tempoEst !== null) {
            updatesAttr.tempo_estimado_dia = tempoEst;
        }

        if (Object.keys(updatesAttr).length > 0) {
            const { error: errUpdAttr } = await supabase
                .from('atribuicoes_pendentes')
                .update(updatesAttr)
                .eq('id', attrId)
                .eq('status', 'PENDENTE');
            if (errUpdAttr) {
                console.error('Erro ao atualizar atribuicoes_pendentes:', errUpdAttr);
                return res.status(500).json({ success: false, error: 'Erro ao atualizar atribuição.' });
            }
        }

        return res.json({ success: true, message: 'Registro pendente atualizado com sucesso.' });
    } catch (error) {
        console.error('Erro ao editar pendente:', error);
        return res.status(500).json({ success: false, error: 'Erro ao editar registro pendente.' });
    }
}

/**
 * Conta o total de atribuições pendentes
 */
async function contarPendentes(req, res) {
    try {
        const { count, error } = await supabase

            .from('atribuicoes_pendentes')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'PENDENTE');

        if (error) throw error;

        return res.json({ success: true, count: count || 0 });
    } catch (error) {
        console.error('Erro ao contar pendentes:', error);
        return res.status(500).json({ success: false, error: 'Erro ao contar pendências.' });
    }
}


module.exports = {
    criarAtribuicaoPendente,
    listarMinhasPendentes,
    listarConfiguracoesExistentes,
    listarPendentesParaAprovacao,
    contarPendentes,
    aprovarAtribuicao,
    iniciarTimerPendente,
    pararTimerPendente,
    editarPendentePeloColaborador
};
