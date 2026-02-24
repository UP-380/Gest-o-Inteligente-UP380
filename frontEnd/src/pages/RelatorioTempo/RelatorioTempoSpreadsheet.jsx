import React, { useMemo, useState, useEffect } from 'react';
import Avatar from '../../components/user/Avatar';
import './RelatorioTempo.css';
import '../../pages/PlanilhaHoras/PlanilhaHoras.css';

const RelatorioTempoSpreadsheet = ({
    dataInicio,
    dataFim,
    registros,
    loading,
    groupBy,
    nomesTarefas,
    nomesClientes,
    nomesProdutos,
    usuarios = []
}) => {

    const [expandedResponsavel, setExpandedResponsavel] = useState(null); // usuario_id ou null
    const [expandedSubs, setExpandedSubs] = useState(new Set()); // Set de `${usuario_id}_${sub.id}` para expandir cliente/produto e ver tarefas

    useEffect(() => {
        setExpandedSubs(new Set());
    }, [expandedResponsavel]);

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

    const datas = useMemo(() => {
        if (!dataInicio || !dataFim) return [];
        const d = [];
        const inicio = new Date(dataInicio);
        const fim = new Date(dataFim);
        const dataAtual = new Date(inicio);
        while (dataAtual <= fim) {
            d.push(new Date(dataAtual));
            dataAtual.setDate(dataAtual.getDate() + 1);
        }
        return d;
    }, [dataInicio, dataFim]);

    const usuariosMap = useMemo(() => {
        const m = {};
        (usuarios || []).forEach(u => { m[String(u.id)] = u; });
        return m;
    }, [usuarios]);

    // Nível 1: Por responsável (total por dia + total período)
    const porResponsavel = useMemo(() => {
        const map = {};

        // Inicializar com todos os usuários conhecidos para garantir paridade com o modo Lista
        (usuarios || []).forEach(u => {
            const id = String(u.id);
            map[id] = {
                usuario_id: u.id,
                nome: u.nome_usuario || u.email_usuario || `Responsável ${u.id}`,
                foto: u.foto_perfil,
                dias: {},
                total: 0,
                registros: []
            };
        });

        if (registros && registros.length > 0) {
            registros.forEach(reg => {
                const uid = reg.usuario_id;
                if (!uid) return;
                const id = String(uid);
                if (!map[id]) {
                    const u = usuariosMap[id];
                    map[id] = {
                        usuario_id: uid,
                        nome: u ? (u.nome_usuario || u.email_usuario) : `ID ${uid}`,
                        foto: u?.foto_perfil,
                        dias: {},
                        total: 0,
                        registros: []
                    };
                }
                const dia = reg.data_inicio ? reg.data_inicio.split('T')[0] : null;
                const duration = reg.tempo_realizado || (reg.data_fim && reg.data_inicio ? new Date(reg.data_fim) - new Date(reg.data_inicio) : 0);
                if (dia) {
                    map[id].dias[dia] = (map[id].dias[dia] || 0) + duration;
                }
                map[id].total += duration;
                map[id].registros.push(reg);
            });
        }
        return Object.values(map).sort((a, b) => b.total - a.total);
    }, [registros, usuariosMap, usuarios]);

    // Detalhe expandido: para um usuario_id, agrupar por groupBy (cliente/tarefa/produto)
    const detalhePorResponsavel = useMemo(() => {
        if (!expandedResponsavel || !registros) return {};
        const userRegs = registros.filter(r => String(r.usuario_id) === String(expandedResponsavel));
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
        return g;
    }, [expandedResponsavel, registros, groupBy, nomesClientes, nomesTarefas, nomesProdutos]);

    const sortedDetalhe = useMemo(() =>
        Object.values(detalhePorResponsavel).sort((a, b) => b.total - a.total),
        [detalhePorResponsavel]
    );

    // Quando groupBy é cliente ou produto: para cada cliente/produto, listar tarefas com totais por dia
    const tarefasPorSub = useMemo(() => {
        if (!expandedResponsavel || !registros || (groupBy !== 'cliente' && groupBy !== 'produto')) return {};
        const userRegs = registros.filter(r => String(r.usuario_id) === String(expandedResponsavel));
        const out = {};
        sortedDetalhe.forEach(sub => {
            const regsDoSub = userRegs.filter(reg => {
                if (groupBy === 'cliente') return String(reg.cliente_id || 'sem-cliente') === String(sub.id);
                return String(reg.produto_id || 'sem-produto') === String(sub.id);
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
    }, [expandedResponsavel, registros, groupBy, sortedDetalhe, nomesTarefas]);

    const totaisDia = useMemo(() => {
        const t = {};
        datas.forEach(d => {
            const k = d.toISOString().split('T')[0];
            t[k] = porResponsavel.reduce((acc, p) => acc + (p.dias[k] || 0), 0);
        });
        return t;
    }, [porResponsavel, datas]);

    const totalGeral = useMemo(() => Object.values(totaisDia).reduce((acc, v) => acc + v, 0), [totaisDia]);

    return (
        <div className="planilha-horas-container rt-spreadsheet-by-responsavel">
            {loading ? (
                <div className="relatorio-loading">
                    <div className="relatorio-spinner"></div>
                    <p>Carregando planilha...</p>
                </div>
            ) : registros.length === 0 ? (
                <div className="relatorio-empty">
                    <i className="fas fa-table" style={{ fontSize: '2rem', marginBottom: '1rem', display: 'block' }}></i>
                    Nenhum registro para exibir na planilha.
                </div>
            ) : (
                <div className="planilha-horas-table-wrapper custom-scrollbar">
                    <table className="planilha-horas-table rt-planilha-pessoas">
                        <thead>
                            <tr>
                                <th className="planilha-horas-th rt-planilha-th-pessoas" style={{ zIndex: 30 }}>
                                    Pessoas ({porResponsavel.length})
                                </th>
                                <th className="planilha-horas-th rt-planilha-th-abrir" style={{ zIndex: 30, width: '90px' }}></th>
                                {datas.map(d => (
                                    <th key={d.toISOString()} className="planilha-horas-th planilha-horas-th-data">
                                        {formatarDataHeader(d.toISOString().split('T')[0])}
                                    </th>
                                ))}
                                <th className="planilha-horas-th planilha-horas-th-total">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {porResponsavel.map((pessoa) => {
                                const isExpanded = expandedResponsavel === pessoa.usuario_id;
                                return (
                                    <React.Fragment key={pessoa.usuario_id}>
                                        <tr className="planilha-horas-tr rt-planilha-tr-pessoa">
                                            <td className="planilha-horas-td rt-planilha-td-pessoa" title={pessoa.nome}>
                                                <div className="rt-planilha-pessoa-cell">
                                                    <Avatar
                                                        avatarId={pessoa.foto}
                                                        nomeUsuario={pessoa.nome}
                                                        size="small"
                                                        className="rt-planilha-avatar"
                                                    />
                                                    <div className="rt-planilha-pessoa-info">
                                                        <span className="rt-planilha-pessoa-nome">{pessoa.nome}</span>
                                                        <span className="rt-planilha-pessoa-total">{formatarTempoHMS(pessoa.total)}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="planilha-horas-td rt-planilha-td-abrir">
                                                <button
                                                    type="button"
                                                    className={`rt-planilha-abrir-btn ${isExpanded ? 'expanded' : ''}`}
                                                    onClick={() => setExpandedResponsavel(isExpanded ? null : pessoa.usuario_id)}
                                                    aria-expanded={isExpanded}
                                                >
                                                    {isExpanded ? 'Fechar' : 'Abrir'}
                                                    <i className={`fas fa-chevron-${isExpanded ? 'up' : 'right'}`} style={{ marginLeft: '4px' }}></i>
                                                </button>
                                            </td>
                                            {datas.map(d => {
                                                const key = d.toISOString().split('T')[0];
                                                const val = pessoa.dias[key] || 0;
                                                return (
                                                    <td
                                                        key={key}
                                                        className={`planilha-horas-td planilha-horas-td-tempo ${val > 0 ? 'planilha-horas-td-editavel' : ''}`}
                                                        style={{ textAlign: 'center', fontWeight: val > 0 ? '600' : 'normal', color: val > 0 ? '#1e293b' : '#94a3b8' }}
                                                    >
                                                        {formatarTempoHMS(val)}
                                                    </td>
                                                );
                                            })}
                                            <td className="planilha-horas-td planilha-horas-td-total">
                                                {formatarTempoHMS(pessoa.total)}
                                            </td>
                                        </tr>
                                        {isExpanded && sortedDetalhe.length > 0 && (
                                            sortedDetalhe.map(sub => {
                                                const subKey = `${pessoa.usuario_id}_${sub.id}`;
                                                const temTarefas = (groupBy === 'cliente' || groupBy === 'produto') && (tarefasPorSub[sub.id] || []).length > 0;
                                                const subExpanded = expandedSubs.has(subKey);
                                                const toggleSub = () => {
                                                    setExpandedSubs(prev => {
                                                        const next = new Set(prev);
                                                        if (next.has(subKey)) next.delete(subKey);
                                                        else next.add(subKey);
                                                        return next;
                                                    });
                                                };
                                                return (
                                                    <React.Fragment key={sub.id}>
                                                        <tr className="planilha-horas-tr rt-planilha-tr-detalhe">
                                                            <td className="planilha-horas-td rt-planilha-td-detalhe-label" colSpan={2}>
                                                                {temTarefas ? (
                                                                    <button
                                                                        type="button"
                                                                        className="rt-planilha-sub-abrir-btn"
                                                                        onClick={(e) => { e.stopPropagation(); toggleSub(); }}
                                                                        aria-expanded={subExpanded}
                                                                        title={subExpanded ? 'Fechar tarefas' : 'Abrir tarefas'}
                                                                    >
                                                                        <i className={`fas fa-chevron-${subExpanded ? 'down' : 'right'}`}></i>
                                                                    </button>
                                                                ) : (
                                                                    <span className="rt-planilha-detalhe-indent"></span>
                                                                )}
                                                                <span className="rt-planilha-detalhe-indent"></span>
                                                                {groupBy === 'cliente' && <i className="fas fa-briefcase" style={{ marginRight: '6px', color: '#64748b' }}></i>}
                                                                {groupBy === 'tarefa' && <i className="fas fa-tasks" style={{ marginRight: '6px', color: '#64748b' }}></i>}
                                                                {groupBy === 'produto' && <i className="fas fa-box" style={{ marginRight: '6px', color: '#64748b' }}></i>}
                                                                {sub.label}
                                                                {temTarefas && (
                                                                    <span className="rt-planilha-sub-count">
                                                                        ({tarefasPorSub[sub.id].length} tarefa{tarefasPorSub[sub.id].length !== 1 ? 's' : ''})
                                                                    </span>
                                                                )}
                                                            </td>
                                                            {datas.map(d => {
                                                                const key = d.toISOString().split('T')[0];
                                                                const val = sub.dias[key] || 0;
                                                                return (
                                                                    <td
                                                                        key={key}
                                                                        className={`planilha-horas-td planilha-horas-td-tempo ${val > 0 ? 'planilha-horas-td-editavel' : ''}`}
                                                                        style={{ textAlign: 'center', fontWeight: val > 0 ? '600' : 'normal', color: val > 0 ? '#475569' : '#94a3b8', fontSize: '0.8125rem' }}
                                                                    >
                                                                        {formatarTempoHMS(val)}
                                                                    </td>
                                                                );
                                                            })}
                                                            <td className="planilha-horas-td planilha-horas-td-total" style={{ fontSize: '0.8125rem' }}>
                                                                {formatarTempoHMS(sub.total)}
                                                            </td>
                                                        </tr>
                                                        {temTarefas && subExpanded && (tarefasPorSub[sub.id] || []).map(t => (
                                                            <tr key={t.id} className="planilha-horas-tr rt-planilha-tr-tarefa">
                                                                <td className="planilha-horas-td rt-planilha-td-tarefa-label" colSpan={2}>
                                                                    <span className="rt-planilha-detalhe-indent"></span>
                                                                    <span className="rt-planilha-detalhe-indent"></span>
                                                                    <span className="rt-planilha-detalhe-indent"></span>
                                                                    <i className="fas fa-tasks" style={{ marginRight: '6px', color: '#94a3b8', fontSize: '0.75rem' }}></i>
                                                                    {t.label}
                                                                </td>
                                                                {datas.map(d => {
                                                                    const key = d.toISOString().split('T')[0];
                                                                    const val = t.dias[key] || 0;
                                                                    return (
                                                                        <td
                                                                            key={key}
                                                                            className={`planilha-horas-td planilha-horas-td-tempo ${val > 0 ? 'planilha-horas-td-editavel' : ''}`}
                                                                            style={{ textAlign: 'center', fontWeight: val > 0 ? '500' : 'normal', color: val > 0 ? '#64748b' : '#94a3b8', fontSize: '0.75rem' }}
                                                                        >
                                                                            {formatarTempoHMS(val)}
                                                                        </td>
                                                                    );
                                                                })}
                                                                <td className="planilha-horas-td planilha-horas-td-total" style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                                    {formatarTempoHMS(t.total)}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </React.Fragment>
                                                );
                                            })
                                        )}
                                    </React.Fragment>
                                );
                            })}
                            <tr className="planilha-horas-tr planilha-horas-tr-total">
                                <td className="planilha-horas-td planilha-horas-td-total-label" colSpan={2} style={{ paddingLeft: '1rem' }}>
                                    TOTAL GERAL
                                </td>
                                {datas.map(d => {
                                    const key = d.toISOString().split('T')[0];
                                    return (
                                        <td key={key} className="planilha-horas-td planilha-horas-td-total">
                                            {formatarTempoHMS(totaisDia[key])}
                                        </td>
                                    );
                                })}
                                <td className="planilha-horas-td planilha-horas-td-total" style={{ color: '#059669' }}>
                                    {formatarTempoHMS(totalGeral)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default RelatorioTempoSpreadsheet;
