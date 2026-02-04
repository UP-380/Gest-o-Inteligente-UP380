import React, { useState, useEffect, useRef } from 'react';
import { comunicacaoAPI } from '../../services/comunicacao.service';
import { api, usuariosAPI } from '../../services/api';
import './ChatView.css';

const ChatView = () => {
    const [conversas, setConversas] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [allUsers, setAllUsers] = useState([]);
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const messagesEndRef = useRef(null);
    const [currentUser, setCurrentUser] = useState(null);

    // Carregar usuário atual e conversas
    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('usuario'));
        setCurrentUser(user);
        loadConversas();
    }, []);

    // Carregar mensagens quando selecionar um usuário
    useEffect(() => {
        if (selectedUser) {
            loadMessages(selectedUser.id);
            // Polling simples para receber mensagens (futuro: WebSocket)
            const interval = setInterval(() => loadMessages(selectedUser.id, true), 5000);
            return () => clearInterval(interval);
        }
    }, [selectedUser]);

    // Scroll para baixo ao receber mensagem
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const loadConversas = async () => {
        setLoading(true);
        try {
            const response = await comunicacaoAPI.listarConversasRecentes();
            if (response.success) {
                setConversas(response.data);
            }
        } catch (error) {
            console.error('Erro ao listar conversas:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadMessages = async (userId, silent = false) => {
        if (!silent) setLoadingMessages(true);
        try {
            const response = await comunicacaoAPI.listarMensagensChat(userId);
            if (response.success) {
                setMessages(response.data);
            }
        } catch (error) {
            console.error('Erro ao listar mensagens:', error);
        } finally {
            if (!silent) setLoadingMessages(false);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedUser) return;

        try {
            const payload = {
                tipo: 'CHAT',
                destinatario_id: selectedUser.id,
                conteudo: newMessage
            };
            console.log('[CHAT] Enviando mensagem para destinatario_id:', selectedUser.id, 'payload:', payload);

            const response = await comunicacaoAPI.enviarMensagem(payload);
            if (response.success) {
                setNewMessage('');
                loadMessages(selectedUser.id, true); // Recarregar mensagens
                loadConversas(); // Atualizar lista lateral (ordem)
            }
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
        }
    };

    const handleNewChat = async () => {
        if (allUsers.length === 0) {
            try {
                // Endpoint para buscar todos os USUÁRIOS DO SISTEMA (para integridade referencial)
                const response = await usuariosAPI.getAll();

                if (response.success) {
                    // Filtrar o próprio usuário
                    const filtered = (response.data || [])
                        .filter(u => u.id !== currentUser?.id);
                    setAllUsers(filtered);
                }
            } catch (error) {
                console.error('Erro ao buscar usuários:', error);
            }
        }
        setShowNewChatModal(true);
    };

    const startChat = (user) => {
        setSelectedUser(user);
        setShowNewChatModal(false);
        // Verificar se já existe na lista, se não, adicionar temporariamente
        const exists = conversas.find(c => c.usuario.id === user.id);
        if (!exists) {
            setConversas(prev => [{
                usuario: user,
                ultima_mensagem: null
            }, ...prev]);
        }
    };

    return (
        <div className="chat-view-container">
            {/* Sidebar */}
            <div className="chat-sidebar">
                <div className="chat-sidebar-header">
                    <button className="new-chat-btn" onClick={handleNewChat}>
                        <i className="fas fa-plus"></i> Nova Conversa
                    </button>
                </div>
                <div className="conversas-list">
                    {loading ? (
                        <div className="loading-spinner"><i className="fas fa-spinner fa-spin"></i></div>
                    ) : conversas.length === 0 ? (
                        <div className="no-conversas">Nenhuma conversa recente</div>
                    ) : (
                        conversas.map(c => (
                            <div
                                key={c.usuario.id}
                                className={`conversa-item ${selectedUser?.id === c.usuario.id ? 'active' : ''}`}
                                onClick={() => setSelectedUser(c.usuario)}
                            >
                                <div className="avatar">
                                    {c.usuario.foto_perfil && !c.usuario.foto_perfil.startsWith('custom') ? (
                                        <img src={c.usuario.foto_perfil} alt={c.usuario.nome_usuario} />
                                    ) : (
                                        <div className="avatar-placeholder">
                                            {c.usuario.nome_usuario?.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <div className="conversa-info">
                                    <div className="user-name">{c.usuario.nome_usuario || c.usuario.nome}</div>
                                    <div className="last-msg">
                                        {c.ultima_mensagem ? (
                                            c.ultima_mensagem.criador_id === currentUser?.id ? 'Você: ' : ''
                                        ) + (c.ultima_mensagem?.conteudo || 'Nova conversa') : 'Nova conversa'}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className="chat-main">
                {selectedUser ? (
                    <>
                        <div className="chat-header">
                            <div className="chat-header-user">
                                <h3>{selectedUser.nome_usuario || selectedUser.nome}</h3>
                            </div>
                        </div>
                        <div className="messages-list">
                            {loadingMessages ? (
                                <div className="loading-messages"><i className="fas fa-spinner fa-spin"></i></div>
                            ) : (
                                messages.map(msg => {
                                    const isMe = msg.criador_id === currentUser?.id;
                                    return (
                                        <div key={msg.id} className={`message-bubble ${isMe ? 'me' : 'other'}`}>
                                            <div className="message-content">{msg.conteudo}</div>
                                            <div className="message-time">
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                        <form className="chat-input-area" onSubmit={handleSendMessage}>
                            <input
                                type="text"
                                placeholder="Digite sua mensagem..."
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                            />
                            <button type="submit" disabled={!newMessage.trim()}>
                                <i className="fas fa-paper-plane"></i>
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="empty-chat-selection">
                        <i className="fas fa-comments"></i>
                        <h3>Selecione um chat para iniciar uma conversa</h3>
                    </div>
                )}
            </div>

            {/* Modal Nova Conversa */}
            {showNewChatModal && (
                <div className="modal-overlay" onClick={() => setShowNewChatModal(false)}>
                    <div className="modal-content users-list-modal" onClick={e => e.stopPropagation()}>
                        <h3>Nova Conversa</h3>
                        <div className="users-list">
                            {allUsers.map(user => (
                                <div key={user.id} className="user-select-item" onClick={() => startChat(user)}>
                                    <span>{user.nome_usuario || user.nome}</span>
                                </div>
                            ))}
                        </div>
                        <button className="close-modal-btn" onClick={() => setShowNewChatModal(false)}>Cancelar</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatView;
