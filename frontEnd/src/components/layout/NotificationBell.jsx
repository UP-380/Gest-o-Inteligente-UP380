import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { hasPermissionSync } from '../../utils/permissions';
import { NOTIFICATION_TYPES } from '../../constants/notificationTypes';
import { comunicacaoAPI } from '../../services/comunicacao.service';
import './NotificationBell.css';
import './NotificationToast.css';

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
    const [toastItems, setToastItems] = useState([]);
    const [replyTexts, setReplyTexts] = useState({});
    const [sendingKey, setSendingKey] = useState(null);
    const toastTimeoutsRef = useRef(new Map());
    const shownToastIdsRef = useRef(new Set());
    const drawerStateRef = useRef({ isOpen: false, tab: null, interlocutorId: null, chamadoId: null });

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

    const showPopupForNotification = useCallback((notif) => {
        if (!notif || shownToastIdsRef.current.has(notif.id)) return;
        const tipo = notif.tipo;
        if (tipo !== NOTIFICATION_TYPES.CHAT_MENSAGEM && tipo !== NOTIFICATION_TYPES.CHAMADO_ATUALIZADO) return;

        const meta = notif.metadata || {};
        const drawer = drawerStateRef.current;
        if (tipo === NOTIFICATION_TYPES.CHAT_MENSAGEM && drawer.isOpen && drawer.tab === 'chats') {
            if (drawer.interlocutorId != null && String(meta.remetente_id) === String(drawer.interlocutorId)) return;
        }
        if (tipo === NOTIFICATION_TYPES.CHAMADO_ATUALIZADO && drawer.isOpen && drawer.tab === 'chamados') {
            if (drawer.chamadoId != null && meta.chamado_id != null && String(drawer.chamadoId) === String(meta.chamado_id)) return;
        }

        shownToastIdsRef.current.add(notif.id);
        const key = `toast-${notif.id}-${Date.now()}`;
        const payload = {
            id: notif.id,
            tipo: notif.tipo,
            titulo: notif.titulo,
            mensagem: notif.mensagem,
            link: notif.link,
            referencia_id: notif.referencia_id,
            criado_em: notif.criado_em ?? notif.created_at,
            metadata: notif.metadata || {}
        };
        setToastItems((prev) => [...prev, { key, payload }]);
        /* Fecha só ao clicar no X ou ao enviar mensagem pelo atalho */
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
                // Buscar a última notificação e mostrar popup se for Chat ou Chamado
                try {
                    const listRes = await fetch(`${API_BASE_URL}/notificacoes?apenas_nao_lidas=true&limit=1`, { credentials: 'include' });
                    const listJson = await listRes.json();
                    if (listJson.success && listJson.data && listJson.data[0]) {
                        showPopupForNotification(listJson.data[0]);
                    }
                } catch (_) { /* ignora */ }
            }

            setCount(newCount);
            setPrevCount(newCount);
            localStorage.setItem('last_notified_count', String(newCount));
        } catch (_) {
            setCount(0);
        }
    }, [canSeeBell, isOpen, playNotificationSound, showPopupForNotification]);

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

    const openLinkFromToast = (item) => {
        const { payload } = item;
        if (payload.link && payload.link.includes('/comunicacao')) {
            const url = new URL(payload.link, window.location.origin);
            const tab = url.searchParams.get('tab') || 'chats';
            const interlocutorId = url.searchParams.get('interlocutorId');
            window.dispatchEvent(new CustomEvent('open-communication-drawer', {
                detail: { tab, interlocutorId }
            }));
        } else if (payload.link) {
            navigate(payload.link);
        }
        dismissToast(item.key);
    };

    const dismissToast = (key) => {
        const entry = toastTimeoutsRef.current.get(key);
        if (entry) {
            if (entry.main) clearTimeout(entry.main);
            if (entry.exit) clearTimeout(entry.exit);
            toastTimeoutsRef.current.delete(key);
        }
        setToastItems((prev) => prev.filter((item) => item.key !== key));
        setReplyTexts((prev) => { const next = { ...prev }; delete next[key]; return next; });
    };

    const setReplyText = (key, value) => {
        setReplyTexts((prev) => ({ ...prev, [key]: value }));
    };

    const handleSendReply = async (key, item) => {
        const text = (replyTexts[key] || '').trim();
        if (!text) return;
        const { payload } = item;
        const meta = payload.metadata || {};
        setSendingKey(key);
        try {
            if (payload.tipo === NOTIFICATION_TYPES.CHAT_MENSAGEM) {
                const res = await comunicacaoAPI.enviarMensagem({
                    tipo: 'CHAT',
                    destinatario_id: meta.remetente_id,
                    conteudo: text
                });
                if (res && res.success) {
                    setReplyText(key, '');
                    dismissToast(key);
                }
            } else if (payload.tipo === NOTIFICATION_TYPES.CHAMADO_ATUALIZADO && meta.chamado_id) {
                const res = await comunicacaoAPI.enviarMensagem({
                    tipo: 'CHAMADO',
                    mensagem_pai_id: meta.chamado_id,
                    conteudo: text
                });
                if (res && res.success) {
                    setReplyText(key, '');
                    dismissToast(key);
                }
            }
        } catch (e) {
            console.error('Erro ao enviar resposta rápida:', e);
        } finally {
            setSendingKey(null);
        }
    };

    useEffect(() => {
        return () => {
            toastTimeoutsRef.current.forEach((entry) => {
                if (entry.main) clearTimeout(entry.main);
                if (entry.exit) clearTimeout(entry.exit);
            });
            toastTimeoutsRef.current.clear();
        };
    }, []);

    useEffect(() => {
        const handler = (e) => {
            const d = e.detail || {};
            drawerStateRef.current = {
                isOpen: !!d.isOpen,
                tab: d.tab ?? null,
                interlocutorId: d.interlocutorId ?? null,
                chamadoId: d.chamadoId ?? null
            };
        };
        window.addEventListener('communication-drawer-state', handler);
        return () => window.removeEventListener('communication-drawer-state', handler);
    }, []);

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

            {/* Popup de aviso importante (portal no body) - estilo Teams/WhatsApp */}
            {toastItems.length > 0 && createPortal(
                <div className="notification-toast-backdrop" aria-hidden="true">
                    <div className="notification-toast-container">
                        {toastItems.map((item) => {
                            const meta = item.payload.metadata || {};
                            const remetenteNome = meta.remetente_nome || item.payload.titulo || 'Usuário';
                            const remetenteFoto = meta.remetente_foto || null;
                            const mensagemExibir = item.payload.mensagem || '';
                            const mensagemTruncada = mensagemExibir.length > 120 ? mensagemExibir.slice(0, 117) + '...' : mensagemExibir;
                            const isChat = item.payload.tipo === NOTIFICATION_TYPES.CHAT_MENSAGEM;
                            const isSending = sendingKey === item.key;
                            return (
                                <div
                                    key={item.key}
                                    className={`notification-toast-card toast-${isChat ? 'chat' : 'chamado'} ${item.exit ? 'toast-exit' : ''}`}
                                >
                                    <button
                                        type="button"
                                        className="notification-toast-close"
                                        onClick={() => dismissToast(item.key)}
                                        aria-label="Fechar"
                                    >
                                        <i className="fas fa-times"></i>
                                    </button>
                                    <div
                                        className="notification-toast-inner"
                                        onClick={() => !item.exit && openLinkFromToast(item)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(ev) => ev.key === 'Enter' && !item.exit && openLinkFromToast(item)}
                                    >
                                        <div className="notification-toast-avatar">
                                            {remetenteFoto ? (
                                                <img src={remetenteFoto} alt="" />
                                            ) : (
                                                <span className="notification-toast-iniciais">
                                                    {(remetenteNome || 'U').slice(0, 2).toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                        <div className="notification-toast-body">
                                            <p className="notification-toast-nome">{remetenteNome}</p>
                                            <p className="notification-toast-message">{mensagemTruncada}</p>
                                        </div>
                                    </div>
                                    {((isChat && meta.remetente_id) || (!isChat && meta.chamado_id)) ? (
                                        <div className="notification-toast-reply" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="text"
                                                placeholder={isChat ? 'Responder...' : 'Responder ao chamado...'}
                                                value={replyTexts[item.key] || ''}
                                                onChange={(e) => setReplyText(item.key, e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendReply(item.key, item))}
                                                disabled={isSending}
                                            />
                                            <button
                                                type="button"
                                                className="notification-toast-send"
                                                onClick={() => handleSendReply(item.key, item)}
                                                disabled={isSending || !(replyTexts[item.key] || '').trim()}
                                                aria-label="Enviar"
                                            >
                                                {isSending ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default NotificationBell;
