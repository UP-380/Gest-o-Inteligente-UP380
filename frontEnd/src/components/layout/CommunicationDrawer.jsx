import React, { useState, useEffect, useRef, useCallback } from 'react';
import { comunicacaoAPI } from '../../services/comunicacao.service';
import { usuariosAPI, authAPI } from '../../services/api';
import { hasPermissionSync } from '../../utils/permissions';
import Avatar from '../user/Avatar';
import './CommunicationDrawer.css';

const CommunicationDrawer = ({ user }) => {
    const [isOpen, setIsOpen] = useState(false);
    const canSeeComm = user && hasPermissionSync(user.permissoes, '/comunicacao');
    const [activeTab, setActiveTab] = useState('chats'); // 'chats', 'comunicados', 'chamados'
    const [selectedChat, setSelectedChat] = useState(null);

    // Chat States
    const [conversas, setConversas] = useState([]);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loadingChats, setLoadingChats] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);

    // New Chat States
    const [showNewChatList, setShowNewChatList] = useState(false);
    const [allUsers, setAllUsers] = useState([]);
    const [userSearchText, setUserSearchText] = useState('');

    // Comunicados States
    const [comunicados, setComunicados] = useState([]);
    const [loadingComunicados, setLoadingComunicados] = useState(false);

    // Chamados States
    const [chamados, setChamados] = useState([]);
    const [loadingChamados, setLoadingChamados] = useState(false);
    const [selectedChamado, setSelectedChamado] = useState(null);
    const [chamadoMessages, setChamadoMessages] = useState([]);
    const [loadingChamadoMessages, setLoadingChamadoMessages] = useState(false);
    const [replyingToChamado, setReplyingToChamado] = useState(false);

    // Form States para Novos Itens
    const [showNewAvisoForm, setShowNewAvisoForm] = useState(false);
    const [showNewChamadoForm, setShowNewChamadoForm] = useState(false);
    const [formData, setFormData] = useState({ titulo: '', conteudo: '', destacado: false });
    const [isSaving, setIsSaving] = useState(false);

    const messagesEndRef = useRef(null);

    // Ouvir evento para abrir o drawer sem mudar de página
    useEffect(() => {
        const handleOpenDrawer = async (event) => {
            const { tab, interlocutorId } = event.detail || {};
            setIsOpen(true);
            if (tab) setActiveTab(tab);

            if (tab === 'chats' && interlocutorId) {
                // Tentar encontrar nas conversas já carregadas
                let targetUser = conversas.find(c => String(c.usuario.id) === String(interlocutorId))?.usuario;

                if (!targetUser) {
                    // Se não estiver no histórico, buscar na lista geral de usuários
                    try {
                        const response = await usuariosAPI.getAll();
                        if (response.success) {
                            targetUser = (response.data || []).find(u => String(u.id) === String(interlocutorId));
                        }
                    } catch (e) {
                        console.error('Erro ao buscar usuário para abrir chat:', e);
                    }
                }

                if (targetUser) {
                    handleSelectChat(targetUser);
                }
            }
        };

        window.addEventListener('open-communication-drawer', handleOpenDrawer);
        return () => window.removeEventListener('open-communication-drawer', handleOpenDrawer);
    }, [conversas]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (selectedChat) {
            scrollToBottom();
        }
    }, [messages]);

    const loadConversas = async () => {
        if (!user) return;
        setLoadingChats(true);
        try {
            const response = await comunicacaoAPI.listarConversasRecentes();
            if (response.success) {
                setConversas(response.data);
            }
        } catch (error) {
            console.error('Erro ao listar conversas:', error);
        } finally {
            setLoadingChats(false);
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

    const loadComunicados = async () => {
        setLoadingComunicados(true);
        try {
            const response = await comunicacaoAPI.listarComunicados();
            if (response.success) {
                setComunicados(response.data);
            }
        } catch (error) {
            console.error('Erro ao listar comunicados:', error);
        } finally {
            setLoadingComunicados(false);
        }
    };

    const loadChamados = async () => {
        setLoadingChamados(true);
        try {
            const response = await comunicacaoAPI.listarChamados();
            if (response.success) {
                setChamados(response.data);
            }
        } catch (error) {
            console.error('Erro ao listar chamados:', error);
        } finally {
            setLoadingChamados(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            if (activeTab === 'chats' && !selectedChat) loadConversas();
            if (activeTab === 'comunicados') loadComunicados();
            if (activeTab === 'chamados' && !selectedChamado) loadChamados();
        }
    }, [isOpen, activeTab, selectedChat, selectedChamado]);

    // Polling para mensagens se o chat estiver aberto
    useEffect(() => {
        let interval;
        if (isOpen && selectedChat) {
            interval = setInterval(() => loadMessages(selectedChat.id, true), 5000);
        }
        return () => clearInterval(interval);
    }, [isOpen, selectedChat]);

    const handleSelectChat = (chatUser) => {
        setSelectedChat(chatUser);
        setShowNewChatList(false);
        loadMessages(chatUser.id);
    };

    const handleNewChatClick = async () => {
        setShowNewChatList(true);
        if (allUsers.length === 0) {
            try {
                const response = await usuariosAPI.getAll();
                if (response.success) {
                    const filtered = (response.data || []).filter(u => u.id !== user?.id);
                    setAllUsers(filtered);
                }
            } catch (error) {
                console.error('Erro ao buscar usuários:', error);
            }
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedChat) return;

        try {
            const payload = {
                tipo: 'CHAT',
                destinatario_id: selectedChat.id,
                conteudo: newMessage
            };

            const response = await comunicacaoAPI.enviarMensagem(payload);
            if (response.success) {
                setNewMessage('');
                loadMessages(selectedChat.id, true);
                loadConversas();
            }
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
        }
    };

    const handleSelectChamado = async (chamado) => {
        setSelectedChamado(chamado);
        setLoadingChamadoMessages(true);
        try {
            const response = await comunicacaoAPI.listarRespostasChamado(chamado.id);
            if (response.success) {
                setChamadoMessages(response.data);
            }
        } catch (error) {
            console.error('Erro ao carregar mensagens do chamado:', error);
        } finally {
            setLoadingChamadoMessages(false);
        }
    };

    const handleSendChamadoReply = async (e) => {
        e.preventDefault();
        const content = newMessage.trim();
        if (!content || !selectedChamado) return;

        setReplyingToChamado(true);
        try {
            const response = await comunicacaoAPI.enviarMensagem({
                tipo: 'CHAMADO',
                conteudo: content,
                mensagem_pai_id: selectedChamado.id
            });

            if (response.success) {
                setNewMessage('');
                // Recarregar mensagens
                const resMsg = await comunicacaoAPI.listarRespostasChamado(selectedChamado.id);
                if (resMsg.success) setChamadoMessages(resMsg.data);
            }
        } catch (error) {
            console.error('Erro ao responder chamado:', error);
        } finally {
            setReplyingToChamado(false);
        }
    };

    const handleChangeChamadoStatus = async (newStatus) => {
        if (!selectedChamado) return;
        try {
            const response = await comunicacaoAPI.atualizarStatusChamado(selectedChamado.id, newStatus);
            if (response.success) {
                setSelectedChamado({ ...selectedChamado, status_chamado: newStatus });
                loadChamados();
            }
        } catch (error) {
            console.error('Erro ao atualizar status:', error);
        }
    };

    const handleCreateItem = async (tipo) => {
        if (!formData.titulo.trim() || !formData.conteudo.trim()) return;
        setIsSaving(true);
        try {
            const response = await comunicacaoAPI.enviarMensagem({
                tipo,
                titulo: formData.titulo,
                conteudo: formData.conteudo,
                metadata: tipo === 'COMUNICADO' ? {
                    destacado: formData.destacado
                } : {}
            });

            if (response.success) {
                setFormData({ titulo: '', conteudo: '', destacado: false });
                setShowNewAvisoForm(false);
                setShowNewChamadoForm(false);
                if (tipo === 'COMUNICADO') loadComunicados();
                if (tipo === 'CHAMADO') loadChamados();
            }
        } catch (error) {
            console.error(`Erro ao criar ${tipo}:`, error);
        } finally {
            setIsSaving(false);
        }
    };

    const filteredUsers = allUsers.filter(u =>
        (u.nome_usuario || u.nome || '').toLowerCase().includes(userSearchText.toLowerCase())
    );

    const renderChatList = () => (
        <div className="comm-list-view">
            <div className="comm-actions">
                <button className="new-chat-btn" onClick={handleNewChatClick}>
                    <i className="fas fa-plus"></i> Nova Conversa
                </button>
            </div>
            <div className="comm-list chats-list">
                {loadingChats ? (
                    <div className="comm-loading"><i className="fas fa-spinner fa-spin"></i></div>
                ) : (conversas || []).length === 0 ? (
                    <div className="comm-empty">Nenhuma conversa recente</div>
                ) : (
                    conversas.map(c => (
                        <div key={c.usuario.id} className="comm-item chat-item" onClick={() => handleSelectChat(c.usuario)}>
                            <div className="comm-item-avatar">
                                <Avatar
                                    avatarId={c.usuario.foto_perfil}
                                    nomeUsuario={c.usuario.nome_usuario || c.usuario.nome}
                                    size="normal"
                                />
                            </div>
                            <div className="comm-item-info">
                                <div className="comm-item-name">{c.usuario.nome_usuario || c.usuario.nome}</div>
                                <div className="comm-item-last-msg">
                                    {c.ultima_mensagem ? (
                                        c.ultima_mensagem.criador_id === user?.id ? 'Você: ' : ''
                                    ) + (c.ultima_mensagem?.conteudo || 'Nova conversa') : 'Nova conversa'}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    const renderNewChatList = () => (
        <div className="new-chat-view">
            <div className="chat-detail-header">
                <button className="back-btn" onClick={() => setShowNewChatList(false)}>
                    <i className="fas fa-arrow-left"></i>
                </button>
                <span className="chat-target-name">Nova Conversa</span>
            </div>
            <div className="comm-search-bar">
                <i className="fas fa-search"></i>
                <input
                    type="text"
                    placeholder="Buscar usuários..."
                    value={userSearchText}
                    onChange={(e) => setUserSearchText(e.target.value)}
                />
            </div>
            <div className="comm-list users-listing">
                {filteredUsers.map(u => (
                    <div key={u.id} className="comm-item user-select-item" onClick={() => handleSelectChat(u)}>
                        <div className="comm-item-avatar mini">
                            <Avatar
                                avatarId={u.foto_perfil}
                                nomeUsuario={u.nome_usuario || u.nome}
                                size="small"
                            />
                        </div>
                        <div className="comm-item-name">{u.nome_usuario || u.nome}</div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderChatDetail = () => (
        <div className="chat-detail-container">
            <div className="chat-detail-header">
                <button className="back-btn" onClick={() => setSelectedChat(null)}>
                    <i className="fas fa-arrow-left"></i>
                </button>
                <Avatar
                    avatarId={selectedChat.foto_perfil}
                    nomeUsuario={selectedChat.nome_usuario || selectedChat.nome}
                    size="small"
                />
                <span className="chat-target-name">{selectedChat.nome_usuario || selectedChat.nome}</span>
            </div>
            <div className="comm-messages-list">
                {loadingMessages ? (
                    <div className="comm-loading"><i className="fas fa-spinner fa-spin"></i></div>
                ) : (
                    messages.map(msg => {
                        const isMe = msg.criador_id === user?.id;
                        return (
                            <div key={msg.id} className={`comm-msg-bubble ${isMe ? 'me' : 'other'}`}>
                                <div className="msg-content">{msg.conteudo}</div>
                                <div className="msg-time">
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>
            <form className="comm-chat-input" onSubmit={handleSendMessage}>
                <input
                    type="text"
                    placeholder="Digite aqui..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                />
                <button type="submit" disabled={!newMessage.trim()}>
                    <i className="fas fa-paper-plane"></i>
                </button>
            </form>
        </div>
    );

    const renderComunicados = () => (
        <div className="comm-list-view">
            <div className="comm-actions">
                {(user?.permissoes === 'administrador' || hasPermissionSync(user?.permissoes, 'action/criar-avisos')) && (
                    <button className="new-chat-btn" onClick={() => setShowNewAvisoForm(true)}>
                        <i className="fas fa-bullhorn"></i> Criar Aviso
                    </button>
                )}
            </div>
            <div className="comm-list comunicados-list">
                {loadingComunicados ? (
                    <div className="comm-loading"><i className="fas fa-spinner fa-spin"></i></div>
                ) : (comunicados || []).length === 0 ? (
                    <div className="comm-empty">Nenhum comunicado</div>
                ) : (
                    comunicados.map(com => (
                        <div key={com.id} className="comm-card comunicado-card" style={{ cursor: 'default' }}>
                            <div className="comm-card-header">
                                <span className="author">
                                    <i className="fas fa-user-circle" style={{ marginRight: '5px', opacity: 0.5 }}></i>
                                    {com.criador?.nome_usuario}
                                </span>
                                <span className="date">{new Date(com.created_at).toLocaleDateString()}</span>
                            </div>

                            <h4 className="comm-card-title" style={{ fontSize: '15px', color: '#0e3b6f', marginBottom: '8px' }}>{com.titulo}</h4>
                            <p className="comm-card-content" style={{
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                fontSize: '13px',
                                color: '#475569',
                                lineHeight: '1.5'
                            }}>
                                {com.conteudo}
                            </p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    const renderChamados = () => (
        <div className="comm-list-view">
            <div className="comm-actions">
                <button className="new-chat-btn" onClick={() => setShowNewChamadoForm(true)}>
                    <i className="fas fa-headset"></i> Abrir Chamado
                </button>
            </div>
            <div className="comm-list chamados-list">
                {loadingChamados ? (
                    <div className="comm-loading"><i className="fas fa-spinner fa-spin"></i></div>
                ) : (chamados || []).length === 0 ? (
                    <div className="comm-empty">Nenhum chamado</div>
                ) : (
                    chamados.map(cham => (
                        <div key={cham.id} className="comm-card chamado-card" onClick={() => handleSelectChamado(cham)}>
                            <div className="chamado-status-tag" data-status={cham.status_chamado}>
                                {cham.status_chamado}
                            </div>
                            <h4 className="comm-card-title">{cham.titulo}</h4>
                            <p className="comm-card-content">{cham.conteudo}</p>
                            <div className="comm-card-footer">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span>Aberto por: <strong>{cham.criador?.nome_usuario || 'Usuário'}</strong></span>
                                    <span>{new Date(cham.created_at).toLocaleDateString()}</span>
                                </div>
                                <i className="fas fa-chevron-right" style={{ opacity: 0.3 }}></i>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    const renderChamadoDetail = () => (
        <div className="chat-detail-container">
            <div className="chat-detail-header">
                <button className="back-btn" onClick={() => setSelectedChamado(null)}>
                    <i className="fas fa-arrow-left"></i>
                </button>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="chat-target-name">{selectedChamado.titulo}</span>
                    <span style={{ fontSize: '11px', opacity: 0.7 }}>Aberto em {new Date(selectedChamado.created_at).toLocaleDateString()}</span>
                </div>
            </div>

            {(user?.permissoes === 'administrador' || user?.permissoes === 'gestor') && (
                <div className="chamado-status-selector" style={{ padding: '10px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '5px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', marginRight: '5px' }}>Status:</span>
                    {['ABERTO', 'EM_ANALISE', 'EM_PROCESSO', 'CONCLUIDO'].map(status => (
                        <button
                            key={status}
                            onClick={() => handleChangeChamadoStatus(status)}
                            style={{
                                padding: '4px 8px',
                                fontSize: '10px',
                                border: '1px solid #cbd5e1',
                                borderRadius: '4px',
                                backgroundColor: selectedChamado.status_chamado === status ? '#0e3b6f' : 'white',
                                color: selectedChamado.status_chamado === status ? 'white' : '#64748b',
                                cursor: 'pointer'
                            }}
                        >
                            {status.replace('_', ' ')}
                        </button>
                    ))}
                </div>
            )}

            <div className="comm-messages-list">
                {loadingChamadoMessages ? (
                    <div className="comm-loading"><i className="fas fa-spinner fa-spin"></i></div>
                ) : (
                    chamadoMessages.map(msg => {
                        const isMe = msg.criador_id === user?.id;
                        return (
                            <div key={msg.id} className={`comm-msg-bubble ${isMe ? 'me' : 'other'} chamado-msg`}>
                                <div className="msg-author" style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '2px', opacity: 0.7 }}>
                                    {msg.criador?.nome_usuario || 'Sistema'}
                                </div>
                                <div className="msg-content">{msg.conteudo}</div>
                                <div className="msg-time">
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {selectedChamado.status_chamado !== 'CONCLUIDO' ? (
                <form className="comm-chat-input" onSubmit={handleSendChamadoReply}>
                    <input
                        type="text"
                        placeholder="Responder chamado..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        disabled={replyingToChamado}
                    />
                    <button type="submit" disabled={!newMessage.trim() || replyingToChamado}>
                        <i className="fas fa-reply"></i>
                    </button>
                </form>
            ) : (
                <div style={{ padding: '15px', textAlign: 'center', backgroundColor: '#f1f5f9', fontSize: '12px', color: '#64748b' }}>
                    <i className="fas fa-lock"></i> Este chamado foi concluído e está fechado para novas respostas.
                </div>
            )}
        </div>
    );

    const renderNewItemForm = (tipo) => (
        <div className="chat-detail-container">
            <div className="chat-detail-header">
                <button className="back-btn" onClick={() => { setShowNewAvisoForm(false); setShowNewChamadoForm(false); }}>
                    <i className="fas fa-arrow-left"></i>
                </button>
                <span className="chat-target-name">{tipo === 'COMUNICADO' ? 'Novo Aviso' : 'Novo Chamado'}</span>
            </div>
            <div className="comm-form-body" style={{ padding: '20px' }}>
                <div style={{ marginBottom: '15px', color: '#64748b', fontSize: '12px' }}>
                    <i className="fas fa-info-circle"></i> Todos os campos marcados com * são obrigatórios.
                </div>
                <div className="form-group" style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Título *</label>
                    <input
                        type="text"
                        placeholder="Digite o título..."
                        value={formData.titulo}
                        onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    />
                </div>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Descrição *</label>
                    <textarea
                        placeholder="Digite o conteúdo..."
                        value={formData.conteudo}
                        onChange={(e) => setFormData({ ...formData, conteudo: e.target.value })}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', minHeight: '150px', resize: 'vertical' }}
                    />
                </div>
                {tipo === 'COMUNICADO' && (
                    <div className="form-group" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                            type="checkbox"
                            id="destacar-aviso"
                            checked={formData.destacado}
                            onChange={(e) => setFormData({ ...formData, destacado: e.target.checked })}
                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <label htmlFor="destacar-aviso" style={{ fontWeight: '600', color: '#0e3b6f', cursor: 'pointer' }}>
                            Destacar este aviso no topo do painel
                        </label>
                    </div>
                )}

                <button
                    className="btn-confirm"
                    onClick={() => handleCreateItem(tipo)}
                    disabled={isSaving || !formData.titulo.trim() || !formData.conteudo.trim()}
                    style={{
                        width: '100%',
                        padding: '12px',
                        backgroundColor: (isSaving || !formData.titulo.trim() || !formData.conteudo.trim()) ? '#cbd5e1' : '#0e3b6f',
                        color: 'white',
                        borderRadius: '8px',
                        border: 'none',
                        fontWeight: 'bold',
                        cursor: (isSaving || !formData.titulo.trim() || !formData.conteudo.trim()) ? 'not-allowed' : 'pointer'
                    }}
                >
                    {isSaving ? 'Salvando...' : (tipo === 'COMUNICADO' ? 'Publicar Aviso' : 'Abrir Chamado')}
                </button>
            </div>
        </div>
    );

    if (!canSeeComm) return null;

    return (
        <div className="comm-drawer-wrapper">
            <button className="comm-toggle-btn" onClick={() => setIsOpen(!isOpen)} title="Comunicação">
                <i className="fas fa-comments"></i>
                {/* Futuro: count de mensagens não lidas */}
            </button>

            {isOpen && <div className="comm-backdrop" onClick={() => setIsOpen(false)}></div>}

            <div className={`comm-drawer ${isOpen ? 'open' : ''}`}>
                <div className="comm-drawer-header">
                    <h3>Comunicação</h3>
                    <button className="close-btn" onClick={() => setIsOpen(false)}>&times;</button>
                </div>

                {!selectedChat && !showNewChatList && (
                    <div className="comm-tabs">
                        <button
                            className={`comm-tab-btn ${activeTab === 'chats' ? 'active' : ''}`}
                            onClick={() => setActiveTab('chats')}
                        >
                            <i className="fas fa-comment-dots"></i> Chats
                        </button>
                        <button
                            className={`comm-tab-btn ${activeTab === 'comunicados' ? 'active' : ''}`}
                            onClick={() => setActiveTab('comunicados')}
                        >
                            <i className="fas fa-bullhorn"></i> Avisos
                        </button>
                        <button
                            className={`comm-tab-btn ${activeTab === 'chamados' ? 'active' : ''}`}
                            onClick={() => setActiveTab('chamados')}
                        >
                            <i className="fas fa-headset"></i> Chamados
                        </button>
                    </div>
                )}

                <div className="comm-drawer-body">
                    {activeTab === 'chats' ? (
                        selectedChat ? renderChatDetail() : (showNewChatList ? renderNewChatList() : renderChatList())
                    ) : activeTab === 'comunicados' ? (
                        showNewAvisoForm ? renderNewItemForm('COMUNICADO') : renderComunicados()
                    ) : (
                        selectedChamado ? renderChamadoDetail() : (showNewChamadoForm ? renderNewItemForm('CHAMADO') : renderChamados())
                    )}
                </div>
            </div>
        </div>
    );
};

export default CommunicationDrawer;
