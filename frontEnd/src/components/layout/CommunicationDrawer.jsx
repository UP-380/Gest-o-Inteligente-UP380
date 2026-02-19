import React, { useState, useEffect, useRef, useCallback } from 'react';
import { comunicacaoAPI } from '../../services/comunicacao.service';
import { usuariosAPI, authAPI } from '../../services/api';
import { hasPermissionSync } from '../../utils/permissions';
import Avatar from '../user/Avatar';
import './CommunicationDrawer.css';

// ==============================================================================
// === HELPER: Markdown <-> HTML Converter for Rich Editor ===
// ==============================================================================

// Dentro do chat/aviso/chamado: exibe foto/vídeo de verdade

// Substitui imagem/vídeo por labels "(imagem)" e "(video)" sem exibir o link

const markdownToHtml = (text, isEditable = false) => {
    if (!text) return '';
    let html = text
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") // Sanitize
        .replace(/\n/g, '<br>'); // Lines

    if (isEditable) {
        // No editor, renderizamos com wrappers de remoção
        html = html
            .replace(/!\[(.*?)\]\((.*?)\)/g,
                '<span class="media-preview-wrapper" contenteditable="false">' +
                '<img src="$2" alt="$1" class="media-preview" />' +
                '<span class="media-remove-btn">&times;</span>' +
                '</span>')
            .replace(/\[video\]\((.*?)\)/g,
                '<span class="media-preview-wrapper" contenteditable="false">' +
                '<video src="$1" controls class="media-preview"></video>' +
                '<span class="media-remove-btn">&times;</span>' +
                '</span>');
    } else {
        html = html
            .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" class="media-preview" title="Clique para ampliar" />')
            .replace(/\[video\]\((.*?)\)/g, '<video src="$1" controls class="media-preview"></video>');
    }
    return html;
};


// Para previews/listas (fora do chat): troca por labels (imagem) (video)

// Para previews/listas: troca markdown de mídia por labels sem link

const conteudoParaPreview = (text) => {
    if (!text) return '';
    return String(text)
        .replace(/!\[(.*?)\]\((.*?)\)/g, '(imagem)')
        .replace(/\[video\]\((.*?)\)/g, '(video)');
};

const htmlToMarkdown = (html) => {
    if (!html) return '';
    // Create a temp div to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Remove remove buttons before parsing
    const removeBtns = temp.querySelectorAll('.media-remove-btn');
    removeBtns.forEach(btn => btn.remove());

    // Process images
    const images = temp.querySelectorAll('img');
    images.forEach(img => {
        const markdown = `![${img.alt || 'image'}](${img.src})`;
        img.replaceWith(document.createTextNode(markdown));
    });

    // Process videos
    const videos = temp.querySelectorAll('video');
    videos.forEach(vid => {
        const markdown = `[video](${vid.src})`;
        vid.replaceWith(document.createTextNode(markdown));
    });

    // Process media-label links (imagem)/(video) - converter de volta para markdown
    const mediaLinks = temp.querySelectorAll('a.media-label');
    mediaLinks.forEach(a => {
        const href = a.getAttribute('href') || '';
        const text = (a.textContent || '').trim();
        const markdown = text === '(video)' ? `[video](${href})` : `![imagem](${href})`;
        a.replaceWith(document.createTextNode(markdown));
    });

    // Process Line Breaks
    // Replace <br> and <div> with newlines
    let text = temp.innerHTML
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<div\s*>/gi, '\n')
        .replace(/<\/div>/gi, '')
        .replace(/<[^>]+>/g, ''); // Strip any remaining HTML tags (like the contentEditable wrappers)

    // Decode entities
    const decoder = document.createElement('textarea');
    decoder.innerHTML = text;
    return decoder.value;
};

const getPreviewText = (text) => {
    if (!text) return '';
    const cleaned = conteudoParaPreview(text).replace(/<br>/g, ' ');
    return cleaned.substring(0, 100) + (cleaned.length > 100 ? '...' : '');
};

const formatTime = (dateString) => {
    try {
        const date = dateString ? new Date(dateString) : new Date();
        // Check if date is valid
        if (isNaN(date.getTime())) return '';

        return date.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo'
        });
    } catch (e) {
        // Fallback to system time if timezone is not supported
        const date = dateString ? new Date(dateString) : new Date();
        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
};

const formatDate = (dateString) => {
    try {
        const date = dateString ? new Date(dateString) : new Date();
        if (isNaN(date.getTime())) return '';
        return date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    } catch (e) {
        const date = dateString ? new Date(dateString) : new Date();
        return date.toLocaleDateString('pt-BR');
    }
};

const getDateLabel = (dateString) => {
    try {
        const date = dateString ? new Date(dateString) : new Date();
        if (isNaN(date.getTime())) return '';

        const now = new Date();

        // Adjust to comparable date string ('YYYY-MM-DD') in 'America/Sao_Paulo'
        const getIsoDate = (d) => new Intl.DateTimeFormat('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Sao_Paulo' }).format(d);

        const dateIso = getIsoDate(date);
        const todayIso = getIsoDate(now);

        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayIso = getIsoDate(yesterday);

        if (dateIso === todayIso) return 'Hoje';
        if (dateIso === yesterdayIso) return 'Ontem';

        // Check if within 7 days
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 7) {
            // Get weekday
            const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'America/Sao_Paulo' });
            // Capitalize
            return weekday.charAt(0).toUpperCase() + weekday.slice(1);
        }

        return date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    } catch (e) {
        return '';
    }
};

// ==============================================================================
// === COMPONENT: Rich Editor (Teams-like) ===
// ==============================================================================
const RichEditor = ({ initialValue, onContentChange, placeholder, minHeight = '100px', autoFocus = false, showUploadIcon = true, onImageClick = null }) => {
    const editorRef = useRef(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (editorRef.current) {
            const currentMarkdown = htmlToMarkdown(editorRef.current.innerHTML);
            // Atualiza apenas se o markdown mudou externamente (ex: botão de anexo ou envio)
            if (currentMarkdown !== initialValue) {
                // Se o valor estiver vazio, limpamos
                if (initialValue === '') {
                    editorRef.current.innerHTML = '';
                } else {
                    // Renderizamos com modo editável para ter os botões de X
                    editorRef.current.innerHTML = markdownToHtml(initialValue, true);
                }
            }
        }
    }, [initialValue]);

    const handleInput = () => {
        if (editorRef.current) {
            const markdown = htmlToMarkdown(editorRef.current.innerHTML);
            onContentChange(markdown);
        }
    };

    const handleEditorClick = (e) => {
        if (e.target.classList.contains('media-remove-btn')) {
            e.stopPropagation();
            const wrapper = e.target.closest('.media-preview-wrapper');
            if (wrapper) {
                wrapper.remove();
                handleInput();
            }
        } else if (e.target.tagName === 'IMG' && onImageClick) {
            e.stopPropagation();
            onImageClick(e.target.src);
        }
    };

    const insertAtCursor = (element) => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        // Ensure we are inside the editor
        if (!editorRef.current.contains(range.commonAncestorContainer)) return;

        range.deleteContents();
        range.insertNode(element);
        range.collapse(false);
    };

    const handleUpload = async (file) => {
        if (!file) return;
        if (file.size > 50 * 1024 * 1024) return alert('Arquivo > 50MB');

        setUploading(true);

        // 1. Create Placeholder
        const id = 'loader-' + Date.now();
        const placeholderImg = document.createElement('img');
        placeholderImg.id = id;
        placeholderImg.src = 'https://cdnjs.cloudflare.com/ajax/libs/galleriffic/2.0.1/css/loader.gif'; // Generic loader or local asset
        placeholderImg.style.maxWidth = '30px';
        insertAtCursor(placeholderImg);

        try {
            const data = new FormData();
            data.append('file', file);
            const response = await comunicacaoAPI.uploadMedia(data);

            if (response.success) {
                const url = response.data.url;
                const isVideo = file.type.startsWith('video');

                // 2. Replace Placeholder
                const loader = document.getElementById(id);
                if (loader) {
                    // Create Wrapper
                    const wrapper = document.createElement('span');
                    wrapper.contentEditable = "false"; // Atomic element
                    wrapper.style.cssText = "position: relative; display: inline-block; margin: 5px 0; vertical-align: bottom;";

                    // Create Media
                    let media;
                    if (isVideo) {
                        media = document.createElement('video');
                        media.src = url;
                        media.controls = true;
                    } else {
                        media = document.createElement('img');
                        media.src = url;
                    }
                    media.style.cssText = "max-width: 100%; max-height: 300px; border-radius: 8px; display: block;";

                    // Create Remove Button
                    const btn = document.createElement('span');
                    btn.innerHTML = '&times;';
                    btn.className = 'media-remove-btn';
                    btn.contentEditable = "false";
                    btn.style.cssText = "position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.6); color: white; border-radius: 50%; width: 24px; height: 24px; text-align: center; line-height: 22px; cursor: pointer; font-weight: bold; font-size: 16px; z-index: 10; transition: background 0.2s;";

                    btn.onclick = (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        wrapper.remove();
                        // Trigger input event manually since we are outside React render flow
                        handleInput();
                    };

                    // Hover effect for button
                    btn.onmouseenter = () => btn.style.background = 'red';
                    btn.onmouseleave = () => btn.style.background = 'rgba(0,0,0,0.6)';

                    wrapper.appendChild(media);
                    wrapper.appendChild(btn);

                    loader.replaceWith(wrapper);

                    // Add a space after to allow typing
                    const space = document.createTextNode(' \u00A0');
                    wrapper.after(space);

                    // Fix cursor position
                    const selection = window.getSelection();
                    const range = document.createRange();
                    range.setStartAfter(wrapper);
                    range.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(range);
                    // Trigger change update
                    handleInput();
                }
            }
        } catch (error) {
            console.error('Upload fail', error);
            const loader = document.getElementById(id);
            if (loader) loader.remove();
            const msg = error?.message?.includes('502') || error?.message?.includes('Bad Gateway')
                ? 'Falha no upload (erro 502 - servidor). Tente novamente em instantes.'
                : 'Falha no upload. Verifique a conexão e tente novamente.';
            alert(msg);
        } finally {
            setUploading(false);
        }
    };

    const handlePaste = (e) => {
        const items = e.clipboardData.items;
        let hasFile = false;
        for (let i = 0; i < items.length; i++) {
            if (items[i].kind === 'file') {
                e.preventDefault();
                hasFile = true;
                const blob = items[i].getAsFile();
                if (blob) {
                    // Reconstruct file to ensure valid name and type for Multer
                    // Chrome pastes often have generic 'image.png' or empty names
                    const ext = blob.type.split('/')[1] || 'png';
                    const fileName = `pasted_image_${Date.now()}.${ext}`;
                    const file = new File([blob], fileName, { type: blob.type || 'image/png' });
                    handleUpload(file);
                }
            }
        }
        // If not file, let normal paste happen (text)
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleUpload(files[0]);
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleUpload(e.target.files[0]);
            e.target.value = ''; // Reset input
        }
    };

    const fileInputRef = useRef(null);

    return (
        <div
            className="rich-editor-wrapper"
            style={{
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                backgroundColor: 'white',
                cursor: 'text',
                position: 'relative',
                width: '100%'
            }}
            onClick={() => editorRef.current?.focus()}
        >
            <div
                ref={editorRef}
                contentEditable={true}
                onInput={handleInput}
                onClick={handleEditorClick}
                onPaste={handlePaste}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                style={{
                    minHeight: minHeight,
                    padding: '12px',
                    outline: 'none',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    color: 'black'
                }}
            />
            {(!editorRef.current?.innerText && !editorRef.current?.innerHTML && placeholder) && (
                <div style={{ position: 'absolute', top: '12px', left: '12px', color: '#94a3b8', pointerEvents: 'none' }}>
                    {placeholder}
                </div>
            )}
            {uploading && (
                <div style={{ position: 'absolute', top: '5px', right: '5px' }}>
                    <i className="fas fa-spinner fa-spin" style={{ color: '#0e3b6f' }}></i>
                </div>
            )}
            {showUploadIcon && (
                <div
                    style={{
                        position: 'absolute',
                        right: '10px',
                        bottom: '10px',
                        opacity: 0.5,
                        cursor: 'pointer',
                        fontSize: '1.2rem',
                        color: '#64748b',
                        zIndex: 5
                    }}
                    title="Anexar imagem/vídeo"
                    onClick={() => fileInputRef.current?.click()}
                    onMouseEnter={(e) => e.target.style.opacity = 1}
                    onMouseLeave={(e) => e.target.style.opacity = 0.5}
                >
                    <i className="fas fa-folder-open"></i>
                </div>
            )}
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
                accept="image/*,video/*"
            />
        </div>
    );
};

// Main Component
const CommunicationDrawer = ({ user }) => {
    const [isOpen, setIsOpen] = useState(false);
    const canSeeComm = user && hasPermissionSync(user.permissoes, '/comunicacao');
    const [activeTab, setActiveTab] = useState('chats'); // 'chats', 'comunicados', 'chamados'
    const [selectedChat, setSelectedChat] = useState(null);
    const [expandedImage, setExpandedImage] = useState(null);

    const handleImageClick = (e) => {
        if (e.target.tagName === 'IMG') {
            e.stopPropagation(); // Prevent bubble click
            setExpandedImage(e.target.src);
        }
    };

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
    const [formData, setFormData] = useState({ titulo: '', conteudo: '', destacado: false, categoria: '' });
    const [isSaving, setIsSaving] = useState(false);

    const OPERADORES_POR_CATEGORIA = {
        'Hardware': 'Carlos Ferreira',
        'Software': 'Ana Clara',
        'Rede': 'Roberto Mendes',
        'Acesso': 'Fernanda Lima',
        'Outros': 'Suporte Geral'
    };

    // Edit & Upload States
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editContent, setEditContent] = useState('');
    const [uploading, setUploading] = useState(false);
    const drawerFileInputRef = useRef(null);
    // Para identificar onde inserir a mídia (novo chamado, resposta ou edição)
    const [uploadTarget, setUploadTarget] = useState(null); // 'NEW_CHAMADO', 'REPLY', 'EDIT_MSG'

    const messagesEndRef = useRef(null);

    // Informar estado do drawer para outros componentes (ex.: não mostrar popup se chat já aberto)
    useEffect(() => {
        const payload = {
            isOpen,
            tab: activeTab,
            interlocutorId: selectedChat?.id != null ? String(selectedChat.id) : null,
            chamadoId: selectedChamado?.id != null ? String(selectedChamado.id) : null
        };
        window.dispatchEvent(new CustomEvent('communication-drawer-state', { detail: payload }));
    }, [isOpen, activeTab, selectedChat?.id, selectedChamado?.id]);

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
                const list = response.data || [];
                setMessages(list);
                // Marcar como lidas as mensagens que o outro enviou (quem está vendo é o usuário atual)
                const msgsDoOutro = list.filter(m => Number(m.criador_id) !== Number(user?.id));
                msgsDoOutro.forEach((m) => {
                    comunicacaoAPI.marcarMensagemLida(m.id).catch(() => { });
                });
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

    // Polling para mensagens e status "visto" quando o chat estiver aberto
    useEffect(() => {
        let interval;
        if (isOpen && selectedChat) {
            interval = setInterval(() => loadMessages(selectedChat.id, true), 2500);
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
            console.log('[CHAT] Enviando mensagem para destinatario_id:', selectedChat.id, 'payload:', payload);

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

    // Upload Handler
    const handleUploadFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validar tamanho (50MB)
        if (file.size > 50 * 1024 * 1024) {
            alert('Arquivo muito grande (Max 50MB).');
            return;
        }

        setUploading(true);
        const data = new FormData();
        data.append('file', file);

        try {
            const response = await comunicacaoAPI.uploadMedia(data);
            if (response.success) {
                const url = response.data.url;
                const isVideo = file.type.startsWith('video');
                const markdown = isVideo ? `\n[video](${url})\n` : `\n![imagem](${url})\n`;

                if (uploadTarget === 'NEW_CHAMADO') {
                    setFormData(prev => ({ ...prev, conteudo: prev.conteudo + markdown }));
                } else if (uploadTarget === 'REPLY') {
                    setNewMessage(prev => prev + markdown);
                } else if (uploadTarget === 'EDIT') {
                    setEditContent(prev => prev + markdown);
                }
            }
        } catch (error) {
            console.error('Erro no upload:', error);
            const msg = error?.message?.includes('502') || error?.message?.includes('Bad Gateway')
                ? 'Falha no upload (erro 502 - servidor). Tente novamente em instantes.'
                : 'Erro ao enviar arquivo. Verifique a conexão e tente novamente.';
            alert(msg);
        } finally {
            setUploading(false);
            if (drawerFileInputRef.current) drawerFileInputRef.current.value = '';
        }
    };

    const triggerUpload = (target) => {
        console.log('[Drawer] triggerUpload target:', target);
        setUploadTarget(target);
        if (drawerFileInputRef.current) {
            console.log('[Drawer] Clicking hidden input');
            drawerFileInputRef.current.click();
        } else {
            console.warn('[Drawer] drawerFileInputRef.current is NULL');
        }
    };

    // Edit Handlers
    const handleStartEdit = (msg) => {
        setEditingMessageId(msg.id);
        setEditContent(msg.conteudo);
    };

    const handleCancelEdit = () => {
        setEditingMessageId(null);
        setEditContent('');
    };

    const handleSaveEdit = async (msgId) => {
        if (!editContent.trim()) return; // Não permitir vazio (ou permitir para "deletar" conteudo? Melhor não)

        try {
            const response = await comunicacaoAPI.atualizarMensagem(msgId, { conteudo: editContent });
            if (response.success) {
                // Atualizar lista local
                setChamadoMessages(prev => prev.map(m => m.id === msgId ? { ...m, conteudo: editContent } : m));
                handleCancelEdit();
            }
        } catch (error) {
            console.error('Erro ao salvar edição:', error);
            alert('Erro ao salvar alterações.');
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
                } : (tipo === 'CHAMADO' ? {
                    categoria: formData.categoria
                } : {})
            });

            if (response.success) {
                setFormData({ titulo: '', conteudo: '', destacado: false, categoria: '' });
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
                            <div className="comm-item-avatar-wrapper">
                                <div className="comm-item-avatar">
                                    <Avatar
                                        avatarId={c.usuario.foto_perfil}
                                        nomeUsuario={c.usuario.nome_usuario || c.usuario.nome}
                                        size="normal"
                                    />
                                </div>
                                {(c.nao_lidas_count || 0) > 0 && (
                                    <span className="chat-unread-badge" aria-label={`${c.nao_lidas_count} não lidas`}>
                                        {c.nao_lidas_count > 99 ? '99+' : c.nao_lidas_count}
                                    </span>
                                )}
                            </div>
                            <div className="comm-item-info">
                                <div className="comm-item-name">{c.usuario.nome_usuario || c.usuario.nome}</div>
                                <div className="comm-item-last-msg">
                                    {c.ultima_mensagem ? (
                                        c.ultima_mensagem.criador_id === user?.id ? 'Você: ' : ''
                                    ) + conteudoParaPreview(c.ultima_mensagem?.conteudo || 'Nova conversa') : 'Nova conversa'}
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
                    (() => {
                        let lastDateLabel = null;
                        return messages.map(msg => {
                            const isMe = msg.criador_id === user?.id;
                            const currentDateLabel = getDateLabel(msg.created_at);
                            const showDateSeparator = currentDateLabel !== lastDateLabel;
                            if (showDateSeparator) lastDateLabel = currentDateLabel;

                            return (
                                <React.Fragment key={msg.id}>
                                    {showDateSeparator && (
                                        <div className="chat-date-separator" style={{ textAlign: 'center', margin: '15px 0', position: 'relative' }}>
                                            <span style={{
                                                backgroundColor: '#e1f5fe',
                                                color: '#0e3b6f',
                                                fontSize: '11px',
                                                padding: '4px 12px',
                                                borderRadius: '12px',
                                                fontWeight: '600',
                                                display: 'inline-block'
                                            }}>
                                                {currentDateLabel}
                                            </span>
                                        </div>
                                    )}
                                    <div className={`comm-msg-bubble ${isMe ? 'me' : 'other'}`}>
                                        <div className="msg-content" onClick={handleImageClick} style={{ color: 'inherit', cursor: 'pointer' }} dangerouslySetInnerHTML={{ __html: markdownToHtml(msg.conteudo) }} />
                                        <div className="msg-time msg-time-with-receipt">
                                            {formatTime(msg.created_at)}
                                            {isMe && (
                                                <span className="msg-read-receipt" title={msg.lida_por_destinatario === true || msg.lida_por_destinatario === 'true' ? 'Visto' : 'Enviado'}>
                                                    {msg.lida_por_destinatario === true || msg.lida_por_destinatario === 'true' ? (
                                                        <i className="fas fa-check-double msg-read" aria-hidden></i>
                                                    ) : (
                                                        <i className="fas fa-check msg-sent" aria-hidden></i>
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        });
                    })()
                )}
                <div ref={messagesEndRef} />
            </div>
            <form className="comm-chat-input" onSubmit={handleSendMessage} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1, border: '1px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
                        <RichEditor
                            initialValue={newMessage}
                            onContentChange={setNewMessage}
                            placeholder="Digite aqui... Cole imagens ou vídeos"
                            minHeight="40px"
                            onImageClick={setExpandedImage}
                        />
                    </div>
                    <button type="submit" disabled={!newMessage.trim()} style={{ height: '40px', alignSelf: 'flex-end', marginBottom: '1px' }}>
                        <i className="fas fa-paper-plane"></i>
                    </button>
                </div>
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
                                <span className="date">{formatDate(com.created_at)}</span>
                            </div>

                            <h4 className="comm-card-title" style={{ fontSize: '15px', color: '#0e3b6f', marginBottom: '8px' }}>{com.titulo}</h4>
                            <div
                                className="comm-card-content"
                                onClick={handleImageClick}
                                style={{
                                    fontSize: '13px',
                                    color: '#475569',
                                    lineHeight: '1.5',
                                    cursor: 'pointer'
                                }}
                                dangerouslySetInnerHTML={{ __html: markdownToHtml(com.conteudo) }}
                            />
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
                            <p className="comm-card-content">{getPreviewText(cham.conteudo)}</p>
                            <div className="comm-card-footer">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span>Aberto por: <strong>{cham.criador?.nome_usuario || 'Usuário'}</strong></span>
                                    <span>{formatDate(cham.created_at)}</span>
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
                    <span style={{ fontSize: '11px', opacity: 0.7 }}>Aberto em {formatDate(selectedChamado.created_at)}</span>
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
                    chamadoMessages.map((msg, index) => {
                        const isMe = msg.criador_id === user?.id;
                        const isEditing = editingMessageId === msg.id;

                        // Date Separator Logic
                        const prevMsg = index > 0 ? chamadoMessages[index - 1] : null;
                        const currentDateLabel = getDateLabel(msg.created_at);
                        const prevDateLabel = prevMsg ? getDateLabel(prevMsg.created_at) : null;
                        const showDateSeparator = currentDateLabel !== prevDateLabel;

                        {/* Rich Editor for Editing */ }
                        if (isEditing) {
                            return (
                                <React.Fragment key={msg.id}>
                                    {showDateSeparator && (
                                        <div className="chat-date-separator" style={{ textAlign: 'center', margin: '15px 0', position: 'relative' }}>
                                            <span style={{
                                                backgroundColor: '#e1f5fe',
                                                color: '#0e3b6f',
                                                fontSize: '11px',
                                                padding: '4px 12px',
                                                borderRadius: '12px',
                                                fontWeight: '600',
                                                display: 'inline-block'
                                            }}>
                                                {currentDateLabel}
                                            </span>
                                        </div>
                                    )}
                                    <div className={`comm-msg-bubble ${isMe ? 'me' : 'other'} intellisense-edit-mode`} style={{ width: '90%', maxWidth: 'none', flexDirection: 'column' }}>
                                        <div style={{ marginBottom: '5px', fontWeight: 'bold', fontSize: '12px' }}>Editando mensagem...</div>
                                        <RichEditor
                                            initialValue={editContent}
                                            onContentChange={setEditContent}
                                            placeholder="Digite sua mensagem..."
                                            minHeight="80px"
                                            showUploadIcon={true}
                                            onImageClick={setExpandedImage}
                                        />
                                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end', marginTop: '5px' }}>
                                            <button onClick={handleCancelEdit} style={{ padding: '4px 8px', background: 'transparent', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
                                            <button onClick={() => handleSaveEdit(msg.id)} style={{ padding: '4px 8px', background: '#0e3b6f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Salvar</button>
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        }

                        return (
                            <React.Fragment key={msg.id}>
                                {showDateSeparator && (
                                    <div className="chat-date-separator" style={{ textAlign: 'center', margin: '15px 0', position: 'relative' }}>
                                        <span style={{
                                            backgroundColor: '#e1f5fe',
                                            color: '#0e3b6f',
                                            fontSize: '11px',
                                            padding: '4px 12px',
                                            borderRadius: '12px',
                                            fontWeight: '600',
                                            display: 'inline-block'
                                        }}>
                                            {currentDateLabel}
                                        </span>
                                    </div>
                                )}
                                <div className={`comm-msg-bubble ${isMe ? 'me' : 'other'} chamado-msg`} style={{ position: 'relative' }}>
                                    {isMe && (
                                        <div className="msg-actions" style={{ position: 'absolute', top: '5px', right: '5px', opacity: 0.5, cursor: 'pointer', zIndex: 10 }}>
                                            <i className="fas fa-pencil-alt" title="Editar" onClick={() => handleStartEdit(msg)} style={{ fontSize: '10px' }}></i>
                                        </div>
                                    )}
                                    <div className="msg-author" style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '2px', opacity: 0.7 }}>
                                        {msg.criador?.nome_usuario || 'Sistema'}
                                    </div>
                                    <div className="msg-content" onClick={handleImageClick} style={{ cursor: 'pointer' }}>
                                        {/* Use formatMessageContent only for viewing, RichEditor handles raw HTML internally but outputs Markdown */}
                                        <div dangerouslySetInnerHTML={{ __html: markdownToHtml(msg.conteudo) }} />
                                    </div>
                                    <div className="msg-time">
                                        {formatTime(msg.created_at)}
                                    </div>
                                </div>
                            </React.Fragment>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {selectedChamado.status_chamado !== 'CONCLUIDO' ? (
                <form className="comm-chat-input" onSubmit={handleSendChamadoReply} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input
                            type="text"
                            placeholder="Responder chamado..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            disabled={replyingToChamado}
                            style={{ flex: 1 }}
                        />
                        <button type="button" onClick={() => triggerUpload('REPLY')} disabled={uploading}>
                            <i className={`fas ${uploading ? 'fa-spinner fa-spin' : 'fa-paperclip'}`}></i>
                        </button>
                        <button type="submit" disabled={!newMessage.trim() || replyingToChamado}>
                            <i className="fas fa-paper-plane"></i>
                        </button>
                    </div>
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

                {tipo === 'CHAMADO' && (
                    <div className="form-group" style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Categoria *</label>
                        <select
                            value={formData.categoria}
                            onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: 'white' }}
                        >
                            <option value="">Selecione uma categoria</option>
                            {Object.keys(OPERADORES_POR_CATEGORIA).map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                        {formData.categoria && (
                            <small style={{
                                display: 'block',
                                fontSize: '0.85rem',
                                fontStyle: 'italic',
                                color: '#0e3b6f',
                                marginTop: '5px'
                            }}>
                                Responsável: {OPERADORES_POR_CATEGORIA[formData.categoria]}
                            </small>
                        )}
                    </div>
                )}

                {(tipo === 'COMUNICADO' || formData.categoria) && (
                    <>
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
                            <RichEditor
                                initialValue={formData.conteudo}
                                onContentChange={(val) => setFormData({ ...formData, conteudo: val })}
                                placeholder={tipo === 'COMUNICADO' ? "Digite o aviso..." : "Descreva o chamado..."}
                                minHeight="150px"
                                showUploadIcon={false}
                                onImageClick={setExpandedImage}
                            />
                            {tipo === 'CHAMADO' && (
                                <button
                                    type="button"
                                    className="attach-file-btn"
                                    style={{
                                        width: '100%',
                                        padding: '14px',
                                        border: 'none',
                                        backgroundImage: `url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='8' ry='8' stroke='%230e3b6f' stroke-width='2.5' stroke-dasharray='1, 12' stroke-dashoffset='0' stroke-linecap='round'/%3e%3c/svg%3e")`,
                                        backgroundColor: '#f8fafc',
                                        color: '#0e3b6f',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        marginTop: '10px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        fontWeight: '600',
                                        transition: 'all 0.2s'
                                    }}
                                    onClick={() => triggerUpload('NEW_CHAMADO')}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = '#eff6ff';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = '#f8fafc';
                                    }}
                                >
                                    <i className="fas fa-paperclip"></i> Anexar arquivo
                                </button>
                            )}
                        </div>
                    </>
                )}
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
                        backgroundColor: (isSaving || !formData.titulo.trim() || !formData.conteudo.trim() || (tipo === 'CHAMADO' && !formData.categoria)) ? '#cbd5e1' : '#0e3b6f',
                        color: 'white',
                        borderRadius: '8px',
                        border: 'none',
                        fontWeight: 'bold',
                        cursor: (isSaving || !formData.titulo.trim() || !formData.conteudo.trim() || (tipo === 'CHAMADO' && !formData.categoria)) ? 'not-allowed' : 'pointer'
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

            {/* Lightbox for Images */}
            {expandedImage && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.9)',
                        zIndex: 99999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px'
                    }}
                    onClick={() => setExpandedImage(null)}
                >
                    <button
                        style={{
                            position: 'absolute',
                            top: '20px',
                            right: '20px',
                            background: 'transparent',
                            border: 'none',
                            color: 'white',
                            fontSize: '30px',
                            cursor: 'pointer'
                        }}
                        onClick={() => setExpandedImage(null)}
                    >
                        &times;
                    </button>
                    <img
                        src={expandedImage}
                        alt="Expanded"
                        style={{
                            maxWidth: '90%',
                            maxHeight: '90%',
                            objectFit: 'contain',
                            borderRadius: '4px',
                            boxShadow: '0 0 20px rgba(0,0,0,0.5)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            {/* Hidden Input for Global Uploads (Chamados/Avisos/Respostas) */}
            <input
                type="file"
                ref={drawerFileInputRef}
                style={{ display: 'none' }}
                onChange={handleUploadFile}
                accept="image/*,video/*"
            />
        </div>
    );
};

export default CommunicationDrawer;
