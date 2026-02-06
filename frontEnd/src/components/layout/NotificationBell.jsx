
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { hasPermissionSync } from '../../utils/permissions';
import './NotificationBell.css';

const API_BASE_URL = '/api';

const NotificationBell = ({ user }) => {
    const navigate = useNavigate();
    const [count, setCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);

    const [prevCount, setPrevCount] = useState(() => {
        const stored = localStorage.getItem('last_notified_count');
        return stored ? parseInt(stored, 10) : 0;
    });
    const [shouldPulse, setShouldPulse] = useState(false);

    // Verificar se o usuário tem permissão para ver o sininho
    // Utiliza o utilitário de permissões para verificar acesso à página de notificações
    const canSeeBell = user && hasPermissionSync(user.permissoes, '/notificacoes');

    const playNotificationSound = useCallback(() => {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // Nota lá (A5)
            oscillator.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.2); // Desce para A4 rapidamente

            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.2);
        } catch (e) {
            console.error('Erro ao reproduzir som de notificação:', e);
        }
    }, []);

    const fetchCount = useCallback(async () => {
        if (!canSeeBell) return;
        try {
            const res = await fetch(`${API_BASE_URL}/notificacoes/count`);
            const json = await res.json();
            if (json.success) {
                const newCount = json.count;

                // Se o count aumentou em relação ao que já sabíamos (mesmo de sessões anteriores),
                // então disparamos a animação e o som.
                if (newCount > prevCount) {
                    setShouldPulse(true);
                    playNotificationSound(); // Toca o som ao receber nova notificação
                    setTimeout(() => setShouldPulse(false), 2000);
                    // Se o drawer estiver aberto, recarregar a lista
                    if (isOpen) fetchNotifications();
                }

                setCount(newCount);
                setPrevCount(newCount);
                localStorage.setItem('last_notified_count', newCount.toString());
            }
        } catch (e) {
            console.error('Erro ao buscar contagem de notificações:', e);
        }
    }, [canSeeBell, prevCount, isOpen, playNotificationSound]);

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

    const handleMarkAllAsRead = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/notificacoes/visualizar-todas`, { method: 'POST' });
            const json = await res.json();
            if (json.success) {
                setNotifications([]);
                setCount(0);
                setPrevCount(0);
            }
        } catch (e) {
            console.error('Erro ao marcar todas como lidas:', e);
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
            // Se o link for de comunicação, abrir o drawer em vez de navegar
            if (notif.link.includes('/comunicacao')) {
                const url = new URL(notif.link, window.location.origin);
                const tab = url.searchParams.get('tab') || 'chats';
                const interlocutorId = url.searchParams.get('interlocutorId');

                window.dispatchEvent(new CustomEvent('open-communication-drawer', {
                    detail: { tab, interlocutorId }
                }));
            } else {
                navigate(notif.link);
            }
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
                    <div className="notification-drawer-header-top">
                        <h3>Notificações</h3>
                        <button className="close-drawer-btn" onClick={() => setIsOpen(false)}>&times;</button>
                    </div>
                    {notifications.length > 0 && (
                        <button className="mark-all-read-btn-header" onClick={handleMarkAllAsRead}>
                            <i className="fas fa-check-double" style={{ marginRight: '5px' }}></i>
                            Marcar todas como lidas
                        </button>
                    )}
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
