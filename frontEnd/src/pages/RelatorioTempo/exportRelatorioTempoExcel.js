import * as XLSX from 'xlsx';

const formatarTempoHMS = (milissegundos) => {
    if (!milissegundos || milissegundos === 0) return '0h';
    const totalSegundos = Math.floor(milissegundos / 1000);
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    if (minutos === 0) return `${horas}h`;
    return `${horas}h ${minutos}m`;
};

const formatarDataHeader = (dataStr) => {
    if (!dataStr) return '';
    const data = new Date(dataStr);
    const weekday = data.toLocaleDateString('pt-BR', { weekday: 'short' });
    const dayMonth = data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    return `${weekday}, ${dayMonth}`;
};

/**
 * Gera a mesma estrutura de dados da planilha (porResponsavel, detalhes por groupBy, totais)
 * para montar o Excel idêntico à exibição em planilha.
 */
function buildPlanilhaData(registros, dataInicio, dataFim, groupBy, nomesTarefas, nomesClientes, nomesProdutos, usuarios) {
    const usuariosMap = {};
    (usuarios || []).forEach(u => { usuariosMap[String(u.id)] = u; });

    const datas = [];
    if (dataInicio && dataFim) {
        const inicio = new Date(dataInicio);
        const fim = new Date(dataFim);
        const dataAtual = new Date(inicio);
        while (dataAtual <= fim) {
            datas.push(new Date(dataAtual));
            dataAtual.setDate(dataAtual.getDate() + 1);
        }
    }

    const porResponsavel = [];
    (usuarios || []).forEach(u => {
        const id = String(u.id);
        porResponsavel.push({
            usuario_id: u.id,
            nome: u.nome_usuario || u.email_usuario || `Responsável ${u.id}`,
            dias: {},
            total: 0,
            registros: []
        });
    });

    if (registros && registros.length > 0) {
        registros.forEach(reg => {
            const uid = reg.usuario_id;
            if (!uid) return;
            const id = String(uid);
            let pessoa = porResponsavel.find(p => String(p.usuario_id) === id);
            if (!pessoa) {
                const u = usuariosMap[id];
                pessoa = {
                    usuario_id: uid,
                    nome: u ? (u.nome_usuario || u.email_usuario) : `ID ${uid}`,
                    dias: {},
                    total: 0,
                    registros: []
                };
                porResponsavel.push(pessoa);
            }
            const dia = reg.data_inicio ? reg.data_inicio.split('T')[0] : null;
            const duration = reg.tempo_realizado || (reg.data_fim && reg.data_inicio ? new Date(reg.data_fim) - new Date(reg.data_inicio) : 0);
            if (dia) {
                pessoa.dias[dia] = (pessoa.dias[dia] || 0) + duration;
            }
            pessoa.total += duration;
            pessoa.registros.push(reg);
        });
    }

    const sortedPorResponsavel = porResponsavel
        .filter(p => p.total > 0 || p.registros.length > 0)
        .sort((a, b) => b.total - a.total);

    const totaisDia = {};
    datas.forEach(d => {
        const k = d.toISOString().split('T')[0];
        totaisDia[k] = sortedPorResponsavel.reduce((acc, p) => acc + (p.dias[k] || 0), 0);
    });
    const totalGeral = Object.values(totaisDia).reduce((acc, v) => acc + v, 0);

    function getDetalhePorResponsavel(usuarioId) {
        const userRegs = (registros || []).filter(r => String(r.usuario_id) === String(usuarioId));
        const g = {};
        userRegs.forEach(reg => {
            let mainKey = 'outros';
            let mainLabel = 'Outros';
            if (groupBy === 'cliente') {
                mainKey = reg.cliente_id || 'sem-cliente';
                mainLabel = mainKey === 'sem-cliente' ? 'Sem Cliente' : (nomesClientes[mainKey] || `Cliente ${mainKey}`);
            } else if (groupBy === 'tarefa') {
                mainKey = reg.tarefa_id || 'sem-tarefa';
                mainLabel = mainKey === 'sem-tarefa' ? 'Sem Tarefa' : (nomesTarefas[mainKey] || `Tarefa ${mainKey}`);
            } else if (groupBy === 'produto') {
                mainKey = reg.produto_id || 'sem-produto';
                mainLabel = mainKey === 'sem-produto' ? 'Sem Produto' : (nomesProdutos[mainKey] || `Produto ${mainKey}`);
            }
            if (!g[mainKey]) g[mainKey] = { id: mainKey, label: mainLabel, dias: {}, total: 0 };
            const dia = reg.data_inicio ? reg.data_inicio.split('T')[0] : null;
            const duration = reg.tempo_realizado || (reg.data_fim && reg.data_inicio ? new Date(reg.data_fim) - new Date(reg.data_inicio) : 0);
            if (dia) {
                g[mainKey].dias[dia] = (g[mainKey].dias[dia] || 0) + duration;
            }
            g[mainKey].total += duration;
        });
        return Object.values(g).sort((a, b) => b.total - a.total);
    }

    function getTarefasPorSub(usuarioId, sortedDetalhe) {
        const userRegs = (registros || []).filter(r => String(r.usuario_id) === String(usuarioId));
        const out = {};
        sortedDetalhe.forEach(sub => {
            const regsDoSub = userRegs.filter(reg => {
                if (groupBy === 'cliente') return String(reg.cliente_id || 'sem-cliente') === String(sub.id);
                if (groupBy === 'produto') return String(reg.produto_id || 'sem-produto') === String(sub.id);
                return false;
            });
            const porTarefa = {};
            regsDoSub.forEach(reg => {
                const tid = reg.tarefa_id || 'sem-tarefa';
                const label = tid === 'sem-tarefa' ? 'Sem Tarefa' : (nomesTarefas[tid] || `Tarefa ${tid}`);
                if (!porTarefa[tid]) porTarefa[tid] = { id: tid, label, dias: {}, total: 0 };
                const dia = reg.data_inicio ? reg.data_inicio.split('T')[0] : null;
                const duration = reg.tempo_realizado || (reg.data_fim && reg.data_inicio ? new Date(reg.data_fim) - new Date(reg.data_inicio) : 0);
                if (dia) porTarefa[tid].dias[dia] = (porTarefa[tid].dias[dia] || 0) + duration;
                porTarefa[tid].total += duration;
            });
            out[sub.id] = Object.values(porTarefa).sort((a, b) => b.total - a.total);
        });
        return out;
    }

    return {
        datas,
        sortedPorResponsavel,
        totaisDia,
        totalGeral,
        getDetalhePorResponsavel,
        getTarefasPorSub
    };
}

/**
 * Exporta o relatório de tempo para Excel no mesmo formato da visualização em planilha.
 */
export function exportRelatorioTempoExcel({
    dataInicio,
    dataFim,
    registros,
    groupBy,
    nomesTarefas = {},
    nomesClientes = {},
    nomesProdutos = {},
    usuarios = []
}) {
    if (!dataInicio || !dataFim || !registros || registros.length === 0) {
        return;
    }

    const {
        datas,
        sortedPorResponsavel,
        totaisDia,
        totalGeral,
        getDetalhePorResponsavel,
        getTarefasPorSub
    } = buildPlanilhaData(registros, dataInicio, dataFim, groupBy, nomesTarefas, nomesClientes, nomesProdutos, usuarios);

    const dateKeys = datas.map(d => d.toISOString().split('T')[0]);
    const headerRow = ['Pessoas (' + sortedPorResponsavel.length + ')', '', ...dateKeys.map(k => formatarDataHeader(k)), 'Total'];

    const rows = [headerRow];

    sortedPorResponsavel.forEach(pessoa => {
        const personRow = [pessoa.nome, '', ...dateKeys.map(k => formatarTempoHMS(pessoa.dias[k] || 0)), formatarTempoHMS(pessoa.total)];
        rows.push(personRow);

        const sortedDetalhe = getDetalhePorResponsavel(pessoa.usuario_id);
        const tarefasPorSub = getTarefasPorSub(pessoa.usuario_id, sortedDetalhe);

        sortedDetalhe.forEach(sub => {
            const subRow = ['', sub.label, ...dateKeys.map(k => formatarTempoHMS(sub.dias[k] || 0)), formatarTempoHMS(sub.total)];
            rows.push(subRow);

            const tarefas = (groupBy === 'cliente' || groupBy === 'produto') ? (tarefasPorSub[sub.id] || []) : [];
            tarefas.forEach(t => {
                const taskRow = ['', '    ' + t.label, ...dateKeys.map(k => formatarTempoHMS(t.dias[k] || 0)), formatarTempoHMS(t.total)];
                rows.push(taskRow);
            });
        });
    });

    const totalRow = ['TOTAL GERAL', '', ...dateKeys.map(k => formatarTempoHMS(totaisDia[k] || 0)), formatarTempoHMS(totalGeral)];
    rows.push(totalRow);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const colCount = headerRow.length;
    ws['!cols'] = [{ wch: 28 }, { wch: 32 }, ...Array(Math.max(0, colCount - 3)).fill({ wch: 10 }), { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório de Tempo');
    const fileName = `Relatorio_Tempo_${dataInicio}_${dataFim}.xlsx`;
    XLSX.writeFile(wb, fileName);
}
