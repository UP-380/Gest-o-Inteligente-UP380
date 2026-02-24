import React, { useState, useEffect } from 'react';
import Avatar from '../../components/user/Avatar';
import './RelatorioTempo.css';

const RelatorioTempoLive = ({ showToast }) => {
    const [registrosAtivos, setRegistrosAtivos] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchLive = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/live/active-sessions');
            if (res.ok) {
                const json = await res.json();
                const regs = json.data || [];
                setRegistrosAtivos(regs);
            } else {
                showToast('error', 'Erro ao API Live.');
            }
        } catch (error) {
            console.error(error);
            showToast('error', 'Erro na conexão Live.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLive();
        const intervalId = setInterval(fetchLive, 30000);
        return () => clearInterval(intervalId);
    }, []);

    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const timerId = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timerId);
    }, []);

    const formatarTempoDecorrido = (dataInicioIso) => {
        if (!dataInicioIso) return '00:00:00';
        const start = new Date(dataInicioIso).getTime();
        const diff = Math.max(0, now - start);
        const seconds = Math.floor(diff / 1000);
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        const format2 = n => n.toString().padStart(2, '0');
        return `${format2(h)}:${format2(m)}:${format2(s)}`;
    };

    if (loading && registrosAtivos.length === 0) {
        return (
            <div className="relatorio-loading">
                <div className="relatorio-spinner"></div>
                <p>Buscando atividades ao vivo...</p>
            </div>
        );
    }

    if (registrosAtivos.length === 0) {
        return (
            <div className="relatorio-empty" style={{ marginTop: '2rem' }}>
                <i className="fas fa-bed" style={{ fontSize: '2rem', marginBottom: '1rem', display: 'block', color: '#94a3b8' }}></i>
                Nenhum colaborador online rastreando tempo no momento.
            </div>
        );
    }

    return (
        <div className="relatorio-live-container">
            <div className="relatorio-header-left relatorio-live-header" style={{ marginTop: '20px', marginBottom: '20px' }}>
                <div className="relatorio-live-title">
                    <div className="live-pulse" />
                    <span>{registrosAtivos.length} Sessões Ativas Agora</span>
                </div>
            </div>

            <div className="relatorio-live-grid">
                {registrosAtivos.map(reg => {
                    const nomePessoa = reg.membro_nome || `Usuário ${reg.usuario_id}`;
                    const clienteStr = reg.cliente_nome || '—';
                    const tarefaStr = reg.tarefa_nome || `Tarefa #${reg.tarefa_id || '?'}`;
                    const produtoStr = reg.produto_nome || '—';
                    const realizadoStr = formatarTempoDecorrido(reg.data_inicio);
                    const estimadoStr = reg.tempo_estimado_formatado != null ? reg.tempo_estimado_formatado : '—';
                    const dataEstimadaStr = reg.data_estimada_formatada != null ? reg.data_estimada_formatada : '—';

                    return (
                        <div key={reg.id} className="rt-live-user-card">
                            <div className="rt-live-user-header">
                                <div className="rt-live-user-info">
                                    <Avatar
                                        avatarId={reg.foto_perfil}
                                        nomeUsuario={nomePessoa}
                                        size="medium"
                                    />
                                    <span className="rt-live-user-nome">{nomePessoa}</span>
                                </div>
                                <button
                                    onClick={() => {
                                        window.dispatchEvent(new CustomEvent('open-communication-drawer', {
                                            detail: { tab: 'chats', interlocutorId: reg.usuario_id }
                                        }));
                                    }}
                                    className="rt-live-chat-btn"
                                    title={`Abrir chat com ${nomePessoa}`}
                                >
                                    <i className="fas fa-comment-dots" />
                                </button>
                            </div>

                            <div className="rt-live-tarefa-card painel-usuario-tarefa-card">
                                <div className="painel-usuario-tarefa-top" style={{ alignItems: 'flex-start' }}>
                                    <div className="painel-usuario-tarefa-nome" style={{ width: '100%', wordBreak: 'break-word' }}>
                                        <span className="painel-usuario-tarefa-text">{tarefaStr}</span>
                                    </div>
                                </div>
                                <div className="rt-live-meta-cliente" style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <i className="fas fa-box" style={{ color: '#94a3b8', fontSize: '11px', width: '12px', textAlign: 'center' }} />
                                    <span><strong>Produto:</strong> {produtoStr}</span>
                                </div>
                                <div className="rt-live-meta-cliente" style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <i className="fas fa-building" style={{ color: '#94a3b8', fontSize: '11px', width: '12px', textAlign: 'center' }} />
                                    <span><strong>Cliente:</strong> {clienteStr}</span>
                                </div>
                                <div className="painel-usuario-tarefa-tags rt-live-tags" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
                                    <span className="painel-usuario-badge-estimado">
                                        <i className="fas fa-calendar-alt painel-usuario-estimado-icon-inline" />
                                        <span className="painel-usuario-estimado-label">Data Estimada:</span>
                                        <span className="painel-usuario-estimado-pill">{dataEstimadaStr}</span>
                                    </span>
                                    <span className="painel-usuario-badge-estimado">
                                        <i className="fas fa-clock painel-usuario-estimado-icon-inline" />
                                        <span className="painel-usuario-estimado-label">Estimado:</span>
                                        <span className="painel-usuario-estimado-pill">{estimadoStr}</span>
                                    </span>
                                    <span className="painel-usuario-badge-realizado">
                                        <i className="fas fa-play-circle painel-usuario-realizado-icon-inline" />
                                        <span className="painel-usuario-realizado-label">Realizado Agora:</span>
                                        <span className="painel-usuario-realizado-pill rt-live-fixed-pill">{realizadoStr}</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <style>{`
                @keyframes rt-live-pulse {
                    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
                    70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
                    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
                }
                .relatorio-live-container .live-pulse {
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    background: #10b981;
                    box-shadow: 0 0 10px #10b981;
                    animation: rt-live-pulse 1.5s infinite;
                }
            `}</style>
        </div>
    );
};

export default RelatorioTempoLive;
