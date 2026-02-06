import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import Avatar from '../../components/user/Avatar';
import '../../pages/CadastroVinculacoes/CadastroVinculacoes.css';
import './MinhasNotificacoes.css';

const API_BASE_URL = '/api';

const NOTIFICATION_CONFIG = {
    PLUG_RAPIDO: { icon: 'fas fa-bolt', label: 'Plug Rápido', color: '#f59e0b' },
    PLUG_RAPIDO_APROVADO: { icon: 'fas fa-check-circle', label: 'Plug Rápido Aprovado', color: '#10b981' },
    APROVACAO_PENDENTE: { icon: 'fas fa-clipboard-list', label: 'Aprovação Pendente', color: '#3b82f6' },
    CHAT_MENSAGEM: { icon: 'fas fa-comments', label: 'Chat', color: '#8b5cf6' },
    COMUNICADO_NOVO: { icon: 'fas fa-bullhorn', label: 'Comunicado', color: '#6366f1' },
    CHAMADO_NOVO: { icon: 'fas fa-ticket-alt', label: 'Chamado', color: '#ec4899' },
    CHAMADO_ATUALIZADO: { icon: 'fas fa-sync-alt', label: 'Chamado Atualizado', color: '#06b6d4' }
};

const getNotificationConfig = (tipo) => NOTIFICATION_CONFIG[tipo] || { icon: 'fas fa-info-circle', label: tipo?.replace(/_/g, ' ') || 'Notificação', color: '#6b7280' };

const formatarData = (val) => {
    if (!val) return '—';
    const d = new Date(val);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const MinhasNotificacoes = () => {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [filter, setFilter] = useState('todas'); // 'todas', 'nao_lidas'
    const [filterTipo, setFilterTipo] = useState(''); // '' = todas, ou PLUG_RAPIDO, CHAT_MENSAGEM, etc.

    const fetchNotifications = useCallback(async () => {
        setLoading(true);
        try {
            const apenasNaoLidas = filter === 'nao_lidas';
            const res = await fetch(`${API_BASE_URL}/notificacoes?apenas_nao_lidas=${apenasNaoLidas}&limit=50`);
            const json = await res.json();
            if (json.success) {
                setNotifications(json.data || []);
                setTotal(json.total || 0);
            }
        } catch (e) {
            console.error('Erro ao buscar notificações:', e);
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    useEffect(() => {
        const onFocus = () => fetchNotifications();
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [fetchNotifications]);

    const handleMarkAsRead = async (id) => {
        try {
            const res = await fetch(`${API_BASE_URL}/notificacoes/${id}/visualizar`, { method: 'PATCH' });
            const json = await res.json();
            if (json.success) {
                setNotifications(prev => prev.map(n => n.id === id ? { ...n, visualizada: true } : n));
                if (filter === 'nao_lidas') {
                    setNotifications(prev => prev.filter(n => n.id !== id));
                }
            }
        } catch (e) {
            console.error('Erro ao marcar como lida:', e);
        }
    };

    const handleMarkAsUnread = async (id) => {
        try {
            const res = await fetch(`${API_BASE_URL}/notificacoes/${id}/desvisualizar`, { method: 'PATCH' });
            const json = await res.json();
            if (json.success) {
                setNotifications(prev => prev.map(n => n.id === id ? { ...n, visualizada: false } : n));
            }
        } catch (e) {
            console.error('Erro ao desmarcar como lida:', e);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/notificacoes/visualizar-todas`, { method: 'POST' });
            const json = await res.json();
            if (json.success) {
                setNotifications(prev => prev.map(n => ({ ...n, visualizada: true })));
                if (filter === 'nao_lidas') {
                    setNotifications([]);
                }
            }
        } catch (e) {
            console.error('Erro ao marcar todas como lidas:', e);
        }
    };

    const handleNotificationClick = async (notif) => {
        if (!notif.visualizada) {
            await handleMarkAsRead(notif.id);
        }
        if (notif.link) {
            navigate(notif.link);
        }
    };

    const notifsFiltradas = filterTipo
        ? notifications.filter((n) => n.tipo === filterTipo)
        : notifications;

    const TIPOS_OPCOES = Object.entries(NOTIFICATION_CONFIG).map(([k, v]) => ({ value: k, icon: v.icon, label: v.label, color: v.color }));

    return (
        <Layout>
            <div className="container">
                <main className="main-content">
                    <div className="notifications-page">
                        <div className="notifications-page-header">
                            <div className="header-left">
                                <div className="header-icon">
                                    <i className="fas fa-bell"></i>
                                </div>
                                <div>
                                    <h1>Minhas Notificações</h1>
                                    <p>Acompanhe todas as atualizações e solicitações direcionadas a você</p>
                                </div>
                            </div>
                            <div className="header-actions">
                                <button className="btn-mark-all" onClick={handleMarkAllAsRead}>
                                    <i className="fas fa-check-double"></i> Marcar todas como lidas
                                </button>
                            </div>
                        </div>

                        <div className="notifications-filters">
                            <button
                                className={`filter-btn ${filter === 'todas' ? 'active' : ''}`}
                                onClick={() => setFilter('todas')}
                            >
                                Todas <span>{total}</span>
                            </button>
                            <button
                                className={`filter-btn ${filter === 'nao_lidas' ? 'active' : ''}`}
                                onClick={() => setFilter('nao_lidas')}
                            >
                                Não lidas
                            </button>
                        </div>

                        <div className="filtros-vinculacao-row filtros-tipo-notificacao">
                            {TIPOS_OPCOES.map((opt) => (
                                <div key={opt.value} className="filter-group">
                                    <div className="filtro-pai-wrapper">
                                        <label className="filtro-card-option filtro-tipo-notif">
                                            <input
                                                type="radio"
                                                name="filtro-tipo-notificacao"
                                                checked={filterTipo === opt.value}
                                                onChange={() => setFilterTipo(filterTipo === opt.value ? '' : opt.value)}
                                            />
                                            <div className="filtro-card-content">
                                                <div
                                                    className="filtro-card-icon filtro-tipo-icon"
                                                    style={{ color: opt.color, backgroundColor: `${opt.color}15` }}
                                                >
                                                    <i className={opt.icon}></i>
                                                </div>
                                                <div className="filtro-card-text">
                                                    <span className="filtro-card-title">{opt.label}</span>
                                                </div>
                                                <div className="filtro-card-check">
                                                    <i className="fas fa-check"></i>
                                                </div>
                                                <div className="filtro-card-click-indicator">
                                                    <i className="fas fa-hand-pointer"></i>
                                                </div>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {loading ? (
                            <div className="loading-state">
                                <i className="fas fa-spinner fa-spin"></i>
                                <p>Carregando notificações...</p>
                            </div>
                        ) : notifsFiltradas.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">
                                    <i className="fas fa-bell-slash"></i>
                                </div>
                                <h3>Nenhuma notificação encontrada</h3>
                                <p>
                                    {filterTipo
                                        ? `Nenhuma notificação do tipo "${getNotificationConfig(filterTipo).label}".`
                                        : 'Você está em dia com todas as suas tarefas e alertas.'}
                                </p>
                            </div>
                        ) : (
                            <div className="notifications-list-grid">
                                {notifsFiltradas.map((notif) => (
                                    <div
                                        key={notif.id}
                                        className={`notification-card ${!notif.visualizada ? 'unread' : ''}`}
                                        onClick={() => handleNotificationClick(notif)}
                                    >
                                        <div className="card-icon" style={{ backgroundColor: `${getNotificationConfig(notif.tipo).color}15`, color: getNotificationConfig(notif.tipo).color }}>
                                            <i className={getNotificationConfig(notif.tipo).icon}></i>
                                        </div>
                                        <div className="card-body">
                                            <div className="card-header">
                                                <div className="card-header-main">
                                                    <span className="type-badge">{getNotificationConfig(notif.tipo).label}</span>
                                                    <span className={`status-badge ${notif.visualizada ? 'read' : 'unread'}`}>
                                                        {notif.visualizada ? 'Lida' : 'Não Lida'}
                                                    </span>
                                                </div>
                                                <span className="date-text" title="Data e hora do recebimento">
                                                    <i className="fas fa-clock"></i> {formatarData(notif.criado_em ?? notif.created_at)}
                                                </span>
                                            </div>
                                            <h3 className="card-title">{notif.titulo || 'Nova Notificação'}</h3>
                                            <p className="card-message">{notif.mensagem || ''}</p>
                                        </div>
                                        <div className="card-actions">
                                            {!notif.visualizada ? (
                                                <button
                                                    className="btn-mark-read"
                                                    onClick={(e) => { e.stopPropagation(); handleMarkAsRead(notif.id); }}
                                                    title="Marcar como lida"
                                                >
                                                    <i className="fas fa-check"></i>
                                                </button>
                                            ) : (
                                                <button
                                                    className="btn-mark-unread"
                                                    onClick={(e) => { e.stopPropagation(); handleMarkAsUnread(notif.id); }}
                                                    title="Marcar como não lida"
                                                >
                                                    <i className="fas fa-undo"></i>
                                                </button>
                                            )}
                                            <div className="action-arrow">
                                                <i className="fas fa-chevron-right"></i>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </Layout>
    );
};

export default MinhasNotificacoes;
