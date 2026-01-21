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
            iniciar_timer // boolean: se true, já cria o registro em registro_tempo_pendente com data_inicio = now
        } = req.body;

        const usuario_id = req.session.usuario.id; // Usuário logado é OBRIGATORIAMENTE o criador/responsável

        // Validações básicas
        const missingFields = [];
        if (!cliente_id) missingFields.push('cliente_id');
        if (!produto_id) missingFields.push('produto_id');
        if (!tarefa_id) missingFields.push('tarefa_id');
        if (!data_inicio) missingFields.push('data_inicio');
        if (!data_fim) missingFields.push('data_fim');
        if (tempo_estimado_dia === undefined || tempo_estimado_dia === null) missingFields.push('tempo_estimado_dia');

        if (missingFields.length > 0) {
            console.error('Campos faltando no Plug Rápido:', missingFields, req.body);
            return res.status(400).json({ success: false, error: `Campos obrigatórios faltando: ${missingFields.join(', ')}` });
        }

        // 1. Criar a atribuição pendente (Com auditoria da intenção original)
        const { data: atribuicao, error: erroAtribuicao } = await supabase
            .schema('up_gestaointeligente')
            .from('atribuicoes_pendentes')
            .insert({
                usuario_id,

                // Dados atuais (podem ser alterados posteriormente pelo gestor)
                cliente_id,
                produto_id,
                tarefa_id,

                // Dados originais (Auditoria - Nunca devem ser alterados)
                cliente_id_original: cliente_id,
                produto_id_original: produto_id,
                tarefa_id_original: tarefa_id,

                data_inicio,
                data_fim,
                tempo_estimado_dia,
                status: 'PENDENTE'
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
            const { data: registro, error: erroRegistro } = await supabase
                .schema('up_gestaointeligente')
                .from('registro_tempo_pendente')
                .insert({
                    atribuicao_pendente_id: atribuicao.id,
                    usuario_id,
                    tarefa_id,
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
            .schema('up_gestaointeligente')
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
            clienteIds.length > 0 ? supabase.schema('up_gestaointeligente').from('cp_cliente').select('id, nome').in('id', clienteIds) : { data: [] },
            produtoIds.length > 0 ? supabase.schema('up_gestaointeligente').from('cp_produto').select('id, nome').in('id', produtoIds) : { data: [] },
            tarefaIds.length > 0 ? supabase.schema('up_gestaointeligente').from('tarefa').select('id, nome').in('id', tarefaIds) : { data: [] }
        ]);

        const clientesMap = new Map((clientesRes.data || []).map(c => [String(c.id), c]));
        const produtosMap = new Map((produtosRes.data || []).map(p => [String(p.id), p]));
        const tarefasMap = new Map((tarefasRes.data || []).map(t => [String(t.id), t]));

        // Buscar tempo acumulado para cada atribuição
        const atribuicoesComTempo = await Promise.all(pendentes.map(async (attr) => {
            const { data: tempos } = await supabase
                .schema('up_gestaointeligente')
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
 * Lista pendentes para aprovação (Apenas GESTOR)
 */
async function listarPendentesParaAprovacao(req, res) {
    try {
        const { data: pendentes, error } = await supabase
            .schema('up_gestaointeligente')
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
            clienteIds.length > 0 ? supabase.schema('up_gestaointeligente').from('cp_cliente').select('id, nome').in('id', clienteIds) : { data: [] },
            produtoIds.length > 0 ? supabase.schema('up_gestaointeligente').from('cp_produto').select('id, nome').in('id', produtoIds) : { data: [] },
            tarefaIds.length > 0 ? supabase.schema('up_gestaointeligente').from('tarefa').select('id, nome').in('id', tarefaIds) : { data: [] },
            usuarioIds.length > 0 ? supabase.schema('up_gestaointeligente').from('usuarios').select('id, nome_usuario, foto_perfil').in('id', usuarioIds) : { data: [] }
        ]);

        const clientesMap = new Map((clientesRes.data || []).map(c => [String(c.id), c]));
        const produtosMap = new Map((produtosRes.data || []).map(p => [String(p.id), p]));
        const tarefasMap = new Map((tarefasRes.data || []).map(t => [String(t.id), t]));
        const usuariosMap = new Map((usuariosRes.data || []).map(u => [String(u.id), u]));

        const dataEnriched = pendentes.map(p => ({
            ...p,
            usuario: usuariosMap.get(String(p.usuario_id)) || { nome_usuario: 'Desconhecido' },
            cliente: clientesMap.get(String(p.cliente_id)) || { nome: 'N/A' },
            produto: produtosMap.get(String(p.produto_id)) || { nome: 'N/A' },
            tarefa: tarefasMap.get(String(p.tarefa_id)) || { nome: 'N/A' }
        }));

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

/**
 * Aprova uma atribuição pendente.
 * REGRAS RÍGIDAS:
 * 1. Data e Responsável são IMUTÁVEIS (pegos do registro original)
 * 2. Cliente, Produto, Tarefa e Estimativa podem ser editados pelo gestor
 * 3. Migração de tempo deve ser normalizada (buscar tipo_tarefa correto)
 * 4. Status vira APROVADA e dados finais são salvos na pendência
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

        const gestor_id = req.session.usuario.id;

        // 1. Buscar a atribuição pendente original
        const { data: pendente, error: erroBusca } = await supabase
            .schema('up_gestaointeligente')
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
            usuario_id: pendente.usuario_id,
            data_inicio: pendente.data_inicio,
            data_fim: pendente.data_fim
        };

        // 2. Criar Agrupador ID
        const agrupador_id = uuidv4();

        // 3. Criar Historico de Atribuição (Oficial)
        const { error: erroHistorico } = await supabase
            .schema('up_gestaointeligente')
            .from('historico_atribuicoes')
            .insert({
                agrupador_id,
                cliente_id: dadosFinais.cliente_id,
                responsavel_id: dadosFinais.usuario_id,
                usuario_criador_id: pendente.usuario_id,
                produto_ids: [dadosFinais.produto_id],
                tarefas: [{ tarefa_id: dadosFinais.tarefa_id, tempo_estimado_dia: dadosFinais.tempo_estimado_dia }],
                data_inicio: dadosFinais.data_inicio,
                data_fim: dadosFinais.data_fim,
                created_at: new Date().toISOString()
            });

        if (erroHistorico) throw erroHistorico;

        // 4. Criar Regra de Tempo Estimado

        // Buscar/Descobrir tipo_tarefa_id para a tarefa FINAL
        let tipo_tarefa_id = null;
        if (dadosFinais.tarefa_id) {
            const { data: vinculo } = await supabase
                .schema('up_gestaointeligente')
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
                    .schema('up_gestaointeligente')
                    .from('tarefa')
                    .select('tipo_tarefa_id')
                    .eq('id', dadosFinais.tarefa_id)
                    .single();
                if (tarefa) tipo_tarefa_id = tarefa.tipo_tarefa_id;
            }
        }

        const { error: erroRegra } = await supabase
            .schema('up_gestaointeligente')
            .from('tempo_estimado_regra')
            .insert({
                agrupador_id,
                cliente_id: dadosFinais.cliente_id,
                produto_id: dadosFinais.produto_id,
                tarefa_id: dadosFinais.tarefa_id,
                responsavel_id: dadosFinais.usuario_id,
                data_inicio: dadosFinais.data_inicio,
                data_fim: dadosFinais.data_fim,
                tempo_estimado_dia: dadosFinais.tempo_estimado_dia,
                tipo_tarefa_id,
                incluir_finais_semana: true,
                incluir_feriados: true,
                created_by: gestor_id
            });

        if (erroRegra) throw erroRegra;

        // 5. Migrar Registro de Tempo Pendente -> Registro Tempo Oficial
        // NORMALIZAÇÃO: Usar os dados finais aprovados, não o que estava no pendente
        const { data: registrosPendentes } = await supabase
            .schema('up_gestaointeligente')
            .from('registro_tempo_pendente')
            .select('*')
            .eq('atribuicao_pendente_id', id);

        if (registrosPendentes && registrosPendentes.length > 0) {
            const registrosParaInserir = registrosPendentes.map(reg => {
                // Se o registro não tiver data_fim, precisamos fechar agora ou permitir migrar aberto?
                // Regra geral: Migramos, se estiver aberto, continua aberto no oficial? 
                // O sistema oficial suporta data_fim null (em andamento).

                return {
                    usuario_id: dadosFinais.usuario_id, // Garante que é o dono original
                    tarefa_id: dadosFinais.tarefa_id,   // Tarefa aprovada
                    cliente_id: dadosFinais.cliente_id, // Cliente aprovado
                    produto_id: dadosFinais.produto_id, // Produto aprovado
                    tarefa_tipo_id: tipo_tarefa_id,     // Tipo calculado corretamente
                    data_inicio: reg.data_inicio,
                    data_fim: reg.data_fim,
                    tempo_estimado_id: null, // Sem vínculo direto com regra antiga
                    observacao: 'Origem: Plug Rápido (Aprovado)',
                    bloqueado: true // TICKET 2: Bloquear edição/exclusão deste registro
                };
            });

            const { error: erroMigracao } = await supabase
                .schema('up_gestaointeligente')
                .from('registro_tempo')
                .insert(registrosParaInserir);

            if (erroMigracao) throw erroMigracao;
        }

        // 6. Atualizar status da pendência e persistir valores FINAIS
        // Isso garante histórico do que foi efetivamente aprovado
        const { error: erroUpdate } = await supabase
            .schema('up_gestaointeligente')
            .from('atribuicoes_pendentes')
            .update({
                status: 'APROVADA',
                aprovado_em: new Date().toISOString(),
                aprovado_por: gestor_id,

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

        // 1. Verificar se já existe timer ativo
        const { data: registroAberto } = await supabase
            .schema('up_gestaointeligente')
            .from('registro_tempo_pendente')
            .select('id')
            .eq('atribuicao_pendente_id', atribuicao_pendente_id)
            .eq('usuario_id', usuario_id)
            .is('data_fim', null)
            .maybeSingle();

        if (registroAberto) {
            return res.status(400).json({ success: false, error: 'Já existe um timer ativo para esta atribuição.' });
        }

        // 2. Buscar detalhes da atribuição para consistência
        const { data: atribuicao } = await supabase
            .schema('up_gestaointeligente')
            .from('atribuicoes_pendentes')
            .select('tarefa_id')
            .eq('id', atribuicao_pendente_id)
            .single();

        if (!atribuicao) {
            return res.status(404).json({ success: false, error: 'Atribuição não encontrada.' });
        }

        // 3. Iniciar novo timer
        const { data: novoRegistro, error } = await supabase
            .schema('up_gestaointeligente')
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
            .schema('up_gestaointeligente')
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
            .schema('up_gestaointeligente')
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


module.exports = {
    criarAtribuicaoPendente,
    listarMinhasPendentes,
    listarPendentesParaAprovacao,
    aprovarAtribuicao,
    iniciarTimerPendente,
    pararTimerPendente
};
