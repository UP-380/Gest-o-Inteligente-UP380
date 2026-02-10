import React, { useState, useEffect, useMemo, useRef } from 'react';
import Layout from '../../components/layout/Layout';
import FilterPeriodo from '../../components/filters/FilterPeriodo';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import Avatar from '../../components/user/Avatar';
import './RelatorioTempo.css';
import RelatorioTempoSpreadsheet from './RelatorioTempoSpreadsheet';

const MAX_PLANILHA_RECORDS = 5000;
const CHUNK_TAREFAS = 50;
const CHUNK_PRODUTOS = 80;

const RelatorioTempo = () => {
    const { usuario } = useAuth();
    const showToast = useToast();

    // --- STATE ---
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [habilitarFinaisSemana, setHabilitarFinaisSemana] = useState(false);
    const [habilitarFeriados, setHabilitarFeriados] = useState(false);

    const [usuarios, setUsuarios] = useState([]);
    const [selectedResponsaveis, setSelectedResponsaveis] = useState([]); // [] = todos; [id1, id2, ...] = múltiplos
    const [groupBy, setGroupBy] = useState('cliente'); // 'cliente', 'tarefa', 'produto'

    // Toolbar State
    const [activePopover, setActivePopover] = useState(null);
    const popoverRef = useRef(null);
    const [responsavelSearch, setResponsavelSearch] = useState('');

    // --- NEW LAZY LOADING STATE ---
    // Level 1: User Summaries (List with Totals)
    const [userSummaries, setUserSummaries] = useState([]); // [{ id, totalEstimado, totalRealizado, totalContratado, pendentes: [] }]

    // Level 2: User Details Cache (Subgroups: Client/Task/Product)
    // Map<userId, { loaded: boolean, subgroups: [ { id, title, total... } ] }>
    const [userDetailsCache, setUserDetailsCache] = useState({});

    // Level 3: Subgroup Records Cache (Individual Time Logs)
    // Map<uniqueKey, { loaded: boolean, items: [] }>
    // uniqueKey = `${userId}_${subgrouType}_${subgroupId}`
    const [subgroupRecordsCache, setSubgroupRecordsCache] = useState({});

    // Expansion State
    const [expandedUsers, setExpandedUsers] = useState({}); // { userId: boolean }
    const [expandedSubgroups, setExpandedSubgroups] = useState({}); // { uniqueKey: boolean }

    // --- VIEW MODE STATE ---
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'spreadsheet'
    const [spreadsheetRecords, setSpreadsheetRecords] = useState([]);
    const [spreadsheetLoading, setSpreadsheetLoading] = useState(false);

    const [loading, setLoading] = useState(false);

    const [nomesTarefas, setNomesTarefas] = useState({});
    const [nomesClientes, setNomesClientes] = useState({});
    const [nomesProdutos, setNomesProdutos] = useState({});

    // --- INITIALIZATION --- (não define período inicial; período é obrigatório para carregar)
    useEffect(() => {
        fetchUsuarios();
    }, []);

    const fetchUsuarios = async () => {
        try {
            const response = await fetch('/api/usuarios?limit=1000');
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    setUsuarios(result.data);
                }
            }
        } catch (error) {
            console.error('Erro ao buscar usuários:', error);
        }
    };

    // --- DATA FETCHING (LAZY) ---
    // 1. Fetch User Summaries & Totals
    const fetchInitialData = async () => {
        if (!dataInicio || !dataFim || usuarios.length === 0) return;

        setLoading(true);
        setUserSummaries([]);
        setUserDetailsCache({});
        setSubgroupRecordsCache({});
        setExpandedUsers({});
        setExpandedSubgroups({});

        try {
            // A. Prepare User IDs (múltiplos ou todos)
            const targetUserIds = selectedResponsaveis.length > 0
                ? selectedResponsaveis.filter(id => usuarios.some(u => u.id === id))
                : usuarios.map(u => u.id);

            // B. Fetch Pendentes (Lightweight)
            let pendentes = [];
            try {
                const resPendentes = await fetch('/api/atribuicoes-pendentes/aprovacao');
                if (resPendentes.ok) {
                    const json = await resPendentes.json();
                    const rawPendentes = json.data || [];

                    // Filter Pendentes by Date Range
                    const startMs = new Date(dataInicio).getTime();
                    const endMs = new Date(dataFim).getTime() + (24 * 60 * 60 * 1000); // End of day

                    pendentes = rawPendentes.filter(p => {
                        const d = new Date(p.data_inicio).getTime();
                        return d >= startMs && d < endMs;
                    }).map(p => ({
                        ...p,
                        id: `pendente_${p.id}`,
                        is_pendente: true,
                        // Ensure totals exist
                        tempo_realizado: Number(p.tempo_realizado) || Number(p.tempo_realizado_ms) || (p.data_inicio && p.data_fim ? (new Date(p.data_fim) - new Date(p.data_inicio)) : 0)
                    }));
                }
            } catch (e) {
                console.error("Erro fetching pendentes:", e);
            }

            // C. Fetch Cards Responsavel (Confirmed Totals) - Uses GestaoCapacidade Logic
            // Split into chunks if too many users to avoid URL limit or backend limit
            const chunks = [];
            const chunkSize = 50;
            for (let i = 0; i < targetUserIds.length; i += chunkSize) {
                chunks.push(targetUserIds.slice(i, i + chunkSize));
            }

            let summariesMap = {}; // { userId: { totalRealizado, totalEstimado } }

            // Need Member Mapping First
            let userToMember = {};
            let memberToUser = {};
            const resColab = await fetch('/api/colaboradores?limit=1000');
            if (resColab.ok) {
                const json = await resColab.json();
                (json.data || []).forEach(m => {
                    if (m.usuario_id) {
                        userToMember[m.usuario_id] = m.id;
                        memberToUser[m.id] = m.usuario_id;
                    }
                });
            }

            const targetMemberIds = targetUserIds.map(uid => userToMember[uid]).filter(Boolean);

            // Re-chunk with Member IDs
            const memChunks = [];
            for (let i = 0; i < targetMemberIds.length; i += chunkSize) {
                memChunks.push(targetMemberIds.slice(i, i + chunkSize));
            }

            await Promise.all(memChunks.map(async (chunkIds) => {
                const res = await fetch('/api/gestao-capacidade/cards/responsavel', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ids: chunkIds,
                        data_inicio: dataInicio,
                        data_fim: dataFim,
                        incluir_detalhes: false // Summary only
                    })
                });
                if (res.ok) {
                    const json = await res.json();
                    Object.assign(summariesMap, json.data || {});
                }
            }));


            // E. Fetch Contratado (Hours)
            let contractedMap = {};
            if (targetMemberIds.length > 0) {
                const resContr = await fetch(`/api/custo-colaborador-vigencia/horas-contratadas?membro_id=${targetMemberIds.join(',')}&data_inicio=${dataInicio}&data_fim=${dataFim}`);
                if (resContr.ok) {
                    const json = await resContr.json();
                    const dataC = json.data || {};
                    // Can be array or object
                    if (Array.isArray(dataC)) {
                        dataC.forEach(item => {
                            if (item && item.membro_id) {
                                contractedMap[item.membro_id] = (item.totalHoras || 0) * 3600000;
                            }
                        });
                    } else {
                        Object.entries(dataC).forEach(([mid, val]) => {
                            if (val) {
                                contractedMap[mid] = (val.horasContratadasPeriodo || val.totalHoras || 0) * 3600000;
                            }
                        });
                    }
                }
            }

            // F. Build User Overview List
            const overview = targetUserIds.map(uid => {
                const mid = userToMember[uid];
                const summary = mid ? summariesMap[mid] : null;
                const userPendentes = pendentes.filter(p => p.usuario_id === uid);

                const totalPendentes = userPendentes.reduce((acc, p) => acc + (p.tempo_realizado || 0), 0);
                const totalConfirmed = summary ? (summary.total_realizado_ms || 0) : 0;

                // Estimate comes from SUMMARY (Cards)
                const totalEstimado = summary ? (summary.total_estimado_ms || 0) : 0;

                const user = usuarios.find(u => u.id === uid);

                return {
                    id: uid,
                    memberId: mid,
                    type: 'user',
                    title: user ? (user.nome_usuario || user.email_usuario) : `ID: ${uid}`,
                    avatar: user ? (user.nome_usuario ? user.nome_usuario.charAt(0).toUpperCase() : '?') : '?',
                    foto: user?.foto_perfil,

                    totalRealizado: totalConfirmed + totalPendentes,
                    totalConfirmed: totalConfirmed,
                    totalEstimado: totalEstimado,
                    totalContratado: mid ? (contractedMap[mid] || 0) : 0,

                    pendentes: userPendentes, // Store for local usage

                    // Helpers for display
                    hasData: (totalConfirmed + totalPendentes + totalEstimado) > 0
                };
            }).filter(u => u.hasData || u.totalContratado > 0); // Hide empty users unless contracted

            // Sort by Total Realized
            overview.sort((a, b) => b.totalRealizado - a.totalRealizado);

            setUserSummaries(overview);

        } catch (error) {
            console.error("Erro fetchInitialData:", error);
            showToast('error', 'Erro ao carregar dados.');
        } finally {
            setLoading(false);
        }
    };

    // Trigger Initial Fetch (só quando período estiver preenchido)
    useEffect(() => {
        if (usuarios.length > 0 && dataInicio && dataFim) {
            fetchInitialData();
        }
    }, [dataInicio, dataFim, selectedResponsaveis, usuarios]);

    // Limpar dados quando período for removido
    useEffect(() => {
        if (!dataInicio || !dataFim) {
            setUserSummaries([]);
            setUserDetailsCache({});
            setSubgroupRecordsCache({});
            setExpandedUsers({});
            setExpandedSubgroups({});
            setSpreadsheetRecords([]);
        }
    }, [dataInicio, dataFim]);

    // Clear details cache when GroupBy changes
    useEffect(() => {
        setUserDetailsCache({});
        setSubgroupRecordsCache({});
        setExpandedUsers({});
        setExpandedSubgroups({});
    }, [groupBy]);

    // --- SPREADSHEET DATA FETCHING (só quando modo planilha; evita duplo fetch e sobrecarga VPS) ---
    const spreadsheetAbortRef = useRef(null);

    const fetchSpreadsheetData = async () => {
        if (!dataInicio || !dataFim) return;
        if (spreadsheetLoading) return;

        if (spreadsheetAbortRef.current) {
            spreadsheetAbortRef.current.abort();
        }
        const ac = new AbortController();
        spreadsheetAbortRef.current = ac;

        setSpreadsheetLoading(true);
        try {
            let url = `/api/registro-tempo?data_inicio=${dataInicio}&data_fim=${dataFim}&limit=${MAX_PLANILHA_RECORDS}`;
            if (selectedResponsaveis.length > 0) {
                url += `&usuario_id=${selectedResponsaveis.join(',')}`;
            }

            const response = await fetch(url, { signal: ac.signal });
            if (!response.ok) {
                if (response.status !== 499) setSpreadsheetRecords([]);
                return;
            }
            const json = await response.json();
            let records = json.data || [];
            const totalCount = json.count != null ? json.count : records.length;
            const truncated = totalCount > MAX_PLANILHA_RECORDS;

            const taskIds = new Set();
            records.forEach(r => { if (r.tarefa_id) taskIds.add(r.tarefa_id); });
            const missingTasks = [...taskIds].filter(id => !nomesTarefas[id]);
            if (missingTasks.length > 0) {
                for (let i = 0; i < missingTasks.length; i += CHUNK_TAREFAS) {
                    if (ac.signal.aborted) return;
                    const chunk = missingTasks.slice(i, i + CHUNK_TAREFAS);
                    await buscarNomesTarefas(chunk);
                }
            }

            const clienteIds = [...new Set(records.map(r => r.cliente_id).filter(Boolean))];
            const missingClientes = clienteIds.filter(id => !nomesClientes[id]);
            if (missingClientes.length > 0) {
                try {
                    const resClientes = await fetch('/api/cp_clientes-id-nome', { signal: ac.signal });
                    if (resClientes.ok) {
                        const result = await resClientes.json();
                        if (result.success && result.data && result.data.length > 0) {
                            const map = {};
                            result.data.forEach(c => {
                                if (c.id != null && c.nome != null) map[String(c.id)] = c.nome;
                            });
                            setNomesClientes(prev => ({ ...prev, ...map }));
                        }
                    }
                } catch (e) {
                    if (e.name !== 'AbortError') console.warn('Erro ao buscar nomes dos clientes para planilha:', e);
                }
            }

            const produtoIds = [...new Set(records.map(r => r.produto_id).filter(Boolean))];
            const missingProdutos = produtoIds.filter(id => !nomesProdutos[id]);
            if (missingProdutos.length > 0) {
                try {
                    for (let i = 0; i < missingProdutos.length; i += CHUNK_PRODUTOS) {
                        if (ac.signal.aborted) return;
                        const chunk = missingProdutos.slice(i, i + CHUNK_PRODUTOS);
                        const resProdutos = await fetch(`/api/produtos-por-ids?ids=${chunk.join(',')}`, { signal: ac.signal });
                        if (resProdutos.ok) {
                            const result = await resProdutos.json();
                            if (result.success && result.data && typeof result.data === 'object') {
                                setNomesProdutos(prev => ({ ...prev, ...result.data }));
                            }
                        }
                    }
                } catch (e) {
                    if (e.name !== 'AbortError') console.warn('Erro ao buscar nomes dos produtos para planilha:', e);
                }
            }

            if (!ac.signal.aborted) {
                setSpreadsheetRecords(records);
                if (truncated) showToast('info', `Exibindo até ${MAX_PLANILHA_RECORDS} registros. Ajuste os filtros para refinar.`);
            }
        } catch (error) {
            if (error.name === 'AbortError') return;
            console.error("Erro fetching spreadsheet data:", error);
            showToast('error', 'Erro ao carregar dados da planilha.');
            setSpreadsheetRecords([]);
        } finally {
            if (spreadsheetAbortRef.current === ac) spreadsheetAbortRef.current = null;
            setSpreadsheetLoading(false);
        }
    };

    useEffect(() => {
        if (viewMode === 'spreadsheet' && dataInicio && dataFim) {
            fetchSpreadsheetData();
        } else if (viewMode === 'list') {
            setSpreadsheetRecords([]);
        }
        return () => {
            if (spreadsheetAbortRef.current) {
                spreadsheetAbortRef.current.abort();
                spreadsheetAbortRef.current = null;
            }
        };
    }, [viewMode, dataInicio, dataFim, selectedResponsaveis]);


    // --- EXPANSION HANDLERS ---

    // 1. Toggle User (Level 1 -> 2)
    const toggleUser = async (userId) => {
        const isExpanded = !!expandedUsers[userId];
        const newExpanded = { ...expandedUsers, [userId]: !isExpanded };
        setExpandedUsers(newExpanded);

        if (!isExpanded) {
            // Expanding: Check Cache
            if (!userDetailsCache[userId]) {
                const userItem = userSummaries.find(u => u.id === userId);
                if (!userItem || !userItem.memberId) return;

                // Load Details
                try {
                    // Map groupBy to api 'tipo_detalhe'
                    const tipoDetalheMap = {
                        'cliente': 'clientes',
                        'tarefa': 'tarefas',
                        'produto': 'produtos',
                        'responsavel': 'responsaveis' // Should not happen here
                    };
                    const tipo = tipoDetalheMap[groupBy] || 'clientes';

                    const res = await fetch('/api/gestao-capacidade/cards/responsavel/detalhes', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id: userItem.memberId,
                            tipo_detalhe: tipo,
                            data_inicio: dataInicio,
                            data_fim: dataFim
                        })
                    });

                    if (res.ok) {
                        const json = await res.json();
                        let items = json.data || [];

                        // Metadata Names update
                        const newNames = {};
                        items.forEach(itm => {
                            newNames[itm.original_id || itm.id] = itm.nome;
                        });

                        if (groupBy === 'cliente') setNomesClientes(prev => ({ ...prev, ...newNames }));
                        else if (groupBy === 'tarefa') setNomesTarefas(prev => ({ ...prev, ...newNames }));
                        else if (groupBy === 'produto') setNomesProdutos(prev => ({ ...prev, ...newNames }));

                        // Add Pendentes to subgroups
                        const userPendentes = userItem.pendentes || [];
                        const pendentesByGroup = {};

                        userPendentes.forEach(p => {
                            let key = 'outros';
                            if (groupBy === 'cliente') key = p.cliente_id;
                            else if (groupBy === 'tarefa') key = p.tarefa_id;
                            else if (groupBy === 'produto') key = p.produto_id;

                            key = String(key || 'outros');
                            if (!pendentesByGroup[key]) pendentesByGroup[key] = 0;
                            pendentesByGroup[key] += (p.tempo_realizado || 0);
                        });

                        // Merge
                        // Map items to standardized structure
                        let mergedMap = {};
                        items.forEach(itm => {
                            const k = String(itm.original_id || itm.id);
                            mergedMap[k] = {
                                id: k,
                                title: itm.nome,
                                totalRealizado: itm.total_realizado_ms || 0,
                                totalEstimado: itm.total_estimado_ms || 0
                            };
                        });

                        Object.entries(pendentesByGroup).forEach(([k, total]) => {
                            if (!mergedMap[k]) {
                                // Subgroup exists only in pending
                                let title = 'Outros/Sem ID';
                                // Try to fetch name if ID exists
                                if (k !== 'outros') {
                                    if (groupBy === 'cliente') title = nomesClientes[k] || 'Cliente Carregando...';
                                    else if (groupBy === 'tarefa') title = nomesTarefas[k] || 'Tarefa Carregando...';
                                }
                                mergedMap[k] = {
                                    id: k,
                                    title: title,
                                    totalRealizado: 0,
                                    totalEstimado: 0
                                };
                            }
                            mergedMap[k].totalRealizado += total;
                        });

                        const sortedItems = Object.values(mergedMap).sort((a, b) => b.totalRealizado - a.totalRealizado);

                        setUserDetailsCache(prev => ({
                            ...prev,
                            [userId]: { loaded: true, subgroups: sortedItems }
                        }));
                    }

                } catch (e) {
                    console.error("Erro loading user details:", e);
                }
            }
        }
    };

    // --- HELPERS FOR METADATA ---
    const buscarNomesTarefas = async (ids) => {
        if (!ids || ids.length === 0) return;
        try {
            // Filter only unknown IDs
            const unknownIds = ids.filter(id => !nomesTarefas[id] && id !== 'outros');
            if (unknownIds.length === 0) return;

            const chunks = [];
            for (let i = 0; i < unknownIds.length; i += 50) chunks.push(unknownIds.slice(i, i + 50));

            await Promise.all(chunks.map(async (chunk) => {
                const response = await fetch(`/api/tarefas-por-ids?ids=${chunk.join(',')}`);
                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        setNomesTarefas(prev => ({ ...prev, ...result.data }));
                    }
                }
            }));
        } catch (err) { console.error("Erro fetching nomes tarefas:", err); }
    };


    // 2. Toggle Subgroup (Level 2 -> 3)
    const toggleSubGroup = async (userId, subGroupId) => {
        const uniqueKey = `${userId}_${subGroupId}`;
        const isExpanded = !!expandedSubgroups[uniqueKey];
        setExpandedSubgroups(prev => ({ ...prev, [uniqueKey]: !isExpanded }));

        if (!isExpanded) {
            // Load Records
            if (!subgroupRecordsCache[uniqueKey]) {
                try {
                    const userItem = userSummaries.find(u => u.id === userId);
                    if (!userItem) return;

                    // Fetch Confirmed Records
                    let url = `/api/registro-tempo?usuario_id=${userId}&data_inicio=${dataInicio}&data_fim=${dataFim}&limit=200`; // Limit 200 reasonable for lazy load
                    if (groupBy === 'cliente' && subGroupId !== 'outros') url += `&cliente_id=${subGroupId}`;
                    else if (groupBy === 'tarefa' && subGroupId !== 'outros') url += `&tarefa_id=${subGroupId}`;
                    else if (groupBy === 'produto' && subGroupId !== 'outros') url += `&produto_id=${subGroupId}`;

                    const res = await fetch(url);
                    let records = [];
                    if (res.ok) {
                        const json = await res.json();
                        records = (json.data || []).map(r => ({ ...r, tipo: 'realizado', is_pendente: false }));
                    }

                    // Add Pendentes
                    const userPendentes = userItem.pendentes || [];
                    const relevantPendentes = userPendentes.filter(p => {
                        let k = 'outros';
                        if (groupBy === 'cliente') k = p.cliente_id;
                        else if (groupBy === 'tarefa') k = p.tarefa_id;
                        else if (groupBy === 'produto') k = p.produto_id;
                        return String(k || 'outros') === String(subGroupId);
                    });

                    const allRecords = [...records, ...relevantPendentes].sort((a, b) => new Date(b.data_inicio) - new Date(a.data_inicio));

                    // --- Fetch Missing Task Names ---
                    const taskIds = [...new Set(allRecords.map(r => r.tarefa_id).filter(Boolean))];
                    if (taskIds.length > 0) {
                        buscarNomesTarefas(taskIds);
                    }

                    setSubgroupRecordsCache(prev => ({
                        ...prev,
                        [uniqueKey]: { loaded: true, items: allRecords }
                    }));

                } catch (e) {
                    console.error("Erro loading subgroup records:", e);
                }
            }
        }
    };


    // --- HELPERS ---
    const formatTime = (ms) => {
        if (!ms) return '0h 0min';
        const seconds = Math.floor(ms / 1000);
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h}h ${m}min`;
    };

    const formatDate = (isoString) => {
        if (!isoString) return '';
        const d = new Date(isoString);
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    };

    // Filtered Users for Search Dropdown
    const filteredUsuariosSearch = useMemo(() => {
        if (!responsavelSearch) return usuarios;
        const lower = responsavelSearch.toLowerCase();
        return usuarios.filter(u =>
            (u.nome_usuario || '').toLowerCase().includes(lower) ||
            (u.email_usuario || '').toLowerCase().includes(lower)
        );
    }, [usuarios, responsavelSearch]);

    // Handle Click Outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (popoverRef.current && !popoverRef.current.contains(event.target)) {
                if (event.target.closest('.periodo-dropdown') ||
                    event.target.closest('.periodo-popup') ||
                    event.target.closest('.periodo-container') ||
                    event.target.closest('[class*="periodo-"]') ||
                    event.target.closest('.periodo-quick-select') ||
                    event.target.closest('.periodo-portal-wrapper')
                ) {
                    return;
                }
                setActivePopover(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Total Geral
    const totalGeralMs = useMemo(() => {
        return userSummaries.reduce((acc, u) => acc + (u.totalRealizado || 0), 0);
    }, [userSummaries]);


    return (
        <Layout>
            <div className="container">
                <main className="main-content relatorio-tempo-main">

                    {/* Header */}
                    <div className="relatorio-header cadastro-listing-page-header">
                        <div className="relatorio-header-left">
                            <div className="relatorio-header-icon">
                                <i className="fas fa-chart-pie"></i>
                            </div>
                            <div>
                                <h1 className="relatorio-title">Relatório de Tempo</h1>
                                <p className="relatorio-subtitle">Análise gerencial de horas rastreadas por equipe, cliente e tarefa</p>
                            </div>
                        </div>
                        {(dataInicio && dataFim) && (
                            <div style={{ marginLeft: 'auto', fontWeight: 'bold', color: '#64748b' }}>
                                Total Geral: <span style={{ color: '#10b981', fontSize: '1.1em' }}>{formatTime(totalGeralMs)}</span>
                            </div>
                        )}
                    </div>

                    {/* Filtros: Período (obrigatório) + Toolbar */}
                    <div className="relatorio-filters-toolbar" ref={popoverRef}>
                        <div className={`rt-periodo-wrapper ${(!dataInicio || !dataFim) ? 'rt-periodo-obrigatorio' : ''}`}>
                            <FilterPeriodo
                                dataInicio={dataInicio}
                                dataFim={dataFim}
                                onInicioChange={(e) => setDataInicio(e.target.value)}
                                onFimChange={(e) => setDataFim(e.target.value)}
                                showWeekendToggle={true}
                                onWeekendToggleChange={setHabilitarFinaisSemana}
                                showHolidayToggle={true}
                                onHolidayToggleChange={setHabilitarFeriados}
                            />
                        </div>

                        <div className="relatorio-toolbar">
                            {/* Responsavel (múltipla escolha + badge com quantidade) */}
                            <div className="toolbar-item toolbar-item-responsavel">
                                <div
                                    className={`toolbar-icon-wrap-responsavel ${activePopover === 'responsavel' ? 'active' : ''}`}
                                    onClick={() => setActivePopover(activePopover === 'responsavel' ? null : 'responsavel')}
                                    title="Filtrar Responsáveis"
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActivePopover(activePopover === 'responsavel' ? null : 'responsavel'); } }}
                                >
                                    <span className="toolbar-icon toolbar-icon-responsavel">
                                        <i className="fas fa-user-friends"></i>
                                    </span>
                                    {selectedResponsaveis.length > 0 && (
                                        <span className="toolbar-icon-badge" aria-label={`${selectedResponsaveis.length} responsável(is) selecionado(s)`}>
                                            {selectedResponsaveis.length}
                                        </span>
                                    )}
                                </div>
                                {activePopover === 'responsavel' && (
                                    <div className="responsavel-card-dropdown">
                                        <div className="responsavel-card-search">
                                            <div className="responsavel-card-search-wrapper">
                                                <i className="fas fa-search" style={{ color: '#9ca3af', fontSize: '14px' }}></i>
                                                <input
                                                    type="text"
                                                    className="responsavel-card-search-input"
                                                    placeholder="Buscar colaborador..."
                                                    autoComplete="off"
                                                    value={responsavelSearch}
                                                    onChange={(e) => setResponsavelSearch(e.target.value)}
                                                    autoFocus
                                                />
                                            </div>
                                        </div>
                                        <div className="responsavel-card-dropdown-content custom-scrollbar">
                                            <div
                                                className={`responsavel-card-option ${selectedResponsaveis.length === 0 ? 'selected' : ''}`}
                                                onClick={() => setSelectedResponsaveis([])}
                                            >
                                                <div className="responsavel-card-option-avatar" style={{ background: '#e2e8f0', color: '#64748b' }}>
                                                    <i className="fas fa-users"></i>
                                                </div>
                                                <span className="responsavel-card-option-label">Todos os Responsáveis</span>
                                            </div>
                                            {filteredUsuariosSearch.map(u => {
                                                const isSelected = selectedResponsaveis.includes(u.id);
                                                return (
                                                    <div
                                                        key={u.id}
                                                        className={`responsavel-card-option ${isSelected ? 'selected' : ''}`}
                                                        onClick={() => {
                                                            setSelectedResponsaveis(prev =>
                                                                isSelected ? prev.filter(id => id !== u.id) : [...prev, u.id]
                                                            );
                                                        }}
                                                    >
                                                        <Avatar
                                                            avatarId={u.foto_perfil}
                                                            nomeUsuario={u.nome_usuario}
                                                            size="small"
                                                            className="responsavel-card-option-avatar"
                                                        />
                                                        <span className="responsavel-card-option-label" style={{ marginLeft: '8px' }}>{u.nome_usuario}</span>
                                                        {isSelected && <i className="fas fa-check responsavel-card-option-check" aria-hidden></i>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Group By */}
                            <div className="toolbar-item">
                                <div
                                    className={`toolbar-icon ${activePopover === 'group' ? 'active' : ''}`}
                                    onClick={() => setActivePopover(activePopover === 'group' ? null : 'group')}
                                    title="Agrupar Por"
                                >
                                    <i className="fas fa-layer-group"></i>
                                </div>
                                {activePopover === 'group' && (
                                    <div className="grouphub-dropdown">
                                        {[
                                            { id: 'cliente', label: 'Cliente', icon: 'fa-briefcase' },
                                            { id: 'tarefa', label: 'Tarefa', icon: 'fa-tasks' },
                                            { id: 'produto', label: 'Produto', icon: 'fa-box' }
                                        ].map(opt => (
                                            <div
                                                key={opt.id}
                                                className={`grouphub-option ${groupBy === opt.id ? 'selected' : ''}`}
                                                onClick={() => {
                                                    setGroupBy(opt.id);
                                                    setActivePopover(null);
                                                }}
                                            >
                                                <i className={`fas ${opt.icon}`}></i>
                                                {opt.label}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* VIEW SWITCHER: Lista | Toggle | Planilha */}
                            <div className="rt-view-switcher">
                                <button
                                    type="button"
                                    className={`rt-view-option ${viewMode === 'list' ? 'active' : ''}`}
                                    onClick={() => setViewMode('list')}
                                    title="Visualização em Lista"
                                >
                                    <i className="fas fa-list-ul"></i>
                                    <span>Lista</span>
                                </button>
                                <label className="rt-view-toggle" title={viewMode === 'list' ? 'Ir para Planilha' : 'Ir para Lista'}>
                                    <input
                                        type="checkbox"
                                        checked={viewMode === 'spreadsheet'}
                                        onChange={(e) => setViewMode(e.target.checked ? 'spreadsheet' : 'list')}
                                        aria-label="Alternar visualização"
                                    />
                                    <span className="rt-view-toggle-slider"></span>
                                </label>
                                <button
                                    type="button"
                                    className={`rt-view-option ${viewMode === 'spreadsheet' ? 'active' : ''}`}
                                    onClick={() => setViewMode('spreadsheet')}
                                    title="Visualização em Planilha (Matriz)"
                                >
                                    <i className="fas fa-th-large"></i>
                                    <span>Planilha</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="relatorio-main-area">
                        {(!dataInicio || !dataFim) ? (
                            <div className="relatorio-empty relatorio-empty-periodo">
                                <i className="fas fa-calendar-alt" style={{ fontSize: '2rem', marginBottom: '1rem', display: 'block', color: '#94a3b8' }}></i>
                                <p>Selecione o período para exibir o relatório</p>
                                <p className="relatorio-empty-hint">O filtro de período é obrigatório para carregar os dados em lista ou planilha.</p>
                            </div>
                        ) : viewMode === 'list' ? (
                            <>
                                <div className="relatorio-columns-header">
                                    <div className="rt-col-estimado">Estimado</div>
                                    <div className="rt-col-realizado">Rastreado</div>
                                </div>

                                <div className="relatorio-content">
                                    {loading ? (
                                        <div className="relatorio-loading">
                                            <div className="relatorio-spinner"></div>
                                            <p>Carregando dados...</p>
                                        </div>
                                    ) : userSummaries.length === 0 ? (
                                        <div className="relatorio-empty">
                                            <i className="fas fa-search" style={{ fontSize: '2rem', marginBottom: '1rem', display: 'block' }}></i>
                                            Nenhum registro encontrado para os filtros selecionados.
                                        </div>
                                    ) : (
                                        <div className="relatorio-list">
                                            {userSummaries.map(user => {
                                                const isExpanded = !!expandedUsers[user.id];
                                                const details = userDetailsCache[user.id];
                                                const subgroups = details ? details.subgroups : [];

                                                const excedenteEstimado = user.totalRealizado - user.totalEstimado;
                                                const excedenteContratado = user.totalContratado > 0 ? (user.totalRealizado - user.totalContratado) : null;

                                                return (
                                                    <div key={user.id} className="relatorio-user-group-item" style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                        {/* User Row */}
                                                        <div
                                                            className="group-header user-header"
                                                            onClick={() => toggleUser(user.id)}
                                                            style={{ background: '#fff', padding: '1.25rem 1.5rem', justifyContent: 'space-between', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                        >
                                                            <div className="group-title" style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <i className={`fas fa-chevron-right group-icon ${isExpanded ? 'expanded' : ''}`}></i>
                                                                <Avatar
                                                                    avatarId={user.foto}
                                                                    nomeUsuario={user.title}
                                                                    size="small"
                                                                />
                                                                {user.title}
                                                            </div>

                                                            <div className="group-stats" style={{ display: 'flex', alignItems: 'center' }}>
                                                                {user.totalContratado > 0 && (
                                                                    <span className="rt-badge contratadas" style={{ marginRight: '1rem' }}>
                                                                        {formatTime(user.totalContratado)}
                                                                        {excedenteContratado > 0 && (
                                                                            <span className="rt-badge-excedido" style={{ marginLeft: '4px' }}>
                                                                                (+{formatTime(excedenteContratado)})
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                )}
                                                                <div className="rt-col-estimado">
                                                                    <span className={`rt-badge estimado ${excedenteEstimado > 0 ? 'excedido' : ''}`}>
                                                                        <span className="rt-badge-tempo">{formatTime(user.totalEstimado)}</span>
                                                                        {excedenteEstimado > 0 && <span className="rt-badge-excedido">(+{formatTime(excedenteEstimado)})</span>}
                                                                    </span>
                                                                </div>
                                                                <div className="rt-col-realizado">
                                                                    <span className="rt-badge realizado">
                                                                        {formatTime(user.totalRealizado)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Subgroups (Level 2) */}
                                                        {isExpanded && (
                                                            <div className="relatorio-subgroups-container" style={{ display: 'block' }}>
                                                                {!details ? (
                                                                    <div style={{ padding: '1rem', paddingLeft: '3rem', color: '#64748b' }}>Carregando detalhes...</div>
                                                                ) : subgroups.length === 0 ? (
                                                                    <div style={{ padding: '1rem', paddingLeft: '3rem', color: '#64748b' }}>Sem detalhes para exibir.</div>
                                                                ) : (
                                                                    subgroups.map(sub => {
                                                                        const subKey = `${user.id}_${sub.id}`;
                                                                        const isSubExpanded = !!expandedSubgroups[subKey];
                                                                        const recordsData = subgroupRecordsCache[subKey];
                                                                        const records = recordsData ? recordsData.items : [];

                                                                        const subExcedente = sub.totalRealizado - sub.totalEstimado;

                                                                        return (
                                                                            <div key={subKey} className="relatorio-subgroup-item">
                                                                                <div
                                                                                    className="group-header subgroup-header"
                                                                                    onClick={() => toggleSubGroup(user.id, sub.id)}
                                                                                    style={{ paddingLeft: '3rem', paddingRight: '1.5rem', background: '#f8fafc', height: '48px' }}
                                                                                >
                                                                                    <div className="group-title" style={{ fontSize: '0.9rem' }}>
                                                                                        <i className={`fas fa-chevron-right group-icon ${isSubExpanded ? 'expanded' : ''}`}></i>
                                                                                        {/* Icons based on groupBy */}
                                                                                        <i className={`fas ${groupBy === 'cliente' ? 'fa-briefcase' : groupBy === 'tarefa' ? 'fa-tasks' : 'fa-box'} subgroup-type-icon`} style={{ marginRight: '8px' }}></i>
                                                                                        {sub.title}
                                                                                    </div>
                                                                                    <div className="group-stats">
                                                                                        <div className="rt-col-estimado">
                                                                                            {sub.totalEstimado > 0 && (
                                                                                                <span className={`rt-badge estimado small ${subExcedente > 0 ? 'excedido' : ''}`}>
                                                                                                    {formatTime(sub.totalEstimado)}
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                        <div className="rt-col-realizado">
                                                                                            <span className="rt-badge realizado small">
                                                                                                {formatTime(sub.totalRealizado)}
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>

                                                                                {/* Records (Level 3) - agrupados por data */}
                                                                                {isSubExpanded && (
                                                                                    <div className="relatorio-records-container">
                                                                                        {!recordsData ? (
                                                                                            <div style={{ padding: '1rem', paddingLeft: '5rem' }}>Carregando registros...</div>
                                                                                        ) : records.length === 0 ? (
                                                                                            <div style={{ padding: '1rem', paddingLeft: '5rem' }}>Sem registros.</div>
                                                                                        ) : (() => {
                                                                                            const porData = {};
                                                                                            records.forEach(reg => {
                                                                                                const dia = reg.data_inicio ? reg.data_inicio.split('T')[0] : 'sem-data';
                                                                                                if (!porData[dia]) porData[dia] = [];
                                                                                                porData[dia].push(reg);
                                                                                            });
                                                                                            const datasOrdenadas = Object.keys(porData).sort((a, b) => (b || '').localeCompare(a || ''));
                                                                                            return (
                                                                                                <div className="rt-table">
                                                                                                    <div className="rt-table-header" style={{ paddingLeft: '5rem' }}>
                                                                                                        <div className="rt-th" style={{ width: '120px' }}>Data</div>
                                                                                                        <div className="rt-th" style={{ flex: 1 }}>Tarefa</div>
                                                                                                        <div className="rt-th" style={{ width: '120px' }}>Início</div>
                                                                                                        <div className="rt-th" style={{ width: '120px' }}>Fim</div>
                                                                                                        <div className="rt-th" style={{ width: '120px' }}>Duração</div>
                                                                                                    </div>
                                                                                                    {datasOrdenadas.map(dia => (
                                                                                                        <React.Fragment key={dia}>
                                                                                                            <div className="rt-table-row rt-table-row-data-header" style={{ paddingLeft: '5rem' }}>
                                                                                                                <div className="rt-td" style={{ width: '120px', fontWeight: '600', color: '#475569' }}>{dia === 'sem-data' ? 'Sem data' : formatDate(dia)}</div>
                                                                                                                <div className="rt-td" style={{ flex: 1, fontSize: '0.8125rem', color: '#64748b' }}>
                                                                                                                    {porData[dia].length} registro{porData[dia].length !== 1 ? 's' : ''} · Total: {formatTime(porData[dia].reduce((acc, r) => acc + (r.tempo_realizado || 0), 0))}
                                                                                                                </div>
                                                                                                                <div className="rt-td" style={{ width: '120px' }}></div>
                                                                                                                <div className="rt-td" style={{ width: '120px' }}></div>
                                                                                                                <div className="rt-td" style={{ width: '120px' }}></div>
                                                                                                            </div>
                                                                                                            {porData[dia].map(reg => (
                                                                                                                <div key={reg.id} className={`rt-table-row ${reg.is_pendente ? 'pendente-stripe' : ''}`} style={{ paddingLeft: '5rem' }}>
                                                                                                                    <div className="rt-td" style={{ width: '120px' }}>{formatDate(reg.data_inicio)}</div>
                                                                                                                    <div className="rt-td" style={{ flex: 1 }}>
                                                                                                                        <div style={{ fontWeight: '500' }}>{nomesTarefas[reg.tarefa_id] || `Tarefa #${reg.tarefa_id}`}</div>
                                                                                                                        {reg.is_pendente && <div style={{ fontSize: '0.75rem', color: '#f59e0b' }}><i className="fas fa-exclamation-triangle"></i> Pendente de Aprovação</div>}
                                                                                                                        {reg.observacao && <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{reg.observacao}</div>}
                                                                                                                    </div>
                                                                                                                    <div className="rt-td" style={{ width: '120px' }}>
                                                                                                                        {reg.data_inicio ? new Date(reg.data_inicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                                                                                    </div>
                                                                                                                    <div className="rt-td" style={{ width: '120px' }}>
                                                                                                                        {reg.data_fim ? new Date(reg.data_fim).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                                                                                    </div>
                                                                                                                    <div className="rt-td" style={{ width: '120px', fontWeight: 'bold', color: '#3b82f6' }}>
                                                                                                                        {formatTime(reg.tempo_realizado)}
                                                                                                                    </div>
                                                                                                                </div>
                                                                                                            ))}
                                                                                                        </React.Fragment>
                                                                                                    ))}
                                                                                                </div>
                                                                                            );
                                                                                        })()}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <RelatorioTempoSpreadsheet
                                dataInicio={dataInicio}
                                dataFim={dataFim}
                                registros={spreadsheetRecords}
                                loading={spreadsheetLoading}
                                groupBy={groupBy}
                                nomesTarefas={nomesTarefas}
                                nomesClientes={nomesClientes}
                                nomesProdutos={nomesProdutos}
                                usuarios={usuarios}
                            />
                        )}
                    </div>
                </main>
            </div>
        </Layout>
    );
};

export default RelatorioTempo;
