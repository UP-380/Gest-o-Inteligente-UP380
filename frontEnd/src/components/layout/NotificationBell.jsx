import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './NotificationBell.css';

const API_BASE_URL = '/api';

const NotificationBell = ({ user }) => {
    const navigate = useNavigate();
    const [count, setCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);

    const [prevCount, setPrevCount] = useState(0);
    const [shouldPulse, setShouldPulse] = useState(false);

    // Verificar se o usuário tem permissão para ver o sininho
    const canSeeBell = user && (user.permissoes === 'administrador' || user.permissoes === 'gestor');

    const fetchCount = useCallback(async () => {
        if (!canSeeBell) return;
        try {
            const res = await fetch(`${API_BASE_URL}/notificacoes/count`);
            const json = await res.json();
            if (json.success) {
                const newCount = json.count;
                if (newCount > prevCount) {
                    setShouldPulse(true);
                    setTimeout(() => setShouldPulse(false), 2000);
                    // Se o drawer estiver aberto, recarregar a lista
                    if (isOpen) fetchNotifications();
                }
                setCount(newCount);
                setPrevCount(newCount);
            }
        } catch (e) {
            console.error('Erro ao buscar contagem de notificações:', e);
        }
    }, [canSeeBell, prevCount, isOpen]);

    const fetchNotifications = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/notificacoes?apenas_nao_lidas=true&limit=10`);
            const json = await res.json();
            if (json.success) {
                setNotifications(json.data || []);
            }
        } catch (e) {
            console.error('Erro ao buscar notificações:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (canSeeBell) {
            fetchCount();
            const interval = setInterval(fetchCount, 15000); // Polling 15s (Tempo Real Adaptativo)
            return () => clearInterval(interval);
        }
    }, [canSeeBell, fetchCount]);

    const handleToggleDrawer = () => {
        const nextState = !isOpen;
        setIsOpen(nextState);
        if (nextState) {
            fetchNotifications();
        }
    };

    const handleMarkAsRead = async (e, id) => {
        e.stopPropagation();
        try {
            const res = await fetch(`${API_BASE_URL}/notificacoes/${id}/visualizar`, { method: 'PATCH' });
            const json = await res.json();
            if (json.success) {
                setNotifications(prev => prev.filter(n => n.id !== id));
                setCount(prev => Math.max(0, prev - 1));
                setPrevCount(prev => Math.max(0, prev - 1));
            }
        } catch (e) {
            console.error('Erro ao marcar como lida:', e);
        }
    };

    const handleNotificationClick = async (notif) => {
        // Marcar como lida primeiro
        if (!notif.visualizada) {
            try {
                await fetch(`${API_BASE_URL}/notificacoes/${notif.id}/visualizar`, { method: 'PATCH' });
                setCount(prev => Math.max(0, prev - 1));
                setPrevCount(prev => Math.max(0, prev - 1));
            } catch (e) {
                console.error('Erro ao marcar como lida no clique:', e);
            }
        }

        setIsOpen(false);
        if (notif.link) {
            navigate(notif.link);
        }
    };

    if (!canSeeBell) return null;

    return (
        <div className="notification-bell-wrapper">
            <button className={`notification-bell-btn ${shouldPulse ? 'pulse' : ''}`} onClick={handleToggleDrawer}>
                <i className="fas fa-bell"></i>
                {count > 0 && <span className="notification-badge">{count > 99 ? '99+' : count}</span>}
            </button>

            {/* Backdrop */}
            {isOpen && <div className="notification-drawer-backdrop" onClick={() => setIsOpen(false)}></div>}

            {/* Drawer */}
            <div className={`notification-drawer ${isOpen ? 'open' : ''}`}>
                <div className="notification-drawer-header">
                    <h3>Notificações</h3>
                    <button className="close-drawer-btn" onClick={() => setIsOpen(false)}>&times;</button>
                </div>
                <div className="notification-drawer-body">
                    {loading ? (
                        <div className="notification-loading">
                            <i className="fas fa-spinner fa-spin"></i>
                            <p>Carregando...</p>
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="notification-empty">
                            <i className="fas fa-check-circle"></i>
                            <p>Nenhuma notificação nova</p>
                        </div>
                    ) : (
                        <div className="notification-list">
                            {notifications.map((notif) => (
                                <div
                                    key={notif.id}
                                    className="notification-item"
                                    onClick={() => handleNotificationClick(notif)}
                                >
                                    <div className="notification-item-icon">
                                        <i className={notif.tipo === 'PLUG_RAPIDO' ? "fas fa-bolt" : "fas fa-info-circle"}></i>
                                    </div>
                                    <div className="notification-item-content">
                                        <p className="notification-text">{notif.mensagem}</p>
                                        <span className="notification-time">
                                            {new Date(notif.criado_em).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                        </span>
                                    </div>
                                    <button
                                        className="mark-read-item-btn"
                                        onClick={(e) => handleMarkAsRead(e, notif.id)}
                                        title="Marcar como lida"
                                    >
                                        <i className="fas fa-check"></i>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="notification-drawer-footer">
                    <button className="view-all-btn" onClick={() => { setIsOpen(false); navigate('/notificacoes'); }}>
                        Ver todas as notificações
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NotificationBell;
