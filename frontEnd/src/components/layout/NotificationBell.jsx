import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { hasPermissionSync } from '../../utils/permissions';
import './NotificationBell.css';

const API_BASE_URL = '/api';
const SSE_STREAM_URL = `${API_BASE_URL}/notificacoes/stream`;
const SSE_RECONNECT_DELAY_MS = 3000;
const SSE_MAX_RECONNECT_DELAY_MS = 60000;
const FALLBACK_POLL_MS = 15000; // Fallback: atualiza a cada 15s se o SSE falhar ou não entregar

const NotificationBell = ({ user }) => {
    const navigate = useNavigate();
    const [count, setCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);

    const [autoRead, setAutoRead] = useState(() => {
        return localStorage.getItem('notifications_auto_read') === 'true';
    });

    const [prevCount, setPrevCount] = useState(() => {
        const stored = localStorage.getItem('last_notified_count');
        return stored ? parseInt(stored, 10) : 0;
    });
    const [shouldPulse, setShouldPulse] = useState(false);

    const audioContextRef = useRef(null);
    const prevCountRef = useRef(prevCount);
    prevCountRef.current = prevCount;

    // Verificar se o usuário tem permissão para ver o sininho
    const canSeeBell = user && hasPermissionSync(user.permissoes, '/notificacoes');

    const playNotificationSound = useCallback(() => {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = audioContextRef.current || new AudioCtx();
            audioContextRef.current = ctx;
            if (ctx.state === 'suspended') {
                ctx.resume().catch(() => { });
            }
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, ctx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.2);

            gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.25);
        } catch (e) {
            console.error('Erro ao reproduzir som de notificação:', e);
        }
    }, []);

    const fetchCount = useCallback(async () => {
        if (!canSeeBell) return;
        try {
            const res = await fetch(`${API_BASE_URL}/notificacoes/count`, { credentials: 'include' });
            const json = await res.json().catch(() => ({ success: true, count: 0 }));
            const newCount = json.success ? (json.count ?? 0) : 0;
            const prev = prevCountRef.current;

            if (newCount > prev) {
                setShouldPulse(true);
                playNotificationSound();
                setTimeout(() => setShouldPulse(false), 2500);
                if (isOpen) fetchNotifications();
            }

            setCount(newCount);
            setPrevCount(newCount);
            localStorage.setItem('last_notified_count', String(newCount));
        } catch (_) {
            setCount(0);
        }
    }, [canSeeBell, isOpen, playNotificationSound]);

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

    // SSE para push em tempo real + fallback com polling para garantir que notificação sempre chegue
    useEffect(() => {
        if (!canSeeBell) return;
        fetchCount();
        let eventSource = null;
        let reconnectTimer = null;
        let fallbackPollTimer = null;
        let reconnectDelay = SSE_RECONNECT_DELAY_MS;

        const connectSSE = () => {
            if (eventSource) {
                eventSource.close();
                eventSource = null;
            }
            try {
                eventSource = new EventSource(SSE_STREAM_URL);
                eventSource.onopen = () => {
                    reconnectDelay = SSE_RECONNECT_DELAY_MS;
                    fetchCount();
                };
                eventSource.onmessage = (e) => {
                    try {
                        const data = JSON.parse(e.data);
                        if (data.type === 'notification' || data.type === 'connected') {
                            fetchCount();
                        }
                    } catch (_) { }
                };
                eventSource.onerror = () => {
                    eventSource.close();
                    eventSource = null;
                    reconnectTimer = setTimeout(() => {
                        connectSSE();
                        reconnectDelay = Math.min(reconnectDelay * 1.5, SSE_MAX_RECONNECT_DELAY_MS);
                    }, reconnectDelay);
                };
            } catch (err) {
                console.error('Erro ao conectar stream de notificações:', err);
                reconnectTimer = setTimeout(connectSSE, reconnectDelay);
            }
        };

        connectSSE();

        // Fallback: polling a cada 15s para garantir que notificação chegue mesmo se o SSE falhar
        fallbackPollTimer = setInterval(fetchCount, FALLBACK_POLL_MS);

        const onVisibility = () => {
            if (document.visibilityState === 'visible') fetchCount();
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            if (reconnectTimer) clearTimeout(reconnectTimer);
            if (fallbackPollTimer) clearInterval(fallbackPollTimer);
            if (eventSource) {
                eventSource.close();
            }
        };
    }, [canSeeBell, fetchCount]);

    const handleToggleDrawer = () => {
        try {
            if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume();
            } else if (!audioContextRef.current) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) audioContextRef.current = new AudioCtx();
            }
        } catch (_) { }
        const nextState = !isOpen;
        setIsOpen(nextState);

        if (nextState) {
            fetchNotifications();
        } else {
            // Ao fechar
            // Se auto-leitura estiver habilitada e houver notificações, marcar todas como lidas
            if (autoRead && count > 0) {
                handleMarkAllAsRead();
            }
        }
    };

    const handleToggleAutoRead = (e) => {
        const newValue = e.target.checked;
        setAutoRead(newValue);
        localStorage.setItem('notifications_auto_read', newValue.toString());
        // Se estiver marcando como ligado agora, a ação ocorrerá apenas ao fechar o drawer

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
            {isOpen && (
                <div
                    className="notification-drawer-backdrop"
                    onClick={() => {
                        setIsOpen(false);
                        if (autoRead && count > 0) {
                            handleMarkAllAsRead();
                        }
                    }}
                ></div>
            )}

            {/* Drawer */}
            <div className={`notification-drawer ${isOpen ? 'open' : ''}`}>
                <div className="notification-drawer-header">
                    <div className="notification-drawer-header-top">
                        <h3>Notificações</h3>
                        <button
                            className="close-drawer-btn"
                            onClick={() => {
                                setIsOpen(false);
                                if (autoRead && count > 0) {
                                    handleMarkAllAsRead();
                                }
                            }}
                        >
                            &times;
                        </button>
                    </div>
                    <div className="notification-drawer-header-actions">
                        <div className="notification-auto-read-toggle">
                            <label title="Marcar automaticamente como lidas ao abrir" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                <span>Auto-ler:</span>
                                <div className="switch-wrapper">
                                    <input
                                        type="checkbox"
                                        id="toggleAutoRead"
                                        checked={autoRead}
                                        onChange={handleToggleAutoRead}
                                    />
                                    <span className="switch-slider"></span>
                                </div>
                            </label>
                        </div>
                        {notifications.length > 0 && (
                            <button className="mark-all-read-btn-header" onClick={handleMarkAllAsRead}>
                                <i className="fas fa-check-double"></i>
                                Marcar todas
                            </button>
                        )}
                    </div>
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
