import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import Avatar from '../../components/user/Avatar';
import './MinhasNotificacoes.css';

const API_BASE_URL = '/api';

const MinhasNotificacoes = () => {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [filter, setFilter] = useState('todas'); // 'todas', 'nao_lidas'

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

                        {loading ? (
                            <div className="loading-state">
                                <i className="fas fa-spinner fa-spin"></i>
                                <p>Carregando notificações...</p>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">
                                    <i className="fas fa-bell-slash"></i>
                                </div>
                                <h3>Nenhuma notificação encontrada</h3>
                                <p>Você está em dia com todas as suas tarefas e alertas.</p>
                            </div>
                        ) : (
                            <div className="notifications-list-grid">
                                {notifications.map((notif) => (
                                    <div
                                        key={notif.id}
                                        className={`notification-card ${!notif.visualizada ? 'unread' : ''}`}
                                        onClick={() => handleNotificationClick(notif)}
                                    >
                                        <div className="card-icon">
                                            <i className={notif.tipo === 'PLUG_RAPIDO' ? "fas fa-bolt" : "fas fa-info-circle"}></i>
                                        </div>
                                        <div className="card-body">
                                            <div className="card-header">
                                                <div className="card-header-main">
                                                    <span className="type-badge">{notif.tipo.replace('_', ' ')}</span>
                                                    <span className={`status-badge ${notif.visualizada ? 'read' : 'unread'}`}>
                                                        {notif.visualizada ? 'Lida' : 'Não Lida'}
                                                    </span>
                                                </div>
                                                <span className="date-text">{new Date(notif.criado_em).toLocaleString()}</span>
                                            </div>
                                            <h3 className="card-title">{notif.titulo || 'Nova Notificação'}</h3>
                                            <p className="card-message">{notif.mensagem}</p>
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
