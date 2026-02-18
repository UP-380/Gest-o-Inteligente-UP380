// =============================================================
// === CONTROLLER DE EQUIPAMENTOS ===
// =============================================================

const supabase = require('../config/database');

// GET - Listar equipamentos com paginação e busca
async function getEquipamentos(req, res) {
    try {
        const { page = 1, limit = 5, search = '' } = req.query;
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const offset = (pageNum - 1) * limitNum;

        let query = supabase
            .from('cp_equipamentos')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false });

        // Aplicar busca (case insensitive)
        if (search) {
            // Busca em nome, marca ou modelo
            query = query.or(`nome.ilike.%${search}%,marca.ilike.%${search}%,modelo.ilike.%${search}%`);
        }

        // Aplicar paginação
        if (limitNum > 0) {
            query = query.range(offset, offset + limitNum - 1);
        }

        const { data, error, count } = await query;

        if (error) {
            console.error('❌ Erro ao buscar equipamentos:', error);
            return res.status(500).json({
                success: false,
                error: 'Erro ao buscar equipamentos',
                details: error.message
            });
        }

        // 5. Buscar atribuições ativas para os equipamentos listados
        let equipamentosComUsuario = data || [];
        const equipIds = data?.map(e => e.id) || [];

        if (equipIds.length > 0) {
            const { data: atribuicoes, error: atrError } = await supabase
                .from('cp_equipamento_atribuicoes')
                .select('equipamento_id, colaborador_id, data_retirada, horario_trabalho_inicio, horario_trabalho_fim')
                .in('equipamento_id', equipIds)
                .is('data_devolucao', null);

            if (!atrError && atribuicoes?.length > 0) {
                // Pegar os IDs dos colaboradores para buscar os nomes
                const colabIds = [...new Set(atribuicoes.map(a => a.colaborador_id))];

                const { data: membros, error: mErr } = await supabase
                    .schema('up_gestaointeligente_dev')
                    .from('membro')
                    .select('id, nome')
                    .in('id', colabIds);

                if (!mErr && membros) {
                    const membrosMap = Object.fromEntries(membros.map(m => {
                        // MOCK: Simular horários de trabalho (Isso deve vir do banco futuramente)
                        // Ex: IDs pares = 08:00 - 14:00 (Como pedido no exemplo)
                        // Ex: IDs ímpares = 09:00 - 18:00
                        const isMorningShift = m.id % 2 === 0;
                        return [m.id, {
                            nome: m.nome,
                            horario_entrada: isMorningShift ? '08:00' : '09:00',
                            horario_saida: isMorningShift ? '14:00' : '18:00'
                        }];
                    }));

                    const atrMap = {};

                    atribuicoes.forEach(a => {
                        const membro = membros.find(m => m.id === a.colaborador_id);
                        const nomeMembro = membro ? membro.nome : 'Desconhecido';

                        // Fake schedule logic (mock) - keep consistent with previous logic
                        // In real production, this should come from 'membro' record or 'atribuicao' record 
                        const isMorningShift = a.colaborador_id % 2 === 0;
                        const mockEntrada = isMorningShift ? '08:00' : '09:00';
                        const mockSaida = isMorningShift ? '14:00' : '18:00';

                        const userObj = {
                            id: a.colaborador_id,
                            nome: nomeMembro,
                            horario_entrada: a.horario_trabalho_inicio || mockEntrada,
                            horario_saida: a.horario_trabalho_fim || mockSaida
                        };

                        if (!atrMap[a.equipamento_id]) {
                            atrMap[a.equipamento_id] = [];
                        }
                        atrMap[a.equipamento_id].push(userObj);
                    });

                    equipamentosComUsuario = data.map(e => ({
                        ...e,
                        usuarios_atuais: atrMap[e.id] || [],
                        usuario_atual: atrMap[e.id]?.[0] || null
                    }));
                }
            }
        }

        return res.json({
            success: true,
            data: equipamentosComUsuario,
            count: equipamentosComUsuario.length,
            total: count || 0,
            page: pageNum,
            limit: limitNum
        });
    } catch (error) {
        console.error('Erro inesperado ao buscar equipamentos:', error);
        return res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            details: error.message
        });
    }
}

// GET - Buscar equipamento por ID
async function getEquipamentoPorId(req, res) {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'ID do equipamento é obrigatório'
            });
        }

        const { data, error } = await supabase
            .from('cp_equipamentos')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) {
            console.error('Erro ao buscar equipamento:', error);
            return res.status(500).json({
                success: false,
                error: 'Erro ao buscar equipamento',
                details: error.message
            });
        }

        if (!data) {
            return res.status(404).json({
                success: false,
                error: 'Equipamento não encontrado'
            });
        }

        return res.json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error('Erro inesperado ao buscar equipamento:', error);
        return res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            details: error.message
        });
    }
}

// POST - Criar novo equipamento
async function criarEquipamento(req, res) {
    try {
        console.log('📦 Recebendo requisição para criar equipamento. Body size:', JSON.stringify(req.body).length);
        const {
            nome,
            tipo,
            marca,
            modelo,
            numero_serie,
            data_aquisicao,
            foto,
            status,
            descricao,
            tem_avaria
        } = req.body;

        // Validação básica
        if (!nome || !tipo) {
            return res.status(400).json({
                success: false,
                error: 'Nome e Tipo são obrigatórios'
            });
        }

        // Função auxiliar para limpar valores
        const cleanValue = (value) => {
            if (value === undefined || value === null || value === '') {
                return null;
            }
            const trimmed = String(value).trim();
            return trimmed === '' ? null : trimmed;
        };

        const dadosInsert = {
            nome: cleanValue(nome),
            tipo: cleanValue(tipo),
            marca: cleanValue(marca),
            modelo: cleanValue(modelo),
            numero_serie: cleanValue(numero_serie),
            data_aquisicao: cleanValue(data_aquisicao),
            foto: cleanValue(foto),
            status: cleanValue(status) || 'ativo',
            descricao: cleanValue(descricao),
            tem_avaria: !!tem_avaria
        };

        const { data, error } = await supabase
            .from('cp_equipamentos')
            .insert([dadosInsert])
            .select()
            .single();

        if (error) {
            console.error('Erro ao criar equipamento:', error);
            return res.status(500).json({
                success: false,
                error: 'Erro ao criar equipamento',
                details: error.message
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Equipamento criado com sucesso',
            data: data
        });
    } catch (error) {
        console.error('Erro inesperado ao criar equipamento:', error);
        return res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            details: error.message
        });
    }
}

// PUT - Atualizar equipamento
async function atualizarEquipamento(req, res) {
    try {
        const { id } = req.params;
        console.log(`📦 Recebendo requisição para atualizar equipamento ${id}. Body size:`, JSON.stringify(req.body).length);
        const {
            nome,
            tipo,
            marca,
            modelo,
            numero_serie,
            data_aquisicao,
            foto,
            status,
            descricao,
            tem_avaria
        } = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'ID do equipamento é obrigatório'
            });
        }

        // Função auxiliar para limpar valores
        const cleanValue = (value) => {
            if (value === undefined || value === null || value === '') {
                return null;
            }
            const trimmed = String(value).trim();
            return trimmed === '' ? null : trimmed;
        };

        const dadosUpdate = {};
        if (nome !== undefined) dadosUpdate.nome = cleanValue(nome);
        if (tipo !== undefined) dadosUpdate.tipo = cleanValue(tipo);
        if (marca !== undefined) dadosUpdate.marca = cleanValue(marca);
        if (modelo !== undefined) dadosUpdate.modelo = cleanValue(modelo);
        if (numero_serie !== undefined) dadosUpdate.numero_serie = cleanValue(numero_serie);
        if (data_aquisicao !== undefined) dadosUpdate.data_aquisicao = cleanValue(data_aquisicao);
        if (foto !== undefined) dadosUpdate.foto = cleanValue(foto);
        if (status !== undefined) dadosUpdate.status = cleanValue(status);
        if (descricao !== undefined) dadosUpdate.descricao = cleanValue(descricao);
        if (tem_avaria !== undefined) dadosUpdate.tem_avaria = !!tem_avaria;

        if (Object.keys(dadosUpdate).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Nenhum dado fornecido para atualização'
            });
        }

        const { data, error } = await supabase
            .from('cp_equipamentos')
            .update(dadosUpdate)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Erro ao atualizar equipamento:', error);
            return res.status(500).json({
                success: false,
                error: 'Erro ao atualizar equipamento',
                details: error.message
            });
        }

        return res.json({
            success: true,
            message: 'Equipamento atualizado com sucesso',
            data: data
        });
    } catch (error) {
        console.error('Erro inesperado ao atualizar equipamento:', error);
        return res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            details: error.message
        });
    }
}

// DELETE - Remover equipamento
async function deletarEquipamento(req, res) {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'ID do equipamento é obrigatório'
            });
        }

        const { error } = await supabase
            .from('cp_equipamentos')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Erro ao deletar equipamento:', error);
            return res.status(500).json({
                success: false,
                error: 'Erro ao deletar equipamento',
                details: error.message
            });
        }

        return res.json({
            success: true,
            message: 'Equipamento removido com sucesso'
        });
    } catch (error) {
        console.error('Erro inesperado ao deletar equipamento:', error);
        return res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            details: error.message
        });
    }
}

// POST - Atribuir equipamento a um colaborador
async function atribuirEquipamento(req, res) {
    try {
        const { equipamento_id, colaborador_id, observacoes, horario_entrada, horario_saida } = req.body;
        const admin_id = req.session?.usuario?.id; // Usando o id da sessão

        if (!equipamento_id || !colaborador_id) {
            return res.status(400).json({
                success: false,
                error: 'Equipamento e Colaborador são obrigatórios'
            });
        }

        // 1. Verificar se o equipamento está disponível
        const { data: equip, error: equipError } = await supabase
            .from('cp_equipamentos')
            .select('status')
            .eq('id', equipamento_id)
            .single();

        if (equipError || !equip) {
            return res.status(404).json({ success: false, error: 'Equipamento não encontrado' });
        }

        if (equip.status === 'manutencao') {
            return res.status(400).json({
                success: false,
                error: 'Este equipamento está em manutenção e não pode ser atribuído no momento.'
            });
        }

        // VERIFICAR CONFLITOS DE HORÁRIO
        // Buscar todas as atribuições ativas deste equipamento
        const { data: activeAssignments, error: activeErr } = await supabase
            .from('cp_equipamento_atribuicoes')
            .select('*')
            .eq('equipamento_id', equipamento_id)
            .is('data_devolucao', null);

        if (!activeErr && activeAssignments && activeAssignments.length > 0) {
            // Se já existe atribuição, precisamos validar horários

            // 1. Se o NOVO pedido não tem horário definido (uso integral), e já tem gente usando -> CONFLITO
            if (!horario_entrada || !horario_saida) {
                return res.status(400).json({
                    success: false,
                    error: 'Este equipamento já está em uso parcial. Para compartilhar, defina horário de início e fim.'
                });
            }

            // Helper para converter tempo em minutos e evitar problemas com HH:MM vs HH:MM:SS
            const timeToMinutes = (str) => {
                if (!str) return 0;
                const [h, m] = str.split(':').map(Number);
                return (h || 0) * 60 + (m || 0);
            };

            const novoStart = timeToMinutes(horario_entrada);
            const novoEnd = timeToMinutes(horario_saida);

            for (const assign of activeAssignments) {
                // 2. Se a atribuição EXISTENTE não tem horário (uso integral) -> CONFLITO
                if (!assign.horario_trabalho_inicio || !assign.horario_trabalho_fim) {
                    return res.status(400).json({
                        success: false,
                        error: 'Este equipamento está em uso integral por outro colaborador.'
                    });
                }

                const existStart = timeToMinutes(assign.horario_trabalho_inicio);
                const existEnd = timeToMinutes(assign.horario_trabalho_fim);

                // 3. Verificar sobreposição (Overlap)
                if (novoStart < existEnd && novoEnd > existStart) {
                    return res.status(400).json({
                        success: false,
                        error: `Conflito de horário! Já reservado por outro colaborador das ${assign.horario_trabalho_inicio} às ${assign.horario_trabalho_fim}.`
                    });
                }
            }
        }

        // 2. Criar atribuição
        const { data: atribuicao, error: atrError } = await supabase
            .from('cp_equipamento_atribuicoes')
            .insert([{
                equipamento_id,
                colaborador_id,
                observacoes,
                horario_trabalho_inicio: horario_entrada || null,
                horario_trabalho_fim: horario_saida || null,
                criado_por: admin_id || null
            }])
            .select()
            .single();

        if (atrError) {
            console.error('Erro ao criar atribuição:', atrError);
            return res.status(500).json({
                success: false,
                error: `Erro ao atribuir equipamento: ${atrError.message || 'Erro desconhecido'}`
            });
        }

        // 3. Atualizar status do equipamento
        await supabase
            .from('cp_equipamentos')
            .update({ status: 'em uso' })
            .eq('id', equipamento_id);

        // 4. Registrar ocorrência de entrega automaticamente
        await supabase
            .from('cp_equipamento_ocorrencias')
            .insert([{
                equipamento_id,
                colaborador_id,
                tipo: 'ENTREGA',
                descricao: `Equipamento atribuído. Obs: ${observacoes || 'Nenhuma'}`
            }]);

        return res.status(201).json({
            success: true,
            message: 'Equipamento atribuído com sucesso',
            data: atribuicao
        });
    } catch (error) {
        console.error('Erro inesperado ao atribuir equipamento:', error);
        return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
}

// POST - Devolver equipamento (Check-in)
async function devolverEquipamento(req, res) {
    try {
        const { equipamento_id, colaborador_id, descricao_estado, fotos } = req.body;

        if (!equipamento_id) {
            return res.status(400).json({ success: false, error: 'ID do equipamento é obrigatório' });
        }

        // 1. Finalizar atribuição ativa (Do colaborador específico ou genérica se não informado)
        let query = supabase
            .from('cp_equipamento_atribuicoes')
            .update({ data_devolucao: new Date().toISOString() })
            .eq('equipamento_id', equipamento_id)
            .is('data_devolucao', null);

        if (colaborador_id) {
            query = query.eq('colaborador_id', colaborador_id);
        }

        const { data: fechadas, error: atrError } = await query.select();
        const atrAtiva = fechadas?.[0];

        if (atrError) {
            console.error('Erro ao finalizar atribuição:', atrError);
        }

        // 2. Verificar se ainda existem outras atribuições ativas para este equipamento
        const { count: ativosCount, error: countError } = await supabase
            .from('cp_equipamento_atribuicoes')
            .select('*', { count: 'exact', head: true })
            .eq('equipamento_id', equipamento_id)
            .is('data_devolucao', null);

        // 3. Se não houver mais ninguém usando, voltar status para 'ativo'
        if (ativosCount === 0) {
            await supabase
                .from('cp_equipamentos')
                .update({ status: 'ativo' })
                .eq('id', equipamento_id);
        } else {
            // Se ainda tem gente usando, garante que está 'em uso'
            await supabase
                .from('cp_equipamentos')
                .update({ status: 'em uso' })
                .eq('id', equipamento_id);
        }

        // 3. Registrar ocorrência de devolução com estado
        await supabase
            .from('cp_equipamento_ocorrencias')
            .insert([{
                equipamento_id,
                colaborador_id: atrAtiva?.colaborador_id,
                tipo: 'DEVOLUCAO',
                descricao: descricao_estado || 'Equipamento devolvido ao estoque.',
                fotos: fotos || []
            }]);

        return res.json({
            success: true,
            message: 'Equipamento devolvido com sucesso'
        });
    } catch (error) {
        console.error('Erro inesperado ao devolver equipamento:', error);
        return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
}

// POST - Registrar nova ocorrência (Danos, Observação, etc)
async function registrarOcorrencia(req, res) {
    try {
        const { equipamento_id, tipo, descricao, fotos, colaborador_id } = req.body;

        if (!equipamento_id || !tipo) {
            return res.status(400).json({ success: false, error: 'Dados obrigatórios ausentes' });
        }

        const { data, error } = await supabase
            .from('cp_equipamento_ocorrencias')
            .insert([{
                equipamento_id,
                tipo,
                descricao,
                fotos: fotos || [],
                colaborador_id
            }])
            .select()
            .single();

        if (error) {
            console.error('Erro ao registrar ocorrência:', error);
            return res.status(500).json({ success: false, error: 'Erro ao registrar ocorrência' });
        }

        // Se o tipo for 'DANOS' ou 'MANUTENCAO', talvez queira mudar o status do equipamento
        if (tipo === 'MANUTENCAO') {
            await supabase
                .from('cp_equipamentos')
                .update({ status: 'manutencao' })
                .eq('id', equipamento_id);
        }

        return res.status(201).json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Erro inesperado ao registrar ocorrência:', error);
        return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
}

// GET - Buscar histórico (Atribuições e Ocorrências)
async function getHistoricoEquipamento(req, res) {
    try {
        const { id } = req.params;

        // Buscar atribuições
        const { data: atribuicoes, error: errAtr } = await supabase
            .from('cp_equipamento_atribuicoes')
            .select('*')
            .eq('equipamento_id', id)
            .order('data_retirada', { ascending: false });

        // Buscar ocorrências
        const { data: ocorrencias, error: errOco } = await supabase
            .from('cp_equipamento_ocorrencias')
            .select('*')
            .eq('equipamento_id', id)
            .order('data_ocorrencia', { ascending: false });

        return res.json({
            success: true,
            data: {
                atribuicoes: atribuicoes || [],
                ocorrencias: ocorrencias || []
            }
        });
    } catch (error) {
        console.error('Erro ao buscar histórico:', error);
        return res.status(500).json({ success: false, error: 'Erro interno' });
    }
}

// GET - Estatísticas para o Dashboard
async function getDashboardStats(req, res) {
    try {
        // Totais por status
        const { data: statusCounts, error: errorStatus } = await supabase
            .from('cp_equipamentos')
            .select('status');

        if (errorStatus) throw errorStatus;

        const stats = {
            total: statusCounts.length,
            em_uso: statusCounts.filter(e => e.status === 'em uso').length,
            manutencao: statusCounts.filter(e => e.status === 'manutencao').length,
            estoque: statusCounts.filter(e => e.status === 'ativo' || !e.status).length
        };

        // Atividades recentes (últimas 5 ocorrências)
        const { data: recentes, error: errorRec } = await supabase
            .from('cp_equipamento_ocorrencias')
            .select(`
                *,
                cp_equipamentos (nome, tipo)
            `)
            .order('data_ocorrencia', { ascending: false })
            .limit(20);

        if (errorRec) throw errorRec;

        // Buscar nomes dos colaboradores para as atividades recentes
        let atividadesComNomes = recentes || [];
        const colabIds = [...new Set(recentes?.map(r => r.colaborador_id).filter(Boolean))];

        if (colabIds.length > 0) {
            const { data: membros, error: mErr } = await supabase
                .schema('up_gestaointeligente_dev')
                .from('membro')
                .select('id, nome')
                .in('id', colabIds);

            if (!mErr && membros) {
                const membrosMap = Object.fromEntries(membros.map(m => [m.id, m.nome]));
                atividadesComNomes = recentes.map(r => ({
                    ...r,
                    colaborador_nome: membrosMap[r.colaborador_id] || 'N/A'
                }));
            }
        }

        return res.json({
            success: true,
            data: {
                stats,
                atividades: atividadesComNomes
            }
        });
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        return res.status(500).json({ success: false, error: 'Erro interno' });
    }
}

module.exports = {
    getEquipamentos,
    getEquipamentoPorId,
    criarEquipamento,
    atualizarEquipamento,
    deletarEquipamento,
    atribuirEquipamento,
    devolverEquipamento,
    registrarOcorrencia,
    getHistoricoEquipamento,
    getDashboardStats
};
