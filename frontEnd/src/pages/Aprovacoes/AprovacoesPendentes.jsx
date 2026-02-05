import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CustomSelect from '../../components/vinculacoes/CustomSelect';
import SelecaoTarefasPlugRapido from '../../components/vinculacoes/SelecaoTarefasPlugRapido';
import FilterPeriodo from '../../components/filters/FilterPeriodo';
import TempoEstimadoInput from '../../components/common/TempoEstimadoInput';
import ModalNovaTarefaRapida from '../../components/vinculacoes/ModalNovaTarefaRapida';
import Avatar from '../../components/user/Avatar';
import { useToast } from '../../hooks/useToast';
import './AprovacoesPendentes.css';

const API_BASE_URL = '/api';

const AprovacoesPendentes = () => {
    const showToast = useToast();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const pendenteIdParam = searchParams.get('id');
    const hasAutoOpened = useRef(false);

    const [pendentes, setPendentes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [saving, setSaving] = useState(false);
    const [feriadosCache, setFeriadosCache] = useState({});

    // Estado do form de edição/aprovação
    const [showNewTaskModal, setShowNewTaskModal] = useState(false);
    const [tasksRefreshToken, setTasksRefreshToken] = useState(0);

    // Estado do form de edição/aprovação
    const [editForm, setEditForm] = useState({
        cliente_id: '',
        produto_id: '',
        tarefa_id: '',
        data_inicio: '',
        data_fim: '',
        tempo_estimado_ms: 28800000, // 8h default
        habilitarFinaisSemana: false,
        habilitarFeriados: false
    });

    // Listas para dropdowns de edição
    const [clientesOptions, setClientesOptions] = useState([]);
    const [produtosOptions, setProdutosOptions] = useState([]);
    const [tempoDisponivel, setTempoDisponivel] = useState(null);
    const [membroId, setMembroId] = useState(null);

    useEffect(() => {
        fetchPendentes();
        fetchClientes();
        fetchFeriados();
    }, []);

    const fetchFeriados = async () => {
        const year = new Date().getFullYear();
        try {
            const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`);
            if (response.ok) {
                const feriadosData = await response.json();
                const feriadosMap = {};
                feriadosData.forEach(feriado => {
                    feriadosMap[feriado.date] = feriado.name;
                });
                setFeriadosCache(feriadosMap);
            }
        } catch (error) {
            /* silent */
        }
    };

    const fetchPendentes = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/atribuicoes-pendentes/aprovacao`);
            const json = await res.json();
            if (json.success) {
                const data = json.data || [];
                setPendentes(data);

                // Abrir automaticamente se houver ID na URL
                if (pendenteIdParam && !hasAutoOpened.current && data.length > 0) {
                    const target = data.find(p => String(p.id) === String(pendenteIdParam));
                    if (target) {
                        handleOpenAprovar(target);
                        hasAutoOpened.current = true;
                    }
                }
            }
        } catch (e) { /* silent */ } finally { setLoading(false); }
    };

    const fetchClientes = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/cp_clientes-id-nome?limit=1000`);
            const json = await res.json();
            if (json.success && json.data) {
                setClientesOptions(json.data.map(c => ({ value: String(c.id), label: c.nome })));
            }
        } catch (e) { /* silent */ }
    };

    const fetchProdutos = async (clienteId) => {
        if (!clienteId) {
            setProdutosOptions([]);
            return;
        }
        try {
            const res = await fetch(`${API_BASE_URL}/produtos-por-cliente?clienteId=${clienteId}`);
            const json = await res.json();
            if (json.success && json.data) {
                setProdutosOptions(json.data.map(p => ({ value: String(p.id), label: p.nome })));
            } else {
                setProdutosOptions([]);
            }
        } catch (e) { setProdutosOptions([]); }
    };

    // Ao abrir o modal
    const handleOpenAprovar = async (item) => {
        setSelectedItem(item);
        setMembroId(null);

        const tempoRaw = item.tempo_estimado_dia || 0;

        await fetchProdutos(item.cliente_id);

        // Heuristica: Se < 50000 (aprox 13h em segundos, ou 50s em ms), assume que é segundos (legado erro).
        // 1h = 3600 (sec) vs 3600000 (ms).
        // 10h = 36000 (sec).
        // 1min = 60000 (ms).
        // Threshold de 50000 separa bem segundos típicos de ms típicos.
        const tempoMs = tempoRaw < 50000 ? tempoRaw * 1000 : tempoRaw;

        setEditForm({
            cliente_id: item.cliente_id ? String(item.cliente_id) : '',
            produto_id: item.produto_id ? String(item.produto_id) : '',
            tarefa_id: item.tarefa_id ? String(item.tarefa_id) : '',
            data_inicio: item.data_inicio ? item.data_inicio.split('T')[0] : '',
            data_fim: item.data_fim ? item.data_fim.split('T')[0] : '',
            tempo_estimado_ms: tempoMs,
            habilitarFinaisSemana: false,
            habilitarFeriados: false
        });

        setModalOpen(true);
    };

    useEffect(() => {
        if (modalOpen && selectedItem && editForm.data_inicio && editForm.data_fim) {
            fetchTempoDisponivel();
        }
    }, [
        modalOpen,
        editForm.data_inicio,
        editForm.data_fim,
        editForm.tempo_estimado_ms,
        editForm.habilitarFinaisSemana,
        editForm.habilitarFeriados,
        selectedItem?.usuario_id
    ]);

    const fetchTempoDisponivel = async () => {
        if (!selectedItem?.usuario_id) return;

        try {
            let currentMembroId = membroId;
            if (!currentMembroId) {
                const resMembro = await fetch(`${API_BASE_URL}/membros-por-usuario/${selectedItem.usuario_id}`);
                const jsonMembro = await resMembro.json();
                if (jsonMembro.success && jsonMembro.data && jsonMembro.data.length > 0) {
                    currentMembroId = jsonMembro.data[0].id;
                    setMembroId(currentMembroId);
                } else {
                    setTempoDisponivel(null);
                    return;
                }
            }

            const resContratadas = await fetch(`${API_BASE_URL}/custo-colaborador-vigencia/horas-contratadas?membro_id=${currentMembroId}&data_inicio=${editForm.data_inicio}&data_fim=${editForm.data_fim}`);
            const jsonContratadas = await resContratadas.json();
            const horasContratadasPorDia = (jsonContratadas.success && jsonContratadas.data) ? (jsonContratadas.data.horascontratadasdia || 0) : 0;

            const params = new URLSearchParams({
                data_inicio: editForm.data_inicio,
                data_fim: editForm.data_fim,
                responsavel_id: currentMembroId
            });
            const resAssigned = await fetch(`${API_BASE_URL}/tempo-estimado/total?${params}`);
            const jsonAssigned = await resAssigned.json();
            const tempoAssignedMs = jsonAssigned.success && jsonAssigned.data ? (jsonAssigned.data[currentMembroId] || 0) : 0;

            const dataInicio = new Date(editForm.data_inicio + 'T12:00:00');
            const dataFim = new Date(editForm.data_fim + 'T12:00:00');
            let diasValidos = 0;
            let current = new Date(dataInicio);

            while (current <= dataFim) {
                const dateStr = current.toISOString().split('T')[0];
                const dayOfWeek = current.getDay();
                const isW = dayOfWeek === 0 || dayOfWeek === 6;
                const isH = feriadosCache[dateStr] !== undefined;

                let contar = true;
                if (isW && !editForm.habilitarFinaisSemana) contar = false;
                if (isH && !editForm.habilitarFeriados) contar = false;

                if (contar) diasValidos++;
                current.setDate(current.getDate() + 1);
            }

            const capacidadeTotalMsAtribuida = horasContratadasPorDia * diasValidos * 3600000;
            const novoComprometimentoMs = (editForm.tempo_estimado_ms || 0) * diasValidos;
            const disponivelMs = capacidadeTotalMsAtribuida - tempoAssignedMs - novoComprometimentoMs;

            setTempoDisponivel(disponivelMs);
        } catch (error) {
            setTempoDisponivel(null);
        }
    };

    const formatarTempoDisponivel = (ms) => {
        const totalMinutos = Math.floor(Math.abs(ms) / 60000);
        const horas = Math.floor(totalMinutos / 60);
        const minutos = totalMinutos % 60;
        const sinal = ms < 0 ? '-' : '';

        if (minutos === 0) return `${sinal}${horas}h`;
        return `${sinal}${horas}h ${minutos}min`;
    };

    const handleClienteChange = (val) => {
        setEditForm(prev => ({ ...prev, cliente_id: val, produto_id: '', tarefa_id: '' }));
        fetchProdutos(val);
    };

    const handleProdutoChange = (val) => {
        setEditForm(prev => ({ ...prev, produto_id: val, tarefa_id: '' }));
    };

    const handleConfirmAprovar = async () => {
        if (!selectedItem) return;

        const payload = {
            cliente_id: editForm.cliente_id,
            produto_id: editForm.produto_id,
            tarefa_id: editForm.tarefa_id,
            data_inicio: `${editForm.data_inicio}T00:00:00`,
            data_fim: `${editForm.data_fim}T23:59:59`,
            tempo_estimado_dia: editForm.tempo_estimado_ms
        };

        setSaving(true);
        try {
            const res = await fetch(`${API_BASE_URL}/atribuicoes-pendentes/${selectedItem.id}/aprovar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const json = await res.json();
            if (json.success) {
                showToast('success', 'Aprovado com sucesso!');
                setModalOpen(false);
                fetchPendentes();
            } else {
                showToast('error', 'Erro: ' + (json.error || json.message || 'Erro desconhecido'));
            }
        } catch (e) {
            showToast('error', 'Erro ao aprovar.');
        } finally {
            setSaving(false);
        }
    };

    const handleNewTaskSuccess = (newTaskId) => {
        setTasksRefreshToken(prev => prev + 1);
        setEditForm(prev => ({ ...prev, tarefa_id: String(newTaskId) }));
    };

    return (
        <Layout>
            <div className="container">
                <main className="main-content">
                    <div className="aprovacoes-section">
                        <div className="aprovacoes-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <div className="aprovacoes-header-left" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                <div className="aprovacoes-header-icon" style={{
                                    width: '64px',
                                    height: '64px',
                                    backgroundColor: '#f3f4f6',
                                    borderRadius: '16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <i className="fas fa-check-double" style={{ fontSize: '32px', color: '#0e3b6f' }}></i>
                                </div>
                                <div>
                                    <h1 className="aprovacoes-title" style={{ margin: 0, fontSize: '1.875rem', fontWeight: 700, color: '#111827' }}>Aprovações Pendentes</h1>
                                    <p className="aprovacoes-subtitle" style={{ margin: 0, color: '#6b7280' }}>Gerencie os plugs rápidos realizados pelos colaboradores</p>
                                </div>
                            </div>
                            <button className="btn-voltar" onClick={() => navigate('/gestao-capacidade')}>
                                <i className="fas fa-arrow-left"></i> Voltar para Gestão de Capacidade
                            </button>
                        </div>

                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '40px' }}><i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: '#0e3b6f' }}></i></div>
                        ) : pendentes.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '80px 40px', color: '#9ca3af' }}>
                                <i className="fas fa-check-circle" style={{ fontSize: '4rem', marginBottom: '20px', opacity: 0.5 }}></i>
                                <p style={{ fontSize: '1.1rem' }}>Nenhuma pendência encontrada no momento.</p>
                            </div>
                        ) : (
                            <div className="aprovacoes-grid">
                                {pendentes.map(p => (
                                    <div key={p.id} className="aprovacao-card">
                                        <div className="aprovacao-card-header">
                                            <div className="aprovacao-user-info">
                                                <Avatar
                                                    avatarId={p.usuario?.foto_perfil}
                                                    nomeUsuario={p.usuario?.nome_usuario || 'Usuário'}
                                                    size="normal"
                                                    className="aprovacao-user-avatar"
                                                />
                                                <div>
                                                    <div className="aprovacao-user-name">{p.usuario?.nome_usuario || 'Usuário'}</div>
                                                    <div className="aprovacao-date">Criado em {new Date(p.criado_em).toLocaleDateString()}</div>
                                                </div>
                                            </div>
                                            <div style={{
                                                backgroundColor: '#fff7ed', color: '#d97706',
                                                padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold'
                                            }}>PENDENTE</div>
                                            {(!p.cliente_id || !p.tarefa_id) && (
                                                <div style={{
                                                    backgroundColor: '#fee2e2', color: '#dc2626', marginLeft: '8px',
                                                    padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold',
                                                    border: '1px solid #fecaca'
                                                }}>
                                                    <i className="fas fa-exclamation-triangle"></i> CLASSIFICAÇÃO REQUERIDA
                                                </div>
                                            )}
                                        </div>

                                        {p.comentario_colaborador && (
                                            <div className="aprovacao-comentario-box" style={{
                                                backgroundColor: '#f8fafc',
                                                border: '1px dashed #cbd5e1',
                                                borderRadius: '8px',
                                                padding: '12px',
                                                marginBottom: '1rem',
                                                fontSize: '0.9rem',
                                                color: '#475569'
                                            }}>
                                                <div style={{ fontWeight: '600', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '4px', color: '#64748b' }}>
                                                    <i className="fas fa-comment-dots"></i> Comentário do Colaborador:
                                                </div>
                                                "{p.comentario_colaborador}"
                                            </div>
                                        )}

                                        <div className="aprovacao-details">
                                            <div className="aprovacao-field">
                                                <span className="aprovacao-label">Cliente</span>
                                                <span className={`aprovacao-value ${p.cliente?.nome ? 'highlight' : 'missing'}`}>
                                                    {p.cliente?.nome || 'Não definido'}
                                                </span>
                                            </div>
                                            <div className="aprovacao-field">
                                                <span className="aprovacao-label">Produto</span>
                                                <span className="aprovacao-value">{p.produto?.nome || '-'}</span>
                                            </div>
                                            <div className="aprovacao-field">
                                                <span className="aprovacao-label">Tarefa</span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span className={`aprovacao-value ${p.tarefa?.nome ? '' : 'missing'}`}>
                                                        {p.tarefa?.nome || 'Não definida'}
                                                    </span>
                                                    {p.nova_tarefa_criada && (
                                                        <span className="badge-plug-rapido">
                                                            Nova Tarefa (Plug Rápido)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="aprovacao-time-box">
                                                <div className="aprovacao-time-item">
                                                    <div className="aprovacao-time-label">Início</div>
                                                    <div className="aprovacao-time-value" style={{ fontSize: '0.9rem' }}>{new Date(p.data_inicio).toLocaleDateString()}</div>
                                                </div>
                                                <div className="aprovacao-time-item">
                                                    <div className="aprovacao-time-label">Realizado</div>
                                                    <div className="aprovacao-time-value" style={{ color: '#2563eb' }}>{p.tempo_realizado_formatado || '00:00:00'}</div>
                                                </div>
                                                <div className="aprovacao-time-item">
                                                    <div className="aprovacao-time-label">Estimado/Dia</div>
                                                    <div className="aprovacao-time-value">
                                                        {(() => {
                                                            const raw = p.tempo_estimado_dia || 0;
                                                            // Heurística: Se < 50000, provavelmente é segundos (legado), então *1000.
                                                            // Se >= 50000, é ms. (1h = 3600000ms)
                                                            const ms = raw < 50000 ? raw * 1000 : raw;

                                                            // Converter ms para horas
                                                            const h = Math.floor(ms / 3600000);

                                                            // Se tiver minutos relevantes, poderíamos mostrar, mas vou manter o padrão de horas
                                                            if (h === 0 && ms > 0) return '< 1h';

                                                            return `${h}h`;
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="aprovacao-actions">
                                            <button className="btn-aprovacao btn-aprovar" onClick={() => handleOpenAprovar(p)}>
                                                <i className="fas fa-search-plus"></i> Revisar e Aprovar
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {modalOpen && (
                <div className="modal-plug-rapido-overlay" onClick={() => setModalOpen(false)}>
                    <div className="modal-plug-rapido-container" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px' }}>
                        <div className="modal-plug-rapido-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <h3>
                                    <i className="fas fa-clipboard-check" style={{ color: '#0e3b6f', marginRight: '6px' }}></i>
                                    Aprovar Atribuição
                                </h3>

                                {tempoDisponivel !== null && (
                                    <div
                                        title="Tempo disponível restante após aprovar esta atribuição"
                                        style={{
                                            padding: '4px 8px',
                                            backgroundColor: tempoDisponivel < 0 ? '#fef2f2' : 'rgb(240, 249, 255)',
                                            border: `1px solid ${tempoDisponivel < 0 ? '#ef4444' : 'rgb(14, 165, 233)'}`,
                                            borderRadius: '4px',
                                            fontSize: '11px',
                                            color: tempoDisponivel < 0 ? '#991b1b' : 'rgb(12, 74, 110)',
                                            fontWeight: '500',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            whiteSpace: 'nowrap',
                                            boxSizing: 'border-box',
                                            cursor: 'help',
                                            position: 'relative'
                                        }}
                                    >
                                        <i className="fas fa-clock" style={{ fontSize: '10px', flexShrink: 0 }}></i>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {formatarTempoDisponivel(tempoDisponivel)}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <button className="modal-plug-rapido-close" onClick={() => setModalOpen(false)}>&times;</button>
                        </div>
                        <div className="modal-plug-rapido-body">
                            <p className="modal-aprovar-hint" style={{ backgroundColor: '#eff6ff', padding: '12px', borderRadius: '8px', border: '1px solid #dbeafe', color: '#1e40af', marginBottom: '10px' }}>
                                <i className="fas fa-info-circle" style={{ marginRight: '8px' }}></i>
                                {selectedItem?.comentario_colaborador
                                    ? "Este colaborador plugou sem tarefa definida. Leia o comentário e escolha a classificação correta."
                                    : "Verifique os dados abaixo. Você pode ajustar o Cliente, Produto ou a própria Tarefa se necessário."
                                }
                            </p>

                            {selectedItem?.comentario_colaborador && (
                                <div className="modal-comentario-destaque" style={{
                                    backgroundColor: '#fffbeb',
                                    border: '1px solid #fef3c7',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    marginBottom: '15px'
                                }}>
                                    <div style={{ color: '#92400e', fontWeight: '700', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '4px' }}>
                                        <i className="fas fa-comment"></i> Relato do Colaborador:
                                    </div>
                                    <div style={{ color: '#78350f', fontStyle: 'italic' }}>
                                        "{selectedItem.comentario_colaborador}"
                                    </div>
                                </div>
                            )}

                            <div className="form-group-plug">
                                <label>Cliente</label>
                                <CustomSelect
                                    value={editForm.cliente_id}
                                    options={clientesOptions}
                                    onChange={(e) => handleClienteChange(e.target.value)}
                                    placeholder="Selecione o Cliente"
                                    enableSearch={true}
                                />
                            </div>

                            <div className="form-group-plug">
                                <label>Produto</label>
                                <CustomSelect
                                    value={editForm.produto_id}
                                    options={produtosOptions}
                                    onChange={(e) => handleProdutoChange(e.target.value)}
                                    placeholder="Selecione o Produto"
                                    enableSearch={true}
                                    disabled={!editForm.cliente_id}
                                />
                            </div>

                            <div className="form-group-plug">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <label style={{ marginBottom: 0 }}>Tarefa</label>
                                    {editForm.cliente_id && editForm.produto_id && (
                                        (() => {
                                            const isOriginalNewTask = selectedItem?.nova_tarefa_criada && String(editForm.tarefa_id) === String(selectedItem?.tarefa_id);

                                            return isOriginalNewTask ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowNewTaskModal(true)}
                                                    style={{
                                                        background: '#eff6ff',
                                                        border: '1px solid #3b82f6',
                                                        borderRadius: '4px',
                                                        color: '#1d4ed8',
                                                        cursor: 'pointer',
                                                        fontSize: '0.75rem',
                                                        padding: '2px 10px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        fontWeight: '600',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <i className="fas fa-edit"></i> Nova tarefa criada (Editar)
                                                </button>
                                            ) : null;
                                        })()
                                    )}
                                </div>
                                <SelecaoTarefasPlugRapido
                                    key={tasksRefreshToken}
                                    clienteId={editForm.cliente_id}
                                    produtoId={editForm.produto_id}
                                    selectedTarefaId={editForm.tarefa_id}
                                    onTarefaSelect={(tid) => setEditForm(prev => ({ ...prev, tarefa_id: tid }))}
                                />
                            </div>

                            <div className="form-row-plug">
                                <div className="form-group-plug">
                                    <label>Período</label>
                                    <FilterPeriodo
                                        dataInicio={editForm.data_inicio}
                                        dataFim={editForm.data_fim}
                                        onInicioChange={(e) => setEditForm(prev => ({ ...prev, data_inicio: e.target.value }))}
                                        onFimChange={(e) => setEditForm(prev => ({ ...prev, data_fim: e.target.value }))}
                                        showWeekendToggle={true}
                                        showHolidayToggle={true}
                                        onWeekendToggleChange={(val) => setEditForm(prev => ({ ...prev, habilitarFinaisSemana: val }))}
                                        onHolidayToggleChange={(val) => setEditForm(prev => ({ ...prev, habilitarFeriados: val }))}
                                    />
                                </div>
                                <div className="form-group-plug">
                                    <label>Tempo Estimado / Dia</label>
                                    <TempoEstimadoInput
                                        value={editForm.tempo_estimado_ms}
                                        onChange={(val) => setEditForm(prev => ({ ...prev, tempo_estimado_ms: val }))}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="modal-plug-rapido-footer">
                            <button className="btn-cancel" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</button>
                            <button
                                className="btn-confirm"
                                onClick={handleConfirmAprovar}
                                disabled={saving || !editForm.cliente_id || !editForm.produto_id || !editForm.tarefa_id}
                                style={{ minWidth: '160px' }}
                                title={(!editForm.cliente_id || !editForm.produto_id || !editForm.tarefa_id) ? 'Preencha todos os campos para aprovar' : ''}
                            >
                                {saving ? (
                                    <><i className="fas fa-spinner fa-spin"></i> Aprovando...</>
                                ) : (
                                    <><i className="fas fa-check-circle"></i> Aprovar Atribuição</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ModalNovaTarefaRapida
                isOpen={showNewTaskModal}
                onClose={() => setShowNewTaskModal(false)}
                onSuccess={handleNewTaskSuccess}
                clienteId={editForm.cliente_id}
                produtoId={editForm.produto_id}
                editTaskId={selectedItem?.nova_tarefa_criada && String(editForm.tarefa_id) === String(selectedItem?.tarefa_id) ? editForm.tarefa_id : null}
            />
        </Layout>
    );
};

export default AprovacoesPendentes;
