import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    format,
    addMonths,
    subMonths,
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    addWeeks,
    subWeeks,
    isToday
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import './AgendaColaborador.css';

const API_BASE_URL = '/api';

const formatarTempoHMS = (milissegundos) => {
    if (!milissegundos || milissegundos === 0) return '0s';
    const totalSegundos = Math.floor(milissegundos / 1000);
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segundos = totalSegundos % 60;
    const partes = [];
    if (horas > 0) partes.push(`${horas}h`);
    if (minutos > 0) partes.push(`${minutos}min`);
    if (segundos > 0 || partes.length === 0) partes.push(`${segundos}s`);
    return partes.join(' ');
};

const formatarTempoEstimado = (tempo) => {
    const valor = Number(tempo) || 0;
    if (valor >= 1000) return formatarTempoHMS(valor);
    return formatarTempoHMS(valor * 3600000);
};

const AgendaColaborador = ({ usuario, getIdsParaAgenda }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState('week'); // 'week' ou 'month'
    const [tarefas, setTarefas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [cardTempoRealizadoMs, setCardTempoRealizadoMs] = useState(null);
    const [cardLoadingTempo, setCardLoadingTempo] = useState(false);
    const [cardRegistroAtivo, setCardRegistroAtivo] = useState(null); // { registro_id } quando esta tarefa está com timer rodando
    const [cardPlayLoading, setCardPlayLoading] = useState(false);

    // Helper para padronizar textos
    const normalizeText = (str) => {
        return str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() : '';
    };

    /** Converte string de data (YYYY-MM-DD ou ISO) para Date em meia-noite local (evita problema de fuso) */
    const parseDataLocal = (dataStr) => {
        if (!dataStr) return null;
        const apenasData = typeof dataStr === 'string' ? dataStr.split('T')[0] : String(dataStr).split('T')[0];
        const partes = apenasData.split('-');
        if (partes.length !== 3) return null;
        const y = parseInt(partes[0], 10);
        const m = parseInt(partes[1], 10) - 1;
        const d = parseInt(partes[2], 10);
        if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
        return new Date(y, m, d);
    };

    const getIdsPossiveisUsuario = useCallback(async () => {
        let responsavelIdDescoberto = null;

        // Tentar descobrir via banco chamando uma route ou fallback (aqui mantemos o basico do storage ou props)
        const usuarioStorage = (() => {
            try {
                return JSON.parse(localStorage.getItem('usuario') || '{}');
            } catch {
                return {};
            }
        })();

        const coletarIds = (obj) => {
            const ids = [];
            const chavesId = ['id', 'membro_id', 'colaborador_id', 'usuario_id', 'membroId', 'colaboradorId'];
            Object.entries(obj || {}).forEach(([k, v]) => {
                if (v == null) return;
                const keyNorm = k.toLowerCase().replace(/_/g, '');
                const isChaveId = chavesId.some((c) => keyNorm === c.toLowerCase().replace(/_/g, ''));
                if (!isChaveId) return;
                if (typeof v === 'number' && !Number.isNaN(v)) {
                    ids.push(String(v));
                } else if (typeof v === 'string' && v.trim()) {
                    const s = v.trim();
                    if (/^\d+$/.test(s)) ids.push(s);
                    else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) ids.push(s);
                }
            });
            return ids;
        };

        const idsPossiveisBase = [...coletarIds(usuario), ...coletarIds(usuarioStorage)];

        const ehIdValido = (v) => {
            if (typeof v === 'number' && !Number.isNaN(v)) return true;
            const s = String(v).trim();
            return /^\d+$/.test(s) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
        };

        return Array.from(new Set(idsPossiveisBase)).filter(ehIdValido);
    }, [usuario]);

    // Carregar tarefas para o intervalo de datas vizíveis na tela
    const fetchTarefas = useCallback(async (dataInicioSTR, dataFimSTR) => {
        if (!usuario) return;
        setLoading(true);

        try {
            // Usar os mesmos IDs que "Minhas tarefas" (inclui ID do membro/colaborador) quando disponível
            const idsUnicos = getIdsParaAgenda
                ? await getIdsParaAgenda()
                : await getIdsPossiveisUsuario();
            if (idsUnicos.length === 0) {
                setLoading(false);
                return;
            }

            const params = new URLSearchParams();
            params.append('filtro_responsavel', 'true');
            idsUnicos.forEach((id) => params.append('responsavel_id', String(id)));

            params.append('data_inicio', dataInicioSTR);
            params.append('data_fim', dataFimSTR);
            params.append('limit', '1000'); // Limite alto para a agenda
            params.append('page', '1');

            const response = await fetch(`${API_BASE_URL}/tempo-estimado?${params}`, {
                credentials: 'include',
                headers: { Accept: 'application/json' }
            });

            let registrosAPI = [];
            if (response.ok) {
                const result = await response.json();
                if (result.success && Array.isArray(result.data)) {
                    registrosAPI = result.data;
                }
            }

            // Adicionar tarefas pendentes do plug rapido
            try {
                const resPendentes = await fetch(`${API_BASE_URL}/atribuicoes-pendentes/minhas`);
                if (resPendentes.ok) {
                    const jsonPendentes = await resPendentes.json();
                    if (jsonPendentes.success && Array.isArray(jsonPendentes.data)) {
                        const startDate = new Date(dataInicioSTR);
                        const endDate = new Date(dataFimSTR);

                        const pendentesDoPeriodo = jsonPendentes.data.filter(p => {
                            if (!p.data_inicio) return false;
                            const d = new Date(p.data_inicio);
                            return d >= startDate && d <= endDate;
                        });

                        const pendentesMapeados = pendentesDoPeriodo.map(p => ({
                            id: p.id,
                            tarefa_id: p.tarefa_id,
                            cliente_id: p.cliente_id,
                            produto_id: p.produto_id,
                            data: p.data_inicio,
                            tempo_estimado_dia: p.tempo_estimado_dia,
                            is_pendente: true,

                            // Nested objects ou ids dependendo do endpoint
                            tarefa: p.tarefa || { nome: 'Tarefa Pendente' },
                            cliente: p.cliente || { nome: 'Cliente Pendente' },
                            produto: p.produto || { nome: '-' }
                        }));

                        registrosAPI = [...registrosAPI, ...pendentesMapeados];
                    }
                }
            } catch (e) { /* Silent fail */ }

            // Buscar nomes de tarefas e clientes em lote (igual ao Painel)
            const tarefasMap = {};
            const clientesMap = {};
            const tarefasIdsUnicos = [...new Set(registrosAPI.map(r => r.tarefa_id).filter(Boolean))].map(String);
            const clientesIdsUnicos = [...new Set(registrosAPI.map(r => r.cliente_id).filter(Boolean))].map(String);

            if (tarefasIdsUnicos.length > 0) {
                try {
                    const resTarefas = await fetch(`${API_BASE_URL}/tarefas-por-ids?ids=${tarefasIdsUnicos.join(',')}`, {
                        credentials: 'include',
                        headers: { Accept: 'application/json' }
                    });
                    if (resTarefas.ok) {
                        const json = await resTarefas.json();
                        if (json.success && json.data && typeof json.data === 'object') {
                            Object.entries(json.data).forEach(([id, nome]) => {
                                if (nome && String(nome).trim()) tarefasMap[String(id)] = String(nome).trim();
                            });
                        }
                    }
                } catch (e) { /* ignore */ }
            }

            if (clientesIdsUnicos.length > 0) {
                const promessasClientes = clientesIdsUnicos.map(async (id) => {
                    try {
                        const res = await fetch(`${API_BASE_URL}/base-conhecimento/cliente/${encodeURIComponent(id)}`, {
                            credentials: 'include',
                            headers: { Accept: 'application/json' }
                        });
                        if (!res.ok) return { id, nome: null };
                        const result = await res.json();
                        if (!result.success || !result.data || !result.data.cliente) return { id, nome: null };
                        const c = result.data.cliente;
                        const nome = c.nome || c.nome_amigavel || c.amigavel || c.nome_fantasia || c.fantasia || c.razao_social || c.razao || null;
                        return { id: String(id), nome: nome ? String(nome).trim() : null };
                    } catch (e) {
                        return { id: String(id), nome: null };
                    }
                });
                const resultadosClientes = await Promise.all(promessasClientes);
                resultadosClientes.forEach(({ id, nome }) => {
                    if (nome) clientesMap[id] = nome;
                });
            }

            // Aplicar nomes aos registros (já vindos da API ou dos mapas)
            const recordsResolved = registrosAPI.map((reg) => {
                const tarefaNome = reg.tarefa?.nome || (reg.tarefa_id ? tarefasMap[String(reg.tarefa_id)] : null);
                const clienteNome = reg.cliente?.nome || (reg.cliente_id ? clientesMap[String(reg.cliente_id)] : null);
                return {
                    ...reg,
                    displayData: parseDataLocal(reg.data),
                    displayNome: tarefaNome || (reg.tarefa_id ? `Tarefa #${reg.tarefa_id}` : 'Tarefa'),
                    displayCliente: clienteNome || (reg.cliente_id ? `Cliente #${reg.cliente_id}` : 'Cliente'),
                };
            });
            setTarefas(recordsResolved.filter(r => r.displayData !== null));

        } catch (error) {
            console.error('Erro ao buscar tarefas para agenda:', error);
        } finally {
            setLoading(false);
        }
    }, [usuario, getIdsPossiveisUsuario, getIdsParaAgenda]);

    // Recalcular dias vizíveis na grade sempre que ViewMode ou currentDate mudar
    const daysInGrid = useMemo(() => {
        let startDate;
        let endDate;

        if (viewMode === 'month') {
            const monthStart = startOfMonth(currentDate);
            const monthEnd = endOfMonth(currentDate);
            // Garantir que a grid começa pelo primeiro dia da semana (Domingo=0 ou seg=1, no pt-BR startOfWeek resolve)
            startDate = startOfWeek(monthStart, { locale: ptBR });
            endDate = endOfWeek(monthEnd, { locale: ptBR });
        } else {
            startDate = startOfWeek(currentDate, { locale: ptBR });
            endDate = endOfWeek(currentDate, { locale: ptBR });
        }

        return eachDayOfInterval({ start: startDate, end: endDate });
    }, [currentDate, viewMode]);

    // Efeito disparador de busca
    useEffect(() => {
        if (!daysInGrid || daysInGrid.length === 0) return;

        const fmt = 'yyyy-MM-dd';
        const di = format(daysInGrid[0], fmt);
        const df = format(daysInGrid[daysInGrid.length - 1], fmt);

        fetchTarefas(di, df);
    }, [daysInGrid, fetchTarefas]);

    // Buscar tempo realizado e registro ativo ao abrir o card de detalhe
    const refetchCardTempoEAtivo = useCallback(() => {
        if (!selectedTask || !usuario?.id || !selectedTask.tarefa_id || !selectedTask.cliente_id) return;
        let dataStr = '';
        if (selectedTask.data) {
            const d = typeof selectedTask.data === 'string' ? selectedTask.data : (selectedTask.displayData && selectedTask.displayData.toISOString ? selectedTask.displayData.toISOString() : '');
            dataStr = d ? (d.split('T')[0] || d) : '';
        } else if (selectedTask.displayData && selectedTask.displayData.toISOString) {
            dataStr = selectedTask.displayData.toISOString().split('T')[0];
        }
        const urlRealizado = `${API_BASE_URL}/registro-tempo/realizado?usuario_id=${usuario.id}&tarefa_id=${selectedTask.tarefa_id}&cliente_id=${encodeURIComponent(selectedTask.cliente_id)}${dataStr ? `&data=${dataStr}` : ''}`;
        const paramsAtivo = new URLSearchParams({
            usuario_id: usuario.id,
            tarefa_id: selectedTask.tarefa_id,
            cliente_id: selectedTask.cliente_id
        });
        Promise.all([
            fetch(urlRealizado, { credentials: 'include', headers: { Accept: 'application/json' } }).then((res) => res.ok ? res.json() : { success: false }),
            fetch(`${API_BASE_URL}/registro-tempo/ativo?${paramsAtivo}`, { credentials: 'include', headers: { Accept: 'application/json' } }).then((res) => res.ok ? res.json() : { success: false })
        ]).then(([resultRealizado, resultAtivo]) => {
            if (resultRealizado.success && resultRealizado.data && resultRealizado.data.tempo_realizado_ms != null) {
                setCardTempoRealizadoMs(resultRealizado.data.tempo_realizado_ms);
            } else {
                setCardTempoRealizadoMs(0);
            }
            if (resultAtivo.success && resultAtivo.data && resultAtivo.data.id) {
                setCardRegistroAtivo({ registro_id: resultAtivo.data.id });
            } else {
                setCardRegistroAtivo(null);
            }
        }).catch(() => {
            setCardTempoRealizadoMs(0);
            setCardRegistroAtivo(null);
        });
    }, [selectedTask, usuario?.id]);

    useEffect(() => {
        if (!selectedTask || !usuario?.id || !selectedTask.tarefa_id || !selectedTask.cliente_id) {
            setCardTempoRealizadoMs(null);
            setCardRegistroAtivo(null);
            return;
        }
        setCardLoadingTempo(true);
        setCardTempoRealizadoMs(null);
        setCardRegistroAtivo(null);
        let dataStr = '';
        if (selectedTask.data) {
            const d = typeof selectedTask.data === 'string' ? selectedTask.data : (selectedTask.displayData && selectedTask.displayData.toISOString ? selectedTask.displayData.toISOString() : '');
            dataStr = d ? (d.split('T')[0] || d) : '';
        } else if (selectedTask.displayData && selectedTask.displayData.toISOString) {
            dataStr = selectedTask.displayData.toISOString().split('T')[0];
        }
        const urlRealizado = `${API_BASE_URL}/registro-tempo/realizado?usuario_id=${usuario.id}&tarefa_id=${selectedTask.tarefa_id}&cliente_id=${encodeURIComponent(selectedTask.cliente_id)}${dataStr ? `&data=${dataStr}` : ''}`;
        const paramsAtivo = new URLSearchParams({
            usuario_id: usuario.id,
            tarefa_id: selectedTask.tarefa_id,
            cliente_id: selectedTask.cliente_id
        });
        Promise.all([
            fetch(urlRealizado, { credentials: 'include', headers: { Accept: 'application/json' } }).then((res) => res.ok ? res.json() : { success: false }),
            fetch(`${API_BASE_URL}/registro-tempo/ativo?${paramsAtivo}`, { credentials: 'include', headers: { Accept: 'application/json' } }).then((res) => res.ok ? res.json() : { success: false })
        ]).then(([resultRealizado, resultAtivo]) => {
            if (resultRealizado.success && resultRealizado.data && resultRealizado.data.tempo_realizado_ms != null) {
                setCardTempoRealizadoMs(resultRealizado.data.tempo_realizado_ms);
            } else {
                setCardTempoRealizadoMs(0);
            }
            if (resultAtivo.success && resultAtivo.data && resultAtivo.data.id) {
                setCardRegistroAtivo({ registro_id: resultAtivo.data.id });
            } else {
                setCardRegistroAtivo(null);
            }
        }).catch(() => {
            setCardTempoRealizadoMs(0);
            setCardRegistroAtivo(null);
        }).finally(() => setCardLoadingTempo(false));
    }, [selectedTask, usuario?.id]);

    // Ouvir eventos de timer iniciado/parado (ex.: pelo header ou Minhas tarefas) para atualizar o card
    useEffect(() => {
        const handleUpdate = () => {
            if (selectedTask && usuario?.id) refetchCardTempoEAtivo();
        };
        window.addEventListener('registro-tempo-iniciado', handleUpdate);
        window.addEventListener('registro-tempo-finalizado', handleUpdate);
        return () => {
            window.removeEventListener('registro-tempo-iniciado', handleUpdate);
            window.removeEventListener('registro-tempo-finalizado', handleUpdate);
        };
    }, [selectedTask, usuario?.id, refetchCardTempoEAtivo]);

    const handleIniciarRegistro = useCallback(async () => {
        if (!selectedTask || !usuario?.id || cardPlayLoading) return;
        setCardPlayLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/registro-tempo/iniciar`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                    tarefa_id: String(selectedTask.tarefa_id).trim(),
                    cliente_id: String(selectedTask.cliente_id).trim(),
                    usuario_id: parseInt(usuario.id, 10),
                    produto_id: selectedTask.produto_id ? String(selectedTask.produto_id).trim() : null
                })
            });
            const result = await res.json();
            if (!res.ok || !result.success) {
                if (result.error && result.error.includes('Já existe um registro')) {
                    refetchCardTempoEAtivo();
                    return;
                }
                alert(result.error || 'Erro ao iniciar registro de tempo');
                return;
            }
            setCardRegistroAtivo({ registro_id: result.data.id });
            window.dispatchEvent(new CustomEvent('registro-tempo-iniciado'));
            refetchCardTempoEAtivo();
        } catch (e) {
            alert('Erro ao iniciar registro de tempo');
        } finally {
            setCardPlayLoading(false);
        }
    }, [selectedTask, usuario?.id, cardPlayLoading, refetchCardTempoEAtivo]);

    const handlePararRegistro = useCallback(async () => {
        if (!selectedTask || !usuario?.id || !cardRegistroAtivo?.registro_id || cardPlayLoading) return;
        setCardPlayLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/registro-tempo/finalizar/${cardRegistroAtivo.registro_id}`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                    tarefa_id: String(selectedTask.tarefa_id).trim(),
                    usuario_id: parseInt(usuario.id, 10)
                })
            });
            const result = await res.json();
            if (!res.ok || !result.success) {
                alert(result.error || 'Erro ao finalizar registro de tempo');
                return;
            }
            setCardRegistroAtivo(null);
            window.dispatchEvent(new CustomEvent('registro-tempo-finalizado'));
            refetchCardTempoEAtivo();
        } catch (e) {
            alert('Erro ao finalizar registro de tempo');
        } finally {
            setCardPlayLoading(false);
        }
    }, [selectedTask, usuario?.id, cardRegistroAtivo, cardPlayLoading, refetchCardTempoEAtivo]);

    // Controles
    const handlePrev = () => {
        if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
        else setCurrentDate(subWeeks(currentDate, 1));
    };

    const handleNext = () => {
        if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
        else setCurrentDate(addWeeks(currentDate, 1));
    };

    const handleToday = () => {
        setCurrentDate(new Date());
    };

    const headerLabel = () => {
        if (viewMode === 'month') {
            return format(currentDate, 'MMMM yyyy', { locale: ptBR }).replace(/^\w/, c => c.toUpperCase());
        } else {
            const start = startOfWeek(currentDate, { locale: ptBR });
            const end = endOfWeek(currentDate, { locale: ptBR });
            if (isSameMonth(start, end)) {
                return `${format(start, 'dd')} a ${format(end, 'dd')} de ${format(start, 'MMMM yyyy', { locale: ptBR })}`;
            }
            return `${format(start, 'dd MMM')} a ${format(end, 'dd MMM, yyyy', { locale: ptBR })}`;
        }
    };

    const weekDaysHeader = () => {
        const days = [];
        const startDate = startOfWeek(new Date(), { locale: ptBR });
        for (let i = 0; i < 7; i++) {
            days.push(
                <div key={i} className="agenda-weekday">
                    {format(addWeeks(startDate, 0).setDate(startDate.getDate() + i), 'EEEE', { locale: ptBR })}
                </div>
            );
        }
        return days;
    };

    const tempoEstimado = selectedTask ? (Number(selectedTask.tempo_estimado_dia) || 0) : 0;
    const tempoEstimadoMs = tempoEstimado >= 1000 ? tempoEstimado : tempoEstimado * 3600000;
    const realizadoMs = cardTempoRealizadoMs != null ? cardTempoRealizadoMs : 0;
    const porcentagem = tempoEstimadoMs > 0 ? Math.min(100, (realizadoMs / tempoEstimadoMs) * 100) : 0;
    const porcentagemExcesso = tempoEstimadoMs > 0 && realizadoMs > tempoEstimadoMs
        ? Math.min(8, ((realizadoMs / tempoEstimadoMs) * 100) - 100)
        : 0;
    const corBarra = realizadoMs > tempoEstimadoMs ? '#dc2626' : '#f59e0b';

    return (
        <div className="agenda-colaborador-container">
            <div className="agenda-header">
                <div className="agenda-header-controls">
                    <button className="agenda-btn-nav" onClick={handleToday}>Hoje</button>
                    <button className="agenda-btn-nav" onClick={handlePrev}>
                        <i className="fas fa-chevron-left"></i>
                    </button>
                    <button className="agenda-btn-nav" onClick={handleNext}>
                        <i className="fas fa-chevron-right"></i>
                    </button>
                    <div className="agenda-current-date">
                        {headerLabel()}
                    </div>
                </div>

                <div className="agenda-view-toggle">
                    <button
                        className={`agenda-view-btn ${viewMode === 'week' ? 'active' : ''}`}
                        onClick={() => setViewMode('week')}
                    >
                        Semana
                    </button>
                    <button
                        className={`agenda-view-btn ${viewMode === 'month' ? 'active' : ''}`}
                        onClick={() => setViewMode('month')}
                    >
                        Mês
                    </button>
                </div>
            </div>

            <div className="agenda-main-row">
                <div className="agenda-grid">
                    <div className="agenda-weekdays">
                        {weekDaysHeader()}
                    </div>

                    <div className={`agenda-days-grid is-${viewMode}-view`}>
                        {daysInGrid.map((day, idx) => {
                            const isOutside = !isSameMonth(day, currentDate) && viewMode === 'month';
                            const isTodayDate = isToday(day);
                            const dayTasks = tarefas.filter(t => isSameDay(t.displayData, day));

                            return (
                                <div
                                    key={idx}
                                    className={`agenda-day-cell ${isOutside ? 'is-outside-month' : ''} ${isTodayDate ? 'is-today' : ''}`}
                                >
                                    <div className="agenda-day-header">
                                        <div className="agenda-day-number">
                                            {format(day, 'd')}
                                        </div>
                                    </div>

                                    <div className={`agenda-tasks-list${viewMode === 'month' ? ' agenda-tasks-list--month' : ''}`}>
                                        {dayTasks.map((t, idxTask) => (
                                            <div
                                                key={t.id || `task-${idxTask}`}
                                                className="agenda-task-item"
                                                role="button"
                                                tabIndex={0}
                                                title={`${t.displayCliente} - ${t.displayNome}`}
                                                onClick={() => setSelectedTask(t)}
                                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedTask(t); } }}
                                            >
                                                <span className="agenda-task-cliente">{t.displayCliente}</span>
                                                <span className="agenda-task-nome">{t.displayNome}</span>
                                                {t.is_pendente && (
                                                    <i className="fas fa-clock" style={{ marginLeft: '4px', fontSize: '10px' }} title="Aguardando aprovação"></i>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {selectedTask && (
                    <div className="agenda-detalhe-card-wrapper">
                        <div className="painel-usuario-tarefa-card agenda-detalhe-card">
                            <div className="agenda-detalhe-card-header">
                                <span className="agenda-detalhe-card-title">Detalhe da tarefa</span>
                                <button
                                    type="button"
                                    className="agenda-detalhe-close"
                                    onClick={() => { setSelectedTask(null); setCardTempoRealizadoMs(null); }}
                                    title="Fechar"
                                    aria-label="Fechar"
                                >
                                    <i className="fas fa-times"></i>
                                </button>
                            </div>
                            <div className="painel-usuario-tarefa-top">
                                <div className="painel-usuario-tarefa-nome">
                                    <span className="painel-usuario-tarefa-text">{selectedTask.displayNome}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    {cardRegistroAtivo ? (
                                        <button
                                            type="button"
                                            className="painel-usuario-stop-btn"
                                            title="Parar registro de tempo"
                                            disabled={cardPlayLoading}
                                            onClick={(e) => { e.stopPropagation(); handlePararRegistro(); }}
                                        >
                                            <i className="fas fa-stop"></i>
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            className="painel-usuario-play-btn"
                                            title="Iniciar registro de tempo"
                                            disabled={cardPlayLoading}
                                            onClick={(e) => { e.stopPropagation(); handleIniciarRegistro(); }}
                                        >
                                            <i className="fas fa-play"></i>
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '-4px' }}>
                                {selectedTask.displayCliente}
                            </div>
                            <div className="painel-usuario-barra-progresso-wrapper painel-usuario-barra-progresso-quadro" style={{ marginTop: '8px' }}>
                                <div className="painel-usuario-barra-progresso-container">
                                    <div className="painel-usuario-barra-progresso-base painel-usuario-barra-progresso-base-quadro">
                                        <div
                                            className="painel-usuario-barra-progresso-fill"
                                            style={{ width: `${porcentagem}%`, background: corBarra }}
                                        />
                                        {porcentagemExcesso > 0 && (
                                            <div
                                                className="painel-usuario-barra-progresso-fill-excesso"
                                                style={{ width: '25px', background: '#dc2626', left: '100%' }}
                                            />
                                        )}
                                    </div>
                                    <div className="painel-usuario-barra-progresso-label" style={{ color: realizadoMs > tempoEstimadoMs ? '#dc2626' : '#6b7280' }}>
                                        {porcentagem.toFixed(0)}%
                                    </div>
                                </div>
                            </div>
                            <div className="painel-usuario-tarefa-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                                <span className="painel-usuario-badge-estimado">
                                    <i className="fas fa-clock painel-usuario-estimado-icon-inline"></i>
                                    <span className="painel-usuario-estimado-label">Estimado:</span>
                                    <span className="painel-usuario-estimado-pill">{formatarTempoEstimado(selectedTask.tempo_estimado_dia)}</span>
                                </span>
                                <span className="painel-usuario-badge-realizado">
                                    <i className="fas fa-play-circle painel-usuario-realizado-icon-inline"></i>
                                    <span className="painel-usuario-realizado-label">Realizado:</span>
                                    <span className="painel-usuario-realizado-pill">
                                        {cardLoadingTempo ? '...' : formatarTempoHMS(realizadoMs)}
                                    </span>
                                </span>
                                <span className="painel-usuario-subtarefas-info" style={{ color: '#6b7280', fontSize: '11px' }}>
                                    0 pendentes
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {loading && (
                <div className="agenda-loading" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(255,255,255,0.8)' }}>
                    <i className="fas fa-spinner fa-spin fa-2x"></i>
                    <span>Carregando agenda...</span>
                </div>
            )}
        </div>
    );
};

export default AgendaColaborador;
