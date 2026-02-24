import type { Context } from 'hono';
import { supabase } from '../../lib/supabaseClient.js';
import type { ActiveSession } from './types.js';

const SCHEMA = process.env.SUPABASE_DB_SCHEMA || 'up_gestaointeligente';

export async function activeSessionsHandler(c: Context) {
    try {
        // 1. Buscar registros de tempo ativos (onde data_fim é nulo)
        const { data: activeRecords, error: errRecords } = await supabase.schema(SCHEMA)
            .from('registro_tempo')
            .select('id, usuario_id, data_inicio, cliente_id, produto_id, tarefa_id')
            .is('data_fim', null);

        if (errRecords) throw errRecords;
        if (!activeRecords || activeRecords.length === 0) {
            return c.json({ success: true, data: [], count: 0 });
        }

        // 2. Coletar IDs para buscar metadados
        const usuarioIds = Array.from(new Set(activeRecords.map(r => r.usuario_id)));
        const clienteIds = Array.from(new Set(activeRecords.map(r => r.cliente_id).filter(Boolean))) as string[];
        const produtoIds = Array.from(new Set(activeRecords.map(r => r.produto_id).filter(Boolean))) as string[];
        const tarefaIds = Array.from(new Set(activeRecords.map(r => r.tarefa_id).filter(Boolean))) as string[];
        // Buscar estimativas baseadas na tarefa_id e responsável (membro_id)
        let estimadosData: any[] = [];
        if (tarefaIds.length > 0) {
            const { data: estRecords } = await supabase.schema(SCHEMA)
                .from('tempo_estimado_regra')
                .select('id, tarefa_id, responsavel_id, tempo_estimado_dia, data_inicio')
                .in('tarefa_id', tarefaIds);
            if (estRecords) estimadosData = estRecords;
        }

        const [
            { data: membros },
            { data: usuarios },
            { data: clientes },
            { data: produtos },
            { data: tarefas }
        ] = await Promise.all([
            supabase.schema(SCHEMA).from('membro').select('id, usuario_id, nome').in('usuario_id', usuarioIds),
            supabase.schema(SCHEMA).from('usuarios').select('id, foto_perfil').in('id', usuarioIds),
            clienteIds.length ? supabase.schema(SCHEMA).from('cp_cliente').select('id, nome').in('id', clienteIds) : Promise.resolve({ data: [] }),
            produtoIds.length ? supabase.schema(SCHEMA).from('cp_produto').select('id, nome').in('id', produtoIds) : Promise.resolve({ data: [] }),
            tarefaIds.length ? supabase.schema(SCHEMA).from('cp_tarefa').select('id, nome').in('id', tarefaIds) : Promise.resolve({ data: [] })
        ]);

        // 4. Mapear para acesso rápido
        const membroMap = new Map();
        membros?.forEach(m => membroMap.set(m.usuario_id, m));

        const usuarioMap = new Map();
        usuarios?.forEach(u => usuarioMap.set(u.id, u));

        const clienteMap = new Map();
        clientes?.forEach(c => clienteMap.set(String(c.id), c.nome));

        const produtoMap = new Map();
        produtos?.forEach(p => produtoMap.set(String(p.id), p.nome));

        const tarefaMap = new Map();
        tarefas?.forEach(t => tarefaMap.set(String(t.id), t.nome || ''));

        const estimadoMap = new Map();
        estimadosData?.forEach(e => {
            const compositeKey = `${e.tarefa_id}_${e.responsavel_id}`; // tarefa_id_responsavel_id
            estimadoMap.set(compositeKey, { tempo: e.tempo_estimado_dia, data_inicio: e.data_inicio });
        });

        function formatarDataISOBr(dataStr: string) {
            if (!dataStr) return null;
            const dataS = typeof dataStr === 'string' ? dataStr.split('T')[0] : '';
            const partes = dataS.split('-');
            if (partes.length === 3) {
                return `${partes[2]}/${partes[1]}/${partes[0]}`;
            }
            return dataStr;
        }

        function tempoEstimadoDiaParaMs(tempo_estimado_dia: any): number {
            const t = Number(tempo_estimado_dia) || 0;
            if (t > 0 && t < 1000) return Math.round(t * 3600000);
            return t;
        }

        function formatarTempoHMS(milissegundos: number) {
            if (!milissegundos || milissegundos === 0) return '0s';

            const totalSegundos = Math.floor(Math.abs(milissegundos) / 1000);
            const horas = Math.floor(totalSegundos / 3600);
            const minutos = Math.floor((totalSegundos % 3600) / 60);
            const segundos = totalSegundos % 60;

            const partes = [];

            if (horas > 0) {
                partes.push(`${horas}h`);
            }

            if (minutos > 0) {
                partes.push(`${minutos}min`);
            }

            if (segundos > 0 || partes.length === 0) {
                partes.push(`${segundos}s`);
            }

            return partes.join(' ');
        }

        // 5. Montar resposta final
        const now = Date.now();
        const data: ActiveSession[] = activeRecords.map(r => {
            const membro = membroMap.get(r.usuario_id);
            const usuario = usuarioMap.get(r.usuario_id);
            const dataInicioMs = new Date(r.data_inicio!).getTime();

            // Tenta encontrar tempo_estimado_dia (regra baseada na tarefa e responsavel logado)
            const compositeKey = r.tarefa_id && membro?.id ? `${r.tarefa_id}_${membro.id}` : null;
            const estimadoData = compositeKey ? estimadoMap.get(compositeKey) : null;
            const tempoEstimadoFormatado = estimadoData?.tempo ? formatarTempoHMS(tempoEstimadoDiaParaMs(estimadoData.tempo)) : null;
            const dataEstimadaFormatada = estimadoData?.data_inicio ? formatarDataISOBr(estimadoData.data_inicio) : null;

            return {
                id: String(r.id),
                usuario_id: r.usuario_id,
                data_inicio: r.data_inicio!,
                membro_id: membro?.id || 0,
                membro_nome: membro?.nome || 'Usuário Desconhecido',
                foto_perfil: usuario?.foto_perfil,
                cliente_id: r.cliente_id,
                cliente_nome: r.cliente_id ? clienteMap.get(String(r.cliente_id)) : null,
                produto_id: r.produto_id,
                produto_nome: r.produto_id ? produtoMap.get(String(r.produto_id)) : null,
                tarefa_id: r.tarefa_id,
                tarefa_nome: r.tarefa_id ? tarefaMap.get(String(r.tarefa_id)) : null,
                tempo_decorrido_ms: now - dataInicioMs,
                tempo_estimado_formatado: tempoEstimadoFormatado,
                data_estimada_formatada: dataEstimadaFormatada
            };
        });

        // Ordenar por quem começou há mais tempo
        data.sort((a, b) => b.tempo_decorrido_ms - a.tempo_decorrido_ms);

        return c.json({
            success: true,
            data,
            count: data.length
        });

    } catch (error: any) {
        console.error('Erro no activeSessionsHandler:', error);
        return c.json({
            success: false,
            error: 'Erro interno ao buscar sessões ativas',
            message: error.message
        }, 500);
    }
}
